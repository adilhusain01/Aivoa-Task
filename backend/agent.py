"""
agent.py - LangGraph AI Agent for HCP Interaction Management

Role of the LangGraph Agent:
    The agent acts as an intelligent orchestrator for all HCP interaction workflows.
    It processes natural-language input from field representatives, extracts structured
    data (HCP name, interaction type, topics, sentiment, etc.) using the Groq LLM,
    and routes execution to the appropriate tool — whether logging a new interaction,
    editing an existing one, fetching HCP history, suggesting follow-ups, or
    performing sentiment analysis. The agent maintains conversational state across
    turns so reps can refine their logs naturally.

LangGraph State Machine:
    START → agent_node → (tool call?) → tool_node → agent_node → END
                       ↘ (no tool needed) → END
"""

import json
import uuid
from datetime import datetime
from typing import Annotated, Sequence, TypedDict, Optional, List

from langchain_core.messages import (
    BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage
)
from langchain_core.tools import tool
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from config import settings
from database import SessionLocal
import models

# ─── DB helper (tools use their own sessions) ─────────────────────────────────

def get_session():
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL 1 – log_interaction
#   Captures interaction data from structured or conversational input.
#   Uses the LLM upstream (in the agent node) for summarization and entity
#   extraction before the tool is invoked with clean structured fields.
# ═══════════════════════════════════════════════════════════════════════════════
@tool
def log_interaction(
    hcp_name: str,
    interaction_type: str,
    interaction_date: str,
    interaction_time: str,
    topics_discussed: str,
    sentiment: str,
    outcomes: str,
    follow_up_actions: str,
    attendees: str = "",
    materials_shared: str = "[]",
    samples_distributed: str = "[]",
    raw_chat_input: str = "",
) -> str:
    """
    Log a new HCP interaction to the database.

    The LLM extracts all entities from free-text before calling this tool.
    Summarization of topics and AI follow-up suggestions are also generated
    by the LLM and stored alongside the structured fields.

    Args:
        hcp_name: Full name of the Healthcare Professional.
        interaction_type: One of Meeting, Call, Email, Conference, Webinar, Detail Visit.
        interaction_date: ISO date string (YYYY-MM-DD).
        interaction_time: HH:MM time string.
        topics_discussed: Key discussion points, drug efficacy, patient data, etc.
        sentiment: Observed HCP sentiment — positive, neutral, or negative.
        outcomes: Outcomes or agreements reached during the interaction.
        follow_up_actions: Next steps the field rep must take.
        attendees: Comma-separated list of other attendees.
        materials_shared: JSON array string of material names.
        samples_distributed: JSON array string of sample names.
        raw_chat_input: Original free-text message from the field rep.

    Returns:
        JSON string with {success, interaction_id, message}.
    """
    db = get_session()
    try:
        # Ensure HCP record exists (upsert by name)
        hcp = db.query(models.HCP).filter(
            models.HCP.name.ilike(f"%{hcp_name}%")
        ).first()
        if not hcp:
            hcp = models.HCP(name=hcp_name)
            db.add(hcp)
            db.flush()

        # Parse JSON arrays safely
        try:
            mats = json.loads(materials_shared) if materials_shared else []
        except Exception:
            mats = []
        try:
            samps = json.loads(samples_distributed) if samples_distributed else []
        except Exception:
            samps = []

        # AI-generated summary (brief condensed version of topics + outcomes)
        ai_summary = f"Interaction with {hcp_name} on {interaction_date}. " \
                     f"Topics: {topics_discussed[:200]}. Outcome: {outcomes[:200]}."

        # Build suggested follow-ups using a secondary Groq call
        suggested = _generate_followup_suggestions(hcp_name, topics_discussed, sentiment)

        interaction = models.Interaction(
            hcp_id=hcp.id,
            hcp_name=hcp_name,
            interaction_type=interaction_type,
            interaction_date=interaction_date,
            interaction_time=interaction_time,
            attendees=attendees,
            topics_discussed=topics_discussed,
            ai_summary=ai_summary,
            materials_shared=mats,
            samples_distributed=samps,
            sentiment=sentiment.lower(),
            outcomes=outcomes,
            follow_up_actions=follow_up_actions,
            ai_suggested_followups=suggested,
            raw_chat_input=raw_chat_input,
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        return json.dumps({
            "success": True,
            "interaction_id": interaction.id,
            "message": f"Interaction with {hcp_name} logged successfully (ID: {interaction.id}).",
            "ai_suggested_followups": suggested,
        })
    except Exception as e:
        db.rollback()
        return json.dumps({"success": False, "error": str(e)})
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL 2 – edit_interaction
#   Allows field reps to modify any field of an already-logged interaction.
#   The agent first retrieves the current value, then applies the change and
#   re-runs AI summarization if topics or outcomes change.
# ═══════════════════════════════════════════════════════════════════════════════
@tool
def edit_interaction(interaction_id: Optional[str] = None, field: str = "", value: str = "") -> str:
    """
    Edit a specific field of an existing HCP interaction or update the current
    form state when no interaction ID is provided.

    Args:
        interaction_id: Optional database ID of the interaction to edit.
        field: The field name to update (e.g., 'sentiment', 'outcomes').
        value: The new value for that field.

    Returns:
        JSON string with {success, interaction_id, updated_field, new_value, message}.
    """
    allowed_fields = {
        "interaction_type", "interaction_date", "interaction_time",
        "attendees", "topics_discussed", "sentiment", "outcomes",
        "follow_up_actions", "materials_shared", "samples_distributed",
        "hcp_name",
    }

    if field not in allowed_fields:
        return json.dumps({
            "success": False,
            "error": f"Field '{field}' cannot be edited. Allowed: {sorted(allowed_fields)}"
        })

    if interaction_id is not None:
        try:
            interaction_id = int(interaction_id)
        except Exception:
            interaction_id = None

    if interaction_id is None:
        # When no interaction is saved yet, simply return the corrected field/value.
        return json.dumps({
            "success": True,
            "interaction_id": None,
            "updated_field": field,
            "new_value": value,
            "message": f"Updated '{field}' on the current interaction form.",
        })

    db = get_session()
    try:
        interaction = db.query(models.Interaction).filter(
            models.Interaction.id == interaction_id
        ).first()
        if not interaction:
            return json.dumps({"success": False, "error": f"Interaction {interaction_id} not found."})

        # Handle JSON list fields
        if field in ("materials_shared", "samples_distributed"):
            try:
                parsed = json.loads(value)
            except Exception:
                parsed = [v.strip() for v in value.split(",") if v.strip()]
            setattr(interaction, field, parsed)
        else:
            setattr(interaction, field, value)

        # Regenerate AI summary if key fields changed
        if field in ("topics_discussed", "outcomes"):
            interaction.ai_summary = (
                f"Interaction with {interaction.hcp_name} on {interaction.interaction_date}. "
                f"Topics: {interaction.topics_discussed[:200]}. "
                f"Outcome: {interaction.outcomes[:200]}."
            )

        db.commit()
        return json.dumps({
            "success": True,
            "interaction_id": interaction_id,
            "updated_field": field,
            "new_value": value,
            "message": f"Field '{field}' updated successfully for interaction {interaction_id}.",
        })
    except Exception as e:
        db.rollback()
        return json.dumps({"success": False, "error": str(e)})
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL 3 – get_hcp_profile
#   Retrieves full HCP profile and recent interaction history so the agent can
#   provide contextually aware suggestions during a conversation.
# ═══════════════════════════════════════════════════════════════════════════════
@tool
def get_hcp_profile(hcp_name: str) -> str:
    """
    Retrieve the HCP's profile and last 5 interaction summaries.

    Used by the agent to provide context-aware suggestions, detect patterns in
    prescribing behavior, and personalize the conversation with the field rep.

    Args:
        hcp_name: Full or partial name of the Healthcare Professional.

    Returns:
        JSON string with HCP details and interaction history.
    """
    db = get_session()
    try:
        hcp = db.query(models.HCP).filter(
            models.HCP.name.ilike(f"%{hcp_name}%")
        ).first()
        if not hcp:
            return json.dumps({
                "found": False,
                "message": f"No HCP found matching '{hcp_name}'. A new profile will be created on first log."
            })

        recent = (
            db.query(models.Interaction)
            .filter(models.Interaction.hcp_id == hcp.id)
            .order_by(models.Interaction.created_at.desc())
            .limit(5)
            .all()
        )
        history = [
            {
                "id": i.id,
                "date": i.interaction_date,
                "type": i.interaction_type,
                "summary": i.ai_summary,
                "sentiment": i.sentiment,
                "outcomes": i.outcomes,
            }
            for i in recent
        ]
        return json.dumps({
            "found": True,
            "hcp": {
                "id": hcp.id,
                "name": hcp.name,
                "specialty": hcp.specialty,
                "institution": hcp.institution,
                "territory": hcp.territory,
            },
            "interaction_count": len(recent),
            "recent_interactions": history,
        })
    except Exception as e:
        return json.dumps({"found": False, "error": str(e)})
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL 4 – suggest_followups
#   Uses Groq LLM to generate contextually relevant follow-up actions for
#   the field rep based on the latest interaction's topics and HCP sentiment.
# ═══════════════════════════════════════════════════════════════════════════════
@tool
def suggest_followups(hcp_name: str, topics: str, sentiment: str) -> str:
    """
    Generate AI-powered follow-up action recommendations.

    Calls Groq (llama-3.3-70b-versatile) to produce 3-5 actionable follow-up
    suggestions tailored to the HCP, topics discussed, and observed sentiment.
    Suggestions cover scheduling, materials, samples, medical education, and
    advisory board opportunities.

    Args:
        hcp_name: Name of the HCP.
        topics: Topics that were discussed during the interaction.
        sentiment: Observed HCP sentiment (positive / neutral / negative).

    Returns:
        JSON string with a list of suggested follow-up actions.
    """
    suggestions = _generate_followup_suggestions(hcp_name, topics, sentiment)
    return json.dumps({
        "success": True,
        "hcp_name": hcp_name,
        "suggested_followups": suggestions
    })


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL 5 – analyze_sentiment
#   Applies the Groq LLM to infer HCP sentiment from free-text interaction
#   notes, providing both a label and a confidence rationale.
# ═══════════════════════════════════════════════════════════════════════════════
@tool
def analyze_sentiment(interaction_text: str) -> str:
    """
    Analyze and infer HCP sentiment from interaction notes.

    Uses Groq llama-3.3-70b-versatile to classify HCP sentiment as positive, neutral,
    or negative, and provides a rationale. This helps field reps capture
    accurate sentiment even when they don't explicitly state it.

    Args:
        interaction_text: Free-text description of the interaction / HCP behavior.

    Returns:
        JSON string with {sentiment, confidence, rationale}.
    """
    try:
        llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model="llama-3.3-70b-versatile",
            temperature=0.1,
        )
        prompt = f"""Analyze the sentiment of the HCP (Healthcare Professional) in the following interaction notes.
Classify as: positive, neutral, or negative.
Provide a 1-2 sentence rationale.

Interaction notes:
{interaction_text}

Respond ONLY in this JSON format:
{{"sentiment": "positive|neutral|negative", "confidence": "high|medium|low", "rationale": "..."}}"""

        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        # Strip markdown code blocks if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return raw.strip()
    except Exception as e:
        return json.dumps({
            "sentiment": "neutral",
            "confidence": "low",
            "rationale": f"Could not analyze sentiment: {str(e)}"
        })


