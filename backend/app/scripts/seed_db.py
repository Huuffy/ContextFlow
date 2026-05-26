"""
Seed NeoBank demo data: 20 customers, 15 rich multi-channel conversations,
varied statuses (open/waiting/resolved/closed), AI summaries with real sentiment.

Run: uv run python -m app.scripts.seed_db
Re-running drops and recreates all data cleanly.
"""
import asyncio
import json
import os
from datetime import date, timedelta, datetime, timezone
from decimal import Decimal
import random

from sqlalchemy import select, text

from app.db.session import AsyncSessionLocal, init_db
from app.config import settings
from app.models import (
    Agent, AgentRole, Customer, ChannelIdentifier, ChannelType,
    Conversation, ConversationStatus, Message, SenderType, MessageDirection, MessageStatus,
    Campaign, CampaignStatus,
    AISummary, SentimentType, Transaction, ConsentRecord, ConsentType, ConsentStatus,
)
from app.core.security import hash_password

NOW = datetime.now(timezone.utc)


def ago(**kwargs):
    return NOW - timedelta(**kwargs)


CUSTOMERS = [
    ("Priya Sharma",    "priya.sharma@gmail.com",    "+919876543210"),
    ("Rahul Verma",     "rahul.verma@gmail.com",     "+919876543211"),
    ("Ananya Iyer",     "ananya.iyer@gmail.com",     "+919876543212"),
    ("Karan Mehta",     "karan.mehta@gmail.com",     "+919876543213"),
    ("Sunita Patel",    "sunita.patel@gmail.com",    "+919876543214"),
    ("Arjun Nair",      "arjun.nair@gmail.com",      "+919876543215"),
    ("Deepika Singh",   "deepika.singh@gmail.com",   "+919876543216"),
    ("Vikram Rao",      "vikram.rao@gmail.com",      "+919876543217"),
    ("Meera Joshi",     "meera.joshi@gmail.com",     "+919876543218"),
    ("Aditya Kumar",    "aditya.kumar@gmail.com",    "+919876543219"),
    ("Pooja Gupta",     "pooja.gupta@gmail.com",     "+919876543220"),
    ("Rohit Desai",     "rohit.desai@gmail.com",     "+919876543223"),
    ("Neha Chaudhary",  "neha.chaudhary@gmail.com",  "+919876543224"),
    ("Manish Tiwari",   "manish.tiwari@gmail.com",   "+919876543225"),
    ("Shreya Banerjee", "shreya.banerjee@gmail.com", "+919876543226"),
    ("Varun Pillai",    "varun.pillai@gmail.com",    "+919876543227"),
    ("Divya Nair",      "divya.nair@gmail.com",      "+919876543228"),
    ("Nikhil Shah",     "nikhil.shah@gmail.com",     "+919876543229"),
    ("Sanjay Bhatia",   "sanjay.bhatia@gmail.com",   "+919876543221"),
    ("Kavya Reddy",     "kavya.reddy@gmail.com",     "+919876543222"),
]

MERCHANT_CATEGORIES = ["travel", "food", "shopping", "utilities", "entertainment", "healthcare", "education", "fuel"]
MERCHANTS = {
    "travel":        ["IndiGo Airlines", "MakeMyTrip", "IRCTC", "Ola", "Uber"],
    "food":          ["Swiggy", "Zomato", "McDonald's", "Domino's", "Starbucks"],
    "shopping":      ["Amazon", "Flipkart", "Myntra", "Ajio", "Nykaa"],
    "utilities":     ["BESCOM", "BSNL", "Airtel", "Jio", "Tata Power"],
    "entertainment": ["Netflix", "Hotstar", "PVR Cinemas", "BookMyShow", "Spotify"],
    "healthcare":    ["Apollo Pharmacy", "Practo", "Fortis Hospital", "MedPlus"],
    "education":     ["Byju's", "Unacademy", "Coursera", "NIIT"],
    "fuel":          ["HPCL", "BPCL", "Indian Oil", "Shell"],
}

