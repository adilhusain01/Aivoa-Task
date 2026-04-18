// components/ChatPanel.jsx
import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Bot,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import {
  sendChatMessage,
  addUserMessage,
  resetSession,
} from "../store/chatSlice";
import { mergeExtractedData, setAiFollowups } from "../store/interactionSlice";

const TOOL_LABELS = {
  log_interaction: {
    label: "Interaction Logged",
    color: "#16a34a",
    bg: "#f0fdf4",
  },
  edit_interaction: {
    label: "Interaction Edited",
    color: "#2563eb",
    bg: "#eff6ff",
  },
  get_hcp_profile: {
    label: "HCP Profile Fetched",
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
  suggest_followups: {
    label: "Follow-ups Generated",
    color: "#d97706",
    bg: "#fffbeb",
  },
  analyze_sentiment: {
    label: "Sentiment Analyzed",
    color: "#0891b2",
    bg: "#ecfeff",
  },
};

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  const toolInfo = msg.toolUsed ? TOOL_LABELS[msg.toolUsed] : null;

  return (
    <div
      style={{
        ...styles.bubbleWrap,
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      {!isUser && (
        <div style={styles.avatar}>
          <Bot size={14} color="#fff" />
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxWidth: "82%",
          alignItems: isUser ? "flex-end" : "flex-start",
        }}
      >
        {toolInfo && (
          <div
            style={{
              ...styles.toolBadge,
              color: toolInfo.color,
              background: toolInfo.bg,
            }}
          >
            <Wrench size={10} /> {toolInfo.label}
          </div>
        )}
        {msg.interactionId && (
          <div style={styles.successBadge}>
            <CheckCircle2 size={11} /> Saved as #{msg.interactionId}
          </div>
        )}
        <div
          style={{
            ...styles.bubble,
            ...(isUser ? styles.userBubble : styles.aiBubble),
            ...(msg.isError ? styles.errorBubble : {}),
          }}
        >
          {msg.content}
        </div>
        <span style={styles.timestamp}>
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ ...styles.bubbleWrap, justifyContent: "flex-start" }}>
      <div style={styles.avatar}>
        <Bot size={14} color="#fff" />
      </div>
      <div
        style={{
          ...styles.bubble,
          ...styles.aiBubble,
          display: "flex",
          gap: 5,
          padding: "10px 16px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--gray-300)",
              animation: "pulse 1.5s ease infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const dispatch = useDispatch();
  const { messages, isTyping, lastSuggestedFollowups } = useSelector(
    (s) => s.chat,
  );
  const { form } = useSelector((s) => s.interaction);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Sync AI followups to form
  useEffect(() => {
    if (lastSuggestedFollowups.length > 0) {
      dispatch(setAiFollowups(lastSuggestedFollowups));
    }
  }, [lastSuggestedFollowups, dispatch]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    dispatch(addUserMessage(trimmed));
    setInput("");

    // Build full form context to help the AI decide whether to log or edit
    const formContext = {
      hcp_name: form.hcp_name || undefined,
      interaction_type: form.interaction_type,
      interaction_date: form.interaction_date,
      interaction_time: form.interaction_time || undefined,
      attendees: form.attendees || undefined,
      topics_discussed: form.topics_discussed || undefined,
      materials_shared: form.materials_shared?.length
        ? form.materials_shared
        : undefined,
      samples_distributed: form.samples_distributed?.length
        ? form.samples_distributed
        : undefined,
      sentiment: form.sentiment || undefined,
      outcomes: form.outcomes || undefined,
      follow_up_actions: form.follow_up_actions || undefined,
    };

    const result = await dispatch(
      sendChatMessage({ message: trimmed, formContext }),
    );

    // If AI extracted data, merge into form
    if (
      result.payload?.extracted_data &&
      Object.keys(result.payload.extracted_data).length > 0
    ) {
      dispatch(mergeExtractedData(result.payload.extracted_data));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const examplePrompts = [
    "Met Dr. Sharma, discussed OncoBoost Phase III data, positive response, shared brochure",
    "Called Dr. Kumar, neutral, discussed CardioMax dosing, will send follow-up data",
    "Edit interaction #3 — change sentiment to positive",
  ];

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.botIcon}>
            <Bot size={16} color="#fff" />
          </div>
          <div>
            <div style={styles.headerTitle}>AI Assistant</div>
            <div style={styles.headerSub}>Log interaction via chat</div>
          </div>
        </div>
        <button
          style={styles.resetBtn}
          onClick={() => dispatch(resetSession())}
          title="New session"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* System info card */}
      <div style={styles.infoCard}>
        <Sparkles
          size={13}
          style={{ color: "var(--blue-600)", flexShrink: 0 }}
        />
        <p style={styles.infoText}>
          Log interaction details here (e.g., "Met Dr. Smith, discussed Product
          X efficacy, positive sentiment, shared brochure") or ask for help.
        </p>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Example prompts (shown when only the intro message exists) */}
      {messages.length === 1 && (
        <div style={styles.examples}>
          <p style={styles.examplesLabel}>Try an example:</p>
          {examplePrompts.map((p, i) => (
            <button
              key={i}
              style={styles.exampleBtn}
              onClick={() => setInput(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={styles.inputArea}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe interaction..."
          style={styles.chatInput}
          rows={1}
          disabled={isTyping}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: !input.trim() || isTyping ? 0.5 : 1,
            cursor: !input.trim() || isTyping ? "not-allowed" : "pointer",
          }}
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
        >
          {isTyping ? (
            <Loader2
              size={15}
              style={{ animation: "spin 0.8s linear infinite" }}
            />
          ) : (
            <Send size={15} />
          )}
          {isTyping ? null : "Log"}
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  panel: {
    width: 400,
    minWidth: 360,
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    borderLeft: "1px solid var(--gray-200)",
    height: "100%",
  },
  header: {
    padding: "16px 18px",
    borderBottom: "1px solid var(--gray-100)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    background: "#fff",
    zIndex: 10,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  botIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "linear-gradient(135deg, var(--blue-500), var(--blue-700))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 14, fontWeight: 600, color: "var(--gray-800)" },
  headerSub: { fontSize: 11, color: "var(--gray-400)", marginTop: 1 },
  resetBtn: {
    background: "none",
    border: "1px solid var(--gray-200)",
    borderRadius: "var(--radius-sm)",
    padding: "6px 8px",
    cursor: "pointer",
    color: "var(--gray-500)",
    display: "flex",
    alignItems: "center",
  },
  infoCard: {
    margin: "12px 14px 0",
    padding: 12,
    background: "var(--blue-50)",
    border: "1px solid var(--blue-100)",
    borderRadius: "var(--radius)",
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 12,
    color: "var(--gray-600)",
    lineHeight: 1.5,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  bubbleWrap: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    animation: "fadeIn 0.2s ease",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "linear-gradient(135deg, var(--blue-500), var(--blue-700))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    padding: "10px 13px",
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  aiBubble: {
    background: "var(--gray-100)",
    color: "var(--gray-800)",
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    background: "var(--blue-600)",
    color: "#fff",
    borderBottomRightRadius: 4,
  },
  errorBubble: {
    background: "var(--red-50)",
    color: "#dc2626",
  },
  toolBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.3,
  },
  successBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
    color: "#16a34a",
    background: "#f0fdf4",
  },
  timestamp: {
    fontSize: 10,
    color: "var(--gray-400)",
  },
  examples: {
    padding: "0 14px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  examplesLabel: {
    fontSize: 11,
    color: "var(--gray-400)",
    fontWeight: 500,
    marginBottom: 2,
  },
  exampleBtn: {
    background: "var(--gray-50)",
    border: "1px solid var(--gray-200)",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 11,
    color: "var(--gray-600)",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "var(--font)",
    lineHeight: 1.4,
    transition: "all 0.15s",
  },
  inputArea: {
    padding: "12px 14px",
    borderTop: "1px solid var(--gray-100)",
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    background: "#fff",
  },
  chatInput: {
    flex: 1,
    padding: "9px 12px",
    border: "1px solid var(--gray-200)",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    fontFamily: "var(--font)",
    resize: "none",
    outline: "none",
    color: "var(--gray-800)",
    lineHeight: 1.4,
    maxHeight: 100,
    overflowY: "auto",
  },
  sendBtn: {
    padding: "9px 14px",
    background: "var(--gray-800)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    fontFamily: "var(--font)",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    transition: "background 0.15s",
    height: 38,
  },
};
