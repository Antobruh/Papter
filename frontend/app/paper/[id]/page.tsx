/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { papersApi, analysisApi, type Paper, type AllAnalyses, type Concept } from "@/lib/api";

// Lazy-loaded heavy components
import dynamic from "next/dynamic";

const SummaryPanel = dynamic(() => import("@/components/SummaryPanel"), { ssr: false });
const ChatInterface = dynamic(() => import("@/components/ChatInterface"), { ssr: false });
const GapAnalysis = dynamic(() => import("@/components/GapAnalysis"), { ssr: false });
const CompareModal = dynamic(() => import("@/components/CompareModal"), { ssr: false });
const ConceptMap = dynamic(() => import("@/components/ConceptMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Loading concept map…
    </div>
  ),
});

type Tab = "summary" | "chat" | "gaps" | "compare" | "conceptmap";

const TABS: { key: Tab; label: string }[] = [
  { key: "summary",    label: "Summary" },
  { key: "chat",       label: "AI Chat" },
  { key: "gaps",       label: "Research Gaps" },
  { key: "compare",    label: "Compare" },
  { key: "conceptmap", label: "Concept Map" },
];

function StatusDot({ status }: { status: Paper["status"] }) {
  const map = { pending: "#fbbf24", processing: "#06b6d4", ready: "#22c55e", error: "#ef4444" };
  return (
    <span style={{
      display: "inline-block",
      width: 8, height: 8, borderRadius: "50%",
      background: map[status] ?? "#94a3b8",
      marginRight: 6,
      animation: status === "processing" ? "pulse 1.5s infinite" : "none",
    }} />
  );
}

