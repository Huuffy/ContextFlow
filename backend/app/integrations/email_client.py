import asyncio
import aiosmtplib
import logging
import uuid
from datetime import date
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)

# Gmail free-tier SMTP hard limit is 100 emails/day (500 is web-UI only).
# We stop at 90 to leave 10 as headroom for transactional replies.
_DAILY_LIMIT = 90
_sent_date: date | None = None
_sent_today: int = 0

# Temporary SMTP error codes — worth retrying after a back-off
_RETRYABLE_CODES = {421, 450, 452}
# Max retries and initial back-off (doubles each attempt)
_MAX_RETRIES = 3
_BACKOFF_BASE = 15  # seconds


class EmailRateLimitError(Exception):
    """Raised when Gmail persistently throttles us — caller should pause the campaign."""


def _reset_daily_counter() -> None:
    global _sent_date, _sent_today
    today = date.today()
    if _sent_date != today:
        _sent_date = today
        _sent_today = 0


def daily_quota_remaining() -> int:
    _reset_daily_counter()
    return max(0, _DAILY_LIMIT - _sent_today)


async def send_email(
    to: str,
    subject: str,
    body: str,
    in_reply_to: str | None = None,
    references: str | None = None,
) -> None:
    global _sent_today

    if not settings.gmail_address or not settings.gmail_app_password:
        logger.warning(f"[EMAIL STUB] To: {to} | Subject: {subject} | Body: {body[:80]}")
        return

    _reset_daily_counter()
    if _sent_today >= _DAILY_LIMIT:
        raise EmailRateLimitError(f"Daily Gmail quota reached ({_DAILY_LIMIT} emails). Retry tomorrow.")

    msg = MIMEMultipart("alternative")
    msg["From"] = settings.gmail_address
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = f"<{uuid.uuid4()}@neobanksupport>"
    msg["List-Unsubscribe"] = f"<mailto:{settings.gmail_address}?subject=unsubscribe>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = references or in_reply_to

    msg.attach(MIMEText(body, "plain"))

    last_exc: Exception | None = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.gmail_smtp_server,
                port=587,
                username=settings.gmail_address,
                password=settings.gmail_app_password,
                use_tls=False,
                start_tls=True,
            )
            _sent_today += 1
            logger.info(f"Email sent to {to} (attempt {attempt}, today={_sent_today}/{_DAILY_LIMIT})")
            return
        except aiosmtplib.SMTPException as exc:
            last_exc = exc
            code = getattr(exc, "code", 0) or 0
            if code in _RETRYABLE_CODES:
                wait = _BACKOFF_BASE * (2 ** (attempt - 1))  # 15s, 30s, 60s
                logger.warning(
                    f"Gmail rate-limit ({code}) sending to {to} — "
                    f"attempt {attempt}/{_MAX_RETRIES}, backing off {wait}s"
                )
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(wait)
                    continue
                # All retries exhausted on a rate-limit code → tell caller to pause
                raise EmailRateLimitError(
                    f"Gmail persistently throttling (code {code}) after {_MAX_RETRIES} attempts"
                ) from exc
            elif code >= 500:
                # Permanent rejection (550 spam policy, 554 blocked, etc.) — don't retry
                logger.error(f"Permanent SMTP rejection ({code}) for {to}: {exc}")
                raise
            else:
                logger.error(f"SMTP error sending to {to}: {exc}")
                raise

    if last_exc:
        raise last_exc
