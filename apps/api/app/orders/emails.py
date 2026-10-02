"""Order emails: a new paid order for the store, and each change for the buyer.

Sent after the change is saved. A message that fails to send never undoes the
order: the cabinet and "My orders" always show the real state.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import telegram
from app.accounts.models import User
from app.config import get_settings
from app.mailer import send_email
from app.orders.models import Order, OrderStatus
from app.stores.models import Store, StoreMember

settings = get_settings()


def som(price_minor: int) -> str:
    whole, part = divmod(price_minor, 100)
    grouped = f"{whole:,}".replace(",", " ")
    return f"{grouped},{part:02d} сом" if part else f"{grouped} сом"


def item_line(order: Order) -> str:
    """The order's contents, one item per line."""
    lines = []
    for item in order.items:
        details = ", ".join(part for part in (item.size_label, item.color_name) if part)
        count = f" × {item.quantity}" if item.quantity > 1 else ""
        lines.append(f"{item.title}" + (f" ({details})" if details else "") + count)
    return "\n".join(lines)


def delivery_line(order: Order, lang: str) -> str:
    if order.delivery_method == "delivery":
        label = {"ru": "Доставка", "ky": "Жеткирүү"}[lang]
        return f"{label}: {order.delivery_address}"
    return {"ru": "Самовывоз из магазина", "ky": "Дүкөндөн алып кетүү"}[lang]


# The Kyrgyz texts are machine-drafted and need review by a native speaker.
BUYER = {
    OrderStatus.PAID: {
        "ru": (
            "Заказ №{number} оплачен",
            "Магазин «{store}» получил ваш заказ и скоро свяжется с вами.",
        ),
        "ky": (
            "№{number} буйрутма төлөндү",
            "«{store}» дүкөнү буйрутмаңызды алды, жакында байланышат.",
        ),
    },
    OrderStatus.ACCEPTED: {
        "ru": (
            "Заказ №{number} принят магазином",
            "Магазин «{store}» подтвердил заказ и готовит его.",
        ),
        "ky": (
            "№{number} буйрутманы дүкөн кабыл алды",
            "«{store}» дүкөнү буйрутманы ырастап, даярдап жатат.",
        ),
    },
    OrderStatus.SHIPPED: {
        "ru": (
            "Заказ №{number} передан в доставку",
            "Магазин «{store}» передал заказ в доставку или подготовил к выдаче.",
        ),
        "ky": (
            "№{number} буйрутма жеткирүүгө берилди",
            "«{store}» дүкөнү буйрутманы жеткирүүгө берди же берүүгө даярдады.",
        ),
    },
    OrderStatus.COMPLETED: {
        "ru": ("Заказ №{number} получен", "Спасибо за покупку в магазине «{store}»."),
        "ky": ("№{number} буйрутма алынды", "«{store}» дүкөнүнөн сатып алганыңыз үчүн рахмат."),
    },
    OrderStatus.REFUNDED: {
        "ru": (
            "Заказ №{number} отменён, деньги возвращаются",
            "Заказ в магазине «{store}» отменён.",
        ),
        "ky": (
            "№{number} буйрутма жокко чыгарылды, акча кайтарылат",
            "«{store}» дүкөнүндөгү буйрутма жокко чыгарылды.",
        ),
    },
}

REASON = {"ru": "Причина: {note}", "ky": "Себеби: {note}"}
ORDERS_LINK = {"ru": "Ваши заказы: {link}", "ky": "Буйрутмаларыңыз: {link}"}

STORE_NEW = {
    "ru": (
        "Новый заказ №{number}",
        "В магазине «{store}» новый оплаченный заказ.\n\n{item}\n{price}\n{delivery}\n\n"
        "Покупатель: {buyer}, {phone}\n\nПримите заказ в кабинете: {link}",
    ),
    "ky": (
        "Жаңы буйрутма №{number}",
        "«{store}» дүкөнүндө жаңы төлөнгөн буйрутма бар.\n\n{item}\n{price}\n{delivery}\n\n"
        "Сатып алуучу: {buyer}, {phone}\n\nБуйрутманы кабинеттен кабыл алыңыз: {link}",
    ),
}
STORE_CANCELLED = {
    "ru": (
        "Заказ №{number} отменён покупателем",
        "Покупатель отменил заказ в магазине «{store}».\n\n{item}",
    ),
    "ky": (
        "№{number} буйрутманы сатып алуучу жокко чыгарды",
        "Сатып алуучу «{store}» дүкөнүндөгү буйрутманы жокко чыгарды.\n\n{item}",
    ),
}


def language(user: User) -> str:
    return "ky" if user.locale == "ky" else "ru"


async def tell_buyer(db: AsyncSession, order: Order, store: Store) -> None:
    texts = BUYER.get(OrderStatus(order.status))
    buyer = await db.get(User, order.user_id)
    if texts is None or buyer is None:
        return
    lang = language(buyer)
    subject, lead = texts[lang]
    lines = [
        lead.format(store=store.name),
        "",
        item_line(order),
        som(order.total_minor),
        delivery_line(order, lang),
    ]
    if order.status == OrderStatus.REFUNDED and order.closing_note:
        lines += ["", REASON[lang].format(note=order.closing_note)]
    lines += ["", ORDERS_LINK[lang].format(link=f"{settings.web_base_url}/orders")]
    await send_email(buyer.email, subject.format(number=order.number), "\n".join(lines))


async def tell_store(db: AsyncSession, order: Order, store: Store, texts: dict) -> None:
    """Write to everyone who works in the store, each in their own language."""
    buyer = await db.get(User, order.user_id)
    members = await db.scalars(
        select(User)
        .join(StoreMember, StoreMember.user_id == User.id)
        .where(StoreMember.store_id == store.id, User.is_active)
    )

    def filled(lang: str) -> tuple[str, str]:
        subject, body = texts[lang]
        return subject.format(number=order.number), body.format(
            store=store.name,
            item=item_line(order),
            price=som(order.total_minor),
            delivery=delivery_line(order, lang),
            buyer=buyer.name if buyer else "",
            phone=order.buyer_phone,
            link=f"{settings.web_base_url}/cabinet/stores/{store.id}",
        )

    for member in members:
        subject, body = filled(language(member))
        await send_email(member.email, subject, body)
    # The store's Telegram chat, if it connected one, gets the same notice at once.
    if store.telegram_chat_id:
        subject, body = filled("ru")
        await telegram.send(store.telegram_chat_id, f"{subject}\n\n{body}")
