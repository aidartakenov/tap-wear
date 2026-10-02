from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Reference data uses stable internal codes as keys; display names are
# stored per language (Russian now, Kyrgyz once translated and reviewed).


class City(Base):
    __tablename__ = "cities"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name_ru: Mapped[str] = mapped_column(String(100))
    name_ky: Mapped[str | None] = mapped_column(String(100))


class Category(Base):
    __tablename__ = "categories"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    parent_code: Mapped[str | None] = mapped_column(ForeignKey("categories.code"))
    name_ru: Mapped[str] = mapped_column(String(100))
    name_ky: Mapped[str | None] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(default=0)


class Color(Base):
    __tablename__ = "colors"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name_ru: Mapped[str] = mapped_column(String(100))
    name_ky: Mapped[str | None] = mapped_column(String(100))
