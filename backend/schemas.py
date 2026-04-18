"""
schemas.py - Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ─── HCP Schemas ─────────────────────────────────────────────────────────────

class HCPBase(BaseModel):
    name: str
    specialty: Optional[str] = None
    institution: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    territory: Optional[str] = None


class HCPCreate(HCPBase):
    pass


class HCPRead(HCPBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Interaction Schemas ──────────────────────────────────────────────────────

class InteractionCreate(BaseModel):
    hcp_name: str
    interaction_type: str = "Meeting"
    interaction_date: str
    interaction_time: Optional[str] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[List[str]] = []
    samples_distributed: Optional[List[str]] = []
    sentiment: Optional[str] = "neutral"
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None
    raw_chat_input: Optional[str] = None


class InteractionUpdate(BaseModel):
    interaction_type: Optional[str] = None
    interaction_date: Optional[str] = None
    interaction_time: Optional[str] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[List[str]] = None
    samples_distributed: Optional[List[str]] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None


class InteractionRead(BaseModel):
    id: int
    hcp_name: str
    interaction_type: str
    interaction_date: str
    interaction_time: Optional[str] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    ai_summary: Optional[str] = None
    materials_shared: Optional[List[Any]] = []
    samples_distributed: Optional[List[Any]] = []
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None
    ai_suggested_followups: Optional[List[str]] = []
    raw_chat_input: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Chat Schemas ─────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    session_id: str
    message: str
    form_context: Optional[dict] = None    # current form state to merge with


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    extracted_data: Optional[dict] = None  # structured data extracted by agent
    interaction_id: Optional[int] = None   # set when interaction is logged
    suggested_followups: Optional[List[str]] = []
    tool_used: Optional[str] = None


# ─── Agent Tool Schemas ────────────────────────────────────────────────────────

class LogInteractionInput(BaseModel):
    hcp_name: str
    interaction_type: str
    interaction_date: str
    interaction_time: str
    topics_discussed: str
    sentiment: str
    outcomes: str
    follow_up_actions: str
    attendees: Optional[str] = ""
    materials_shared: Optional[List[str]] = []
    samples_distributed: Optional[List[str]] = []
    raw_chat_input: Optional[str] = ""


class EditInteractionInput(BaseModel):
    interaction_id: int
    field: str
    value: Any
