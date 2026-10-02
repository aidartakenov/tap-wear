"""Photo search: indexing on approval, ranking, filters, and the upload checks."""

import asyncio
import io

import pytest
from PIL import Image

from app import storage
from tests.conftest import prepare_database
from tests.test_merchant import ADMIN_EMAIL, Actor, new_product, new_store, upload

API = "/api/v1"


def picture(color: str, size=(240, 320)) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", size, color).save(output, format="JPEG")
    return output.getvalue()


@pytest.fixture(scope="module", autouse=True)
def restore_fixtures(database):
    """These tests create a store and products; put the fixture data back afterwards."""
    yield
    asyncio.run(prepare_database())


@pytest.fixture(scope="module")
def object_storage():
    try:
        storage.ensure_assets_bucket()
    except Exception as error:  # noqa: BLE001
        pytest.skip(f"Object storage is not reachable ({error}); start infra/docker-compose.yml")


@pytest.fixture(scope="module")
def published(client, object_storage) -> dict[str, str]:
    """Two approved products of one approved store: a red one and a navy one."""
    seller = Actor(client, "seller@search.test")
    admin = Actor(client, ADMIN_EMAIL, register=False)
    store = new_store(seller, "Магазин для поиска")
    admin.post(f"/admin/stores/{store['id']}/decision", json={"decision": "approve"})
    ids = {}
    for name, color, audience in (("red", "red", "women"), ("navy", "navy", "men")):
        product = new_product(seller, store["id"], title=f"Вещь {name}", audience=audience)
        assert upload(seller, product["id"], picture(color)).status_code == 201
        seller.post(f"/merchant/products/{product['id']}/submit")
        approved = admin.post(
            f"/admin/products/{product['id']}/decision", json={"decision": "approve"}
        )
        assert approved.json()["status"] == "published"
        ids[name] = product["id"]
    return ids


def search(client, color: str, **params):
    client.cookies.clear()
    return client.post(
        f"{API}/search/visual",
        params=params,
        files={"file": ("query.jpg", picture(color, size=(300, 300)), "image/jpeg")},
    )


def test_approved_products_are_indexed_and_the_closest_photo_comes_first(client, published):
    status = client.get(f"{API}/search/visual/status").json()
    assert status["placeholder"] is True and status["indexed_photos"] >= 2

    by_red = [item["id"] for item in search(client, "red").json()["items"]]
    by_navy = [item["id"] for item in search(client, "#000070").json()["items"]]
    assert by_red[0] == published["red"] and by_navy[0] == published["navy"]
    # Both are ranked; how alike they are is not exposed.
    assert set(by_red) >= set(published.values())
    assert "distance" not in search(client, "red").json()["items"][0]


def test_catalog_filters_apply_before_ranking(client, published):
    only_men = search(client, "red", audience="men").json()["items"]
    assert published["red"] not in [item["id"] for item in only_men]
    assert published["navy"] in [item["id"] for item in only_men]
    assert search(client, "red", price_max_minor=100).json()["items"] == []


def test_photo_saved_from_the_web_as_avif_is_accepted(client, published):
    output = io.BytesIO()
    Image.new("RGB", (300, 300), "red").save(output, format="AVIF")
    client.cookies.clear()
    found = client.post(
        f"{API}/search/visual", files={"file": ("saved.jpg", output.getvalue(), "image/jpeg")}
    )
    assert found.status_code == 200, found.text
    assert found.json()["items"][0]["id"] == published["red"]


def test_query_must_be_a_real_picture(client, published):
    client.cookies.clear()
    fake = client.post(f"{API}/search/visual", files={"file": ("a.jpg", b"<script>", "image/jpeg")})
    assert fake.json()["code"] == "unsupported_image"
    assert client.post(f"{API}/search/visual").status_code == 422


def test_similar_products_are_other_visible_products_closest_first(
    client, published, object_storage
):
    client.cookies.clear()
    similar = client.get(f"{API}/search/similar/{published['red']}").json()["items"]
    ids = [item["id"] for item in similar]
    # The product itself is never its own neighbour; the other indexed one is.
    assert published["red"] not in ids and published["navy"] in ids
    assert (
        client.get(f"{API}/search/similar/{published['red']}", params={"limit": 0}).status_code
        == 422
    )
