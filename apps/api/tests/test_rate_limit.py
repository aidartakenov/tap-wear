import asyncio

import pytest

from app import rate_limit
from tests.conftest import IDS, prepare_database

API = "/api/v1"


@pytest.fixture(scope="module", autouse=True)
def restore_fixtures(database):
    yield
    asyncio.run(prepare_database())


@pytest.fixture
def limits_on(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "rate_limit_enabled", True)
    rate_limit.reset()
    yield
    rate_limit.reset()


def test_repeated_sign_in_attempts_from_one_address_are_slowed_down(client, limits_on):
    client.cookies.clear()
    attempt = {"email": "nobody@shop.test", "password": "guess guess"}

    statuses = [client.post(f"{API}/auth/login", json=attempt).status_code for _ in range(11)]

    assert statuses == [401] * 10 + [429]
    limited = client.post(f"{API}/auth/login", json=attempt)
    assert limited.json()["code"] == "rate_limited"
    assert 1 <= int(limited.headers["Retry-After"]) <= 60


def test_limits_are_separate_per_action(client, limits_on):
    client.cookies.clear()
    report = {"product_id": str(IDS["jacket"]), "reason": "other"}

    statuses = [client.post(f"{API}/reports", json=report).status_code for _ in range(6)]

    assert statuses == [201] * 5 + [429]
    # Reading the catalog is not affected by the reports limit.
    assert client.get(f"{API}/products").status_code == 200
