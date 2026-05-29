from fastapi import APIRouter, HTTPException
from app.config import settings

router = APIRouter(prefix="/test", tags=["test"])

TEST_EMAIL = "neobanksupport@gmail.com"


@router.post("/send-email")
async def send_test_email():
    """Send a test email to the demo address so we can verify live email ingestion."""
    if not settings.gmail_address or not settings.gmail_app_password:
        raise HTTPException(status_code=503, detail="Email not configured (GMAIL_ADDRESS missing in .env)")

    from app.integrations.email_client import send_email
    await send_email(
        to=TEST_EMAIL,
        subject="NeoBank Support — Live Test",
        body=(
            "Hi Viraj,\n\n"
            "This is a live test from ContextFlow. "
            "Reply to this email and your message will appear in the NeoBank agent dashboard.\n\n"
            "— NeoBank Support System"
        ),
    )
    return {"ok": True, "sent_to": TEST_EMAIL}
