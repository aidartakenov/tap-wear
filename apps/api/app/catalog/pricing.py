"""What a size of a product costs: its full price, and the price after the store's discount.

A store sets a discount as a percentage for the whole product ("скидка −30%").
The discounted price is rounded down to whole soms, so buyers see 3 150 сом,
not 3 150,35. The same rule is written twice, in Python and in SQL, and both
must agree: the catalog filters and sorts by the SQL one, orders charge the
Python one.
"""

from sqlalchemy import case, func

from app.catalog.models import Product, ProductVariant

SOM = 100
MAX_DISCOUNT_PERCENT = 90


def discounted(full_minor: int, percent: int | None) -> int:
    if not percent:
        return full_minor
    rounded = full_minor * (100 - percent) // 100 // SOM * SOM
    # Never free, and never more than the full price for tiny prices.
    return min(full_minor, max(rounded, SOM))


def full_price(variant: ProductVariant, product: Product) -> int:
    """The price before any discount: the size's own price, else the product's."""
    return variant.price_override_minor or product.base_price_minor


def price(variant: ProductVariant, product: Product) -> int:
    """What the buyer pays for one piece of this size now."""
    return discounted(full_price(variant, product), product.discount_percent)


# The same two prices as SQL expressions, over the products and variants tables.
FULL_PRICE = func.coalesce(ProductVariant.price_override_minor, Product.base_price_minor)
EFFECTIVE_PRICE = case(
    (Product.discount_percent.is_(None), FULL_PRICE),
    else_=func.least(
        FULL_PRICE,
        func.greatest(FULL_PRICE * (100 - Product.discount_percent) // 100 // SOM * SOM, SOM),
    ),
)
