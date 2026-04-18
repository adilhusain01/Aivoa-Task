# 🏥 AI-First CRM – HCP Log Interaction Module

> **Task 1 Submission** | Life-Science CRM | LangGraph + Groq + FastAPI + React + Redux + PostgreSQL

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  ┌─────────────────────────┐   ┌───────────────────────────┐   │
│  │      Form Panel          │   │      Chat Panel (AI)       │   │
│  │  (Structured Input)      │   │  (Conversational Input)    │   │
│  │  Redux interactionSlice  │   │  Redux chatSlice           │   │
│  └────────────┬────────────┘   └─────────────┬─────────────┘   │
└───────────────┼──────────────────────────────┼─────────────────┘
                │  POST /api/interactions       │  POST /api/chat
                ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FastAPI Backend                           │
│   /api/hcps  /api/interactions  /api/chat  /api/chat/history   │
│                         │                                        │
│              ┌──────────▼──────────┐                           │
│              │   LangGraph Agent   │                           │
│              │  ┌───────────────┐  │                           │
│              │  │  Agent Node   │  │  ← Groq llama-3.3-70b-versatile     │
│              │  │ (llama-3.3-70b-versatile)│  │                           │
│              │  └──────┬────────┘  │                           │
│              │         │ tool_call  │                           │
│              │  ┌──────▼────────┐  │                           │
│              │  │  Tool Node    │  │                           │
│              │  │  (5 tools)    │  │                           │
│              │  └───────────────┘  │                           │
│              └─────────────────────┘                           │
│                         │                                        │
└─────────────────────────┼───────────────────────────────────────┘
                          │  SQLAlchemy ORM
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                        │
│   Tables: hcps | interactions | chat_sessions                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 LangGraph Agent – Role & Design

### Role of the Agent

The LangGraph agent is the **intelligent orchestration layer** of the HCP CRM. It sits between the field representative's natural language input (via chat) and the structured database. Its responsibilities are:

1. **Entity Extraction** — Using `llama-3.3-70b-versatile` via Groq, it parses free-text like _"Met Dr. Sharma at AIIMS, discussed Phase III OncoBoost data, she seemed excited, gave 5 samples"_ and extracts: HCP name, date, topics, sentiment, outcomes, materials, samples, and follow-up actions.

2. **Intent Classification** — Determines whether the rep wants to log a new interaction, edit the current draft or an existing interaction, fetch an HCP profile, get follow-up suggestions, or analyze sentiment.

3. **Tool Routing** — Selects and calls the correct tool from its toolkit.

4. **Multi-Turn Context** — Maintains conversational state across turns, allowing reps to say _"Sorry, the sentiment is negative"_ after a prior log and have only that field updated.

5. **Response Generation** — Returns a natural language confirmation plus structured data back to the frontend.

### LangGraph State Machine

```
START
  │
  ▼
agent_node  ──── (Groq llama-3.3-70b-versatile decides: tool call or done?)
  │                          │
  │ (tool_calls present)     │ (no tool calls)
  ▼                          ▼
tool_node                   END
  │
  │ (tool result injected back)
  ▼
agent_node  ──── (generates final natural language reply)
  │
  ▼
END
```

---

## 🔧 LangGraph Tools (5 Defined)

### Tool 1 – `log_interaction` _(Required)_

**Purpose:** Captures and persists a complete HCP interaction record.

**How it works:**

- The LLM extracts all entities from the rep's free-text message.
- The tool is called with a complete set of structured fields, including HCP name, interaction type, date/time, topics, sentiment, outcomes, follow-ups, materials shared, and samples distributed.
- If a field is not available in the user input, the tool call should still include it, using an empty string for text fields and an empty array for list fields.
- It upserts the HCP profile, stores the interaction, generates an AI summary, and produces follow-up suggestions.
- Returns: `{success, interaction_id, ai_suggested_followups}`

