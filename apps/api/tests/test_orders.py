"""Buying an item: order, simulated payment, what the buyer and the store see."""

import asyncio
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app import mailer, telegram
from app.config import get_settings
from tests.conftest import ADMIN_EMAIL, IDS, make_member, test_url
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


def restock() -> None:
    """Switch every uncounted size back on: a sale switches the sold size off."""

    async def update() -> None:
        engine = create_async_engine(test_url, poolclass=NullPool)
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "UPDATE product_variants SET availability_status = 'in_stock', "
                    "availability_confirmed_at = now() "
                    "WHERE stock_mode <> 'exact' AND availability_status = 'out_of_stock'"
                )
            )
        await engine.dispose()

    asyncio.run(update())


def buy(actor: Actor, variant: str | None = None, quantity: int = 1, **overrides):
    # Each test buys the same fixture size, so it has to be there again.
    restock()
    body = {
        "items": [{"variant_id": variant or variant_id("jacket", "L"), "quantity": quantity}],
        "payment_method": "mbank",
        "phone": "+996 555 123 456",
        **overrides,
    }
    return actor.post("/orders", json=body)


def set_stock(product: str, size: str, quantity: int | None) -> None:
    """Make a fixture variant counted (a number) or uncounted (None), in the test database."""
    target = variant_id(product, size)

    async def update() -> None:
        engine = create_async_engine(test_url, poolclass=NullPool)
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "UPDATE product_variants SET quantity = :quantity, stock_mode = :mode, "
                    "availability_status = 'in_stock', availability_confirmed_at = now() "
                    "WHERE id = :id"
                ),
                {
                    "quantity": quantity,
                    "mode": "manual" if quantity is None else "exact",
                    "id": target,
                },
            )
        await engine.dispose()

    asyncio.run(update())


def stock_of(product: str, size: str) -> int | None:
    target = variant_id(product, size)

    async def read() -> int | None:
        engine = create_async_engine(test_url, poolclass=NullPool)
        async with engine.connect() as connection:
            found = await connection.scalar(
                text("SELECT quantity FROM product_variants WHERE id = :id"),
                {"id": target},
            )
        await engine.dispose()
        return found

    return asyncio.run(read())


def test_payment_options_list_the_three_banks_in_test_mode(client):
    options = client.get("/api/v1/payments/options").json()

    assert options["enabled"] is True and options["test_mode"] is True
    assert [method["code"] for method in options["methods"]] == ["mbank", "optima", "obank"]


def test_buying_takes_the_price_from_the_catalog_and_ends_paid(buyer, seller):
    created = buy(buyer, payment_method="optima")
    assert created.status_code == 201, created.text
    order = created.json()
    assert order["status"] == "pending_payment"
    assert order["total_minor"] == 5000 * SOM and order["items"][0]["size_label"] == "L"
    assert order["delivery_method"] == "pickup" and order["delivery_fee_minor"] == 0
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

    # The store and the buyer were both written to.
    subjects = [(mail.to, mail.subject) for mail in mailer.outbox]
    assert ("seller@orders.test", f"Новый заказ №{order['number']}") in subjects
    assert ("buyer@orders.test", f"Заказ №{order['number']} оплачен") in subjects


def test_store_moves_an_order_step_by_step(buyer, seller):
    order = buy(buyer).json()
    buyer.post(f"/orders/{order['id']}/test-pay")
    step = f"/merchant/orders/{order['id']}/status"

    # Steps cannot be skipped, and a buyer cannot move their own order.
    assert seller.post(step, json={"status": "shipped"}).json()["code"] == "wrong_order_step"
    assert buyer.post(step, json={"status": "accepted"}).status_code == 404

    assert seller.post(step, json={"status": "accepted"}).json()["status"] == "accepted"
    # Once accepted, the buyer can no longer cancel alone.
    assert buyer.post(f"/orders/{order['id']}/cancel").json()["code"] == "order_in_progress"
    assert seller.post(step, json={"status": "shipped"}).json()["status"] == "shipped"
    assert seller.post(step, json={"status": "completed"}).json()["status"] == "completed"
    assert seller.post(step, json={"status": "paid"}).json()["code"] == "wrong_order_step"

    mine = buyer.get(f"/orders/{order['id']}").json()
    assert mine["status"] == "completed" and mine["can_cancel"] is False
    assert mailer.outbox[-1].subject == f"Заказ №{order['number']} получен"


