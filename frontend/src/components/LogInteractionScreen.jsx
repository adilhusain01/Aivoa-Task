// components/LogInteractionScreen.jsx
import React, { useEffect, useState } from "react";
import FormPanel from "./FormPanel";
import ChatPanel from "./ChatPanel";
import HCPDirectory from "./HCPDirectory";
import { Activity } from "lucide-react";

export default function LogInteractionScreen() {
  const [apiStatus, setApiStatus] = useState("checking");
  const [activePage, setActivePage] = useState("log");

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const resp = await fetch("/api/health");
        if (!resp.ok) throw new Error("health check failed");
        const data = await resp.json();
        setApiStatus(data.status === "ok" ? "ok" : "error");
      } catch (err) {
        setApiStatus("error");
      }
    };
    checkHealth();
  }, []);

  const navItems = [
    { key: "log", label: "Log Interaction" },
    { key: "directory", label: "HCP Directory" },
  ];

  const pageTitle =
    activePage === "directory" ? "HCP Directory" : "Log HCP Interaction";

  const pageSubtitle =
    activePage === "directory"
      ? "Browse and search healthcare professionals in your directory."
      : "Record your field interaction using the form or chat with the AI assistant.";

  const renderPage = () => {
    if (activePage === "directory") return <HCPDirectory />;
    return (
      <div style={styles.content}>
        <FormPanel />
        <ChatPanel />
      </div>
    );
  };

  return (
    <div style={styles.root}>
      {/* App Topbar */}
      <header style={styles.topbar}>
        <div style={styles.topbarLeft}>
          <div style={styles.logo}>
            <Activity size={18} color="#fff" />
          </div>
          <span style={styles.logoText}>
            LifeRep <span style={styles.logoCRM}>CRM</span>
          </span>
          <nav style={styles.nav}>
            {navItems.map((item) => (
              <a
                key={item.key}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActivePage(item.key);
                }}
                style={{
                  ...styles.navLink,
                  ...(activePage === item.key ? styles.navActive : {}),
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div style={styles.topbarRight}>
          <div style={styles.apiBadge}>
            <span
              style={{
                ...styles.apiDot,
                background: apiStatus === "ok" ? "#22c55e" : "#ef4444",
              }}
            />
            {apiStatus === "checking"
              ? "Checking API"
              : apiStatus === "ok"
                ? "API OK"
                : "API Offline"}
          </div>
        </div>
      </header>

      {/* Page heading */}
      <div style={styles.pageHead}>
        <div>
          <h1 style={styles.pageTitle}>{pageTitle}</h1>
          <p style={styles.pageSubtitle}>{pageSubtitle}</p>
        </div>
        <div style={styles.agentBadge}>
          <span style={styles.agentDot} />
          LangGraph Agent · Groq llama-3.3-70b-versatile
        </div>
      </div>

      {renderPage()}
    </div>
  );
}

const styles = {
  root: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "var(--gray-50)",
    fontFamily: "var(--font)",
  },
  topbar: {
    height: 52,
    background: "#fff",
    borderBottom: "1px solid var(--gray-200)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    flexShrink: 0,
    zIndex: 20,
  },
  topbarLeft: { display: "flex", alignItems: "center", gap: 20 },
  logo: {
    width: 32,
    height: 32,
    background: "linear-gradient(135deg, var(--blue-500), var(--blue-700))",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--gray-800)",
    letterSpacing: "-0.3px",
  },
  logoCRM: { color: "var(--blue-600)" },
  nav: { display: "flex", gap: 2, marginLeft: 8 },
  navLink: {
    padding: "5px 12px",
    fontSize: 13,
    color: "var(--gray-500)",
    textDecoration: "none",
    borderRadius: 6,
    fontWeight: 500,
    transition: "all 0.15s",
  },
  navActive: {
    background: "var(--blue-50)",
    color: "var(--blue-600)",
  },
  topbarRight: { display: "flex", alignItems: "center", gap: 8 },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px",
    color: "var(--gray-500)",
    display: "flex",
    alignItems: "center",
    borderRadius: 6,
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "var(--gray-700)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  pageHead: {
    padding: "14px 24px 12px",
    background: "#fff",
    borderBottom: "1px solid var(--gray-100)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--gray-900)",
    letterSpacing: "-0.4px",
  },
  pageSubtitle: {
    fontSize: 13,
    color: "var(--gray-400)",
    marginTop: 2,
  },
  placeholderPage: {
    flex: 1,
    padding: 40,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    textAlign: "center",
    color: "var(--gray-700)",
  },
  placeholderTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: "var(--gray-900)",
  },
  placeholderText: {
    margin: 0,
    maxWidth: 560,
    fontSize: 15,
    lineHeight: 1.7,
    color: "var(--gray-500)",
  },
  apiBadge: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    background: "var(--gray-100)",
    border: "1px solid var(--gray-200)",
    borderRadius: 18,
    fontSize: 12,
    fontWeight: 600,
    color: "var(--gray-700)",
  },
  apiDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  agentBadge: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "6px 13px",
    background: "var(--blue-50)",
    border: "1px solid var(--blue-100)",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: "var(--blue-700)",
  },
  agentDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#22c55e",
    boxShadow: "0 0 0 2px #bbf7d0",
    animation: "pulse 2s ease infinite",
  },
  content: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    minHeight: 0,
  },
};
