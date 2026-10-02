"""Create an administrator account, or make an existing account an administrator.

    python -m app.create_admin admin@example.com

The password is asked for interactively, so it never ends up in the shell history.
"""

import asyncio
import getpass
import sys

from sqlalchemy import select

from app import models  # noqa: F401
from app.accounts.models import User
from app.accounts.security import hash_password
from app.database import SessionLocal, engine


async def create_admin(email: str, password: str | None) -> None:
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, password_hash=hash_password(password), name="Администратор")
            db.add(user)
        user.is_admin = True
        await db.commit()
    await engine.dispose()
    print(f"{email} is now an administrator")


async def exists(email: str) -> bool:
    async with SessionLocal() as db:
        return await db.scalar(select(User.id).where(User.email == email)) is not None


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    email = sys.argv[1].strip().lower()
    password = None
    if not asyncio.run(exists(email)):
        password = getpass.getpass("Password for the new account (min 8 characters): ")
        if len(password) < 8:
            print("The password is too short")
            return 1
    asyncio.run(create_admin(email, password))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