def test_paid_order_can_be_called_off_with_a_refund(buyer, seller):
    # By the buyer, before the store accepts.
    first = buy(buyer).json()
    buyer.post(f"/orders/{first['id']}/test-pay")
    cancelled = buyer.post(f"/orders/{first['id']}/cancel").json()
    assert cancelled["status"] == "refunded" and cancelled["closing_note"]
    assert mailer.outbox[-2].to == "seller@orders.test"

    # By the store, with a reason the buyer is told.
    second = buy(buyer).json()
    buyer.post(f"/orders/{second['id']}/test-pay")
    refuse = f"/merchant/orders/{second['id']}/refuse"
    assert seller.post(refuse, json={"reason": ""}).status_code == 422
    refused = seller.post(refuse, json={"reason": "Этого размера уже нет"}).json()
    assert refused["status"] == "refunded"
    assert "Этого размера уже нет" in mailer.outbox[-1].body
    assert seller.post(refuse, json={"reason": "ещё раз"}).json()["code"] == "wrong_order_step"


def test_orders_are_private_and_checked(buyer, seller, client):
    assert client.post("/api/v1/orders", json={}).status_code in (401, 403)
    assert buy(buyer, phone="call me").status_code == 422
    assert buy(buyer, payment_method="cash").status_code == 422
    assert buy(buyer, variant=str(uuid.uuid4())).status_code == 404
    # A draft product cannot be bought even with a valid variant id.
    assert buy(buyer, variant=variant_id("draft", "L")).status_code == 404
    assert buy(buyer, quantity=0).status_code == 422
    # Delivery needs an address, and the store must offer delivery at all.
    assert buy(buyer, delivery_method="delivery").status_code == 422
    no_delivery = buy(buyer, delivery_method="delivery", address="ул. Киевская, 1")
    assert no_delivery.json()["code"] == "no_delivery"

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


def test_cart_shows_current_prices_and_what_cannot_be_bought(client, buyer):
    client.cookies.clear()
    lines = [
        {"variant_id": variant_id("jacket", "L"), "quantity": 2},
        {"variant_id": variant_id("draft", "L"), "quantity": 1},
        {"variant_id": str(uuid.uuid4()), "quantity": 1},
    ]
    cart = client.post("/api/v1/cart", json={"items": lines}).json()

    assert len(cart["missing"]) == 2  # the draft and the unknown one
    [store] = cart["stores"]
    assert store["slug"] == "open" and store["pickup_available"] is True
    assert store["delivery_available"] is False
    assert store["items_minor"] == 2 * 5000 * SOM
    assert store["lines"][0]["available"] is True and store["lines"][0]["quantity"] == 2


def test_order_with_several_pieces_holds_counted_stock_until_it_is_released(buyer, seller):
    set_stock("jacket", "L", 3)
    try:
        too_many = buy(buyer, quantity=4)
        assert too_many.json()["code"] == "out_of_stock"

        order = buy(buyer, quantity=2).json()
        assert order["total_minor"] == 2 * 5000 * SOM and order["items"][0]["quantity"] == 2
        assert stock_of("jacket", "L") == 1
        # Buyers are told when only a little is left.
        public = buyer.get(f"/products/{IDS['jacket']}").json()
        left = {
            v["size_label"] + (v["color"] or {}).get("code", ""): v["left"]
            for v in public["variants"]
        }
        assert left["Lblack"] == 1 and left["Mwhite"] is None
        # The last piece can still be bought by someone else; a second one cannot.
        assert buy(seller, quantity=2).json()["code"] == "out_of_stock"

        # Backing out before paying puts the pieces back.
        buyer.post(f"/orders/{order['id']}/cancel")
        assert stock_of("jacket", "L") == 3

        # A refund after payment puts them back too; a completed order does not.
        paid = buy(buyer, quantity=3).json()
        buyer.post(f"/orders/{paid['id']}/test-pay")
        assert stock_of("jacket", "L") == 0
        assert buy(seller).json()["code"] == "out_of_stock"
        refuse = f"/merchant/orders/{paid['id']}/refuse"
        seller.post(refuse, json={"reason": "Брак"})
        assert stock_of("jacket", "L") == 3
    finally:
        set_stock("jacket", "L", None)


