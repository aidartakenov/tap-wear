"""Buying an item: order, simulated payment, what the buyer and the store see."""

import asyncio
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from tests.conftest import IDS, make_member, test_url
from tests.test_merchant import Actor

SOM = 100


def variant_id(product: str, size: str) -> str:
    """A fixture variant's id, read straight from the test database."""

    async def find() -> uuid.UUID:
        engine = create_async_engine(test_url, poolclass=NullPool)
        async with engine.connect() as connection:
            found = await connection.scalar(
                text(
                    "SELECT id FROM product_variants "
                    "WHERE product_id = :product AND size_label = :size ORDER BY color_code LIMIT 1"
                ),
                {"product": IDS[product], "size": size},
            )
        await engine.dispose()
        return found

    return str(asyncio.run(find()))


@pytest.fixture(scope="module")
def buyer(client) -> Actor:
    return Actor(client, "buyer@orders.test")


@pytest.fixture(scope="module")
def seller(client) -> Actor:
    actor = Actor(client, "seller@orders.test")
    make_member("seller@orders.test", "open")
    return actor


def buy(actor: Actor, **overrides):
    body = {
        "variant_id": variant_id("jacket", "L"),
        "payment_method": "mbank",
        "phone": "+996 555 123 456",
        **overrides,
    }
    return actor.post("/orders", json=body)


def test_payment_options_list_the_three_banks_in_test_mode(client):
    options = client.get("/api/v1/payments/options").json()

    assert options["enabled"] is True and options["test_mode"] is True
    assert [method["code"] for method in options["methods"]] == ["mbank", "optima", "obank"]


def test_buying_takes_the_price_from_the_catalog_and_ends_paid(buyer, seller):
    created = buy(buyer, payment_method="optima")
    assert created.status_code == 201, created.text
    order = created.json()
    assert order["status"] == "pending_payment"
    assert order["price_minor"] == 5000 * SOM and order["size_label"] == "L"
    assert order["payment_method_name"] == "Optima Bank" and order["test_mode"] is True

    # The store sees nothing until the money is confirmed.
    store_id = str(IDS["open"])
    assert seller.get("/merchant/orders", params={"store_id": store_id}).json() == []

    paid = buyer.post(f"/orders/{order['id']}/test-pay").json()
    assert paid["status"] == "paid" and paid["paid_at"] is not None
    # A repeated confirmation changes nothing.
    again = buyer.post(f"/orders/{order['id']}/test-pay").json()
    assert again["paid_at"] == paid["paid_at"]

    assert buyer.get("/me/orders").json()[0]["id"] == order["id"]
    seen = seller.get("/merchant/orders", params={"store_id": store_id}).json()
    assert [item["number"] for item in seen] == [order["number"]]
    assert seen[0]["buyer_phone"] == "+996 555 123 456"
    assert buyer.post(f"/orders/{order['id']}/cancel").json()["code"] == "order_paid"


def test_orders_are_private_and_checked(buyer, seller, client):
    assert client.post("/api/v1/orders", json={}).status_code in (401, 403)
    assert buy(buyer, phone="call me").status_code == 422
    assert buy(buyer, payment_method="cash").status_code == 422
    assert buy(buyer, variant_id=str(uuid.uuid4())).status_code == 404
    # A draft product cannot be bought even with a valid variant id.
    assert buy(buyer, variant_id=variant_id("draft", "L")).status_code == 404

    order = buy(buyer).json()
    # Another account can neither read nor pay nor cancel it.
    assert seller.get(f"/orders/{order['id']}").status_code == 404
    assert seller.post(f"/orders/{order['id']}/test-pay").status_code == 404
    assert seller.post(f"/orders/{order['id']}/cancel").status_code == 404
    assert buyer.get("/merchant/orders", params={"store_id": str(IDS["open"])}).status_code == 404

    cancelled = buyer.post(f"/orders/{order['id']}/cancel").json()
    assert cancelled["status"] == "cancelled"
    assert buyer.post(f"/orders/{order['id']}/test-pay").json()["code"] == "order_cancelled"


def test_simulated_payments_are_refused_in_production():
    settings = get_settings()
    with pytest.raises(ValueError, match="not allowed in production"):
        type(settings)(environment="production", payment_provider="test")
