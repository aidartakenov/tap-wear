from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/api/.env, resolved from this file so it loads regardless of the working directory.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "TapWear API"
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    # Browser origins allowed to call the API (the Next.js dev server by default).
    cors_origins: list[str] = ["http://localhost:3000"]

    # Sessions. The cookie is HttpOnly; it is marked Secure everywhere except local development.
    session_cookie_name: str = "tapwear_session"
    session_ttl_hours: int = Field(default=24 * 14, gt=0)
    login_max_failures: int = Field(default=5, gt=0)
    login_lock_minutes: int = Field(default=15, gt=0)

    # Stock freshness: hours after the last confirmation at which the seller is
    # reminded, and at which buyers stop being told "in stock".
    availability_reminder_hours: int = Field(default=48, gt=0)
    availability_stale_hours: int = Field(default=72, gt=0)

    # Database. Required: there is deliberately no default, so a missing
    # DATABASE_URL fails at startup instead of falling back to a baked-in credential.
    database_url: PostgresDsn
    database_pool_size: int = Field(default=10, ge=1)
    database_max_overflow: int = Field(default=20, ge=0)
    database_echo: bool = False

    # MinIO / S3-compatible object storage
    minio_endpoint: str = "localhost:9000"
    minio_access_key: SecretStr
    minio_secret_key: SecretStr
    minio_secure: bool = False
    minio_region: str = "us-east-1"
    minio_bucket_assets: str = "tapwear-assets"
    minio_bucket_search_queries: str = "tapwear-search-queries"
    # Base URL under which buyers' browsers can fetch public product photos.
    storage_public_url: str = "http://localhost:9000"

    # Product photo uploads
    upload_max_bytes: int = Field(default=10 * 1024 * 1024, gt=0)
    upload_max_pixels: int = Field(default=20_000_000, gt=0)
    product_max_images: int = Field(default=5, gt=0)

    # Visual search embeddings. The dimension must match the model's output and
    # the vector(N) column created by the migrations; pgvector's HNSW and
    # IVFFlat indexes support at most 2000 dimensions.
    embedding_model_name: str = "clip-ViT-B-32"
    embedding_dimensions: int = Field(default=512, gt=0, le=2000)

    @field_validator("database_url")
    @classmethod
    def require_asyncpg_driver(cls, value: PostgresDsn) -> PostgresDsn:
        if value.scheme != "postgresql+asyncpg":
            raise ValueError("DATABASE_URL must use the postgresql+asyncpg:// scheme")
        return value

    @property
    def cookie_secure(self) -> bool:
        return self.environment != "local"

    @property
    def sqlalchemy_database_uri(self) -> str:
        return str(self.database_url)

    @property
    def minio_endpoint_url(self) -> str:
        scheme = "https" if self.minio_secure else "http"
        return f"{scheme}://{self.minio_endpoint}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
