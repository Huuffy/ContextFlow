import aiosmtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to: str,
    subject: str,
    body: str,
    in_reply_to: str | None = None,
    references: str | None = None,
) -> None:
    if not settings.gmail_address or not settings.gmail_app_password:
        logger.warning(f"[EMAIL STUB] To: {to} | Subject: {subject} | Body: {body[:80]}")
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.gmail_address
    msg["To"] = to
    msg["Subject"] = subject
    msg["List-Unsubscribe"] = f"<mailto:{settings.gmail_address}?subject=unsubscribe>"

    # Thread headers — keeps replies in the same Gmail/Outlook thread
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        # References must include the full chain; at minimum the same message-id
        msg["References"] = references or in_reply_to

    msg.attach(MIMEText(body, "plain"))

    await aiosmtplib.send(
        msg,
        hostname=settings.gmail_smtp_server,
        port=587,
        username=settings.gmail_address,
        password=settings.gmail_app_password,
        use_tls=False,
        start_tls=True,
    )
    logger.info(f"Email sent to {to} (thread: {bool(in_reply_to)})")
