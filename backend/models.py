"""
models.py - SQLAlchemy ORM models for HCP CRM
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Enum, JSON,
    ForeignKey, func
)
from sqlalchemy.orm import relationship
from database import Base
import enum


class SentimentEnum(str, enum.Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class InteractionTypeEnum(str, enum.Enum):
    meeting = "Meeting"
    call = "Call"
    email = "Email"
    conference = "Conference"
    webinar = "Webinar"
    detail_visit = "Detail Visit"


class HCP(Base):
    """Healthcare Professional profile"""
    __tablename__ = "hcps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    specialty = Column(String(100))
    institution = Column(String(200))
    email = Column(String(150))
    phone = Column(String(30))
    territory = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    interactions = relationship("Interaction", back_populates="hcp", cascade="all, delete-orphan")


class Interaction(Base):
    """HCP Interaction log"""
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    hcp_id = Column(Integer, ForeignKey("hcps.id"), nullable=False)
    hcp_name = Column(String(200), nullable=False)          # denormalized for fast reads
    interaction_type = Column(String(50), default="Meeting")
    interaction_date = Column(String(20), nullable=False)   # stored as ISO string
    interaction_time = Column(String(10))
    attendees = Column(Text)
    topics_discussed = Column(Text)
    ai_summary = Column(Text)                                # LLM-generated summary
    materials_shared = Column(JSON, default=list)
    samples_distributed = Column(JSON, default=list)
    sentiment = Column(String(20), default="neutral")
    outcomes = Column(Text)
    follow_up_actions = Column(Text)
    ai_suggested_followups = Column(JSON, default=list)      # LLM-generated suggestions
    raw_chat_input = Column(Text)                            # original chat message if via chat
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), default="field_rep")

    hcp = relationship("HCP", back_populates="interactions")


class ChatSession(Base):
    """Chat session for conversational logging"""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True)
    interaction_id = Column(Integer, ForeignKey("interactions.id"), nullable=True)
    messages = Column(JSON, default=list)   # [{role, content, timestamp}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
