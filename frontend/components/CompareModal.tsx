"use client";

import { useState } from "react";
import { compareApi, type Paper, type CompareOut } from "@/lib/api";

export default function CompareModal({
  papers,
  currentPaperId,
}: {
  papers: Paper[];
  currentPaperId: string;
}) {
  const [selected, setSelected] = useState<string[]>([currentPaperId]);
  const [result, setResult] = useState<CompareOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model] = useState("qwen3:8b");

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const compare = async () => {
    if (selected.length < 2) {
      setError("Select at least 2 papers to compare.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const out = await compareApi.compare(selected, model);
      setResult(out);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setLoading(false);
    }
  };

  const readyPapers = papers.filter((p) => p.status === "ready");

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 6 }}>Paper Comparison</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Compare methodologies, contributions, datasets and findings across multiple papers
        </p>
      </div>

      {readyPapers.length < 2 ? (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          background: "var(--bg-secondary)", borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 32, marginBottom: 16, fontWeight: "bold" }}>Compare</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Need more papers</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            You need at least 2 ready papers to compare. Upload more papers from the Dashboard.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Paper selector */}
          {!result && (
            <div>
              <p className="section-label" style={{ marginBottom: 12 }}>
                Select papers to compare ({selected.length} selected)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {readyPapers.map((paper) => {
                  const isSelected = selected.includes(paper.id);
                  const isCurrent = paper.id === currentPaperId;
                  return (
                    <label
                      key={paper.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 18px",
                        borderRadius: "var(--radius-sm)",
                        border: `1px solid ${isSelected ? "var(--accent-violet)" : "var(--border)"}`,
                        background: isSelected ? "rgba(124,58,237,0.1)" : "var(--bg-secondary)",
                        cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(paper.id)}
                        disabled={isCurrent}
                        style={{ width: 16, height: 16, accentColor: "var(--accent-violet)" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {paper.title ?? paper.filename}
                          {isCurrent && (
                            <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "var(--accent-cyan)", fontWeight: 400 }}>
                              (current)
                            </span>
                          )}
                        </div>
                        {paper.authors && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                            {paper.authors}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {paper.page_count} pages
                      </span>
                    </label>
                  );
                })}
              </div>

              {error && (
                <p style={{ color: "#ef4444", fontSize: "0.85rem", marginTop: 12 }}>{error}</p>
              )}

              <button
                onClick={compare}
                disabled={loading || selected.length < 2}
                className="btn-primary"
                style={{ marginTop: 20, opacity: (loading || selected.length < 2) ? 0.6 : 1 }}
              >
                {loading ? "Generating comparison..." : `Compare ${selected.length} Papers`}
              </button>

              {loading && (
                <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 12 }}>
                  This may take 30–60 seconds depending on your model…
                </p>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontWeight: 700 }}>Comparison Report</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 2 }}>
                    {result.papers.map((p) => p.title ?? p.filename).join(" vs ")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.report)}
                    className="btn-ghost" style={{ fontSize: "0.8rem" }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => { setResult(null); setSelected([currentPaperId]); }}
                    className="btn-secondary" style={{ fontSize: "0.8rem", padding: "8px 14px" }}
                  >
                    ← New Comparison
                  </button>
                </div>
              </div>

              <div style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: 28,
              }}>
                <div className="prose-dark" style={{ whiteSpace: "pre-wrap", lineHeight: 1.85 }}>
                  {result.report}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