# ─── Private helper: generate follow-up suggestions via Groq ──────────────────

def _generate_followup_suggestions(hcp_name: str, topics: str, sentiment: str) -> List[str]:
    """Call Groq llama-3.3-70b-versatile to generate follow-up suggestions."""
    try:
        llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model="llama-3.3-70b-versatile",
            temperature=0.4,
        )
        prompt = f"""You are a life-science CRM assistant. Based on the following HCP interaction,
suggest 3-5 specific, actionable follow-up tasks for the field representative.
Be concise. Each suggestion should start with an action verb.

HCP: {hcp_name}
Topics Discussed: {topics}
HCP Sentiment: {sentiment}

Return ONLY a JSON array of strings. Example: ["Schedule follow-up in 2 weeks", "Send Phase III data PDF"]"""

        response = llm.invoke([HumanMessage(content=prompt)])
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception:
        return [
            f"Schedule a follow-up meeting with {hcp_name}",
            "Send relevant clinical study materials",
            "Log sample distribution in compliance system",
        ]


# ═══════════════════════════════════════════════════════════════════════════════
# LANGGRAPH STATE & GRAPH DEFINITION
# ═══════════════════════════════════════════════════════════════════════════════

TOOLS = [log_interaction, edit_interaction, get_hcp_profile, suggest_followups, analyze_sentiment]

