import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.deps import current_session, require_session
from app.accounts.emails import RESET, VERIFY, consume_token, send_account_email
from app.accounts.models import Session, User
from app.accounts.security import hash_password, new_token, token_hash, verify_password
from app.config import get_settings
from app.database import get_session
from app.errors import ApiError
from app.locale import current_locale
from app.rate_limit import rate_limit
from app.stores.models import Store, StoreMember

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


# A deliberately loose check: one @, a dot in the domain, no spaces. Whether the
# address really exists can only be proven by sending a confirmation message.
Email = Annotated[str, Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]


class RegisterIn(BaseModel):
    email: Email
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(min_length=1, max_length=100)


class LoginIn(BaseModel):
    email: Email
    password: str = Field(max_length=200)


class MembershipOut(BaseModel):
    store_id: uuid.UUID
    store_slug: str
    store_name: str
    store_status: str
    role: str


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_admin: bool
    email_verified: bool
    # Send this back in the X-CSRF-Token header on every changing request.
    csrf_token: str
    memberships: list[MembershipOut]


async def me_out(db: AsyncSession, session: Session) -> MeOut:
    rows = await db.execute(
        select(StoreMember.role, Store.id, Store.slug, Store.name, Store.status)
        .join(Store, Store.id == StoreMember.store_id)
        .where(StoreMember.user_id == session.user_id)
        .order_by(Store.name)
    )
    user = session.user
    return MeOut(
        id=user.id,
        email=user.email,
        name=user.name,
        is_admin=user.is_admin,
        email_verified=user.email_verified_at is not None,
        csrf_token=session.csrf_token,
        memberships=[
            MembershipOut(
                store_id=store_id, store_slug=slug, store_name=name, store_status=status, role=role
            )
            for role, store_id, slug, name, status in rows
        ],
    )


async def start_session(db: AsyncSession, response: Response, user: User) -> Session:
    token = new_token()
    session = Session(
        user_id=user.id,
        token_hash=token_hash(token),
        csrf_token=new_token(),
        expires_at=datetime.now(UTC) + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(session)
    await db.commit()
    session.user = user
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return session


@router.post("/register", status_code=201, dependencies=[Depends(rate_limit("register", limit=5))])
async def register(
    body: RegisterIn, response: Response, db: AsyncSession = Depends(get_session)
) -> MeOut:
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        name=body.name.strip(),
        # Emails are written in the language the person registered in.
        locale=current_locale(),
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise ApiError(409, "email_taken", "An account with this email already exists") from error
    session = await start_session(db, response, user)
    await send_account_email(db, user, VERIFY)
    return await me_out(db, session)


@router.post("/login", dependencies=[Depends(rate_limit("login", limit=10))])
async def login(
    body: LoginIn, response: Response, db: AsyncSession = Depends(get_session)
) -> MeOut:
    # The same answer for "no such account" and "wrong password", so the
    # endpoint cannot be used to find out which emails are registered.
    invalid = ApiError(401, "invalid_credentials", "Wrong email or password")
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not user.is_active:
        raise invalid

    now = datetime.now(UTC)
    if user.locked_until and user.locked_until > now:
        raise ApiError(429, "too_many_attempts", "Too many attempts. Try again later")

    if not verify_password(body.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= settings.login_max_failures:
            user.locked_until = now + timedelta(minutes=settings.login_lock_minutes)
            user.failed_logins = 0
        await db.commit()
        raise invalid

    user.failed_logins = 0
    user.locked_until = None
    return await me_out(db, await start_session(db, response, user))


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    session: Annotated[Session, Depends(require_session)],
    db: AsyncSession = Depends(get_session),
) -> None:
    session.revoked_at = datetime.now(UTC)
    await db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")


@router.get("/me")
async def me(
    session: Annotated[Session | None, Depends(current_session)],
    db: AsyncSession = Depends(get_session),
) -> MeOut | None:
    """The signed-in account, or null for a guest."""
    return await me_out(db, session) if session else None


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ForgotIn(BaseModel):
    email: Email


class ResetIn(TokenIn):
    new_password: str = Field(min_length=8, max_length=200)


@router.post("/verify-email", status_code=204)
async def verify_email(body: TokenIn, db: AsyncSession = Depends(get_session)) -> None:
    """Confirm an email address with the token from the emailed link."""
    user_id = await consume_token(db, body.token, VERIFY)
    if user_id is None:
        raise ApiError(400, "invalid_token", "This link is not valid or has expired")
    user = await db.get(User, user_id)
    user.email_verified_at = datetime.now(UTC)
    await db.commit()


@router.post(
    "/verify-email/resend",
    status_code=204,
    dependencies=[Depends(rate_limit("resend", limit=3))],
)
async def resend_verification(
    session: Annotated[Session, Depends(require_session)], db: AsyncSession = Depends(get_session)
) -> None:
    if session.user.email_verified_at is None:
        await send_account_email(db, session.user, VERIFY)


@router.post(
    "/password/forgot", status_code=204, dependencies=[Depends(rate_limit("forgot", limit=5))]
)
async def forgot_password(body: ForgotIn, db: AsyncSession = Depends(get_session)) -> None:
    """Email a password reset link. The answer is the same whether or not the
    address has an account, so the endpoint cannot be used to find registered emails."""
    user = await db.scalar(select(User).where(User.email == body.email.lower(), User.is_active))
    if user is not None:
        await send_account_email(db, user, RESET)


@router.post("/password/reset", status_code=204)
async def reset_password(body: ResetIn, db: AsyncSession = Depends(get_session)) -> None:
    user_id = await consume_token(db, body.token, RESET)
    if user_id is None:
        raise ApiError(400, "invalid_token", "This link is not valid or has expired")
    user = await db.get(User, user_id)
    user.password_hash = hash_password(body.new_password)
    user.failed_logins = 0
    user.locked_until = None
    # Receiving the link proves the address belongs to the person.
    user.email_verified_at = user.email_verified_at or datetime.now(UTC)
    # Whoever knew the old password is signed out everywhere.
    await db.execute(
        update(Session)
        .where(Session.user_id == user.id, Session.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()
