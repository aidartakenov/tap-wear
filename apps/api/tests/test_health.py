import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import app

client = TestClient(app)


def test_health_is_ok_without_a_database():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_settings_reject_a_non_asyncpg_database_url():
    with pytest.raises(ValidationError):
        Settings(database_url="postgresql://u:p@localhost:5432/db", _env_file=None)


def test_settings_reject_an_embedding_dimension_too_large_to_index():
    with pytest.raises(ValidationError):
        Settings(embedding_dimensions=4096, _env_file=None)