SYSTEM_PROMPT = """You are an AI assistant embedded in a life-science CRM system, helping field
medical representatives log and manage their HCP (Healthcare Professional) interactions.

Your capabilities (tools):
1. log_interaction    – Save a new HCP interaction with full structured data
2. edit_interaction   – Modify a field in an existing logged interaction or update the current interaction form when no saved record exists
3. get_hcp_profile    – Fetch an HCP's profile and recent interaction history
4. suggest_followups  – Generate AI-driven follow-up action recommendations
5. analyze_sentiment  – Classify HCP sentiment from free-text notes

When a user describes a meeting, call, or visit with a doctor or HCP:
- Extract: HCP name, interaction type, date, time, topics, sentiment, outcomes, follow-ups
- If the date is not mentioned, use today's date
- If the time is not mentioned, use the current time or leave it empty if unknown
- If sentiment is not mentioned, infer from context or default to 'neutral'
- Call log_interaction with a complete set of fields; do not omit any required tool argument
- For missing optional text values, use an empty string; for missing list fields, use an empty array
- If the user corrects or changes a field in the current draft, call edit_interaction for only those fields

Be concise, professional, and medically aware. Always confirm what was logged."""


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]


def build_agent():
    """Build and compile the LangGraph agent."""
    llm = ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model="llama-3.3-70b-versatile",
        temperature=0.2,
    )
    llm_with_tools = llm.bind_tools(TOOLS)

    def agent_node(state: AgentState):
        messages = list(state["messages"])
        # Prepend system message if not already present
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    def should_continue(state: AgentState):
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    tool_node = ToolNode(TOOLS)

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# Singleton agent instance
_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent


