from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_session

router = APIRouter(tags=["health"])


class Health(BaseModel):
    status: Literal["ok"]
    environment: str


class Readiness(BaseModel):
    status: Literal["ready", "unavailable"]
    database: bool
    pgvector: bool


@router.get("/health")
async def health() -> Health:
    """Liveness: the process is up. Does not touch the database."""
    return Health(status="ok", environment=get_settings().environment)


@router.get("/health/ready")
async def ready(response: Response, session: AsyncSession = Depends(get_session)) -> Readiness:
    """Readiness: the database answers and the pgvector extension is installed."""
    database = pgvector = False
    try:
        result = await session.execute(
            text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
        )
        database = True
        pgvector = bool(result.scalar())
    except (SQLAlchemyError, OSError):
        pass

    if not (database and pgvector):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return Readiness(status="unavailable", database=database, pgvector=pgvector)
    return Readiness(status="ready", database=True, pgvector=True)
