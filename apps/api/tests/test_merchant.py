"""The seller cabinet: accounts, store isolation, drafts, photos and moderation."""

import asyncio
import io

import pytest
from PIL import Image

from app import storage
from app.config import get_settings
from tests.conftest import ADMIN_EMAIL, PASSWORD, SOM, prepare_database

API = "/api/v1"
COOKIE = get_settings().session_cookie_name


@pytest.fixture(scope="module", autouse=True)
def restore_fixtures(database):
    """These tests create stores and products; put the fixture data back afterwards."""
    yield
    asyncio.run(prepare_database())


class Actor:
    """One signed-in person. The shared test client carries only one cookie jar,
    so each request is sent with this person's session cookie and CSRF token."""

    def __init__(self, client, email: str, *, register: bool = True):
        self.client = client
        client.cookies.clear()
        path = "register" if register else "login"
        body = {"email": email, "password": PASSWORD}
        if register:
            body["name"] = email.split("@")[0]
        response = client.post(f"{API}/auth/{path}", json=body)
        assert response.status_code in (200, 201), response.text
        self.token = response.cookies[COOKIE]
        self.csrf = response.json()["csrf_token"]

    def request(self, method: str, path: str, *, csrf: bool = True, **kwargs):
        self.client.cookies.clear()
        self.client.cookies.set(COOKIE, self.token)
        headers = {"X-CSRF-Token": self.csrf} if csrf else {}
        return self.client.request(method, f"{API}{path}", headers=headers, **kwargs)

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)

    def patch(self, path, **kwargs):
        return self.request("PATCH", path, **kwargs)

    def delete(self, path, **kwargs):
        return self.request("DELETE", path, **kwargs)


def new_store(actor: Actor, name: str) -> dict:
    response = actor.post("/merchant/stores", json={"name": name, "city_code": "bishkek"})
    assert response.status_code == 201, response.text
    return response.json()