async def run_agent(user_message: str, history: list = None) -> dict:
    """
    Run the LangGraph agent with a user message and optional chat history.

    Args:
        user_message: The latest message from the field rep.
        history: List of previous {role, content} dicts for multi-turn context.

    Returns:
        dict with {reply, extracted_data, interaction_id, suggested_followups, tool_used}
    """
    agent = get_agent()
    messages: List[BaseMessage] = []

    if history:
        for h in history[-10:]:  # keep last 10 turns
            if h["role"] == "user":
                messages.append(HumanMessage(content=h["content"]))
            elif h["role"] == "assistant":
                messages.append(AIMessage(content=h["content"]))

    messages.append(HumanMessage(content=user_message))

    result = await agent.ainvoke({"messages": messages})

    # Extract the final AI reply
    ai_messages = [m for m in result["messages"] if isinstance(m, AIMessage)]
    reply = ai_messages[-1].content if ai_messages else "I processed your request."

    # Detect which tool was used and extract data
    tool_used = None
    interaction_id = None
    suggested_followups = []
    extracted_data = {}

    def normalize_args(args):
        if isinstance(args, str):
            try:
                return json.loads(args)
            except Exception:
                return args
        return args

    def merge_tool_args(args):
        out = {}
        if not isinstance(args, dict):
            return out
        for key, value in args.items():
            normalized = normalize_args(value)
            if key in ("materials_shared", "samples_distributed") and isinstance(normalized, str):
                try:
                    normalized = json.loads(normalized)
                except Exception:
                    normalized = [item.strip() for item in normalized.split(",") if item.strip()]
            out[key] = normalized
        return out

    # First parse tool outputs and then any tool call arguments for richer form filling
    tool_messages = [m for m in result["messages"] if isinstance(m, ToolMessage)]
    for tm in tool_messages:
        try:
            data = json.loads(tm.content)
            if "interaction_id" in data:
                interaction_id = data.get("interaction_id")
                suggested_followups = data.get("ai_suggested_followups", [])
                tool_used = "log_interaction"
            elif "updated_field" in data:
                tool_used = "edit_interaction"
            elif "hcp" in data:
                tool_used = "get_hcp_profile"
            elif "suggested_followups" in data:
                suggested_followups = data.get("suggested_followups", [])
                tool_used = "suggest_followups"
            elif "sentiment" in data and "rationale" in data:
                extracted_data = data
                tool_used = "analyze_sentiment"
        except Exception:
            pass

    for msg in result["messages"]:
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for call in msg.tool_calls:
                call_name = call.get("name")
                call_args = merge_tool_args(call.get("args", {}))
                if call_name == "log_interaction":
                    tool_used = tool_used or "log_interaction"
                    extracted_data = {**extracted_data, **call_args}
                elif call_name == "edit_interaction":
                    tool_used = tool_used or "edit_interaction"
                    field_name = call_args.get("field")
                    if field_name and "value" in call_args:
                        extracted_data = {
                            **extracted_data,
                            field_name: call_args["value"],
                        }
                        interaction_id = interaction_id or call_args.get("interaction_id")
                elif call_name == "get_hcp_profile":
                    tool_used = tool_used or "get_hcp_profile"
                elif call_name == "suggest_followups":
                    tool_used = tool_used or "suggest_followups"
                    if call_args.get("suggested_followups"):
                        suggested_followups = call_args["suggested_followups"]
                elif call_name == "analyze_sentiment":
                    tool_used = tool_used or "analyze_sentiment"
                    extracted_data = {**extracted_data, **call_args}

    return {
        "reply": reply,
        "extracted_data": extracted_data,
        "interaction_id": interaction_id,
        "suggested_followups": suggested_followups,
        "tool_used": tool_used,
    }
