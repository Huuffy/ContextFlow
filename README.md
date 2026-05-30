<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0f3833&height=220&section=header&text=ContextFlow&fontSize=64&fontColor=14b8a6&animation=fadeIn&desc=Team%20CloudCompute&descSize=18&descAlignY=75&descAlign=50" width="100%" />

<br/>

![Python](https://img.shields.io/badge/Python-3.12-3776ab?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript&logoColor=white)
![GPT-4o](https://img.shields.io/badge/GPT--4o-powered-412991?style=flat-square&logo=openai&logoColor=white)
![Meta](https://img.shields.io/badge/Meta_Cloud_API-WhatsApp%20%7C%20Instagram-0866ff?style=flat-square&logo=meta&logoColor=white)
![License](https://img.shields.io/badge/License-Apache_2.0-f97316?style=flat-square)

<br/>

> **iDEA 2.0 Hackathon 2026 · Phase 2 Submission**

</div>

---

## Omni-Channel Customer Communication Digital Platform

This project addresses the challenge of fragmented customer communication in Indian banking. India's Public Sector Banks, Regional Rural Banks, and Co-operative Banks collectively serve over a billion customers - yet every channel they operate on is siloed. A customer raising a loan query on WhatsApp, following up over email, and messaging on Instagram is treated as three separate people by three separate teams. Agents have no shared context, ask the same questions repeatedly, and resolution times suffer.

ContextFlow solves this with a single AI-powered agent inbox that accepts inbound messages from WhatsApp, Instagram, Email, and Telegram simultaneously. All messages - regardless of which channel they arrive on - are identity-resolved to one customer record and presented as a single unified conversation thread. Agents always see the full picture. No customer ever has to repeat themselves.

<div align="center">

| Channel | Integration | Direction |
|:---:|---|---|
| <img src="https://img.shields.io/badge/WhatsApp-25d366?style=flat-square&logo=whatsapp&logoColor=white" /> | Meta Cloud API · Webhooks | Inbound + Outbound |
| <img src="https://img.shields.io/badge/Instagram-e1306c?style=flat-square&logo=instagram&logoColor=white" /> | Meta Cloud API · Webhooks | Inbound + Outbound |
| <img src="https://img.shields.io/badge/Email-0078d4?style=flat-square&logo=gmail&logoColor=white" /> | Gmail IMAP + SMTP | Inbound + Outbound |
| <img src="https://img.shields.io/badge/Telegram-26a5e4?style=flat-square&logo=telegram&logoColor=white" /> | Telegram Bot API · Long polling | Inbound + Outbound |

</div>

---

## Live Demo

🔗 **Live Demo:** [https://context--flow.web.app](https://context--flow.web.app)
🎥 **Demo Video:** *(coming soon)*

---

## Tech Stack

- **Python 3.12** - backend runtime
- **FastAPI** - async REST API and WebSocket server
- **SQLAlchemy (async) + aiosqlite** - SQLite database, no external DB required
- **LanceDB** - local vector store for message embeddings
- **sentence-transformers / all-MiniLM-L6-v2** - local embedding model, runs on CPU, no API call
- **Azure OpenAI GPT-4o** - conversation summarisation, sentiment classification, suggested actions
- **React 19 + TypeScript** - frontend
- **Vite** - frontend build tool
- **Tailwind CSS 4 + shadcn/ui** - UI components and design system
- **Zustand** - frontend state management
- **Framer Motion** - UI animations
- **Meta Cloud API** - WhatsApp and Instagram via a single shared webhook
- **Gmail IMAP + SMTP (aiosmtplib)** - email inbound polling and outbound delivery
- **Telegram Bot API** - long polling inbound, Bot API outbound
- **WebSocket (FastAPI native)** - real-time agent dashboard updates
- **pnpm** - frontend package manager
- **uv** - Python dependency and virtualenv management

---

## How to Run Locally

**Prerequisites:** Python 3.12+, Node.js 20+, pnpm

1. Clone the repository:
   ```bash
   git clone https://github.com/Huuffy/ContextFlow.git
   cd ContextFlow/contextflow
   ```

2. Set up environment variables:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env - fill in Azure OpenAI, Gmail, Telegram, and Meta API keys
   ```

3. Install backend dependencies:
   ```bash
   uv venv && uv pip install -r requirements.txt
   ```

4. Seed demo data (20 customers, 15 conversations, 5 campaigns):
   ```bash
   uv run python -m app.scripts.seed_db
   ```

5. Start the backend:
   ```bash
   uv run uvicorn app.main:app --reload --port 8000
   ```

6. Install frontend dependencies and start the dev server:
   ```bash
   cd ../frontend
   pnpm install
   pnpm dev
   ```

7. Open the app: [http://localhost:5173](http://localhost:5173)

**One-command launcher (Windows):**
```bash
python run.py    # starts backend and frontend in separate terminal windows
```

---

## Project Structure

![ContextFlow Architecture](Resources/architecture.png)

`/backend/app/api/v1/` - REST endpoints: conversations, messages, customers, campaigns, compliance, analytics, AI summary regeneration

`/backend/app/api/webhooks/` - Meta Cloud API handler (WhatsApp + Instagram on a single endpoint), Telegram webhook handler

`/backend/app/events/` - inbound worker (identity resolution, opt-out detection, auto-replies), outbound delivery queue, campaign scheduler (60s IST-based timed dispatch)

`/backend/app/integrations/` - Gmail IMAP poller and SMTP client, Telegram poller and client, WhatsApp and Instagram dispatch via Meta Cloud API

`/backend/app/models/` - SQLAlchemy ORM models (customers, conversations, messages, campaigns, DNC list, channel identifiers)

`/backend/app/services/` - identity resolution service (maps any channel ID to one customer record), message persistence service

`/backend/app/ai/` - GPT-4o summariser and sentiment classifier, MiniLM embedding model with LanceDB vector store

`/backend/app/scripts/seed_db.py` - generates the full demo environment (20 customers, 15 conversations, 5 campaigns, 7 DNC entries)

`/backend/data/` - SQLite database and LanceDB vector store (gitignored)

`/frontend/src/pages/inbox/` - three-panel agent inbox (conversation list, message thread, Customer 360)

`/frontend/src/pages/` - CampaignsPage, CompliancePage, AnalyticsPage, HomePage (public landing + registration modal)

`/frontend/src/services/api.ts` - Axios API client for all backend calls

`/whitelist.json` - registered contacts collected via the landing page, used for campaign dispatch

`/run.py` - Windows one-command launcher (starts backend and frontend in separate terminals)

`/Resources/architecture.png` - system architecture diagram

---

## Modules

### 💬 Unified Inbox
Three-panel layout: conversation list (Open · Awaiting Reply · Resolved · Closed), full cross-channel message thread, and Customer 360. Messages arrive in real time via WebSocket. Ticket state is automated - agent reply → **Awaiting Reply**, customer response → **Open**. First contact on email and Telegram gets an instant acknowledgement automatically.

### 🧠 Customer 360 & AI Summary
GPT-4o generates a summary after every new message: one-liner, detailed context, key issues, suggested next action, and sentiment badge (`positive` · `neutral` · `negative` · `frustrated`). Agents read an intelligent briefing before they respond.

### 📣 Campaigns
Multi-channel outreach with approval workflow. Staff draft a template with `{{name}}` personalisation, select channels, and submit for review. The manager locks the final recipient list and excludes DNC contacts. Campaigns dispatch immediately or on a **scheduled IST time** - the scheduler fires missed campaigns automatically on server restart.

### 🛡️ Compliance
Email-keyed DNC list blocks a customer across all channels simultaneously. Replying `opt out` (any capitalisation) on any channel adds them to DNC instantly and sends a confirmation. Every campaign message includes the opt-out instruction.

### 📊 Analytics
KPI cards, 7-day message volume trend, channel distribution, and sentiment breakdown - all computed live from SQLite.

---

## Dataset
 `No Dataset needed`

All data is 100% synthetic, generated by our team written in `seed_db.py`. Is it flexible enough to handle Live Redis Bank Transactions database

Running the seed script populates a complete demo environment:

- **20 customers** with realistic Indian banking names and profiles
- **15 conversations** across all status states (`open`, `waiting`, `resolved`, `closed`)
- **Multi-channel threads** - WhatsApp + Email, Telegram + Email, WhatsApp + Telegram
- **5 campaigns** across the full lifecycle (draft · pending approval · approved · scheduled)
- **7 DNC entries** simulating real opt-out records
- **All 4 sentiment variants** across conversations: `positive`, `neutral`, `negative`, `frustrated`
- **4 demo bank accounts** for the payment query flow:
  - `8888` - Savings Account
  - `9999` - Current Account
  - `7777` - Credit Account
  - `6666` - Salary Account

Contacts register via the landing page form to populate `whitelist.json` before dispatching campaigns. The registration form collects email (required), name, WhatsApp number, and Telegram ID.

---

## Known Limitations

- Banks currently managing customer queries across Calls, Emails etc have no single place to view or respond - agents switch between apps, losing context at every handoff.
- Without a unified identity layer, the same customer appearing on two channels is treated as two different people; transaction history, past complaints, and prior resolutions are invisible to the agent handling the next query.
- Transaction data visible to agents is siloed inside core banking systems; support staff have no way to see a customer's recent transactions alongside the conversation, making it impossible to resolve payment queries without escalation.
- Marketing campaigns sent through separate tools (bulk SMS, personal WhatsApp numbers, third-party email tools) have no approval workflow, no DNC enforcement, and no delivery visibility - exposing banks to RBI regulatory risk.
- Customer opt-outs made on one channel (e.g. email) do not automatically propagate to others (e.g. WhatsApp), meaning the same customer can receive unwanted messages on a different platform even after opting out.
- There is currently no industry-standard mechanism for banks to link a customer's identity across channels - a customer who contacts the bank on WhatsApp and later emails is recorded as two separate cases with no connection between them.

---

## Team

| Name | Role |
|---|---|
| **Viraj Mukesh Bhatia** | Lead Full Stack Engineer & Cloud Architecture |
| **Ankur Ravi Bodke** | Frontend Development & UI/UX |
| **Aditya Jagdish Chaudhari** | Backend Architecture & AI Integration |
| **Pranali Suryakant Bamne** | DevOps & System Infrastructure |



---

## Contact

For any queries about this submission:

- **Team:** CloudCompute
- **Email:** [virajbhatia1611@gmail.com](mailto:virajbhatia1611@gmail.com)
- **Institute:** Vidyavardhini's College of Engineering and Technology

---

<div align="center">

**Team CloudCompute · iDEA 2.0 Hackathon 2026 · Phase 2**

<img src="https://capsule-render.vercel.app/api?type=waving&color=0f3833&height=120&section=footer" width="100%" />

</div>
