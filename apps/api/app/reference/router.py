from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.locale import name_column
from app.merchant.schemas import Reference, ReferenceItem
from app.reference.models import Category, City, Color

router = APIRouter(tags=["reference"])


@router.get("/reference")
async def get_reference(db: Annotated[AsyncSession, Depends(get_session)]) -> Reference:
    """Allowed values for forms: cities, categories and colours."""

    async def items(model, order) -> list[ReferenceItem]:
        rows = await db.execute(select(model.code, name_column(model)).order_by(order))
        return [ReferenceItem(code=code, name=name) for code, name in rows]

    return Reference(
        cities=await items(City, name_column(City)),
        categories=await items(Category, Category.position),
        colors=await items(Color, name_column(Color)),
    )
