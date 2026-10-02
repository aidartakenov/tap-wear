"""Account emails: address confirmation and password reset, in Russian or Kyrgyz."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.models import AccountToken, User
from app.accounts.security import new_token, token_hash
from app.config import get_settings
from app.mailer import send_email

settings = get_settings()

VERIFY = "verify_email"
RESET = "reset_password"
LIFETIME = {VERIFY: timedelta(hours=48), RESET: timedelta(hours=1)}

# The Kyrgyz texts are machine-drafted and need review by a native speaker.
TEXTS = {
    VERIFY: {
        "ru": (
            "Подтвердите почту для TapWear",
            "Здравствуйте, {name}!\n\n"
            "Чтобы подтвердить этот адрес для аккаунта TapWear, откройте ссылку:\n{link}\n\n"
            "Ссылка действует 48 часов. Если вы не регистрировались на TapWear, "
            "просто не отвечайте на это письмо.",
        ),
        "ky": (
            "TapWear үчүн почтаңызды ырастаңыз",
            "Саламатсызбы, {name}!\n\n"
            "TapWear аккаунтуңуз үчүн бул даректи ырастоо үчүн шилтемени ачыңыз:\n{link}\n\n"
            "Шилтеме 48 саат иштейт. Эгер TapWear сайтына катталбаган болсоңуз, "
            "бул катка жооп бербей эле коюңуз.",
        ),
    },
    RESET: {
        "ru": (
            "Сброс пароля TapWear",
            "Здравствуйте, {name}!\n\n"
            "Чтобы задать новый пароль для аккаунта TapWear, откройте ссылку:\n{link}\n\n"
            "Ссылка действует 1 час и срабатывает один раз. Если вы не просили сбросить "
            "пароль, ничего делать не нужно: пароль останется прежним.",
        ),
        "ky": (
            "TapWear сырсөзүн калыбына келтирүү",
            "Саламатсызбы, {name}!\n\n"
            "TapWear аккаунтуңузга жаңы сырсөз коюу үчүн шилтемени ачыңыз:\n{link}\n\n"
            "Шилтеме 1 саат иштейт жана бир жолу гана колдонулат. Эгер сырсөздү өзгөртүүнү "
            "сураган эмес болсоңуз, эч нерсе кылуунун кереги жок: сырсөз мурункудай калат.",
        ),
    },
}

PAGES = {VERIFY: "verify-email", RESET: "reset-password"}


async def send_account_email(db: AsyncSession, user: User, purpose: str) -> None:
    """Create a single-use token and email its link. Earlier unused tokens stop working."""
    now = datetime.now(UTC)
    await db.execute(
        update(AccountToken)
        .where(
            AccountToken.user_id == user.id,
            AccountToken.purpose == purpose,
            AccountToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    token = new_token()
    db.add(
        AccountToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=token_hash(token),
            expires_at=now + LIFETIME[purpose],
        )
    )
    await db.commit()

    subject, body = TEXTS[purpose]["ky" if user.locale == "ky" else "ru"]
    link = f"{settings.web_base_url}/{PAGES[purpose]}?token={token}"
    await send_email(user.email, subject, body.format(name=user.name, link=link))


async def consume_token(db: AsyncSession, token: str, purpose: str) -> uuid.UUID | None:
    """Mark a valid token as used and return its account id; None if it is not valid."""
    row = await db.scalar(
        select(AccountToken)
        .where(AccountToken.token_hash == token_hash(token), AccountToken.purpose == purpose)
        .with_for_update()
    )
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at <= now:
        return None
    row.used_at = now
    return row.user_id
