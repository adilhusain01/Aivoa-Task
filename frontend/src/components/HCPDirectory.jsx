import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Search } from "lucide-react";
import { fetchHCPs } from "../store/interactionSlice";

export default function HCPDirectory() {
  const dispatch = useDispatch();
  const { hcps } = useSelector((state) => state.interaction);
  const [query, setQuery] = useState("");

  useEffect(() => {
    dispatch(fetchHCPs(query));
  }, [dispatch, query]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.searchBox}>
          <Search size={14} style={styles.searchIcon} />
          <input
            type="search"
            placeholder="Search HCPs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      <div style={styles.grid}>
        {hcps.length === 0 ? (
          <div style={styles.emptyState}>
            No HCPs found. Try a different search term.
          </div>
        ) : (
          hcps.map((hcp) => (
            <div key={hcp.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.cardName}>{hcp.name}</span>
                <span style={styles.cardSpecialty}>
                  {hcp.specialty || "General"}
                </span>
              </div>
              <p style={styles.cardMeta}>
                {hcp.institution || "No institution"}
              </p>
              <p style={styles.cardMeta}>{hcp.territory || "No territory"}</p>
              {hcp.email && <p style={styles.cardDetail}>Email: {hcp.email}</p>}
              {hcp.phone && <p style={styles.cardDetail}>Phone: {hcp.phone}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    background: "#fff",
    borderLeft: "1px solid var(--gray-200)",
    padding: 24,
    overflow: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--gray-100)",
    borderRadius: 12,
    padding: "8px 12px",
    border: "1px solid var(--gray-200)",
  },
  searchIcon: {
    color: "var(--gray-500)",
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    width: 220,
    fontSize: 14,
    color: "var(--gray-900)",
  },
  grid: {
    display: "grid",
    gap: 14,
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  },
  card: {
    border: "1px solid var(--gray-200)",
    borderRadius: 16,
    padding: 18,
    background: "#fff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  cardHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 10,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--gray-900)",
  },
  cardSpecialty: {
    fontSize: 13,
    color: "var(--blue-700)",
    fontWeight: 600,
  },
  cardMeta: {
    margin: 0,
    fontSize: 13,
    color: "var(--gray-500)",
  },
  cardDetail: {
    margin: "8px 0 0",
    fontSize: 13,
    color: "var(--gray-600)",
  },
  emptyState: {
    gridColumn: "1 / -1",
    padding: 40,
    border: "1px dashed var(--gray-300)",
    borderRadius: 16,
    color: "var(--gray-500)",
    textAlign: "center",
    fontSize: 14,
  },
};