def new_product(actor: Actor, store_id: str, **overrides) -> dict:
    body = {
        "store_id": store_id,
        "title": "Куртка зимняя",
        "category": "jackets",
        "audience": "men",
        "base_price_minor": 5000 * SOM,
        "variants": [
            {"size_system": "INT", "size_label": "L", "color": "black", "availability": "in_stock"},
            {"size_system": "INT", "size_label": "M", "color": "black"},
        ],
        **overrides,
    }
    response = actor.post("/merchant/products", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def photo(fmt: str = "JPEG", size=(300, 200), exif: bool = False) -> bytes:
    image = Image.new("RGB", size, "navy")
    output = io.BytesIO()
    if exif:
        data = Image.Exif()
        data[0x0112] = 6  # orientation: rotate 90 degrees
        data[0x010F] = "SecretCamera"  # camera maker
        image.save(output, format=fmt, exif=data)
    else:
        image.save(output, format=fmt)
    return output.getvalue()


def upload(actor: Actor, product_id: str, data: bytes, name: str = "photo.jpg"):
    return actor.post(
        f"/merchant/products/{product_id}/images", files={"file": (name, data, "image/jpeg")}
    )


@pytest.fixture(scope="module")
def object_storage():
    try:
        storage.ensure_assets_bucket()
    except Exception as error:  # noqa: BLE001
        pytest.skip(f"Object storage is not reachable ({error}); start infra/docker-compose.yml")


@pytest.fixture(scope="module")
def owner(client) -> Actor:
    return Actor(client, "owner@shop.test")


@pytest.fixture(scope="module")
def stranger(client) -> Actor:
    actor = Actor(client, "stranger@other.test")
    new_store(actor, "Чужой магазин")
    return actor


@pytest.fixture(scope="module")
def admin(client) -> Actor:
    return Actor(client, ADMIN_EMAIL, register=False)


@pytest.fixture(scope="module")
def store(owner) -> dict:
    return new_store(owner, "Мой Магазин")


# --- Accounts ---------------------------------------------------------------


def test_register_signs_in_and_me_returns_the_account(client):
    actor = Actor(client, "New.User@Shop.test")

    me = actor.get("/auth/me").json()
    assert me["email"] == "new.user@shop.test"
    assert me["is_admin"] is False


def test_guest_me_is_null_and_merchant_area_requires_sign_in(client):
    client.cookies.clear()

    assert client.get(f"{API}/auth/me").json() is None
    assert client.get(f"{API}/merchant/stores").status_code == 401


def test_duplicate_email_and_weak_password_are_rejected(client, owner):
    client.cookies.clear()
    body = {"email": "OWNER@shop.test", "password": PASSWORD, "name": "Again"}
    assert client.post(f"{API}/auth/register", json=body).json()["code"] == "email_taken"

    weak = {"email": "weak@shop.test", "password": "short", "name": "Weak"}
    assert client.post(f"{API}/auth/register", json=weak).status_code == 422


def test_wrong_password_gives_no_hint_and_repeated_failures_lock_the_account(client):
    Actor(client, "locked@shop.test")
    client.cookies.clear()
    attempt = {"email": "locked@shop.test", "password": "wrong password"}
    unknown = {"email": "nobody@shop.test", "password": "wrong password"}

    first = client.post(f"{API}/auth/login", json=attempt)
    assert first.status_code == 401
    assert first.json() == {**client.post(f"{API}/auth/login", json=unknown).json(),
                            "request_id": first.json()["request_id"]}  # fmt: skip

    for _ in range(get_settings().login_max_failures - 1):
        client.post(f"{API}/auth/login", json=attempt)
    correct = {"email": "locked@shop.test", "password": PASSWORD}
    assert client.post(f"{API}/auth/login", json=correct).status_code == 429


def test_logout_revokes_the_session(client):
    actor = Actor(client, "leaving@shop.test")

    assert actor.post("/auth/logout").status_code == 204
    assert actor.get("/auth/me").json() is None
    assert actor.get("/merchant/stores").status_code == 401


def test_changing_request_without_csrf_token_is_refused(owner):
    response = owner.post(
        "/merchant/stores", csrf=False, json={"name": "No token", "city_code": "bishkek"}
    )

    assert response.status_code == 403
    assert response.json()["code"] == "csrf_failed"


# --- Stores and membership --------------------------------------------------


def test_new_store_waits_for_review_and_is_not_public(client, owner, store):
    assert store["status"] == "pending_review"
    assert store["role"] == "owner"
    assert store["slug"] == "moy-magazin"
    assert client.get(f"{API}/stores/{store['slug']}").status_code == 404


def test_another_seller_cannot_see_or_change_the_store(owner, stranger, store):
    store_id = store["id"]
    product = new_product(owner, store_id)
    variant_id = product["variants"][0]["id"]
    update = {"expected_version": product["version"], "title": "Взломано"}
    creation = {
        "store_id": store_id,
        "title": "Подброшено",
        "category": "jackets",
        "audience": "men",
        "base_price_minor": 100,
    }

    attempts = [
        stranger.get(f"/merchant/products?store_id={store_id}"),
        stranger.get(f"/merchant/products/{product['id']}"),
        stranger.patch(f"/merchant/products/{product['id']}", json=update),
        stranger.post(f"/merchant/products/{product['id']}/submit"),
        stranger.post(f"/merchant/products/{product['id']}/archive"),
        stranger.post(f"/merchant/products/{product['id']}/copy"),
        stranger.patch(f"/merchant/variants/{variant_id}", json={"availability": "out_of_stock"}),
        stranger.post("/merchant/products", json=creation),
        stranger.get(f"/merchant/stores/{store_id}/members"),
        stranger.post(f"/merchant/stores/{store_id}/members", json={"email": "x@y.test"}),
        stranger.patch(f"/merchant/stores/{store_id}", json={"name": "Hi", "city_code": "bishkek"}),
        upload(stranger, product["id"], photo()),
    ]

    # "Not found" rather than "forbidden": other stores' ids must not be confirmable.
    assert [response.status_code for response in attempts] == [404] * len(attempts)
    unchanged = owner.get(f"/merchant/products/{product['id']}").json()
    assert unchanged["title"] == "Куртка зимняя"
    assert unchanged["status"] == "draft"
    assert unchanged["variants"][0]["availability"] == "in_stock"


def test_staff_can_manage_products_but_not_the_store_or_its_members(client, owner, store):
    staff = Actor(client, "staff@shop.test")
    added = owner.post(f"/merchant/stores/{store['id']}/members", json={"email": "staff@shop.test"})
    assert added.status_code == 201 and added.json()["role"] == "staff"

    product = new_product(staff, store["id"], title="От сотрудника")
    assert product["status"] == "draft"

    # A staff member cannot give anyone access, including a higher role for themselves.
    invite = {"email": "staff@shop.test", "role": "owner"}
    assert staff.post(f"/merchant/stores/{store['id']}/members", json=invite).status_code == 403
    rename = {"name": "Переименовано", "city_code": "bishkek"}
    assert staff.patch(f"/merchant/stores/{store['id']}", json=rename).status_code == 403
    members = {
        m["email"]: m["role"] for m in owner.get(f"/merchant/stores/{store['id']}/members").json()
    }
    assert members == {"owner@shop.test": "owner", "staff@shop.test": "staff"}

    staff_id = staff.get("/auth/me").json()["id"]
    assert owner.delete(f"/merchant/stores/{store['id']}/members/{staff_id}").status_code == 204
    assert staff.get(f"/merchant/products/{product['id']}").status_code == 404


# --- Products ---------------------------------------------------------------


def test_stale_edit_is_refused_and_does_not_overwrite(owner, store):
    product = new_product(owner, store["id"])
    first = {"expected_version": product["version"], "base_price_minor": 4500 * SOM}
    assert owner.patch(f"/merchant/products/{product['id']}", json=first).status_code == 200

    # A second editor still holds the old version.
    stale = {"expected_version": product["version"], "title": "Старая вкладка"}
    conflict = owner.patch(f"/merchant/products/{product['id']}", json=stale)

    assert conflict.status_code == 409
    assert conflict.json()["code"] == "version_conflict"
    current = owner.get(f"/merchant/products/{product['id']}").json()
    assert current["title"] == "Куртка зимняя"
    assert current["base_price_minor"] == 4500 * SOM


def test_price_must_be_positive_and_values_must_be_known(owner, store):
    base = {"store_id": store["id"], "title": "Худи", "category": "hoodies", "audience": "women"}

    free = owner.post("/merchant/products", json={**base, "base_price_minor": 0})
    unknown = owner.post(
        "/merchant/products", json={**base, "base_price_minor": 100, "category": "spaceships"}
    )

    assert free.status_code == 422
    assert unknown.json()["code"] == "unknown_value"


def test_same_colour_and_size_cannot_be_listed_twice(owner, store):
    twin = {"size_system": "INT", "size_label": "L", "color": "black"}

    response = owner.post(
        "/merchant/products",
        json={
            "store_id": store["id"],
            "title": "Дубль",
            "category": "jackets",
            "audience": "men",
            "base_price_minor": 100,
            "variants": [twin, twin],
        },
    )

    assert response.status_code == 409
    assert response.json()["code"] == "duplicate_variant"


def test_editing_variants_keeps_updates_adds_and_removes(owner, store):
    product = new_product(owner, store["id"])
    large, medium = product["variants"]

    updated = owner.patch(
        f"/merchant/products/{product['id']}",
        json={
            "expected_version": product["version"],
            "variants": [
                {**large, "color": "black", "price_override_minor": 5500 * SOM},
                {"size_system": "INT", "size_label": "XL", "color": "white", "quantity": 0},
            ],
        },
    ).json()

    by_size = {v["size_label"]: v for v in updated["variants"]}
    assert set(by_size) == {"L", "XL"}
    assert by_size["L"]["id"] == large["id"]
    assert by_size["L"]["price_override_minor"] == 5500 * SOM
    # An exact quantity of zero means out of stock.
    assert by_size["XL"]["availability"] == "out_of_stock"
    assert medium["id"] not in {v["id"] for v in updated["variants"]}


def test_confirmation_time_moves_on_a_new_status_or_explicit_confirmation_only(owner, store):
    product = new_product(owner, store["id"])
    variant_id = product["variants"][0]["id"]
    created_at = product["variants"][0]["availability_confirmed_at"]
    # Stating "in stock" when creating the variant counts as confirming it.
    assert created_at is not None

    repriced = owner.patch(
        f"/merchant/variants/{variant_id}", json={"price_override_minor": 4000 * SOM}
    ).json()
    assert repriced["variants"][0]["availability_confirmed_at"] == created_at

    changed = owner.patch(f"/merchant/variants/{variant_id}", json={"availability": "out_of_stock"})
    assert changed.json()["variants"][0]["availability"] == "out_of_stock"
    assert changed.json()["variants"][0]["availability_confirmed_at"] > created_at

    confirmed = owner.patch(
        f"/merchant/variants/{variant_id}",
        json={"availability": "in_stock", "confirm_availability": True},
    )
    assert confirmed.json()["variants"][0]["availability_confirmed_at"] is not None


# --- Photos -----------------------------------------------------------------


def test_only_real_images_are_accepted(owner, store, object_storage):
    product = new_product(owner, store["id"])

    disguised = upload(owner, product["id"], b"<script>alert(1)</script>", "photo.jpg")
    svg = upload(owner, product["id"], b"<svg xmlns='http://www.w3.org/2000/svg'/>", "a.svg")
    huge = upload(owner, product["id"], b"\0" * (get_settings().upload_max_bytes + 1))

    assert disguised.json()["code"] == "unsupported_image"
    assert svg.json()["code"] == "unsupported_image"
    assert huge.status_code == 413
    assert owner.get(f"/merchant/products/{product['id']}").json()["images"] == []


def test_uploaded_photo_is_reencoded_without_exif_and_served_publicly(owner, store, object_storage):
    product = new_product(owner, store["id"])

    response = upload(owner, product["id"], photo(exif=True, size=(300, 200)), "../../evil.jpg")
    assert response.status_code == 201, response.text
    url = response.json()["images"][0]["url"]
    # The stored name is generated by the server, never taken from the upload.
    assert "evil" not in url and url.endswith(".jpg")

    key = url.split(f"/{get_settings().minio_bucket_assets}/", 1)[1]
    stored = storage.client().get_object(get_settings().minio_bucket_assets, key).read()
    image = Image.open(io.BytesIO(stored))
    assert image.format == "JPEG"
    assert not image.getexif()
    assert b"SecretCamera" not in stored
    # The EXIF rotation was applied to the pixels before the EXIF data was dropped.
    assert image.size == (200, 300)


def test_photo_limit_per_product(owner, store, object_storage):
    product = new_product(owner, store["id"])
    limit = get_settings().product_max_images

    statuses = [upload(owner, product["id"], photo(size=(50 + i, 50))).status_code
                for i in range(limit + 1)]  # fmt: skip

    assert statuses == [201] * limit + [409]


# --- Moderation -------------------------------------------------------------


def test_admin_area_is_closed_to_sellers(owner):
    assert owner.get("/admin/queue").status_code == 403
    decision = {"decision": "approve"}
    assert owner.post(f"/admin/products/{owner.csrf}/decision", json=decision).status_code in (
        403,
        422,
    )


def test_product_needs_a_variant_and_a_photo_before_review(owner, store):
    product = new_product(owner, store["id"], variants=[])

    response = owner.post(f"/merchant/products/{product['id']}/submit")

    assert response.status_code == 422
    assert response.json()["code"] == "not_ready"
    assert {item["field"] for item in response.json()["details"]} == {"variants", "images"}


def test_full_path_from_draft_to_public_catalog(client, owner, admin, store, object_storage):
    product = new_product(owner, store["id"], title="Парка тестовая")
    product_id = product["id"]
    upload(owner, product_id, photo())

    def in_catalog() -> bool:
        client.cookies.clear()
        found = client.get(f"{API}/products", params={"q": "Парка тестовая"}).json()["items"]
        return any(item["id"] == product_id for item in found)

    submitted = owner.post(f"/merchant/products/{product_id}/submit").json()
    assert submitted["status"] == "pending_review"
    assert not in_catalog()

    queue = admin.get("/admin/queue").json()
    assert product_id in {item["id"] for item in queue["products"]}
    assert store["id"] in {item["id"] for item in queue["stores"]}

    # A rejection needs a reason, and the reason reaches the seller.
    no_reason = admin.post(f"/admin/products/{product_id}/decision", json={"decision": "reject"})
    assert no_reason.status_code == 422
    rejected = admin.post(
        f"/admin/products/{product_id}/decision",
        json={"decision": "reject", "reason": "Фото не показывает товар"},
    )
    assert rejected.json()["status"] == "draft"
    returned = owner.get(f"/merchant/products/{product_id}").json()
    assert returned["review_note"] == "Фото не показывает товар"

    owner.post(f"/merchant/products/{product_id}/submit")
    approved = admin.post(f"/admin/products/{product_id}/decision", json={"decision": "approve"})
    assert approved.json()["status"] == "published"
    # The product is approved, but its store is not yet.
    assert not in_catalog()

    admin.post(f"/admin/stores/{store['id']}/decision", json={"decision": "approve"})
    assert in_catalog()
    public = client.get(f"{API}/products/{product_id}").json()
    assert public["store"]["slug"] == store["slug"]
    assert public["images"][0].startswith(get_settings().storage_public_url)

    # A buyer reports a problem; the administrator sees and resolves it.
    report = client.post(
        f"{API}/reports",
        json={"product_id": product_id, "reason": "wrong_price", "comment": "В магазине дороже"},
    )
    assert report.status_code == 201
    open_reports = admin.get("/admin/reports").json()
    assert [r["product_title"] for r in open_reports] == ["Парка тестовая"]
    resolve = {"resolution": "Цена исправлена"}
    assert (
        admin.post(f"/admin/reports/{open_reports[0]['id']}/resolve", json=resolve).status_code
        == 204
    )
    assert admin.get("/admin/reports").json() == []

    # Sold out: the variant change is public at once.
    variant_id = public["variants"][0]["id"]
    owner.patch(f"/merchant/variants/{variant_id}", json={"quantity": 0})
    client.cookies.clear()
    variants = client.get(f"{API}/products/{product_id}").json()["variants"]
    assert variants[0]["availability"] == "out_of_stock"

    archived = owner.post(f"/merchant/products/{product_id}/archive").json()
    assert archived["status"] == "archived"
    assert not in_catalog()
    client.cookies.clear()
    assert client.get(f"{API}/products/{product_id}").status_code == 404


def test_blocked_product_cannot_be_edited_or_resubmitted(owner, admin, store):
    product = new_product(owner, store["id"])
    blocked = admin.post(
        f"/admin/products/{product['id']}/decision",
        json={"decision": "block", "reason": "Чужие фотографии"},
    )
    assert blocked.json()["status"] == "blocked"

    edit = {"expected_version": product["version"], "title": "Снова"}
    assert owner.patch(f"/merchant/products/{product['id']}", json=edit).status_code == 403
    assert owner.post(f"/merchant/products/{product['id']}/submit").status_code == 403


def test_report_on_a_hidden_product_is_not_accepted(client, owner, store):
    draft = new_product(owner, store["id"])
    client.cookies.clear()

    response = client.post(f"{API}/reports", json={"product_id": draft["id"], "reason": "other"})

    assert response.status_code == 404