def test_unpaid_order_expires_and_frees_its_stock(buyer):
    set_stock("jacket", "L", 1)
    try:
        order = buy(buyer).json()
        assert stock_of("jacket", "L") == 0

        async def age() -> None:
            engine = create_async_engine(test_url, poolclass=NullPool)
            async with engine.begin() as connection:
                await connection.execute(
                    text(
                        "UPDATE orders SET created_at = now() - interval '2 hours' WHERE id = :id"
                    ),
                    {"id": order["id"]},
                )
            await engine.dispose()

        asyncio.run(age())
        assert buyer.get(f"/orders/{order['id']}").json()["status"] == "cancelled"
        assert stock_of("jacket", "L") == 1
        assert buyer.post(f"/orders/{order['id']}/test-pay").json()["code"] == "order_cancelled"
    finally:
        set_stock("jacket", "L", None)


def test_store_connects_telegram_and_gets_new_orders_there(buyer, seller):
    store_id = str(IDS["open"])
    path = f"/merchant/stores/{store_id}/telegram"
    assert buyer.get(path).status_code == 404  # not this store's owner

    status = seller.get(path).json()
    assert status == {"bot_configured": False, "connected": False, "link": None}
    # Without a real bot the connection succeeds at once and messages are only recorded.
    assert seller.post(f"{path}/check").json()["connected"] is True

    order = buy(buyer).json()
    buyer.post(f"/orders/{order['id']}/test-pay")
    notice = telegram.outbox[-1].text
    assert f"Новый заказ №{order['number']}" in notice and "+996 555 123 456" in notice

    assert seller.delete(path).json()["connected"] is False
    sent = len(telegram.outbox)
    another = buy(buyer).json()
    buyer.post(f"/orders/{another['id']}/test-pay")
    assert len(telegram.outbox) == sent


def test_admin_overview_counts_paid_orders_and_admins_manage_accounts(client, buyer, seller):
    admin = Actor(client, ADMIN_EMAIL, register=False)
    assert buyer.get("/admin/overview").status_code == 403
    assert buyer.get("/admin/users").status_code == 403

    before = admin.get("/admin/overview").json()
    order = buy(buyer).json()
    # An unpaid order is not turnover yet.
    assert admin.get("/admin/overview").json()["orders"] == before["orders"]
    buyer.post(f"/orders/{order['id']}/test-pay")
    after = admin.get("/admin/overview").json()
    assert after["orders"] == before["orders"] + 1
    assert after["turnover_minor"] == before["turnover_minor"] + 5000 * SOM
    assert after["days"][-1]["orders"] >= 1 and after["users"] >= 3

    found = admin.get("/admin/users", params={"q": "buyer@orders"}).json()
    assert found["total"] == 1
    person = found["items"][0]
    assert person["email"] == "buyer@orders.test" and person["orders"] >= 1

    # Blocking signs the person out at once; unblocking lets them back in.
    path = f"/admin/users/{person['id']}"
    assert admin.patch(path, json={"is_active": False}).json()["is_active"] is False
    assert buyer.get("/me/orders").status_code == 401
    assert admin.patch(path, json={"is_active": True}).json()["is_active"] is True

    assert admin.patch(path, json={"is_admin": True}).json()["is_admin"] is True
    assert admin.patch(path, json={"is_admin": False}).json()["is_admin"] is False
    me = admin.get("/auth/me").json()["id"]
    assert (
        admin.patch(f"/admin/users/{me}", json={"is_admin": False}).json()["code"] == "own_account"
    )