```python
@tool
def log_interaction(hcp_name, interaction_type, interaction_date, ...):
    # 1. Upsert HCP profile
    # 2. Store interaction with all fields
    # 3. Generate AI summary
    # 4. Produce follow-up suggestions
    # 5. Return interaction_id + suggestions
```

---

### Tool 2 – `edit_interaction` _(Required)_

**Purpose:** Modifies a specific field of an existing saved interaction or updates the current draft form.

**How it works:**

- The agent determines whether the correction applies to a previously saved interaction or the current unsaved draft.
- If no saved interaction exists yet, `edit_interaction` returns the corrected field/value and the frontend updates only those fields in the left panel.
- If an interaction ID exists, the tool updates that database record and regenerates the AI summary when topics/outcomes change.
- Returns: `{success, updated_field, new_value}`

```python
@tool
def edit_interaction(interaction_id: int = None, field: str = "", value: str = ""):
    # 1. Validate the editable field
    # 2. If no interaction_id, return the corrected field/value for the current form
    # 3. If interaction_id exists, apply change in the database
    # 4. Regenerate summary when topics/outcomes change
```

---

### Tool 3 – `get_hcp_profile`

**Purpose:** Retrieves an HCP's profile and recent interaction history.

**Use case:** The agent can provide context-aware suggestions such as _"This is your 3rd meeting with Dr. Sharma; last visit was neutral and asked for more data."_

**Returns:** `{hcp details, specialty, institution, recent_interactions[]}`

---

### Tool 4 – `suggest_followups`

**Purpose:** Generates 3–5 AI-powered follow-up actions.

**How it works:** Calls `llama-3.3-70b-versatile` with the HCP name, topics, and sentiment, returning concise, actionable follow-up items.

**Returns:** `{suggested_followups: ["Schedule follow-up in 2 weeks", "Send Phase III PDF", ...]}`

---

### Tool 5 – `analyze_sentiment`

**Purpose:** Infers HCP sentiment from free-text notes when the rep doesn't explicitly state it.

**How it works:** Calls `llama-3.3-70b-versatile` on the interaction text, returning a sentiment label, confidence, and rationale.

**Returns:** `{sentiment, confidence: "high|medium|low", rationale}`

---

## 📁 Project Structure

```
hcp-crm/
├── backend/
│   ├── main.py            # FastAPI app + all API routes
│   ├── agent.py           # LangGraph agent + 5 tools
│   ├── models.py          # SQLAlchemy ORM models (HCP, Interaction, ChatSession)
│   ├── database.py        # DB engine + session factory
│   ├── schemas.py         # Pydantic request/response schemas
│   ├── config.py          # Pydantic settings (reads .env)
│   ├── init_db.py         # One-shot DB init + seed script
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── store/
│       │   ├── index.js              # Redux store root
│       │   ├── interactionSlice.js   # Form state + API thunks
│       │   └── chatSlice.js          # Chat state + AI thunks
│       └── components/
│           ├── LogInteractionScreen.jsx  # Page shell + navbar
│           ├── FormPanel.jsx             # Structured form (left)
│           └── ChatPanel.jsx             # AI chat assistant (right)
│
├── docker-compose.yml
└── README.md
```

---

