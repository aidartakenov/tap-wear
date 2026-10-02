"""Sending email.

Two backends, chosen by EMAIL_BACKEND:
- "console" (default): the message is written to the log and kept in memory.
  Nothing leaves the machine. Used for local development and tests.
- "smtp": the message is sent through the configured SMTP server.

Sending never raises to the caller: a mail server problem must not break
registration or reveal whether an address exists. Failures are logged.
"""

import asyncio
import logging
import smtplib
from collections import deque
from dataclasses import dataclass
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class SentEmail:
    to: str
    subject: str
    body: str


# The most recent messages of the console backend, newest last.
outbox: deque[SentEmail] = deque(maxlen=50)


def _send_smtp(message: SentEmail) -> None:
    email = EmailMessage()
    email["From"] = settings.email_from
    email["To"] = message.to
    email["Subject"] = message.subject
    email.set_content(message.body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_starttls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password.get_secret_value())
        smtp.send_message(email)


async def send_email(to: str, subject: str, body: str) -> None:
    message = SentEmail(to=to, subject=subject, body=body)
    if settings.email_backend == "console":
        outbox.append(message)
        logger.info("Email (console backend) to %s: %s\n%s", to, subject, body)
        return
    try:
        await asyncio.to_thread(_send_smtp, message)
    except Exception:  # noqa: BLE001 - see the module docstring
        logger.exception("Could not send email to %s", to)
