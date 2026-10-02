import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProductEmbedding(Base):
    """The vector of one product photo, as computed by one version of the model.

    Vectors of different model versions are never compared with each other:
    every query names the version it wants. After a model change the catalog is
    indexed again under the new version and the old rows can be deleted.
    """

    __tablename__ = "product_embeddings"
    __table_args__ = (UniqueConstraint("image_id", "model_version"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    image_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("product_images.id", ondelete="CASCADE"), index=True
    )
    model_version: Mapped[str] = mapped_column(String(100), index=True)
    dimensions: Mapped[int] = mapped_column()
    # No fixed length, so a model with another output size needs no migration.
    # Exact search is used; an HNSW index would need a fixed length.
    # Empty when the photo could not be read; such rows are skipped by search and
    # stop the same broken photo from being retried on every pass.
    vector: Mapped[list[float] | None] = mapped_column(Vector())
    # What the vector was computed from (file hash or address). A photo whose
    # source changed is indexed again.
    source: Mapped[str] = mapped_column(String(600))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
