"""A read-only view of the database for the administrator.

Lists the application's tables with their row counts and sizes, and shows the
rows of one table page by page. Nothing here can change data. Table and column
names are taken from the models, never from the request, and columns that hold
credentials are never sent.
"""

import uuid
from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import String, Table, Text, cast, func, or_, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.deps import AdminUser
from app.catalog.queries import escape_like
from app.database import Base, get_session
from app.errors import ApiError, not_found

router = APIRouter(prefix="/admin/database", tags=["admin"])

Db = Annotated[AsyncSession, Depends(get_session)]

# Password and token material. The values are replaced with a placeholder.
SECRET_COLUMNS = {"password_hash", "token_hash", "csrf_token"}
HIDDEN = "•••"
# Long texts are cut, so one row never floods the page.
MAX_TEXT = 300
PAGE_LIMIT = 100


class TableInfo(BaseModel):
    name: str
    rows: int
    size_bytes: int


class DatabaseOverview(BaseModel):
    database: str
    version: str
    size_bytes: int
    connections: int
    tables: list[TableInfo]


class ColumnInfo(BaseModel):
    name: str
    type: str
    primary_key: bool
    nullable: bool


class TableRows(BaseModel):
    name: str
    columns: list[ColumnInfo]
    rows: list[list[Any]]
    total: int
    sort: str
    descending: bool


def tables() -> dict[str, Table]:
    return dict(Base.metadata.tables)


def presentable(column: str, value: Any) -> Any:
    """A value as JSON: secrets hidden, long texts cut, special types as text."""
    if value is None:
        return None
    if column in SECRET_COLUMNS:
        return HIDDEN
    if isinstance(value, bool | int | float):
        return value
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, list | tuple):
        return [presentable(column, item) for item in value]
    shown = str(value)
    return shown if len(shown) <= MAX_TEXT else shown[:MAX_TEXT] + "…"


@router.get("")
async def overview(_: AdminUser, db: Db) -> DatabaseOverview:
    info = (
        await db.execute(
            text(
                "SELECT current_database(), current_setting('server_version'), "
                "pg_database_size(current_database()), "
                "(SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())"
            )
        )
    ).one()
    listed = []
    for name, table in sorted(tables().items()):
        rows = await db.scalar(select(func.count()).select_from(table))
        # The name comes from the models, so it is safe to pass as a parameter.
        size = await db.scalar(
            text("SELECT pg_total_relation_size(to_regclass(:name))"), {"name": name}
        )
        listed.append(TableInfo(name=name, rows=rows or 0, size_bytes=size or 0))
    return DatabaseOverview(
        database=info[0],
        version=info[1].split()[0],
        size_bytes=info[2],
        connections=info[3],
        tables=listed,
    )


@router.get("/tables/{name}")
async def table_rows(
    name: str,
    _: AdminUser,
    db: Db,
    limit: Annotated[int, Query(ge=1, le=PAGE_LIMIT)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    sort: str | None = None,
    descending: bool = True,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> TableRows:
    table = tables().get(name)
    if table is None:
        raise not_found("Table not found")
    columns = list(table.columns)

    if sort is None:
        # Newest first where rows are dated; otherwise by the key.
        sort = "created_at" if "created_at" in table.columns else columns[0].name
    if sort not in table.columns or sort in SECRET_COLUMNS:
        raise ApiError(422, "validation_error", "Unknown column to sort by")
    order = table.columns[sort].desc() if descending else table.columns[sort].asc()

    query = select(table)
    if q and q.strip():
        pattern = f"%{escape_like(q.strip())}%"
        searchable = [
            column
            for column in columns
            if column.name not in SECRET_COLUMNS
            and (column.primary_key or isinstance(column.type, String | Text))
        ]
        query = query.where(or_(*(cast(column, Text).ilike(pattern) for column in searchable)))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    result = await db.execute(query.order_by(order).limit(limit).offset(offset))
    return TableRows(
        name=name,
        columns=[
            ColumnInfo(
                name=column.name,
                # The type as PostgreSQL names it (UUID, VARCHAR(200), TIMESTAMP…).
                type=column.type.compile(dialect=postgresql.dialect()),
                primary_key=column.primary_key,
                nullable=bool(column.nullable),
            )
            for column in columns
        ],
        rows=[
            [presentable(column.name, value) for column, value in zip(columns, row, strict=True)]
            for row in result
        ],
        total=total or 0,
        sort=sort,
        descending=descending,
    )
