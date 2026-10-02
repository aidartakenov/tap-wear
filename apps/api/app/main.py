from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import health
from app.accounts.me_router import router as me_router
from app.accounts.router import router as auth_router
from app.catalog.router import router as catalog_router
from app.config import get_settings
from app.database import engine
from app.errors import REQUEST_ID_HEADER, install_error_handling
from app.merchant.router import router as merchant_router
from app.moderation.router import admin_router, reports_router
from app.reference.router import router as reference_router
from app.stores.router import router as stores_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[REQUEST_ID_HEADER],
)
install_error_handling(app)

app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(catalog_router, prefix=settings.api_v1_prefix)
app.include_router(stores_router, prefix=settings.api_v1_prefix)
for router in (
    auth_router,
    me_router,
    merchant_router,
    admin_router,
    reports_router,
    reference_router,
):
    app.include_router(router, prefix=settings.api_v1_prefix)
