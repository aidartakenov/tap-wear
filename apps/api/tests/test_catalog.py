from tests.conftest import IDS, SOM

PRODUCTS = "/api/v1/products"


def titles(response) -> set[str]:
    assert response.status_code == 200, response.text
    return {item["title"] for item in response.json()["items"]}


def test_only_published_products_of_active_stores_are_listed(client):
    response = client.get(PRODUCTS)

    assert titles(response) == {"jacket", "parka", "hoodie"}
    assert response.json()["total"] == 3


def test_hidden_product_detail_is_not_found_with_the_standard_error_shape(client):
    response = client.get(f"{PRODUCTS}/{IDS['hidden']}")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert body["request_id"] == response.headers["X-Request-ID"]


def test_colour_and_size_must_belong_to_the_same_variant(client):
    # The jacket has black/L and white/M, but no white/L.
    assert titles(client.get(PRODUCTS, params={"color": "black", "size_label": "L"})) == {
        "jacket",
        "parka",
    }
    assert titles(client.get(PRODUCTS, params={"color": "white", "size_label": "L"})) == set()


def test_price_filter_uses_the_matching_variant_price(client):
    response = client.get(PRODUCTS, params={"price_max_minor": 4500 * SOM, "category": "jackets"})

    # Only the jacket's sold-out black/M variant is that cheap.
    assert titles(response) == {"jacket"}
    assert response.json()["items"][0]["price_minor"] == 4000 * SOM


def test_in_stock_and_price_must_hold_for_the_same_variant(client):
    response = client.get(
        PRODUCTS, params={"price_max_minor": 4500 * SOM, "in_stock": True, "category": "jackets"}
    )

    # The cheap variant is sold out and the in-stock ones cost more.
    assert titles(response) == set()


def test_in_stock_excludes_products_with_unconfirmed_availability(client):
    assert titles(client.get(PRODUCTS, params={"in_stock": True})) == {"jacket"}


def test_list_item_reports_price_range_sizes_and_availability(client):
    items = client.get(PRODUCTS, params={"q": "nike"}).json()["items"]

    assert len(items) == 1
    jacket = items[0]
    assert jacket["price_minor"] == 4000 * SOM and isinstance(jacket["price_minor"], int)
    assert jacket["price_varies"] is True
    assert jacket["availability"] == "in_stock"
    assert jacket["sizes"] == ["L", "M"]
    assert jacket["image_url"] == "https://example.test/jacket.jpg"


def test_product_without_confirmed_stock_is_not_reported_as_in_stock(client):
    hoodie = client.get(f"{PRODUCTS}/{IDS['hoodie']}").json()

    assert hoodie["availability"] == "unknown"
    assert hoodie["sizes"] == []
    assert hoodie["store"]["slug"] == "open"


def test_search_matches_title_brand_store_and_category(client):
    assert titles(client.get(PRODUCTS, params={"q": "куртки"})) == {"jacket", "parka"}
    assert titles(client.get(PRODUCTS, params={"q": "open hoodie"})) == {"hoodie"}
    assert titles(client.get(PRODUCTS, params={"q": "100%"})) == set()


def test_cursor_pages_cover_every_product_once_in_price_order(client):
    seen, cursor = [], None
    for _ in range(10):
        params = {"sort": "price_asc", "limit": 1, **({"cursor": cursor} if cursor else {})}
        page = client.get(PRODUCTS, params=params).json()
        seen.extend(page["items"])
        cursor = page["next_cursor"]
        if cursor is None:
            break

    assert [item["title"] for item in seen] == ["hoodie", "jacket", "parka"]
    assert [item["price_minor"] for item in seen] == sorted(item["price_minor"] for item in seen)


def test_equal_prices_keep_a_stable_order_across_pages(client):
    # The jacket and the parka both cost 5 000 soms when only black/L variants match.
    params = {"sort": "price_desc", "color": "black", "size_label": "L", "limit": 1}
    first = client.get(PRODUCTS, params=params).json()
    second = client.get(PRODUCTS, params={**params, "cursor": first["next_cursor"]}).json()

    assert {first["items"][0]["title"], second["items"][0]["title"]} == {"jacket", "parka"}
    assert second["next_cursor"] is None


def test_bad_cursor_and_bad_limit_are_rejected_clearly(client):
    bad_cursor = client.get(PRODUCTS, params={"cursor": "not-a-cursor"})
    assert bad_cursor.status_code == 400
    assert bad_cursor.json()["code"] == "invalid_cursor"

    bad_limit = client.get(PRODUCTS, params={"limit": 101})
    assert bad_limit.status_code == 422
    assert bad_limit.json()["details"][0]["field"] == "limit"


def test_products_can_be_fetched_by_ids(client):
    response = client.get(PRODUCTS, params={"ids": [str(IDS["hoodie"]), str(IDS["hidden"])]})

    assert titles(response) == {"hoodie"}


def test_blocked_store_is_absent_from_stores(client):
    stores = client.get("/api/v1/stores").json()["items"]

    assert [store["slug"] for store in stores] == ["open"]
    # The draft product does not count.
    assert stores[0]["product_count"] == 3
    assert client.get("/api/v1/stores/blocked").status_code == 404


def test_catalog_filters_describe_only_visible_products(client):
    filters = client.get("/api/v1/catalog/filters").json()

    assert filters["product_count"] == 3
    assert {a["code"]: a["count"] for a in filters["audiences"]} == {"women": 1, "men": 2}
    assert [c["code"] for c in filters["categories"]] == ["jackets", "hoodies"]
    assert filters["price_max_minor"] == 5000 * SOM
    assert [store["slug"] for store in filters["stores"]] == ["open"]


def test_reference_names_follow_the_requested_language_with_russian_fallback(client):
    kyrgyz = {"Accept-Language": "ky-KG,ky;q=0.9,ru;q=0.8"}

    filters = client.get("/api/v1/catalog/filters", headers=kyrgyz).json()
    names = {category["code"]: category["name"] for category in filters["categories"]}
    jacket = client.get(f"{PRODUCTS}/{IDS['jacket']}", headers=kyrgyz).json()
    default = client.get(f"{PRODUCTS}/{IDS['jacket']}").json()

    # "hoodies" has no Kyrgyz name in the fixtures, so it stays Russian.
    assert names == {"jackets": "Курткалар", "hoodies": "Худи"}
    assert jacket["category"]["name"] == "Курткалар"
    assert default["category"]["name"] == "Куртки"
    assert titles(client.get(PRODUCTS, params={"q": "курткалар"})) == {"jacket", "parka"}
