import asyncio
import itertools
import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

# Tests run against a separate database on the same server as development, so
# they can never touch development data. Settings are read at import time, so
# the variables must be set before the app is imported.
TEST_DATABASE = "tapwear_test"
dotenv = dotenv_values(Path(__file__).resolve().parent.parent / ".env")
configured = (
    os.environ.get("DATABASE_URL")
    or dotenv.get("DATABASE_URL")
    or "postgresql+asyncpg://tapwear:tapwear_password@localhost:5432/tapwear_db"
)
development_url = make_url(configured)
test_url = development_url.set(database=TEST_DATABASE)

os.environ["DATABASE_URL"] = test_url.render_as_string(hide_password=False)
# Uploaded test photos go to their own bucket, never the development one.
os.environ["MINIO_BUCKET_ASSETS"] = "tapwear-test-assets"
# Every test request comes from one address; limits are switched on only where tested.
os.environ["RATE_LIMIT_ENABLED"] = "false"
if not dotenv.get("MINIO_ACCESS_KEY"):
    os.environ.setdefault("MINIO_ACCESS_KEY", "test")
    os.environ.setdefault("MINIO_SECRET_KEY", "test")

from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402, F401
from app.accounts.models import User  # noqa: E402
from app.accounts.security import hash_password  # noqa: E402
from app.catalog.models import (  # noqa: E402
    Availability,
    Product,
    ProductImage,
    ProductStatus,
    ProductVariant,
)
from app.database import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.reference.models import Category, City, Color  # noqa: E402
from app.stores.models import Store, StoreStatus  # noqa: E402

SOM = 100  # minor units in one som
PASSWORD = "correct horse battery"
ADMIN_EMAIL = "admin@tapwear.test"
POSITIONS = itertools.count()

IDS = {
    name: uuid.uuid5(uuid.NAMESPACE_DNS, name)
    for name in ("open", "blocked", "jacket", "hoodie", "draft", "hidden", "parka")
}


def variant(product: str, size: str | None, color: str | None, status: Availability, **extra):
    return ProductVariant(
        product_id=IDS[product],
        size_system="INT" if size else None,
        size_label=size,
        color_code=color,
        availability_status=status,
        # In-stock fixtures were confirmed just now, unless a test says otherwise.
        availability_confirmed_at=extra.pop("confirmed_at", datetime.now(UTC)),
        # Explicit order, so the size list in responses is deterministic.
        position=next(POSITIONS),
        **extra,
    )


def fixtures() -> list:
    def product(name: str, store: str, category: str, audience: str, price: int, **extra):
        return Product(
            id=IDS[name],
            store_id=IDS[store],
            title=name,
            category_code=category,
            audience=audience,
            base_price_minor=price * SOM,
            status=extra.pop("status", ProductStatus.PUBLISHED),
            **extra,
        )

    reference = [
        City(code="bishkek", name_ru="Бишкек"),
        Category(code="jackets", name_ru="Куртки", name_ky="Курткалар"),
        Category(code="hoodies", name_ru="Худи"),
        Color(code="black", name_ru="Черный"),
        Color(code="white", name_ru="Белый"),
    ]
    stores = [
        Store(id=IDS["open"], slug="open", name="Open Store", city_code="bishkek",
              audiences=["women", "men"], address="ул. Киевская, 100",
              status=StoreStatus.ACTIVE),
        Store(id=IDS["blocked"], slug="blocked", name="Blocked Store", city_code="bishkek",
              status=StoreStatus.BLOCKED),
    ]  # fmt: skip
    products = [
        product("jacket", "open", "jackets", "men", 5000, brand="Nike"),
        product("parka", "open", "jackets", "men", 5000),
        product("hoodie", "open", "hoodies", "women", 3000),
        product("draft", "open", "jackets", "men", 1000, status=ProductStatus.DRAFT),
        product("hidden", "blocked", "jackets", "men", 1000),
    ]
    variants = [
        variant("jacket", "L", "black", Availability.IN_STOCK),
        variant("jacket", "M", "white", Availability.IN_STOCK),
        # Cheaper, but sold out.
        variant("jacket", "M", "black", Availability.OUT_OF_STOCK, price_override_minor=4000 * SOM),
        variant("parka", "L", "black", Availability.UNKNOWN),
        variant("hoodie", None, None, Availability.UNKNOWN),
        variant("draft", "L", "black", Availability.IN_STOCK),
        variant("hidden", "L", "black", Availability.IN_STOCK),
    ]
    images = [
        ProductImage(product_id=IDS["jacket"], external_url="https://example.test/jacket.jpg")
    ]
    users = [
        User(email=ADMIN_EMAIL, password_hash=hash_password(PASSWORD), name="Admin", is_admin=True)
    ]
    return [reference, stores, products, variants + images + users]


async def prepare_database() -> None:
    admin = create_async_engine(development_url, poolclass=NullPool, isolation_level="AUTOCOMMIT")
    async with admin.connect() as connection:
        exists = await connection.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": TEST_DATABASE}
        )
        if not exists:
            await connection.execute(text(f'CREATE DATABASE "{TEST_DATABASE}"'))
    await admin.dispose()

    engine = create_async_engine(test_url, poolclass=NullPool)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    async with engine.begin() as connection:
        async with AsyncSession(bind=connection) as session:
            for group in fixtures():
                session.add_all(group)
                await session.flush()
    await engine.dispose()


@pytest.fixture(scope="session")
def database() -> None:
    try:
        asyncio.run(prepare_database())
    except OSError as error:
        pytest.skip(f"Postgres is not reachable ({error}); start infra/docker-compose.yml")


@pytest.fixture(scope="session")
def client(database) -> TestClient:
    # One client for the whole run keeps the app's connection pool on one event loop.
    with TestClient(app) as test_client:
        yield test_client


def make_member(email: str, store: str, role: str = "owner") -> None:
    """Give a registered account access to a fixture store, directly in the database."""

    async def insert() -> None:
        engine = create_async_engine(test_url, poolclass=NullPool)
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "INSERT INTO store_members (id, store_id, user_id, role) "
                    "SELECT gen_random_uuid(), :store, id, :role FROM users WHERE email = :email"
                ),
                {"store": IDS[store], "role": role, "email": email},
            )
        await engine.dispose()

    asyncio.run(insert())
