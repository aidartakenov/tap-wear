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
    app_name: str = "TopWear API"
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = False

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
    minio_bucket_assets: str = "topwear-assets"
    minio_bucket_search_queries: str = "topwear-search-queries"

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
    def sqlalchemy_database_uri(self) -> str:
        return str(self.database_url)

    @property
    def minio_endpoint_url(self) -> str:
        scheme = "https" if self.minio_secure else "http"
        return f"{scheme}://{self.minio_endpoint}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
