"use client";

import { useState } from "react";

interface GapItem {
  gap_type: "limitation" | "missing_area" | "future_direction" | "improvement";
  title: string;
  description: string;
  evidence: string;
}

const GAP_META = {
  limitation:        { label: "Limitation",         color: "#ef4444" },
  missing_area:      { label: "Missing Area",        color: "#f59e0b" },
  future_direction:  { label: "Future Direction",    color: "#06b6d4" },
  improvement:       { label: "Improvement",         color: "#22c55e" },
};

function GapCard({ gap }: { gap: GapItem }) {
  const [open, setOpen] = useState(false);
  const meta = GAP_META[gap.gap_type] ?? GAP_META.limitation;

  return (
    <div
      className={`gap-detector-card gap-${gap.gap_type}`}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "16px 20px",
        marginBottom: 12,
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{gap.title}</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{
            fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
            color: meta.color, background: `${meta.color}18`,
            padding: "2px 8px", borderRadius: 99,
            border: `1px solid ${meta.color}44`,
          }}>
            {meta.label}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14, animation: "fadeIn 0.2s ease" }}>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.7, marginBottom: 12 }}>
            {gap.description}
          </p>
          {gap.evidence && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(124,58,237,0.08)",
              borderRadius: 6,
              borderLeft: "3px solid var(--accent-violet)",
            }}>
              <p style={{ fontSize: "0.7rem", color: "var(--accent-violet-light)", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                Evidence from paper
              </p>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.6, fontFamily: "'Fira Code', monospace" }}>
                &quot;{gap.evidence}&quot;
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GapAnalysis({
  gapsJson,
  loading,
}: {
  gapsJson: string | null | undefined;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<string>("all");

  let gaps: GapItem[] = [];
  if (gapsJson) {
    try {
      const parsed = JSON.parse(gapsJson);
      gaps = Array.isArray(parsed) ? parsed : [];
    } catch {
      // if raw text fallback — not JSON
    }
  }

  const filtered = filter === "all" ? gaps : gaps.filter((g) => g.gap_type === filter);

  const counts = {
    all: gaps.length,
    limitation: gaps.filter((g) => g.gap_type === "limitation").length,
    missing_area: gaps.filter((g) => g.gap_type === "missing_area").length,
    future_direction: gaps.filter((g) => g.gap_type === "future_direction").length,
    improvement: gaps.filter((g) => g.gap_type === "improvement").length,
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1,2,3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Research Gap Analysis</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Limitations, missing areas, and future research opportunities identified from the paper
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {Object.entries(GAP_META).map(([key, meta]) => (
          <div key={key} style={{
            padding: "12px 18px", borderRadius: "var(--radius-sm)",
            background: "var(--bg-secondary)", border: `1px solid ${meta.color}33`,
            textAlign: "center", minWidth: 100,
          }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: meta.color }}>
              {counts[key as keyof typeof counts] ?? 0}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>{meta.label}s</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      {gaps.length > 0 && (
        <div className="tab-bar" style={{ marginBottom: 20, display: "inline-flex" }}>
          {[
            { key: "all", label: "All" },
            ...Object.entries(GAP_META).map(([k, v]) => ({ key: k, label: v.label })),
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`tab-item ${filter === key ? "active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label} {counts[key as keyof typeof counts] > 0 && (
                <span style={{ opacity: 0.7, fontSize: "0.75em" }}>({counts[key as keyof typeof counts]})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Gap list or raw text fallback */}
      {gaps.length > 0 ? (
        filtered.length > 0 ? (
          filtered.map((gap, i) => <GapCard key={i} gap={gap} />)
        ) : (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            No {filter.replace("_", " ")}s found.
          </div>
        )
      ) : gapsJson ? (
        // Fallback: render raw text if JSON parsing failed
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="prose-dark" style={{ whiteSpace: "pre-wrap" }}>{gapsJson}</div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>Gap Analysis</div>
          <p>Gap analysis is not yet available for this paper.</p>
        </div>
      )}
    </div>
  );
}
