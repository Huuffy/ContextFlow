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

## Overview

**ContextFlow** is a production-ready omni-channel customer communication platform built for India's Public Sector Banks, Regional Rural Banks, and Co-operative Banks. It integrates WhatsApp and Instagram via the **Meta Cloud API**, Email via **Gmail IMAP/SMTP**, and Telegram via the **Bot API** — all unified into a single conversation thread per customer.

When a customer opens a query on Instagram and follows up on WhatsApp, the agent sees one continuous thread with no gaps. Every inbound message is automatically summarised and sentiment-scored by **GPT-4o**. Campaigns are audience-targeted by transaction history. Every outbound message passes a live DNC compliance check before dispatch. Customers can self-opt-out on any channel by replying `opt out`. Inbox = reactive (customer contacts bank, agent responds) Campaigns = proactive (bank contacts many customers at once)

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

WhatsApp and Instagram are both served through the **Meta Cloud API** — a single webhook endpoint handles both platforms. Messages from either channel arrive at `/api/webhooks/meta`, are identity-resolved to the customer's golden record, and appear in the same unified thread.

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
                          ┌────────────┴────────────┐
                          ▼                          ▼
                 Identity Resolution          Opt-out Detection
              (channel ID → customer        ("opt out" message
                 golden record)              → DNC list + ack)
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
                                  │
               ┌──────────────────┼──────────────┬──────────────┐
               ▼                  ▼              ▼              ▼
           WhatsApp           Instagram        Email          Telegram
        Meta Cloud API     Meta Cloud API   SMTP reply      Bot API send
                                          (In-Reply-To
                                           threading)
```

---

## Modules

<div align="center">

| | Module | Description |
|:---:|---|---|
| 💬 | **Inbox** | 3-panel layout — conversation list, message thread, Customer 360. Real-time WebSocket push. Status lifecycle: Open · Awaiting Reply · Resolved · Closed. |
| 🧠 | **Customer 360** | Unified profile across all channels, transaction history, GPT-4o summary with sentiment badge, key issues, and suggested action. |
| 📣 | **Campaigns** | Build, submit for approval, schedule, and dispatch multi-channel campaigns. Audience segmented by transaction behaviour. |
| 🛡️ | **Compliance** | Do Not Contact list (email-keyed, blocks all channels simultaneously). Self opt-out via `opt out` reply on any channel. |
| 📊 | **Analytics** | KPI cards, message volume trends, channel distribution, sentiment breakdown — all in one glance. |

</div>

---

## AI Pipeline

Every inbound message triggers a pipeline powered by **GPT-4o**:

1. **Identity resolution** — maps any channel identifier (WhatsApp phone, Instagram IGSID, email address, Telegram chat ID) to a single customer golden record
2. **Summarisation** — one-liner + detailed summary with key issues and suggested action, updated on every new message
3. **Sentiment classification** — `positive | neutral | negative | frustrated`
4. **Auto-reply** — first-contact acknowledgement sent back on the same channel in-thread; email replies use `In-Reply-To` for proper Gmail/Outlook thread grouping
5. **Opt-out detection** — customer replies exactly `opt out` on any channel → email added to DNC list → acknowledgement sent back → all future outbound blocked

Embeddings via `sentence-transformers/all-MiniLM-L6-v2` (runs locally, no API call) stored in **LanceDB** for RAG-ready document search and knowledge-base retrieval.

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
│   │   ├── api/v1/          # REST endpoints (conversations, messages, campaigns, compliance…)
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
│   │   ├── layouts/         # DashboardLayout (collapsible sidebar)
│   │   ├── pages/
│   │   │   ├── inbox/       # InboxPage, ConversationList, ConversationThread, Customer360Panel
│   │   │   ├── CampaignsPage.tsx
│   │   │   ├── CompliancePage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   └── HomePage.tsx
│   │   ├── services/        # api.ts (Axios)
│   │   ├── stores/          # conversationStore (Zustand)
│   │   └── hooks/           # useWebSocket
│   └── public/
└── run.py                   # launcher script (Windows)
```

---

## Tech Stack

<div align="center">

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, Framer Motion |
| Backend | FastAPI, Python 3.12, SQLAlchemy async, aiosqlite (SQLite) |
| Vector Store | LanceDB + `sentence-transformers/all-MiniLM-L6-v2` |
| AI | GPT-4o — summaries, sentiment, suggested actions |
| Real-time | WebSocket (FastAPI native) |
| WhatsApp & Instagram | Meta Cloud API — single webhook, both platforms |
| Email | Gmail IMAP poller + SMTP (aiosmtplib), threaded via `In-Reply-To` |
| Telegram | Telegram Bot API, long polling |

</div>

---

## Demo Data

Running `seed_db.py` populates a complete demo environment:

- **20 customers** with realistic Indian banking profiles and transaction histories
- **15 conversations** across all status states (`open`, `waiting`, `resolved`, `closed`)
- **Multi-channel threads** — WhatsApp + Email, Telegram + Email, WhatsApp + Telegram
- **5 campaigns** at every lifecycle stage (draft → pending → approved → running → completed)
- **7 DNC entries** simulating real opt-out records
- All 4 sentiment variants across conversations: `positive`, `neutral`, `negative`, `frustrated`

---

## License

Distributed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**Team CloudCompute · idea 2.0 Hackathon 2026**

[virajbhatia1611@gmail.com](mailto:virajbhatia1611@gmail.com)

<img src="https://capsule-render.vercel.app/api?type=waving&color=0f3833&height=120&section=footer" width="100%" />

</div>
