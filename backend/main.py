"""
main.py - FastAPI application for HCP CRM AI-First Module
"""
import uuid
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from config import settings
from database import engine, get_db, Base
import models
import schemas
from agent import run_agent

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HCP CRM AI-First API",
    description="AI-powered HCP Interaction Management using LangGraph + Groq",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "HCP CRM API"}


@app.get("/api/health", tags=["System"])
def api_health():
    return health()


# ─── HCP Endpoints ───────────────────────────────────────────────────────────

@app.post("/api/hcps", response_model=schemas.HCPRead, status_code=201, tags=["HCPs"])
def create_hcp(payload: schemas.HCPCreate, db: Session = Depends(get_db)):
    """Create a new HCP profile."""
    hcp = models.HCP(**payload.model_dump())
    db.add(hcp)
    db.commit()
    db.refresh(hcp)
    return hcp


@app.get("/api/hcps", response_model=List[schemas.HCPRead], tags=["HCPs"])
def list_hcps(search: Optional[str] = None, db: Session = Depends(get_db)):
    """List all HCPs, optionally filtered by name search."""
    query = db.query(models.HCP)
    if search:
        query = query.filter(models.HCP.name.ilike(f"%{search}%"))
    return query.order_by(models.HCP.name).all()


@app.get("/api/hcps/{hcp_id}", response_model=schemas.HCPRead, tags=["HCPs"])
def get_hcp(hcp_id: int, db: Session = Depends(get_db)):
    hcp = db.query(models.HCP).filter(models.HCP.id == hcp_id).first()
    if not hcp:
        raise HTTPException(status_code=404, detail="HCP not found")
    return hcp


# ─── Interaction Endpoints ────────────────────────────────────────────────────

@app.post("/api/interactions", response_model=schemas.InteractionRead, status_code=201, tags=["Interactions"])
def create_interaction(payload: schemas.InteractionCreate, db: Session = Depends(get_db)):
    """
    Log a new HCP interaction via structured form.
    HCP profile is auto-created if it doesn't exist.
    """
    # Ensure HCP exists
    hcp = db.query(models.HCP).filter(
        models.HCP.name.ilike(f"%{payload.hcp_name}%")
    ).first()
    if not hcp:
        hcp = models.HCP(name=payload.hcp_name)
        db.add(hcp)
        db.flush()

    interaction = models.Interaction(
        hcp_id=hcp.id,
        **payload.model_dump()
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return interaction


@app.get("/api/interactions", response_model=List[schemas.InteractionRead], tags=["Interactions"])
def list_interactions(
    hcp_name: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List all interactions, optionally filtered by HCP name."""
    query = db.query(models.Interaction)
    if hcp_name:
        query = query.filter(models.Interaction.hcp_name.ilike(f"%{hcp_name}%"))
    return query.order_by(models.Interaction.created_at.desc()).limit(limit).all()


@app.get("/api/interactions/{interaction_id}", response_model=schemas.InteractionRead, tags=["Interactions"])
def get_interaction(interaction_id: int, db: Session = Depends(get_db)):
    interaction = db.query(models.Interaction).filter(
        models.Interaction.id == interaction_id
    ).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return interaction


@app.patch("/api/interactions/{interaction_id}", response_model=schemas.InteractionRead, tags=["Interactions"])
def update_interaction(
    interaction_id: int,
    payload: schemas.InteractionUpdate,
    db: Session = Depends(get_db)
):
    """Update specific fields of an existing interaction."""
    interaction = db.query(models.Interaction).filter(
        models.Interaction.id == interaction_id
    ).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(interaction, field, value)

    db.commit()
    db.refresh(interaction)
    return interaction


@app.delete("/api/interactions/{interaction_id}", status_code=204, tags=["Interactions"])
def delete_interaction(interaction_id: int, db: Session = Depends(get_db)):
    interaction = db.query(models.Interaction).filter(
        models.Interaction.id == interaction_id
    ).first()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    db.delete(interaction)
    db.commit()


# ─── AI Chat Endpoint (LangGraph Agent) ──────────────────────────────────────

@app.post("/api/chat", response_model=schemas.ChatResponse, tags=["AI Agent"])
async def chat_with_agent(payload: schemas.ChatMessage, db: Session = Depends(get_db)):
    """
    Conversational interface to the LangGraph agent.

    The agent (powered by Groq llama-3.3-70b-versatile) will:
    - Extract structured HCP interaction data from free-text
    - Call the appropriate tool (log, edit, suggest, analyze)
    - Return a natural language reply + any extracted/saved data

    Multi-turn context is maintained via the 'form_context' and session history.
    """
    # Build history from existing chat session if available
    history = []
    session = db.query(models.ChatSession).filter(
        models.ChatSession.session_id == payload.session_id
    ).first()

    if session and session.messages:
        history = session.messages

    # Enrich user message with form context if provided
    user_message = payload.message
    if payload.form_context:
        ctx_str = ", ".join(f"{k}: {v}" for k, v in payload.form_context.items() if v)
        if ctx_str:
            user_message = f"{payload.message}\n\n[Current form context: {ctx_str}]"

    # Run LangGraph agent
    result = await run_agent(user_message, history)

    # Persist chat session
    new_msgs = [
        {"role": "user", "content": payload.message, "timestamp": str(uuid.uuid4())},
        {"role": "assistant", "content": result["reply"], "timestamp": str(uuid.uuid4())},
    ]

    if session:
        session.messages = (session.messages or []) + new_msgs
        if result["interaction_id"]:
            session.interaction_id = result["interaction_id"]
    else:
        session = models.ChatSession(
            session_id=payload.session_id,
            messages=new_msgs,
            interaction_id=result.get("interaction_id"),
        )
        db.add(session)

    db.commit()

    return schemas.ChatResponse(
        session_id=payload.session_id,
        reply=result["reply"],
        extracted_data=result.get("extracted_data"),
        interaction_id=result.get("interaction_id"),
        suggested_followups=result.get("suggested_followups", []),
        tool_used=result.get("tool_used"),
    )


@app.get("/api/chat/{session_id}/history", tags=["AI Agent"])
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Get chat history for a session."""
    session = db.query(models.ChatSession).filter(
        models.ChatSession.session_id == session_id
    ).first()
    if not session:
        return {"session_id": session_id, "messages": []}
    return {"session_id": session_id, "messages": session.messages or []}


# ─── Seed data endpoint (dev only) ───────────────────────────────────────────

@app.post("/api/seed", tags=["System"])
def seed_data(db: Session = Depends(get_db)):
    """Seed sample HCP data for development."""
    if settings.APP_ENV != "development":
        raise HTTPException(status_code=403, detail="Only available in development")

    hcps = [
        {"name": "Dr. Anjali Sharma", "specialty": "Oncology", "institution": "AIIMS Delhi", "territory": "North"},
        {"name": "Dr. Rajesh Kumar", "specialty": "Cardiology", "institution": "Fortis Hospital", "territory": "North"},
        {"name": "Dr. Priya Mehta", "specialty": "Neurology", "institution": "Apollo Hospitals", "territory": "West"},
        {"name": "Dr. Vikram Singh", "specialty": "Endocrinology", "institution": "Max Healthcare", "territory": "North"},
        {"name": "Dr. Sunita Patel", "specialty": "Pulmonology", "institution": "Medanta", "territory": "Central"},
    ]
    created = []
    for h in hcps:
        existing = db.query(models.HCP).filter(models.HCP.name == h["name"]).first()
        if not existing:
            hcp = models.HCP(**h)
            db.add(hcp)
            created.append(h["name"])
    db.commit()
    return {"seeded": created}
