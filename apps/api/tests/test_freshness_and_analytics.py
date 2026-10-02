"""Stock freshness for buyers, visitor events, and a store's own statistics."""

import asyncio
import uuid

import pytest

from app.catalog import availability
from tests.conftest import IDS, make_member, prepare_database
from tests.test_merchant import API, Actor

PRODUCTS = f"{API}/products"


@pytest.fixture(scope="module", autouse=True)
def restore_fixtures(database):
    yield
    asyncio.run(prepare_database())


@pytest.fixture(scope="module")
def seller(client) -> Actor:
    actor = Actor(client, "analytics@shop.test")
    make_member("analytics@shop.test", "open")
    return actor


def event(kind: str, session: uuid.UUID, **fields) -> dict:
    return {"event_id": str(uuid.uuid4()), "session_id": str(session), "type": kind, **fields}


def send(client, *events: dict) -> int:
    client.cookies.clear()
    response = client.post(f"{API}/events", json={"events": list(events)})
    assert response.status_code == 202, response.text
    return response.json()["accepted"]


# --- Freshness --------------------------------------------------------------


def test_recently_confirmed_stock_is_shown_as_in_stock(client):
    client.cookies.clear()
    jacket = client.get(f"{PRODUCTS}/{IDS['jacket']}").json()

    assert jacket["availability"] == "in_stock"
    assert "jacket" in {
        p["title"] for p in client.get(PRODUCTS, params={"in_stock": True}).json()["items"]
    }


def test_stock_not_confirmed_in_time_is_no_longer_called_in_stock(client, monkeypatch):
    # Shrink the window so that the fixtures' confirmations count as too old.
    monkeypatch.setattr(availability.settings, "availability_stale_hours", 0)
    client.cookies.clear()

    jacket = client.get(f"{PRODUCTS}/{IDS['jacket']}").json()
    listed = client.get(PRODUCTS, params={"in_stock": True}).json()

    assert jacket["availability"] == "unknown"
    assert {v["availability"] for v in jacket["variants"]} == {"unknown", "out_of_stock"}
    # The product stays in the catalog; it only stops matching "in stock".
    assert listed["items"] == []
    assert client.get(PRODUCTS).json()["total"] == 3


def test_seller_sees_which_variants_are_due_and_can_confirm_them(seller, monkeypatch):
    def states() -> set[str]:
        product = seller.get(f"/merchant/products/{IDS['jacket']}").json()
        return {v["confirmation"] for v in product["variants"] if v["availability"] == "in_stock"}

    assert states() == {"fresh"}
    monkeypatch.setattr(availability.settings, "availability_reminder_hours", 0)
    assert states() == {"due"}
    monkeypatch.setattr(availability.settings, "availability_stale_hours", 0)
    assert states() == {"stale"}

    monkeypatch.undo()
    confirmed = seller.post(f"/merchant/products/{IDS['jacket']}/confirm-availability")
    assert confirmed.status_code == 200
    assert states() == {"fresh"}


# --- Events and analytics ---------------------------------------------------


def test_events_are_counted_once_and_only_for_visible_products(client):
    visitor = uuid.uuid4()
    view = event("product_view", visitor, product_id=str(IDS["jacket"]))

    assert send(client, view) == 1
    # A retry of the same request must not count twice.
    assert send(client, view) == 0
    assert send(client, event("product_view", visitor, product_id=str(IDS["hidden"]))) == 0
    assert send(client, event("store_view", visitor, store_slug="blocked")) == 0


def test_event_input_is_validated(client):
    client.cookies.clear()
    bad_channel = event("contact_click", uuid.uuid4(), product_id=str(IDS["jacket"]), channel="fax")
    too_many = [event("store_view", uuid.uuid4(), store_slug="open") for _ in range(21)]

    assert client.post(f"{API}/events", json={"events": [bad_channel]}).status_code == 422
    assert client.post(f"{API}/events", json={"events": too_many}).status_code == 422


def test_store_statistics_count_views_visitors_contacts_and_sources(client, seller):
    before = seller.get(f"/merchant/analytics?store_id={IDS['open']}").json()
    anna, bek = uuid.uuid4(), uuid.uuid4()
    jacket, hoodie = str(IDS["jacket"]), str(IDS["hoodie"])

    accepted = send(
        client,
        event("store_view", anna, store_slug="open", source="instagram"),
        event("product_view", anna, product_id=jacket, source="instagram"),
        event("product_view", anna, product_id=hoodie, source="instagram"),
        event("contact_click", anna, product_id=jacket, channel="whatsapp", source="instagram"),
        event("product_view", bek, product_id=jacket),
        # The store is taken from the product, whatever the browser claims.
        event("contact_click", bek, product_id=jacket, channel="phone", store_slug="blocked"),
    )
    assert accepted == 6

    after = seller.get(f"/merchant/analytics?store_id={IDS['open']}").json()

    def gained(key: str) -> int:
        return after[key] - before[key]

    assert gained("store_views") == 1
    assert gained("product_views") == 3
    assert gained("contact_clicks") == 2
    assert gained("visitors") == 2
    assert gained("contacting_visitors") == 2
    assert {c["key"]: c["count"] for c in after["contacts_by_channel"]} == {
        "whatsapp": 1,
        "phone": 1,
    }
    sources = {s["key"]: s["count"] for s in after["sources"]}
    assert sources["instagram"] == 1 and sources["direct"] >= 1
    top = {p["title"]: p for p in after["top_products"]}
    assert top["jacket"]["contacts"] == 2 and top["jacket"]["views"] >= 2
    assert sum(day["product_views"] for day in after["daily"]) == after["product_views"]


def test_freshness_summary_counts_in_stock_variants(seller):
    freshness = seller.get(f"/merchant/analytics?store_id={IDS['open']}").json()["freshness"]

    # The jacket has two in-stock variants, both confirmed recently.
    assert freshness == {"in_stock_variants": 2, "confirmed_recently": 2, "needs_confirmation": 0}


def test_statistics_are_private_to_the_store(client):
    outsider = Actor(client, "outsider@shop.test")
    client.cookies.clear()

    assert client.get(f"{API}/merchant/analytics?store_id={IDS['open']}").status_code == 401
    assert outsider.get(f"/merchant/analytics?store_id={IDS['open']}").status_code == 404
