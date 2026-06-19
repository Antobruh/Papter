"use client";

import { useState } from "react";
import type { AllAnalyses } from "@/lib/api";

// ─── Summary tabs ─────────────────────────────────────────────────────────────
type SummaryKey = "overview" | "bullets" | "methodology" | "results" | "limitations" | "future_work";

const SUMMARY_TABS: { key: SummaryKey; label: string; desc: string }[] = [
  { key: "overview",    label: "Overview",    desc: "Comprehensive overview in plain English" },
  { key: "bullets",     label: "Key Points",  desc: "Major findings as bullet points" },
  { key: "methodology", label: "Methodology", desc: "How the research was done" },
  { key: "results",     label: "Results",     desc: "What the findings mean" },
  { key: "limitations", label: "Limitations", desc: "Weaknesses and constraints" },
  { key: "future_work", label: "Future Work", desc: "Open problems ahead" },
];

function SkeletonBlock({ lines = 5 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 16, width: `${70 + (i * 13) % 30}%` }} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SummaryPanel({
  analyses,
  loading,
}: {
  analyses: AllAnalyses | null;
  loading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<SummaryKey>("overview");

  const currentContent = analyses?.[activeTab] as string | undefined;

  const renderContent = () => {
    if (loading) return <SkeletonBlock lines={8} />;
    if (!analyses) return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
        Analysis is not yet available. The paper may still be processing.
      </div>
    );

    if (!currentContent) return <SkeletonBlock lines={6} />;

    // Bullet points tab — render list
    if (activeTab === "bullets") {
      const lines = currentContent.split("\n").filter(Boolean);
      return (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((line, i) => {
            const clean = line.replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, "");
            return clean ? (
              <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ color: "var(--accent-violet)", marginTop: 2, flexShrink: 0 }}>◆</span>
                <span className="prose-dark" style={{ lineHeight: 1.65 }}>{clean}</span>
              </li>
            ) : null;
          })}
        </ul>
      );
    }

    return (
      <div className="prose-dark" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
        {currentContent}
      </div>
    );
  };

  const activeTabMeta = SUMMARY_TABS.find((t) => t.key === activeTab);

  return (
    <div style={{ display: "flex", gap: 24, height: "100%" }}>
      {/* Sidebar tab list */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Summary Type</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {SUMMARY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                borderRadius: 8, border: "none", textAlign: "left",
                cursor: "pointer", transition: "all 0.2s ease",
                background: activeTab === tab.key
                  ? "rgba(124,58,237,0.18)"
                  : "transparent",
                borderLeft: activeTab === tab.key
                  ? "3px solid var(--accent-violet)"
                  : "3px solid transparent",
                color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "0.875rem", fontWeight: activeTab === tab.key ? 600 : 400,
              }}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 28,
          minHeight: 400,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>
                {activeTabMeta?.label ?? activeTab}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                {activeTabMeta?.desc ?? ""}
              </p>
            </div>
            {!loading && analyses && currentContent && (
              <button
                onClick={() => navigator.clipboard.writeText(currentContent)}
                className="btn-ghost"
                style={{ fontSize: "0.8rem" }}
              >
                Copy
              </button>
            )}
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