# Each conversation: (topic, channels, status, sentiment, messages, one_liner, detailed_summary)
# messages: list of (content, sender_type, channel, created_at)
CONVERSATIONS = [
    # ── OPEN: Fresh tickets (customer sent, no agent reply yet) ──────────────
    {
        "customer": "Priya Sharma",
        "topic": "Double charge on credit card",
        "channels": ["whatsapp"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.frustrated,
        "one_liner": "Customer reports duplicate charge of ₹3,200 on credit card — urgent refund needed.",
        "summary": "Priya Sharma contacted via WhatsApp reporting that her credit card was charged twice for the same transaction of ₹3,200 at Swiggy. She is frustrated as the money hasn't been reversed. Requires immediate investigation of transaction logs.",
        "suggested": "Verify transaction logs for duplicate charge, initiate refund if confirmed, notify customer within 2 hours.",
        "messages": [
            ("Hi, I was charged twice on my credit card! ₹3200 got deducted twice for the same Swiggy order. This is really upsetting.", SenderType.customer, "whatsapp", ago(minutes=12)),
        ],
    },
    {
        "customer": "Karan Mehta",
        "topic": "Travel card limit increase request",
        "channels": ["whatsapp"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.neutral,
        "one_liner": "Customer requesting credit limit increase on travel card from ₹1L to ₹2L.",
        "summary": "Karan Mehta sent a WhatsApp message requesting an increase in his NeoBank Travel Card credit limit from ₹1,00,000 to ₹2,00,000. He mentioned he has an international trip planned next month and wants a higher limit for hotel bookings.",
        "suggested": "Check credit history and utilisation ratio. If eligible, process limit increase request and inform customer.",
        "messages": [
            ("I want to increase my travel card limit to 2 lakhs. I have an international trip next month and need higher limit for hotels.", SenderType.customer, "whatsapp", ago(minutes=28)),
        ],
    },
    {
        "customer": "Deepika Singh",
        "topic": "Net banking login not working",
        "channels": ["simulator"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.negative,
        "one_liner": "Customer locked out of net banking — cannot reset password as OTP not received.",
        "summary": "Deepika Singh reported that she has been unable to log into her net banking account for the past 2 days. The OTP required for password reset is not being delivered to her registered mobile number +919876543216.",
        "suggested": "Verify mobile number registration, trigger OTP resend from backend, escalate to tech team if issue persists.",
        "messages": [
            ("I cannot login to net banking since 2 days. OTP is not coming to my number. I tried calling helpline but no response.", SenderType.customer, "simulator", ago(minutes=45)),
        ],
    },
    # ── OPEN: Active (back-and-forth, customer replied last) ─────────────────
    {
        "customer": "Rahul Verma",
        "topic": "Personal loan prepayment query",
        "channels": ["whatsapp", "email"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.negative,
        "one_liner": "Customer wants to prepay personal loan early — unhappy with 2% foreclosure charges.",
        "summary": "Rahul Verma first contacted on WhatsApp asking about prepaying his personal loan. Agent responded with prepayment details. He then sent a detailed email questioning the 2% foreclosure charge which he feels is unfair. He has been a premium customer for 3 years and wants the charge waived.",
        "suggested": "Review foreclosure waiver eligibility for premium customers. Escalate to loans team for exception approval.",
        "messages": [
            ("Hi, I want to prepay my personal loan of 5 lakhs. What is the procedure?", SenderType.customer, "whatsapp", ago(hours=3, minutes=20)),
            ("Hello Rahul! Thank you for reaching out. To prepay your personal loan, a 2% foreclosure charge applies on the outstanding principal. Your current outstanding is ₹4,85,000. So the charge would be approximately ₹9,700. You can visit any branch or use our net banking to initiate this.", SenderType.agent, "whatsapp", ago(hours=2, minutes=55)),
            ("I just sent an email with more questions about this.", SenderType.customer, "whatsapp", ago(hours=2, minutes=30)),
            ("Subject: Foreclosure charge dispute\n\nDear NeoBank Team,\n\nI have been your customer for 3 years with a perfect repayment record. I find the 2% foreclosure charge unfair. I would like to request a waiver. I am a premium account holder and this charge seems excessive. Please reconsider.\n\nRegards,\nRahul Verma", SenderType.customer, "email", ago(hours=2, minutes=15)),
        ],
    },
    {
        "customer": "Ananya Iyer",
        "topic": "ATM card lost — need replacement",
        "channels": ["telegram", "email"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.frustrated,
        "one_liner": "Customer's ATM card lost — card blocked by agent but replacement delivery ETA unclear.",
        "summary": "Ananya Iyer reported her ATM card lost via Telegram. Agent immediately blocked the card. She then emailed asking for the replacement delivery timeline and whether she can use virtual card in the meantime. Customer is frustrated about the 7-10 day delivery window.",
        "suggested": "Confirm card block is active, enable virtual card access immediately, provide express courier option for physical card.",
        "messages": [
            ("My ATM card is lost! Please block it immediately. I had it at the airport.", SenderType.customer, "telegram", ago(hours=5, minutes=0)),
            ("Ananya, I have immediately blocked your ATM card ending in 4521. Your account is secure. A replacement card will be dispatched within 7-10 business days to your registered address.", SenderType.agent, "telegram", ago(hours=4, minutes=45)),
            ("Subject: Replacement card urgent\n\nHello,\n\nI need the replacement faster. Is there an express option? Also can I use a virtual card or UPI in the meantime? I have important payments to make this week.\n\nThanks,\nAnanya", SenderType.customer, "email", ago(hours=4, minutes=0)),
        ],
    },
    {
        "customer": "Sunita Patel",
        "topic": "Fixed deposit maturity and renewal",
        "channels": ["email"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.neutral,
        "one_liner": "Customer's ₹2L FD matures in 10 days — asking about renewal rates and TDS implications.",
        "summary": "Sunita Patel emailed about her ₹2,00,000 fixed deposit maturing in 10 days. She wants to know current FD rates for renewal and whether TDS will be deducted automatically. She is comparing rates with other banks.",
        "suggested": "Share current FD rate card, explain TDS rules for FDs above ₹40,000 interest, offer auto-renewal option.",
        "messages": [
            ("Hello, my FD of 2 lakhs is maturing on 25th. I want to know the renewal interest rates and if TDS will be deducted. Please advise.", SenderType.customer, "email", ago(hours=1, minutes=30)),
            ("Dear Sunita, thank you for writing in! Our current FD rates for 1-year tenure are 7.25% p.a. For amounts above ₹40,000 annual interest, TDS at 10% is applicable. Your ₹2L FD at current rates would earn ₹14,500 interest, which is below TDS threshold. We recommend auto-renewal. Should I initiate it?", SenderType.agent, "email", ago(hours=1, minutes=0)),
            ("Thanks for the info. Can you also tell me about 2-year FD rates? And is there any special rate for senior citizens? My mother might want to invest too.", SenderType.customer, "email", ago(minutes=40)),
        ],
    },
    {
        "customer": "Arjun Nair",
        "topic": "UPI ID change to new phone number",
        "channels": ["whatsapp", "telegram"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.neutral,
        "one_liner": "Customer changed phone number — needs UPI ID updated across WhatsApp and linked apps.",
        "summary": "Arjun Nair needs to update his UPI ID linked to his old phone number +919876543215 to his new number. He contacted on WhatsApp and also via Telegram. Agent explained the process but customer needs clarification on whether existing UPI transaction history will be preserved.",
        "suggested": "Guide customer through UPI ID update process in NeoBank app, confirm transaction history preservation, offer video call if needed.",
        "messages": [
            ("Hi I changed my phone number. How do I update my UPI ID? My old number was linked.", SenderType.customer, "whatsapp", ago(hours=6, minutes=0)),
            ("Hello Arjun! To update your UPI ID, open the NeoBank app → Payments → UPI Settings → Update Mobile Number. You'll need your new SIM with OTP verification. Your transaction history will be preserved.", SenderType.agent, "whatsapp", ago(hours=5, minutes=45)),
            ("I already tried that but getting an error saying 'mobile number not verified'. What to do?", SenderType.customer, "telegram", ago(hours=5, minutes=20)),
            ("That error usually means your new number hasn't been verified with NPCI yet. This can take 24-48 hours after SIM activation. Could you share your new mobile number so we can check the status on our end?", SenderType.agent, "telegram", ago(hours=5, minutes=0)),
            ("My new number is +919876599999. Please check. I need UPI urgently for my rent payment tomorrow.", SenderType.customer, "whatsapp", ago(hours=4, minutes=30)),
        ],
    },
    {
        "customer": "Nikhil Shah",
        "topic": "KYC renewal required",
        "channels": ["email", "whatsapp"],
        "status": ConversationStatus.open,
        "sentiment": SentimentType.neutral,
        "one_liner": "Customer's KYC expired — asking about re-KYC process and whether branch visit is mandatory.",
        "summary": "Nikhil Shah received a KYC renewal notice. He emailed asking whether re-KYC can be done online or requires a branch visit. Agent explained video KYC option. Customer then WhatsApp messaged asking about document requirements.",
        "suggested": "Confirm video KYC eligibility, share document checklist (PAN + Aadhaar), schedule video KYC appointment.",
        "messages": [
            ("I got a message that my KYC needs renewal. Can I do this online or do I need to visit branch?", SenderType.customer, "email", ago(hours=8, minutes=0)),
            ("Hi Nikhil! Great news — you can complete re-KYC via Video KYC from home. You'll need your PAN card and Aadhaar handy. The process takes about 10 minutes. Would you like me to send you the video KYC link?", SenderType.agent, "email", ago(hours=7, minutes=30)),
            ("Yes please send the link. Also what other documents do I need? I have PAN and Aadhaar. Is passport or anything else needed?", SenderType.customer, "whatsapp", ago(hours=7, minutes=0)),
        ],
    },
    # ── WAITING: Agent replied last, awaiting customer response ──────────────
    {
        "customer": "Vikram Rao",
        "topic": "NEFT transfer amount mismatch",
        "channels": ["whatsapp"],
        "status": ConversationStatus.waiting,
        "sentiment": SentimentType.neutral,
        "one_liner": "NEFT of ₹50K sent by customer shows delivered but recipient bank shows not received.",
        "summary": "Vikram Rao reported that a NEFT transfer of ₹50,000 sent yesterday shows 'Delivered' status in NeoBank app but the recipient's bank (HDFC) shows it hasn't been received. Agent asked for UTR number to investigate with RBI NEFT settlement team.",
        "suggested": "Use UTR number to trace transaction with RBI NEFT portal, coordinate with HDFC for settlement confirmation.",
        "messages": [
            ("Hello, I sent NEFT of 50000 yesterday to my brother's HDFC account. My app shows delivered but he says not received. It's urgent.", SenderType.customer, "whatsapp", ago(hours=4, minutes=0)),
            ("Hi Vikram, I understand this is urgent. NEFT transactions can sometimes show a settlement lag of 2-4 hours across banks. To investigate, I need the UTR number from your transaction details. Could you share it? It starts with 'NE' followed by digits.", SenderType.agent, "whatsapp", ago(hours=3, minutes=30)),
        ],
    },
    {
        "customer": "Meera Joshi",
        "topic": "Credit card statement dispute",
        "channels": ["email"],
        "status": ConversationStatus.waiting,
        "sentiment": SentimentType.frustrated,
        "one_liner": "Customer disputes ₹8,400 charge from an unrecognised merchant — may be fraud.",
        "summary": "Meera Joshi emailed about a suspicious charge of ₹8,400 from 'GLOBALSHOP_INT' on her credit card statement which she does not recognise. Agent has requested the transaction date and whether card was physically with her to determine if it's a fraud case requiring chargeback.",
        "suggested": "If card was with customer and transaction is unrecognised, initiate chargeback process and issue replacement card as precaution.",
        "messages": [
            ("I see a charge of ₹8400 from some merchant called GLOBALSHOP_INT on my credit card. I don't recognise this at all. This looks like fraud!", SenderType.customer, "email", ago(hours=6, minutes=0)),
            ("Dear Meera, thank you for bringing this to our attention. I've flagged this transaction for review. To proceed with a dispute/chargeback, I need to confirm:\n1. Was your physical card with you on that date?\n2. What was the transaction date shown in your statement?\n3. Have you shared your card details with anyone?\n\nPlease reply and we'll initiate the chargeback process immediately.", SenderType.agent, "email", ago(hours=5, minutes=0)),
            ("The card was with me the whole time. Let me check the date.", SenderType.customer, "email", ago(hours=4, minutes=30)),
            ("Thank you Meera. Please share the exact date when you have it. Also, as a precaution, should I temporarily block your card while we investigate? You can still use net banking and UPI.", SenderType.agent, "email", ago(hours=4, minutes=0)),
        ],
    },
    {
        "customer": "Aditya Kumar",
        "topic": "Account blocked after failed logins",
        "channels": ["telegram"],
        "status": ConversationStatus.waiting,
        "sentiment": SentimentType.negative,
        "one_liner": "Customer's account blocked after 5 failed login attempts — needs identity verification to unblock.",
        "summary": "Aditya Kumar's account was automatically blocked after 5 consecutive failed login attempts. He contacted via Telegram. Agent has explained the security procedure and sent an OTP to his registered email for identity verification to initiate account unblocking.",
        "suggested": "Once customer confirms OTP, reset account lock, force password reset, and review login attempt logs for security.",
        "messages": [
            ("My account is blocked!! I was trying to login and now it says account blocked. I haven't done anything wrong!", SenderType.customer, "telegram", ago(hours=2, minutes=0)),
            ("Hi Aditya, I can see your account was temporarily blocked as a security measure after multiple failed login attempts — this protects your account from unauthorized access. Don't worry, we can resolve this quickly.\n\nI've sent a verification OTP to your registered email aditya.kumar@gmail.com. Please share the OTP here so we can verify your identity and unblock the account.", SenderType.agent, "telegram", ago(hours=1, minutes=30)),
        ],
    },
    # ── RESOLVED ─────────────────────────────────────────────────────────────
    {
        "customer": "Pooja Gupta",
        "topic": "Cheque bounce reversal completed",
        "channels": ["whatsapp", "email"],
        "status": ConversationStatus.resolved,
        "sentiment": SentimentType.positive,
        "one_liner": "Cheque bounce charge of ₹500 reversed successfully — customer satisfied.",
        "summary": "Pooja Gupta contacted about a ₹500 cheque bounce penalty charged to her account. After verification, the agent confirmed it was an error due to a technical glitch and reversed the charge. Customer was very satisfied with the quick resolution.",
        "suggested": "No further action needed. Case resolved.",
        "messages": [
            ("Hi, I got a cheque bounce charge of ₹500 but my account had sufficient balance. This is wrong!", SenderType.customer, "whatsapp", ago(days=1, hours=3)),
            ("Hello Pooja! I can see the charge and I'm checking your account balance at the time of the cheque presentation. You're right — your account had sufficient balance. This appears to be a technical error. I'm initiating the reversal right away.", SenderType.agent, "whatsapp", ago(days=1, hours=2, minutes=45)),
            ("Thank you for checking so quickly!", SenderType.customer, "email", ago(days=1, hours=2, minutes=30)),
            ("I'm happy to confirm the ₹500 bounce charge has been reversed to your account. It will reflect within 2 hours. We apologize for the inconvenience. Is there anything else I can help you with?", SenderType.agent, "whatsapp", ago(days=1, hours=2)),
            ("Perfect! Thank you so much. Great service!", SenderType.customer, "whatsapp", ago(days=1, hours=1, minutes=45)),
        ],
    },
    {
        "customer": "Rohit Desai",
        "topic": "Health insurance premium payment issue",
        "channels": ["whatsapp"],
        "status": ConversationStatus.resolved,
        "sentiment": SentimentType.positive,
        "one_liner": "Insurance premium payment failure resolved — auto-debit mandate reinstated successfully.",
        "summary": "Rohit Desai's health insurance premium auto-debit failed causing policy lapse risk. Agent identified the NACH mandate had expired, helped customer reinstate it, and confirmed premium payment was processed successfully before grace period ended.",
        "suggested": "No further action needed. Case resolved.",
        "messages": [
            ("My health insurance premium of 12000 failed! I don't want my policy to lapse.", SenderType.customer, "whatsapp", ago(days=2, hours=4)),
            ("Rohit, I can see the NACH mandate for your insurance premium expired last month. Let me help you reinstate it immediately. Please confirm your policy number.", SenderType.agent, "whatsapp", ago(days=2, hours=3, minutes=45)),
            ("Policy number is NB-HEALTH-2024-98765", SenderType.customer, "whatsapp", ago(days=2, hours=3, minutes=30)),
            ("Thank you. I've re-registered the NACH mandate and processed the premium payment of ₹12,000 manually. Your policy is active and will not lapse. The auto-debit is now set up for next year as well.", SenderType.agent, "whatsapp", ago(days=2, hours=3)),
            ("That is such a relief. Thank you for the quick help!", SenderType.customer, "whatsapp", ago(days=2, hours=2, minutes=45)),
        ],
    },
    {
        "customer": "Neha Chaudhary",
        "topic": "Savings account opening for minor",
        "channels": ["email"],
        "status": ConversationStatus.resolved,
        "sentiment": SentimentType.neutral,
        "one_liner": "Minor savings account opened — documents submitted and account number issued.",
        "summary": "Neha Chaudhary inquired about opening a savings account for her 12-year-old daughter. Agent explained the Minor Account requirements, she submitted the required documents (birth certificate, guardian PAN), and the account was successfully opened.",
        "suggested": "No further action needed. Case resolved.",
        "messages": [
            ("I want to open a savings account for my daughter who is 12 years old. What documents are needed?", SenderType.customer, "email", ago(days=2, hours=8)),
            ("Dear Neha, a Minor Savings Account requires: daughter's birth certificate, your PAN card as guardian, Aadhaar of both, and a passport size photo. The account will be operated by you until she turns 18. Minimum balance is zero. Would you like to proceed?", SenderType.agent, "email", ago(days=2, hours=7, minutes=30)),
            ("Yes please proceed. I'm attaching the documents.", SenderType.customer, "email", ago(days=2, hours=6)),
            ("Thank you for the documents! I have successfully opened the Minor Savings Account. Account number: NB-SAV-2024-678901. A welcome kit will be sent to your address. The debit card will arrive in 7 days.", SenderType.agent, "email", ago(days=2, hours=4)),
        ],
    },
    # ── CLOSED ───────────────────────────────────────────────────────────────
    {
        "customer": "Manish Tiwari",
        "topic": "Debit card delivery delay complaint",
        "channels": ["whatsapp"],
        "status": ConversationStatus.closed,
        "sentiment": SentimentType.neutral,
        "one_liner": "Customer complained about 15-day card delivery delay — agent escalated to courier, no further response from customer.",
        "summary": "Manish Tiwari raised a complaint about his debit card not delivered after 15 days. Agent escalated to courier partner and shared tracking details. Customer did not respond after that. Ticket closed after 48 hours of no response.",
        "suggested": "No further action needed. Case closed.",
        "messages": [
            ("My debit card was supposed to come in 7 days but 15 days have passed. This is unacceptable!", SenderType.customer, "whatsapp", ago(days=3, hours=2)),
            ("Manish, I sincerely apologize for the delay. I've escalated this to our courier partner Blue Dart. Your tracking ID is BLU2024789123. I can see the card is in your city and should be delivered by tomorrow. Please let me know once you receive it.", SenderType.agent, "whatsapp", ago(days=3, hours=1, minutes=45)),
        ],
    },
]


async def seed():
    settings.ensure_dirs()

    # Try to delete the DB file for a fully fresh schema; fall back to DELETE if locked
    db_path = settings.sqlite_db_path
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print("Dropped existing database.")
        except PermissionError:
            print("DB file locked (backend running) — will truncate tables instead.")

    await init_db()

    # Truncate all tables in FK order (works whether we deleted the file or not)
    async with AsyncSessionLocal() as db:
        for tbl in ("messages", "ai_summaries", "conversations", "channel_identifiers",
                    "transactions", "consent_records", "dnc_list", "campaigns", "customers", "agents"):
            await db.execute(text(f"DELETE FROM {tbl}"))
        await db.commit()
        print("Cleared existing rows.")

    async with AsyncSessionLocal() as db:

        print("Seeding agents...")
        agent_admin = Agent(
            email="admin@neobank.com",
            password_hash=hash_password("admin123"),
            full_name="Admin Agent",
            role=AgentRole.admin,
            is_active=True,
        )
        agent_support = Agent(
            email="agent@neobank.com",
            password_hash=hash_password("agent123"),
            full_name="Support Agent",
            role=AgentRole.agent,
            is_active=True,
        )
        db.add(agent_admin)
        db.add(agent_support)
        await db.flush()

        print("Seeding customers...")
        customer_map: dict[str, Customer] = {}
        for name, email, phone in CUSTOMERS:
            customer = Customer(
                display_name=name,
                email=email,
                phone=phone,
                metadata_json=json.dumps({"segment": random.choice(["retail", "premium", "business"])}),
            )
            db.add(customer)
            await db.flush()

            # Channel identifiers: email + whatsapp + telegram for all customers
            for ch_type, identifier in [
                (ChannelType.email,    email),
                (ChannelType.whatsapp, phone),
                (ChannelType.telegram, f"tg_{phone[-6:]}"),
            ]:
                db.add(ChannelIdentifier(customer_id=customer.id, channel=ch_type, identifier=identifier))

            # Transactions
            for _ in range(random.randint(8, 15)):
                cat = random.choice(MERCHANT_CATEGORIES)
                db.add(Transaction(
                    customer_id=customer.id,
                    amount=Decimal(str(round(random.uniform(200, 12000), 2))),
                    merchant_name=random.choice(MERCHANTS[cat]),
                    merchant_category=cat,
                    transaction_date=date.today() - timedelta(days=random.randint(0, 90)),
                ))

            # Consent
            db.add(ConsentRecord(
                customer_id=customer.id,
                consent_type=ConsentType.marketing,
                channel="all",
                status=ConsentStatus.active,
            ))

            customer_map[name] = customer

        await db.flush()

        print("Seeding conversations...")
        for conv_def in CONVERSATIONS:
            customer = customer_map[conv_def["customer"]]
            channels = conv_def["channels"]

            conv = Conversation(
                customer_id=customer.id,
                assigned_agent_id=agent_support.id,
                status=conv_def["status"],
                active_channels_json=json.dumps(channels),
                topic=conv_def["topic"],
                last_message_at=conv_def["messages"][-1][3],  # timestamp of last message
            )
            db.add(conv)
            await db.flush()

            for content, sender, channel, created_at in conv_def["messages"]:
                db.add(Message(
                    conversation_id=conv.id,
                    sender_type=sender,
                    direction=MessageDirection.inbound if sender == SenderType.customer else MessageDirection.outbound,
                    channel=channel,
                    content=content,
                    status=MessageStatus.read,
                    created_at=created_at,
                ))

            db.add(AISummary(
                conversation_id=conv.id,
                one_liner=conv_def["one_liner"],
                detailed_summary=conv_def["summary"],
                key_issues_json=json.dumps([conv_def["topic"]]),
                suggested_action=conv_def["suggested"],
                sentiment=conv_def["sentiment"],
                model_used="seeded",
            ))

        print("Seeding campaigns...")
        campaigns_data = [
            {
                "name": "Festive Season Travel Offer",
                "status": CampaignStatus.approved,
                "channels": ["whatsapp", "email"],
                "template": "Hi {{name}}! Celebrate the festive season with NeoBank Travel Card — earn 5X rewards on all travel bookings till Dec 31. Apply now and get ₹1,000 joining bonus! T&C apply.",
                "sent": 0, "delivered": 0,
                "scheduled_at": ago(days=14),
            },
            {
                "name": "EMI Holiday — 0% Interest Offer",
                "status": CampaignStatus.approved,
                "channels": ["whatsapp"],
                "template": "Dear {{name}}, convert your outstanding balance to easy EMIs at 0% interest this month only! Valid on purchases above ₹5,000. Reply YES to activate or visit our app.",
                "sent": 0, "delivered": 0,
                "scheduled_at": ago(days=2),
            },
            {
                "name": "Zero Annual Fee Premium Card",
                "status": CampaignStatus.pending_approval,
                "channels": ["email", "whatsapp"],
                "template": "Hi {{name}}, you are pre-approved for NeoBank Premium Card with ZERO annual fee for life! Enjoy airport lounge access, 2X rewards, and ₹500 welcome voucher. Limited period offer — apply in 2 minutes.",
                "sent": 0, "delivered": 0,
                "scheduled_at": None,
            },
            {
                "name": "UPI Cashback Monsoon Drive",
                "status": CampaignStatus.approved,
                "channels": ["whatsapp", "telegram"],
                "template": "{{name}}, get flat 10% cashback on UPI payments this monsoon! Use NeoBank UPI for utility bills, groceries & more. Max cashback ₹200/month. Valid July–August 2026.",
                "sent": 0, "delivered": 0,
                "scheduled_at": ago(days=-1),  # scheduled for tomorrow
            },
            {
                "name": "KYC Renewal Reminder",
                "status": CampaignStatus.draft,
                "channels": ["email", "telegram"],
                "template": "Dear {{name}}, your NeoBank KYC is due for renewal. Complete it in 5 minutes from home via Video KYC — no branch visit needed. Failure to renew by month end may restrict transactions.",
                "sent": 0, "delivered": 0,
                "scheduled_at": None,
            },
        ]

        for cd in campaigns_data:
            db.add(Campaign(
                name=cd["name"],
                status=cd["status"],
                target_channels_json=json.dumps(cd["channels"]),
                audience_filter_json="{}",
                content_template=cd["template"],
                scheduled_at=cd["scheduled_at"],
                created_by=agent_admin.id,
                approved_by=agent_admin.id if cd["status"] in (CampaignStatus.approved, CampaignStatus.running, CampaignStatus.completed) else None,
                sent_count=cd["sent"],
                delivered_count=cd["delivered"],
            ))

        print("Seeding DNC list...")
        from app.models import DNCEntry, IdentifierType
        dnc_entries = [
            ("+919988776655", IdentifierType.phone),
            ("+919977665544", IdentifierType.phone),
            ("+919966554433", IdentifierType.phone),
            ("optout.customer@hotmail.com", IdentifierType.email),
            ("nospam@rediffmail.com", IdentifierType.email),
            ("+911800000000", IdentifierType.phone),
            ("donotcontact@yahoo.com", IdentifierType.email),
        ]
        for identifier, id_type in dnc_entries:
            db.add(DNCEntry(identifier=identifier, identifier_type=id_type, is_active=True))

        await db.commit()

    # Count
    async with AsyncSessionLocal() as db:
        c_count = (await db.execute(text("SELECT COUNT(*) FROM customers"))).scalar()
        conv_count = (await db.execute(text("SELECT COUNT(*) FROM conversations"))).scalar()
        msg_count = (await db.execute(text("SELECT COUNT(*) FROM messages"))).scalar()
        camp_count = (await db.execute(text("SELECT COUNT(*) FROM campaigns"))).scalar()
        dnc_count = (await db.execute(text("SELECT COUNT(*) FROM dnc_list"))).scalar()

    print(f"\n[OK] Seeded {c_count} customers, {conv_count} conversations, {msg_count} messages")
    print(f"[OK] {camp_count} campaigns, {dnc_count} DNC entries")
    print("[OK] Open: 8 | Waiting: 3 | Resolved: 3 | Closed: 1")
    print("[OK] Admin: admin@neobank.com / admin123")
    print("[OK] Agent: agent@neobank.com / agent123")


if __name__ == "__main__":
    asyncio.run(seed())
