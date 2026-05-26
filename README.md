<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0f3833&height=220&section=header&text=ContextFlow&fontSize=64&fontColor=14b8a6&animation=fadeIn&desc=Omni-Channel%20Customer%20Communication%20Platform&descSize=18&descAlignY=75&descAlign=50" width="100%" />

<br/>

![Python](https://img.shields.io/badge/Python-3.12-3776ab?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript&logoColor=white)
![GPT-4o](https://img.shields.io/badge/GPT--4o-powered-412991?style=flat-square&logo=openai&logoColor=white)
![Meta](https://img.shields.io/badge/Meta_Cloud_API-WhatsApp%20%7C%20Instagram-0866ff?style=flat-square&logo=meta&logoColor=white)
![License](https://img.shields.io/badge/License-Apache_2.0-f97316?style=flat-square)

<br/>

> **idea 2.0 Hackathon 2026 · Team CloudCompute**
>
> Unify WhatsApp · Instagram · Email · Telegram into one AI-powered agent inbox.  
> Customers never repeat themselves. Agents always have full context.

</div>

---

## The Problem

India's Public Sector Banks, Regional Rural Banks, and Co-operative Banks collectively serve over a billion customers — yet their customer communication infrastructure remains deeply fragmented. A customer who raises a loan query on WhatsApp, follows up via email, and calls the branch is treated as three separate interactions by three separate teams with no shared context. Agents waste time asking questions already answered on another channel. Complaint resolution is slow. Regulatory mandates — from RBI's customer grievance guidelines to consent-based marketing rules — are difficult to enforce when communication is scattered across personal inboxes and WhatsApp groups. Meanwhile, the marketing teams operating these banks have no scalable way to send compliant, personalised outreach across multiple channels simultaneously. ContextFlow solves all of this in a single deployable platform: every inbound message from any channel lands in one unified inbox with AI-generated context, every outbound campaign passes a compliance gate before dispatch, and every customer's right to opt out is honoured instantly across all channels the moment they reply `opt out`.

---

## Channel Integration

<div align="center">

| Channel | Integration | Direction | Status |
|:---:|---|---|:---:|
| <img src="https://img.shields.io/badge/WhatsApp-25d366?style=flat-square&logo=whatsapp&logoColor=white" /> | Meta Cloud API · Webhooks | Inbound + Outbound | ✅ Live |
| <img src="https://img.shields.io/badge/Instagram-e1306c?style=flat-square&logo=instagram&logoColor=white" /> | Meta Cloud API · Webhooks | Inbound + Outbound | ✅ Live |
| <img src="https://img.shields.io/badge/Email-0078d4?style=flat-square&logo=gmail&logoColor=white" /> | Gmail IMAP poller + SMTP | Inbound + Outbound | ✅ Live |
| <img src="https://img.shields.io/badge/Telegram-26a5e4?style=flat-square&logo=telegram&logoColor=white" /> | Telegram Bot API · Long polling | Inbound + Outbound | ✅ Live |

</div>

WhatsApp and Instagram are both served through the **Meta Cloud API** — a single webhook endpoint at `/api/webhooks/meta` handles both platforms. Messages from either channel are identity-resolved to the customer's golden record and appear in the same unified thread.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INBOUND CHANNELS                         │
│                                                                 │
│  ┌──────────────────────┐        ┌──────────┐   ┌───────────┐  │
│  │    META CLOUD API    │        │  Gmail   │   │ Telegram  │  │
│  │                      │        │   IMAP   │   │ Bot API   │  │
│  │  WhatsApp │Instagram │        │  Poller  │   │ Polling   │  │
│  └──────────┬───────────┘        └────┬─────┘   └─────┬─────┘  │
└─────────────┼────────────────────────┼───────────────┼─────────┘
              │                        │               │
              └────────────────────────┴───────────────┘
                                       │
                                       ▼
                             FastAPI Inbound Handler
                                       │
                                       ▼
                        asyncio.Queue  (inbound_queue)
                                       │
                                       ▼
                               Inbound Worker
                                       │
                    ┌──────────────────┼─────────────────┐
                    ▼                  ▼                  ▼
           Identity Resolution   Opt-out Detection   Auto-reply
         (channel ID → customer  ("opt out" → DNC   (first contact
            golden record)        list + ack sent)   email/telegram)
                    │
                    ▼
           Persist Message (SQLite)
                    │
                    ▼
              GPT-4o Pipeline
         ┌──────────┴──────────┐
         ▼                     ▼
    AI Summary            Sentiment
  (one-liner +          positive / neutral
  key issues +          negative / frustrated
 suggested action)
         │
         ▼
  WebSocket Push ──▶ Agent Dashboard (React)
                              │
                    Agent composes reply
                              │
                              ▼
           asyncio.Queue  (outbound_queue)
                              │
                              ▼
                    DNC Compliance Check
                    (email-keyed, blocks
                     all channels at once)
                              │
         ┌────────────────────┼──────────────┬──────────────┐
         ▼                    ▼              ▼              ▼
     WhatsApp             Instagram        Email          Telegram
  Meta Cloud API       Meta Cloud API   SMTP reply      Bot API send
                                       (In-Reply-To
                                        threading)

─ ─ ─ ─ ─ ─ ─ ─ ─ ─  CAMPAIGN FLOW  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─

  Registration Form (landing page)
         │
         ▼
  whitelist.json + Customer DB
         │
  Admin creates campaign draft
         │
         ▼
  Submit for Review → Approval screen
  (admin selects/locks recipients,
   DNC contacts auto-excluded)
         │
         ▼
  Dispatch → background worker sends
  to locked whitelist via target channels
  (DNC checked again at send time)
```

---

## Modules

### 💬 Inbox

Banks handle thousands of inbound customer queries daily, arriving across WhatsApp, email, Instagram DMs, and Telegram simultaneously. Without a unified view, agents switch between apps, lose thread history, and repeatedly ask customers to re-explain their problem — damaging trust and inflating resolution time. The Inbox solves this with a three-panel layout: a conversation list on the left (filterable by Open, Awaiting Reply, Resolved, Closed), a full message thread in the centre showing every message across all channels in chronological order, and the Customer 360 panel on the right. Messages arrive in real time via WebSocket — no page refresh needed. The ticket lifecycle is automated: when an agent replies the ticket moves to **Awaiting Reply**; when the customer responds it snaps back to **Open**. Agents can close a ticket with one click. Every first contact on email or Telegram receives an instant automated acknowledgement so customers know their query has been received, without the agent having to manually respond before reading the full context.

---

### 🧠 Customer 360

One of the most common complaints in banking support is customers having to repeat themselves — "I already explained this to someone else." This happens because agents have no cross-channel view of who the customer is or what they've discussed before. The Customer 360 panel, shown alongside every conversation, assembles the complete picture: the customer's registered channels, transaction history, and a GPT-4o-generated AI summary that updates after every new message. The summary includes a one-liner for quick scanning, detailed context, key issues raised, a suggested next action for the agent, and a sentiment badge (`positive`, `neutral`, `negative`, or `frustrated`). Agents can regenerate the summary on demand. This means the very first thing an agent sees when they open a conversation is not a blank screen — it is an intelligent briefing.

---

### 📣 Campaigns

Banks regularly need to reach customers proactively — KYC renewal deadlines, new product offers, regulatory notices, festive season promotions. Today this is done via fragmented tools: a bulk SMS vendor, a separate email platform, WhatsApp broadcasts managed in personal numbers. There is no approval gate, no compliance check, and no way to track delivery across channels in one place. ContextFlow's Campaigns module introduces a proper multi-channel outreach workflow. Bank staff compose a message template with `{{name}}` personalisation, select target channels (WhatsApp, Email, Telegram, Instagram), and submit for management review. During the approval step, the approving manager sees the full registered contact list pulled from the whitelist — they can search contacts, deselect individuals, and lock in the final recipient list before approving. Any contact on the Do Not Contact list is automatically flagged and excluded. Once approved, the campaign dispatches personalised messages to all locked recipients across the selected channels concurrently, with delivery counts updated in real time. Contacts register via the public landing page form, providing their email (required) and optional WhatsApp number and Telegram ID.

---

### 🛡️ Compliance

RBI guidelines mandate that banks maintain and honour Do Not Contact lists, provide customers with a mechanism to opt out of marketing communications, and ensure no outbound message is sent to a customer who has withdrawn consent. Without a centralised system enforcing these rules, a single rogue bulk send can result in regulatory action. ContextFlow's Compliance module provides an email-keyed DNC list: one entry by email address blocks that customer across **all channels simultaneously** — WhatsApp, Instagram, Email, and Telegram — because the block is applied at the customer identity level, not at the channel level. Customers can self-opt-out at any time by replying with exactly `opt out` on any channel; the system immediately adds their email to the DNC list and sends an acknowledgement. Bank staff can also manually add or remove entries from the Compliance page. Every outbound message — whether an agent reply or a campaign dispatch — passes a DNC check before sending. If the customer is blocked, the message is silently dropped and logged.

---

### 📊 Analytics

Bank management and team leads need visibility into support operations — how many queries are open, which channels are busiest, what the overall customer sentiment looks like, and whether message volumes are trending up or down. Without this, staffing decisions are made blindly and sentiment deterioration goes unnoticed until escalations. The Analytics page surfaces KPI cards (total conversations, open tickets, messages sent/received, DNC entries), a message volume trend chart over the last 7 days, a channel distribution breakdown, and a sentiment distribution across all conversations. All data is computed live from the SQLite database — no separate data warehouse required.

---

## AI Pipeline

Every inbound message triggers a pipeline powered by **GPT-4o**:

1. **Identity resolution** — maps any channel identifier (WhatsApp phone, Instagram IGSID, email address, Telegram chat ID) to a single customer golden record via the `channel_identifiers` table
2. **Auto-reply** — first-contact acknowledgement sent back on the same channel in-thread; email replies use `In-Reply-To` so they appear inside the same Gmail/Outlook thread rather than as a new email
3. **Opt-out detection** — customer replies exactly `opt out` on any channel → email added to DNC list → acknowledgement sent back → all future outbound blocked instantly
4. **Summarisation** — one-liner + detailed summary with key issues and suggested action, regenerated on every new message
5. **Sentiment classification** — `positive | neutral | negative | frustrated`

Embeddings via `sentence-transformers/all-MiniLM-L6-v2` run locally (no API call) and are stored in **LanceDB** for RAG-ready knowledge-base retrieval. The embedding model loads in a background thread at startup — the server is ready to accept requests in under one second.

---

## Quick Start

**Prerequisites:** Python 3.12+, Node.js 20+, pnpm

```bash
# Clone
git clone https://github.com/Huuffy/ContextFlow.git
cd ContextFlow

# Backend
cd backend
uv venv && uv pip install -r requirements.txt
cp .env.example .env          # fill in keys (see Environment Variables below)
uv run python -m app.scripts.seed_db   # seeds 20 customers, 15 conversations, 5 campaigns
uv run uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173)

Or from the project root (Windows):

```bash
python run.py    # opens backend + frontend in separate terminal windows
```

---

## Environment Variables

Create `backend/.env`:

```env
# GPT-4o (required for AI summaries)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Meta Cloud API — WhatsApp + Instagram
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
META_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
META_APP_SECRET=your_app_secret
INSTAGRAM_PAGE_ID=your_page_id

# Gmail — Email channel
GMAIL_ADDRESS=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Telegram — Telegram channel
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_USE_POLLING=true
```

---

## Project Structure

```
contextflow/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST endpoints
│   │   │   ├── conversations, messages, customers
│   │   │   ├── campaigns    # draft → review → approve (with recipient lock) → dispatch
│   │   │   ├── compliance   # DNC list CRUD + is_customer_blocked()
│   │   │   ├── register     # contact registration → whitelist.json + DB
│   │   │   ├── analytics    # live KPI aggregation
│   │   │   └── ai           # summary regeneration endpoint
│   │   ├── api/webhooks/    # meta.py (WhatsApp + Instagram), telegram.py
│   │   ├── events/          # inbound_worker, outbound_worker, asyncio queues
│   │   ├── integrations/    # email_client, email_poller, telegram_client, telegram_poller
│   │   │                    # whatsapp.py, instagram.py (Meta Cloud API dispatch)
│   │   ├── models/          # SQLAlchemy models (SQLite via aiosqlite)
│   │   ├── services/        # identity_resolution, message_service
│   │   ├── ai/              # summarizer (GPT-4o), embedder (MiniLM + LanceDB)
│   │   └── scripts/         # seed_db.py
│   └── data/                # SQLite DB + LanceDB vector store (gitignored)
├── frontend/
│   ├── src/
│   │   ├── layouts/         # DashboardLayout (collapsible sidebar, home navigation)
│   │   ├── pages/
│   │   │   ├── inbox/       # InboxPage, ConversationList, ConversationThread, Customer360Panel
│   │   │   ├── CampaignsPage.tsx   # resizable two-panel, recipient picker, dispatch
│   │   │   ├── CompliancePage.tsx  # DNC management
│   │   │   ├── AnalyticsPage.tsx
│   │   │   └── HomePage.tsx        # landing page + registration modal
│   │   ├── services/        # api.ts (Axios)
│   │   ├── stores/          # conversationStore (Zustand)
│   │   └── hooks/           # useWebSocket
│   └── public/
├── whitelist.json           # registered contacts for campaign dispatch
└── run.py                   # launcher script (Windows)
```

---

## Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Framer Motion |
| Backend | FastAPI, Python 3.12, SQLAlchemy async, aiosqlite (SQLite) |
| Vector Store | LanceDB + `sentence-transformers/all-MiniLM-L6-v2` (local, no API) |
| AI | GPT-4o — summaries, sentiment, suggested actions |
| Real-time | WebSocket (FastAPI native) |
| WhatsApp & Instagram | Meta Cloud API — single webhook endpoint, both platforms |
| Email | Gmail IMAP poller + SMTP (aiosmtplib), threaded via `In-Reply-To` |
| Telegram | Telegram Bot API, long polling |
| Campaign Recipients | `whitelist.json` — contacts registered via landing page form |

</div>

---

## Demo Data

Running `seed_db.py` populates a complete demo environment:

- **20 customers** with realistic Indian banking profiles and transaction histories
- **15 conversations** across all status states (`open`, `waiting`, `resolved`, `closed`)
- **Multi-channel threads** — WhatsApp + Email, Telegram + Email, WhatsApp + Telegram
- **5 campaigns** across the full lifecycle (draft · pending approval · approved · approved · approved)
- **7 DNC entries** simulating real opt-out records
- All 4 sentiment variants across conversations: `positive`, `neutral`, `negative`, `frustrated`

Register contacts via the landing page to populate `whitelist.json` before dispatching campaigns.

---

## License

Distributed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**Team CloudCompute · idea 2.0 Hackathon 2026**

[virajbhatia1611@gmail.com](mailto:virajbhatia1611@gmail.com)

<img src="https://capsule-render.vercel.app/api?type=waving&color=0f3833&height=120&section=footer" width="100%" />

</div>
