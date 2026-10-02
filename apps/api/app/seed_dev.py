"""Create local test accounts: one administrator and one seller.

    python -m app.seed_dev

Emails and passwords come from DEV_* variables in apps/api/.env (see .env.example).
Runs only when ENVIRONMENT is "local", so it can never create accounts with
known passwords on a real server.
"""

import asyncio
from datetime import UTC, datetime

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import select

from app import models  # noqa: F401
from app.accounts.models import User
from app.accounts.security import hash_password
from app.config import ENV_FILE, get_settings
from app.database import SessionLocal, engine


class DevAccounts(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    dev_admin_email: str
    dev_admin_password: str
    dev_seller_email: str
    dev_seller_password: str


async def seed() -> None:
    accounts = DevAccounts()
    wanted = [
        (accounts.dev_admin_email, accounts.dev_admin_password, "Администратор", True),
        (accounts.dev_seller_email, accounts.dev_seller_password, "Тестовый продавец", False),
    ]
    async with SessionLocal() as db:
        for email, password, name, is_admin in wanted:
            email = email.lower()
            user = await db.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(email=email, name=name, password_hash=hash_password(password))
                db.add(user)
            else:
                user.password_hash = hash_password(password)
            user.is_admin = is_admin
            # Test accounts skip the confirmation email.
            user.email_verified_at = user.email_verified_at or datetime.now(UTC)
            user.failed_logins = 0
            user.locked_until = None
            print(f"{'admin ' if is_admin else 'seller'} {email}")
        await db.commit()
    await engine.dispose()


if __name__ == "__main__":
    if get_settings().environment != "local":
        raise SystemExit("Refusing to create test accounts outside the local environment")
    asyncio.run(seed())