def test_sales_book_counts_site_orders_and_shop_sales(client, seller):
    # Signed in afresh: an earlier test blocked this account, which ended its session.
    buyer = Actor(client, "buyer@orders.test", register=False)
    store_id = str(IDS["open"])
    report = lambda days=30: seller.get(  # noqa: E731
        "/merchant/sales", params={"store_id": store_id, "days": days}
    ).json()
    assert buyer.get("/merchant/sales", params={"store_id": store_id}).status_code == 404
    before = report()["summary"]

    # A paid order on the site: two pieces of one jacket.
    order = buy(buyer, quantity=2).json()
    buyer.post(f"/orders/{order['id']}/test-pay")
    # Three sales in the shop itself, each recorded with one tap on the size.
    set_stock("jacket", "L", 5)
    try:
        sold = f"/merchant/variants/{variant_id('jacket', 'L')}/sold"
        assert buyer.post(sold, json={}).status_code == 404  # not this store's seller
        taps = [seller.post(sold, json={}) for _ in range(3)]
        assert all(tap.status_code == 201 for tap in taps), taps[0].text
        sale = taps[-1]
        assert stock_of("jacket", "L") == 2
        counted = next(
            v for v in sale.json()["product"]["variants"] if v["id"] == variant_id("jacket", "L")
        )
        assert counted["quantity"] == 2

        after = report()
        summary = after["summary"]
        assert summary["pieces"] == before["pieces"] + 5
        assert summary["revenue_minor"] == before["revenue_minor"] + 5 * 5000 * SOM
        assert summary["sales"] == before["sales"] + 4
        assert summary["shop_pieces"] == before["shop_pieces"] + 3
        assert after["by_day"][-1]["pieces"] >= 5 and len(after["by_day"]) == 30

        jacket = next(
            item for item in after["products"] if item["product_id"] == str(IDS["jacket"])
        )
        assert jacket["pieces"] >= 5 and jacket["variants"][0]["size_label"] == "L"
        assert {share["key"] for share in after["sizes"]} >= {"L"}
        newest = after["lines"][0]
        assert newest["channel"] == "shop" and newest["total_minor"] == 5000 * SOM
        counted = next(
            row for row in after["stock"] if row["variant_id"] == variant_id("jacket", "L")
        )
        assert counted["quantity"] == 2 and counted["sold"] >= 5

        # A refund leaves the sales and is shown apart.
        seller.post(f"/merchant/orders/{order['id']}/refuse", json={"reason": "Брак"})
        refunded = report()["summary"]
        assert refunded["pieces"] == summary["pieces"] - 2
        assert refunded["refunds"] == summary["refunds"] + 1

        # A tap made by mistake is taken back, and its piece returns.
        assert buyer.delete(f"/merchant/sales/{sale.json()['sale_id']}").status_code == 404
        assert seller.delete(f"/merchant/sales/{sale.json()['sale_id']}").status_code == 204
        assert stock_of("jacket", "L") == 3
        assert report()["summary"]["shop_pieces"] == before["shop_pieces"] + 2
    finally:
        set_stock("jacket", "L", None)


def test_sold_switches_an_uncounted_size_off(client, seller):
    # The module's buyer was signed out by the blocking test above.
    buyer = Actor(client, "buyer@orders.test", register=False)
    store_id = str(IDS["open"])
    target = variant_id("jacket", "L")
    pieces = lambda: seller.get(  # noqa: E731
        "/merchant/sales", params={"store_id": store_id, "days": 1}
    ).json()["summary"]["shop_pieces"]

    def status() -> str:
        product = seller.get(f"/merchant/products/{IDS['jacket']}").json()
        return next(v["availability"] for v in product["variants"] if v["id"] == target)

    restock()
    before = pieces()

    # Sold in the shop: one tap records the sale and switches the size off.
    sold = seller.post(f"/merchant/variants/{target}/sold").json()
    assert status() == "out_of_stock" and pieces() == before + 1
    # Nothing more can be sold from a size that is gone, in the shop or on the site.
    assert seller.post(f"/merchant/variants/{target}/sold").json()["code"] == "out_of_stock"
    assert (
        buyer.post(
            "/orders",
            json={
                "items": [{"variant_id": target, "quantity": 1}],
                "payment_method": "mbank",
                "phone": "+996 555 123 456",
            },
        ).json()["code"]
        == "out_of_stock"
    )
    # Taking the sale back puts the size on sale again.
    assert seller.delete(f"/merchant/sales/{sold['sale_id']}").status_code == 204
    assert status() == "in_stock" and pieces() == before

    # Sold through the site: the order switches the size off by itself...
    order = buy(buyer, target).json()
    assert status() == "out_of_stock"
    buyer.post(f"/orders/{order['id']}/test-pay")
    assert status() == "out_of_stock"
    # ...and a called-off order puts it back on sale.
    assert buyer.post(f"/orders/{order['id']}/cancel").json()["status"] == "refunded"
    assert status() == "in_stock"


def test_sales_book_downloads_as_a_pdf_for_the_store_only(client, seller):
    store_id = str(IDS["open"])
    restock()
    sold = seller.post(f"/merchant/variants/{variant_id('jacket', 'L')}/sold").json()

    file = seller.get("/merchant/sales/pdf", params={"store_id": store_id, "days": 7})
    assert file.status_code == 200
    assert file.headers["content-type"] == "application/pdf"
    assert file.headers["content-disposition"].endswith('.pdf"')
    assert file.content.startswith(b"%PDF") and len(file.content) > 5000

    # Another account cannot read this store's book.
    stranger = Actor(client, "pdf-stranger@orders.test")
    assert stranger.get("/merchant/sales/pdf", params={"store_id": store_id}).status_code == 404
    seller.delete(f"/merchant/sales/{sold['sale_id']}")


