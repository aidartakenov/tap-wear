"""A buyer's own account: profile, password and saved products."""

import asyncio

import pytest

from tests.conftest import IDS, PASSWORD, prepare_database
from tests.test_merchant import API, Actor


@pytest.fixture(scope="module", autouse=True)
def restore_fixtures(database):
    yield
    asyncio.run(prepare_database())


@pytest.fixture(scope="module")
def buyer(client) -> Actor:
    return Actor(client, "buyer@home.test")


def test_favorites_require_an_account(client):
    client.cookies.clear()

    assert client.get(f"{API}/me/favorites").status_code == 401


def test_saving_and_removing_a_product(buyer):
    jacket, hoodie = str(IDS["jacket"]), str(IDS["hoodie"])

    assert buyer.request("PUT", f"/me/favorites/{jacket}").json()["ids"] == [jacket]
    # Saving the same product again changes nothing.
    assert buyer.request("PUT", f"/me/favorites/{jacket}").json()["ids"] == [jacket]
    assert set(buyer.request("PUT", f"/me/favorites/{hoodie}").json()["ids"]) == {jacket, hoodie}

    assert buyer.delete(f"/me/favorites/{jacket}").json()["ids"] == [hoodie]
    assert buyer.get("/me/favorites").json()["ids"] == [hoodie]


def test_hidden_products_cannot_be_saved(buyer):
    assert buyer.request("PUT", f"/me/favorites/{IDS['draft']}").status_code == 404
    assert buyer.request("PUT", f"/me/favorites/{IDS['hidden']}").status_code == 404


def test_guest_list_is_merged_into_the_account_skipping_unknown_products(client):
    actor = Actor(client, "merging@home.test")
    device_list = [str(IDS["parka"]), str(IDS["hidden"]), "00000000-0000-4000-8000-000000000000"]

    merged = actor.post("/me/favorites/merge", json={"ids": device_list})

    assert merged.json()["ids"] == [str(IDS["parka"])]


def test_one_account_never_sees_another_accounts_favorites(client, buyer):
    other = Actor(client, "other@home.test")

    assert other.get("/me/favorites").json()["ids"] == []
    assert buyer.get("/me/favorites").json()["ids"] != []


def test_profile_name_can_be_changed(buyer):
    updated = buyer.patch("/auth/me", json={"name": "  Айгуль  "})

    assert updated.json()["name"] == "Айгуль"
    assert buyer.patch("/auth/me", json={"name": " "}).status_code == 422


def test_changing_password_needs_the_current_one_and_signs_out_other_devices(client):
    phone = Actor(client, "devices@home.test")
    laptop = Actor(client, "devices@home.test", register=False)
    new_password = "a brand new passphrase"

    wrong = phone.post(
        "/auth/password", json={"current_password": "not it", "new_password": new_password}
    )
    assert wrong.status_code == 403

    changed = phone.post(
        "/auth/password", json={"current_password": PASSWORD, "new_password": new_password}
    )
    assert changed.status_code == 204
    assert phone.get("/auth/me").json() is not None
    assert laptop.get("/auth/me").json() is None

    client.cookies.clear()
    old = {"email": "devices@home.test", "password": PASSWORD}
    new = {"email": "devices@home.test", "password": new_password}
    assert client.post(f"{API}/auth/login", json=old).status_code == 401
    assert client.post(f"{API}/auth/login", json=new).status_code == 200