## 🚀 Setup & Run Instructions

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+
- **PostgreSQL** 15+ (or use Docker)
- **Groq API Key** — Get free at [console.groq.com](https://console.groq.com)

---

### Option A — Local Development (Recommended for Dev)

#### Step 1 — Clone & Configure Backend

```bash
cd hcp-crm/backend

# Copy environment file
cp .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx   # Your Groq API key
DATABASE_URL=postgresql://postgres:password@localhost:5432/hcp_crm
APP_ENV=development
CORS_ORIGINS=http://localhost:5173
```

#### Step 2 — Start PostgreSQL (if not running)

```bash
# Option: via Docker (easiest)
docker run -d \
  --name hcp_crm_db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=hcp_crm \
  -p 5432:5432 \
  postgres:16-alpine
```

#### Step 3 — Install Backend & Init DB

```bash
cd hcp-crm/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database tables + seed sample HCPs
python init_db.py
```

#### Step 4 — Start Backend Server

```bash
uvicorn main:app --reload --port 8000
```

API is live at: `http://localhost:8000`
Swagger docs at: `http://localhost:8000/api/docs`

#### Step 5 — Install & Start Frontend

```bash
cd hcp-crm/frontend

npm install
npm run dev
```

Frontend is live at: `http://localhost:5173`

---

### Option B — Docker Compose (Full Stack)

```bash
# 1. Set your Groq API key in backend/.env
cp hcp-crm/backend/.env.example hcp-crm/backend/.env
# Edit GROQ_API_KEY in backend/.env

# 2. Start everything
cd hcp-crm
docker compose up --build
```

Services:
| Service | URL |
|------------|----------------------------|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/api/docs |
| PostgreSQL | localhost:5432 |

---

## 🔌 Key API Endpoints

| Method | Endpoint                         | Description                     |
| ------ | -------------------------------- | ------------------------------- |
| GET    | `/health`                        | Health check                    |
| GET    | `/api/health`                    | Health check alias for frontend |
| GET    | `/api/hcps?search=sharma`        | Search HCPs                     |
| POST   | `/api/hcps`                      | Create HCP profile              |
| POST   | `/api/interactions`              | Log interaction (form)          |
| GET    | `/api/interactions`              | List interactions               |
| PATCH  | `/api/interactions/{id}`         | Update interaction fields       |
| POST   | `/api/chat`                      | Chat with LangGraph agent       |
| GET    | `/api/chat/{session_id}/history` | Get chat history                |
| POST   | `/api/seed`                      | Seed sample HCP data (dev only) |

---

## 💡 How to Use the App

### Via Structured Form (Left Panel)

1. Search or type an HCP name
2. Select interaction type, date, time
3. Fill in topics, materials, samples, sentiment, outcomes
4. Click **Log Interaction**

### Via AI Chat (Right Panel)

Type naturally, for example:

- _"Met Dr. Anjali Sharma at AIIMS today, discussed OncoBoost Phase III efficacy data. She was very positive and requested 10 more samples."_
- _"Sorry, the name was actually Dr. John, and the sentiment was negative."_
- _"Edit interaction #5 — change follow_up_actions to 'Send Phase III PDF by Friday'"_
- _"What's Dr. Kumar's interaction history?"_
- _"Analyze the sentiment: Dr. Patel seemed dismissive and kept checking her phone."_

The agent will:

1. Extract structured data from your message
2. Call the appropriate tool (log/edit/profile/suggest/analyze)
3. Auto-fill the left panel form with extracted values
4. Preserve unchanged fields when applying corrections
5. Return a confirmation with the completed action

---

## 🧠 Tech Stack Summary

| Layer         | Technology                                         |
| ------------- | -------------------------------------------------- |
| Frontend      | React 18 + Redux Toolkit + Vite                    |
| Styling       | CSS-in-JS with Google Inter font                   |
| Backend       | Python 3.11 + FastAPI + Uvicorn                    |
| AI Framework  | LangGraph (StateGraph with ToolNode)               |
| LLM Primary   | Groq `llama-3.3-70b-versatile` (agent + sentiment) |
| LLM Secondary | Groq `llama-3.3-70b-versatile` (follow-ups)        |
| ORM           | SQLAlchemy 2.0                                     |
| Database      | PostgreSQL 16                                      |
| Containers    | Docker + Docker Compose                            |

---

## ⚠️ Notes

- Replace `GROQ_API_KEY` in `.env` with your actual key from [console.groq.com](https://console.groq.com/keys)
- The `init_db.py` script must be run once before starting the backend
- In production, set `APP_ENV=production` to disable the `/api/seed` endpoint
- The LangGraph agent maintains multi-turn context within a session (up to 10 previous messages)