def test_store_discount_lowers_the_price_everywhere_and_can_be_removed(client, seller):
    buyer = Actor(client, "buyer@orders.test", register=False)
    product_id = str(IDS["jacket"])
    target = variant_id("jacket", "L")
    restock()

    def discount(percent):
        version = seller.get(f"/merchant/products/{product_id}").json()["version"]
        return seller.patch(
            f"/merchant/products/{product_id}",
            json={"expected_version": version, "discount_percent": percent},
        )

    full = client.get(f"/api/v1/products/{product_id}").json()
    full_price = next(v["price_minor"] for v in full["variants"] if v["id"] == target)
    assert full["discount_percent"] is None and full["old_price_minor"] is None

    assert discount(95).status_code == 422
    assert discount(30).json()["discount_percent"] == 30

    # Rounded down to whole soms; the full price is shown crossed out.
    sale = full_price * 70 // 100 // SOM * SOM
    detail = client.get(f"/api/v1/products/{product_id}").json()
    variant = next(v for v in detail["variants"] if v["id"] == target)
    assert variant == variant | {"price_minor": sale, "old_price_minor": full_price}
    assert detail["discount_percent"] == 30 and detail["old_price_minor"] is not None

    # The "on sale" filter finds it, and the price filter uses the new price.
    on_sale = client.get("/api/v1/products", params={"on_sale": True, "limit": 100}).json()
    assert product_id in {item["id"] for item in on_sale["items"]}
    assert all(item["discount_percent"] for item in on_sale["items"])
    cheap = client.get("/api/v1/products", params={"price_max_minor": sale, "limit": 100}).json()
    assert product_id in {item["id"] for item in cheap["items"]}

    # An order is charged the discounted price.
    order = buy(buyer, target).json()
    assert order["items"][0]["price_minor"] == sale
    buyer.post(f"/orders/{order['id']}/cancel")

    # Sent as null, the discount is gone.
    assert discount(None).json()["discount_percent"] is None
    again = client.get(f"/api/v1/products/{product_id}").json()
    assert next(v for v in again["variants"] if v["id"] == target)["price_minor"] == full_price
    on_sale = client.get("/api/v1/products", params={"on_sale": True, "limit": 100}).json()
    assert product_id not in {item["id"] for item in on_sale["items"]}


def test_buyer_deletes_the_account_and_stores_keep_their_records(client, seller):
    from tests.conftest import PASSWORD
    from tests.test_merchant import API

    buyer = Actor(client, "leaving@orders.test")
    restock()
    # A finished purchase that the store keeps in its sales book.
    order = buy(buyer, phone="+996 700 111 222").json()
    buyer.post(f"/orders/{order['id']}/test-pay")
    seller.post(f"/merchant/orders/{order['id']}/status", json={"status": "accepted"})

    # Not while the store is still working on the order, and never without the password.
    assert buyer.request("DELETE", "/auth/me", json={"password": "wrong-one"}).status_code == 403
    busy = buyer.request("DELETE", "/auth/me", json={"password": PASSWORD})
    assert busy.json()["code"] == "orders_in_progress"
    seller.post(f"/merchant/orders/{order['id']}/status", json={"status": "shipped"})
    seller.post(f"/merchant/orders/{order['id']}/status", json={"status": "completed"})

    assert buyer.request("DELETE", "/auth/me", json={"password": PASSWORD}).status_code == 204
    # Signed out everywhere, and the email and password no longer work.
    assert buyer.get("/me/favorites").status_code == 401
    client.cookies.clear()
    login = client.post(
        f"{API}/auth/login", json={"email": "leaving@orders.test", "password": PASSWORD}
    )
    assert login.status_code == 401
    # The same email can sign up again as a new person.
    Actor(client, "leaving@orders.test")

    # The store still has the sale, without the buyer's phone or name.
    orders = seller.get("/merchant/orders", params={"store_id": str(IDS["open"])}).json()
    kept = next(o for o in orders if o["id"] == order["id"])
    assert "700 111 222" not in str(kept)
    report = seller.get("/merchant/sales", params={"store_id": str(IDS["open"]), "days": 1}).json()
    line = next(line for line in report["lines"] if line["order_number"] == order["number"])
    assert line["buyer"] == "Удалённый пользователь"


def test_store_owner_cannot_delete_the_account(client, seller):
    from tests.conftest import PASSWORD, make_member

    owner = Actor(client, "owner-leaving@orders.test")
    make_member("owner-leaving@orders.test", "open", role="owner")
    refused = owner.request("DELETE", "/auth/me", json={"password": PASSWORD})
    assert refused.json()["code"] == "owns_store"