export default function PaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: paperId } = use(params);
  const router = useRouter();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [analyses, setAnalyses] = useState<AllAnalyses | null>(null);
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [loadingPaper, setLoadingPaper] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadPaper = useCallback(async () => {
    try {
      const p = await papersApi.get(paperId);
      setPaper(p);
      return p;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Paper not found");
      return null;
    } finally {
      setLoadingPaper(false);
    }
  }, [paperId]);

  const loadAnalysis = useCallback(async () => {
    try {
      const a = await analysisApi.getAll(paperId);
      setAnalyses(a);
    } catch {
      // not ready yet
    } finally {
      setLoadingAnalysis(false);
    }
  }, [paperId]);

  useEffect(() => {
    loadPaper();
    papersApi.list().then(setAllPapers).catch(() => null);
  }, [loadPaper]);

  useEffect(() => {
    if (!paper) return;
    if (paper.status === "ready") {
      loadAnalysis();
    } else if (paper.status === "pending" || paper.status === "processing") {
      // Poll until ready
      const timer = setInterval(async () => {
        const p = await papersApi.get(paperId).catch(() => null);
        if (!p) return;
        setPaper(p);
        if (p.status === "ready") {
          clearInterval(timer);
          loadAnalysis();
        } else if (p.status === "error") {
          clearInterval(timer);
          setLoadingAnalysis(false);
        }
      }, 5000);
      return () => clearInterval(timer);
    } else {
      setLoadingAnalysis(false);
    }
  }, [paper?.status, paperId, paper, loadAnalysis]);

  const handleDelete = async () => {
    if (!paper) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    setDeleting(true);
    try {
      await papersApi.delete(paperId);
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Delete failed:", err);
      alert("Failed to delete: " + (err instanceof Error ? err.message : String(err)));
      setDeleting(false);
    }
  };

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loadingPaper) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 16, fontWeight: "bold" }} className="animate-spin-slow">Loading...</div>
          <p style={{ color: "var(--text-muted)" }}>Loading paper...</p>
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 16, fontWeight: "bold" }}>Error</div>
          <p style={{ color: "#ef4444", marginBottom: 16 }}>{error ?? "Paper not found"}</p>
          <Link href="/dashboard" className="btn-primary">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const isProcessing = paper.status === "pending" || paper.status === "processing";
  const concepts: Concept[] = (analyses?.concepts as Concept[] | undefined) ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,8,18,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            <span>←</span> Dashboard
          </Link>
          <span style={{ color: "var(--border)" }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: "bold" }}>PDF</span>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {paper.title ?? paper.filename}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {paper.page_count > 0 && (
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              {paper.page_count} pages
            </span>
          )}
          <span style={{ fontSize: "0.8rem", color: paper.status === "ready" ? "#22c55e" : paper.status === "error" ? "#ef4444" : "#06b6d4" }}>
            <StatusDot status={paper.status} />
            {paper.status.charAt(0).toUpperCase() + paper.status.slice(1)}
          </span>
          {/* Delete button — always available, including during processing */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost"
            style={{
              color: "#ef4444",
              fontSize: "0.8rem",
              padding: "6px 12px",
              border: "1px solid transparent",
              borderRadius: 6,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef444444"; e.currentTarget.style.background = "rgba(239,68,68,0.07)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
          >
            {deleting ? "Deleting…" : confirmDelete ? "Sure?" : "Delete"}
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px" }}>
        {/* ── Processing banner ────────────────────────────────────────────── */}
        {isProcessing && (
          <div style={{
            padding: "16px 24px", marginBottom: 24,
            background: "rgba(6,182,212,0.08)",
            border: "1px solid rgba(6,182,212,0.3)",
            borderRadius: "var(--radius-sm)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: "bold" }} className="animate-spin-slow">Processing</div>
              <div>
                <span style={{ fontWeight: 700, color: "#06b6d4" }}>Processing paper…</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginLeft: 10 }}>
                  Extracting text, generating embeddings, and running AI analysis. This may take 1–3 minutes.
                </span>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: "0.8rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {deleting ? "Deleting…" : confirmDelete ? "Sure?" : "Cancel & Delete"}
            </button>
          </div>
        )}

        {paper.status === "error" && (
          <div style={{
            padding: "16px 24px", marginBottom: 24,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
          }}>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>Processing failed: </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>{paper.error_message}</span>
          </div>
        )}

        {/* ── Paper meta ───────────────────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: "20px 28px", marginBottom: 28, display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div style={{
            width: 48, height: 56, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(6,182,212,0.2) 100%)",
            border: "1px solid var(--border-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: "bold", flexShrink: 0,
          }}>PDF</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 6, lineHeight: 1.3 }}>
              {paper.title ?? paper.filename}
            </h1>
            {paper.authors && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 4 }}>
                {paper.authors}
              </p>
            )}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {paper.page_count > 0 && (
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{paper.page_count} pages</span>
              )}
              {paper.sections && paper.sections.length > 0 && (
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {paper.sections.length} sections detected
                </span>
              )}
              {analyses && (
                <span style={{ fontSize: "0.78rem", color: "#22c55e" }}>Analysis complete</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="tab-bar" style={{ marginBottom: 28, overflowX: "auto", flexWrap: "nowrap" }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-item ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              disabled={tab.key === "chat" && paper.status !== "ready"}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {activeTab === "summary" && (
            <SummaryPanel analyses={analyses} loading={loadingAnalysis} />
          )}
          {activeTab === "chat" && paper.status === "ready" && (
            <ChatInterface paperId={paperId} />
          )}
          {activeTab === "chat" && paper.status !== "ready" && (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>Chat</div>
              <p>Chat will be available once the paper finishes processing.</p>
            </div>
          )}
          {activeTab === "gaps" && (
            <GapAnalysis gapsJson={analyses?.gaps} loading={loadingAnalysis} />
          )}
          {activeTab === "compare" && (
            <CompareModal papers={allPapers} currentPaperId={paperId} />
          )}
          {activeTab === "conceptmap" && (
            <ConceptMap concepts={concepts} loading={loadingAnalysis} />
          )}
        </div>
      </main>
    </div>
  );
}
