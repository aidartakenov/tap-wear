"""Helpers that exist only in local development. Never registered elsewhere."""

from fastapi import APIRouter
from pydantic import BaseModel

from app import mailer

router = APIRouter(prefix="/dev", tags=["development"])


class OutboxEmail(BaseModel):
    to: str
    subject: str
    body: str


@router.get("/outbox")
async def outbox() -> list[OutboxEmail]:
    """Emails "sent" by the console backend, newest first, so links can be opened locally."""
    return [
        OutboxEmail(to=item.to, subject=item.subject, body=item.body)
        for item in reversed(mailer.outbox)
    ]
