import asyncio
import logging
import email as email_lib
from email.header import decode_header
from aioimaplib import IMAP4_SSL
from app.config import settings
from app.events.queues import InboundEvent

logger = logging.getLogger(__name__)

_startup_drain_done = False  # True after first poll drains existing unread

# Senders to ignore — automated/marketing/system emails
_BLOCKED_SENDER_PATTERNS = (
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "notifications@", "newsletter@", "updates@", "mailer@",
    "mail.zee5.com", "hackerrankmail.com", "namecheap.com",
    "hopeforpaws.org", "twitter.com", "accounts.google.com",
    "google.com", "googlecommunityteam", "location-history",
)


def _is_automated(sender_email: str) -> bool:
    s = sender_email.lower()
    return any(p in s for p in _BLOCKED_SENDER_PATTERNS)


async def run_email_poller(queue: asyncio.Queue) -> None:
    logger.info("Gmail IMAP poller started")
    while True:
        try:
            await _poll_once(queue)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"IMAP poll error: {e}")
        await asyncio.sleep(settings.gmail_poll_interval_seconds)


async def _poll_once(queue: asyncio.Queue) -> None:
    imap = IMAP4_SSL(settings.gmail_imap_server)
    await imap.wait_hello_from_server()
    password = settings.gmail_app_password.replace(" ", "")
    typ, data = await imap.login(settings.gmail_address, password)
    if typ != "OK":
        raise RuntimeError(f"IMAP login failed ({typ}): {data} — check GMAIL_APP_PASSWORD in .env")
    typ, data = await imap.select("INBOX")
    if typ != "OK":
        raise RuntimeError(f"IMAP SELECT failed: {data}")

    global _startup_drain_done
    _, data = await imap.search("UNSEEN")
    uids = data[0].split() if data[0] else []

    if not _startup_drain_done:
        # Mark all currently-unread emails as read without processing them.
        # Only emails arriving AFTER this point will be handled.
        if uids:
            uid_list = ",".join(
                uid.decode() if isinstance(uid, bytes) else str(uid) for uid in uids
            )
            await imap.store(uid_list, "+FLAGS", "\\Seen")
            logger.info(f"Startup drain: marked {len(uids)} existing unread emails as read — listening for new mail only")
        else:
            logger.info("Startup drain: inbox already empty — listening for new mail")
        _startup_drain_done = True
        await imap.logout()
        return

    for uid in uids:
        uid_str = uid.decode() if isinstance(uid, bytes) else str(uid)

        _, msg_data = await imap.fetch(uid_str, "(RFC822)")
        raw = msg_data[1] if len(msg_data) > 1 else None
        if not raw:
            continue

        msg = email_lib.message_from_bytes(bytes(raw))
        sender = msg.get("From", "")
        subject = _decode_header(msg.get("Subject", "(no subject)"))
        body = _extract_body(msg)

        if not body or not sender:
            # Mark as read so we don't re-process on next poll
            await imap.store(uid_str, "+FLAGS", "\\Seen")
            continue

        import re
        match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', sender)
        if not match:
            await imap.store(uid_str, "+FLAGS", "\\Seen")
            continue
        sender_email = match.group(0).lower()

        # Skip our own outbound emails
        if sender_email == settings.gmail_address.lower():
            await imap.store(uid_str, "+FLAGS", "\\Seen")
            continue

        # Skip automated / marketing / noreply senders
        if _is_automated(sender_email):
            logger.debug(f"Skipping automated email from {sender_email}")
            await imap.store(uid_str, "+FLAGS", "\\Seen")
            continue

        message_id_header = msg.get("Message-ID", "").strip()

        # For replies (Re:), just show the body; for new threads, prepend the subject
        is_reply = subject.lower().startswith("re:")
        content = body if is_reply else f"Subject: {subject}\n\n{body}"

        event = InboundEvent(
            channel="email",
            identifier=sender_email,
            content=content,
            external_id=message_id_header or uid_str,  # prefer real Message-ID for threading
            raw={
                "sender_name": sender.split("<")[0].strip().strip('"'),
                "message_id": message_id_header,
                "subject": subject,
                "imap_uid": uid_str,
            },
        )
        await queue.put(event)
        # Mark as read so restarts don't re-import
        await imap.store(uid_str, "+FLAGS", "\\Seen")
        logger.info(f"Email from {sender_email}: {subject[:60]}")

    await imap.logout()


def _decode_header(value: str) -> str:
    parts = decode_header(value)
    result = []
    for part, encoding in parts:
        if isinstance(part, bytes):
            result.append(part.decode(encoding or "utf-8", errors="replace"))
        else:
            result.append(part)
    return "".join(result)


def _extract_body(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                raw = payload.decode(part.get_content_charset() or "utf-8", errors="replace") if payload else ""
                return _strip_quoted_reply(raw)
    else:
        payload = msg.get_payload(decode=True)
        raw = payload.decode(msg.get_content_charset() or "utf-8", errors="replace") if payload else ""
        return _strip_quoted_reply(raw)
    return ""


def _strip_quoted_reply(text: str) -> str:
    """Remove quoted reply content — lines starting with '>' and 'On ... wrote:' blocks."""
    import re
    lines = text.splitlines()
    cleaned = []
    for line in lines:
        # Stop at Gmail/Outlook "On <date> ... wrote:" separator
        if re.match(r'^On .{10,} wrote:$', line.strip()):
            break
        # Stop at Outlook-style separator
        if re.match(r'^-+\s*Original Message\s*-+$', line.strip(), re.IGNORECASE):
            break
        # Skip quoted lines
        if line.startswith(">"):
            continue
        cleaned.append(line)
    return "\n".join(cleaned).strip()
