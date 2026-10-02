"""A buyer's own account: profile, password and saved products."""

import asyncio

import pytest

from app import mailer
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


# --- Email confirmation and password reset -----------------------------------


def last_email_token(address: str) -> str:
    message = next(m for m in reversed(mailer.outbox) if m.to == address)
    return message.body.split("token=")[1].split()[0]


def test_new_account_must_confirm_its_email_before_opening_a_store(client):
    actor = Actor(client, "unconfirmed@shop.test", verify=False)
    store = {"name": "Рано", "city_code": "bishkek", "audiences": ["men"]}

    assert actor.get("/auth/me").json()["email_verified"] is False
    refused = actor.post("/merchant/stores", json=store)
    assert refused.status_code == 403 and refused.json()["code"] == "email_not_verified"
    # Saving favorites does not need a confirmed address.
    assert actor.request("PUT", f"/me/favorites/{IDS['jacket']}").status_code == 200

    token = last_email_token("unconfirmed@shop.test")
    assert client.post(f"{API}/auth/verify-email", json={"token": token}).status_code == 204
    assert actor.get("/auth/me").json()["email_verified"] is True
    assert actor.post("/merchant/stores", json=store).status_code == 201
    # A confirmation link works once.
    again = client.post(f"{API}/auth/verify-email", json={"token": token})
    assert again.status_code == 400 and again.json()["code"] == "invalid_token"


def test_confirmation_email_uses_the_language_of_registration(client):
    client.cookies.clear()
    body = {"email": "kyrgyz@home.test", "password": PASSWORD, "name": "Айбек"}
    client.post(f"{API}/auth/register", json=body, headers={"Accept-Language": "ky"})

    message = next(m for m in reversed(mailer.outbox) if m.to == "kyrgyz@home.test")

    assert message.subject == "TapWear үчүн почтаңызды ырастаңыз"
    assert "/verify-email?token=" in message.body


def test_forgot_password_gives_the_same_answer_for_unknown_addresses(client):
    Actor(client, "forgetful@home.test")
    client.cookies.clear()
    sent_before = len(mailer.outbox)

    known = client.post(f"{API}/auth/password/forgot", json={"email": "forgetful@home.test"})
    unknown = client.post(f"{API}/auth/password/forgot", json={"email": "nobody@home.test"})

    assert known.status_code == unknown.status_code == 204
    assert known.content == unknown.content
    # Only the real account got a message.
    assert [m.to for m in list(mailer.outbox)[sent_before:]] == ["forgetful@home.test"]


def test_reset_link_sets_a_new_password_once_and_signs_out_old_sessions(client):
    old_session = Actor(client, "resetting@home.test")
    client.cookies.clear()
    client.post(f"{API}/auth/password/forgot", json={"email": "resetting@home.test"})
    token = last_email_token("resetting@home.test")
    new_password = "fresh new passphrase"

    weak = client.post(f"{API}/auth/password/reset", json={"token": token, "new_password": "x"})
    assert weak.status_code == 422
    done = client.post(
        f"{API}/auth/password/reset", json={"token": token, "new_password": new_password}
    )
    assert done.status_code == 204

    assert old_session.get("/auth/me").json() is None
    client.cookies.clear()
    login = {"email": "resetting@home.test", "password": new_password}
    assert client.post(f"{API}/auth/login", json=login).status_code == 200
    client.cookies.clear()
    reused = client.post(
        f"{API}/auth/password/reset", json={"token": token, "new_password": "another passphrase"}
    )
    assert reused.status_code == 400


def test_a_newer_reset_link_cancels_the_older_one(client):
    Actor(client, "twice@home.test")
    client.cookies.clear()
    client.post(f"{API}/auth/password/forgot", json={"email": "twice@home.test"})
    first = last_email_token("twice@home.test")
    client.post(f"{API}/auth/password/forgot", json={"email": "twice@home.test"})

    stale = client.post(
        f"{API}/auth/password/reset", json={"token": first, "new_password": "whatever it is"}
    )

    assert stale.status_code == 400
