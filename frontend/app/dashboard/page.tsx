/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { papersApi, type Paper } from "@/lib/api";

function StatusBadge({ status }: { status: Paper["status"] }) {
  const map = {
    pending:    { cls: "badge-pending",    label: "Pending" },
    processing: { cls: "badge-processing", label: "Processing" },
    ready:      { cls: "badge-ready",      label: "Ready" },
    error:      { cls: "badge-error",      label: "Error" },
  };
  const { cls, label } = map[status] ?? map.error;
  return <span className={`badge ${cls}`}>{label}</span>;
}

function PaperCard({
  paper,
  onOptimisticDelete,
  onRestore,
}: {
  paper: Paper;
  onOptimisticDelete: (id: string) => void;
  onRestore: (paper: Paper) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }

    // Optimistic: remove from UI immediately for snappy feel
    onOptimisticDelete(paper.id);

    try {
      await papersApi.delete(paper.id);
      // Success — card is already gone from the list
    } catch (err: unknown) {
      console.error("Delete failed:", err);
      // Restore on failure
      onRestore(paper);
      alert("Failed to delete: " + (err instanceof Error ? err.message : String(err)));
    }
    setDeleting(false);
  };

  const date = new Date(paper.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const isProcessing = paper.status === "pending" || paper.status === "processing";

  return (
    <div
      className="glass-card"
      style={{
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: deleting ? 0.5 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontWeight: 700,
            fontSize: "0.95rem",
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>
            {paper.title ?? paper.filename}
          </h3>
          {paper.authors && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: 2 }}>
              {paper.authors}
            </p>
          )}
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
            {paper.page_count > 0 ? `${paper.page_count} pages · ` : ""}{date}
          </p>
        </div>
        <StatusBadge status={paper.status} />
      </div>

      {paper.status === "error" && paper.error_message && (
        <p style={{ color: "#ef4444", fontSize: "0.78rem", background: "rgba(239,68,68,0.08)", padding: "8px 12px", borderRadius: 6 }}>
          {paper.error_message}
        </p>
      )}

      {isProcessing && (
        <div style={{
          fontSize: "0.75rem",
          color: "#06b6d4",
          background: "rgba(6,182,212,0.06)",
          border: "1px solid rgba(6,182,212,0.2)",
          borderRadius: 6,
          padding: "6px 10px",
        }}>
          AI analysis running… this may take 1–3 minutes
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        {paper.status === "ready" ? (
          <Link
            href={`/paper/${paper.id}`}
            className="btn-primary"
            style={{ flex: 1, justifyContent: "center", padding: "9px 16px", fontSize: "0.85rem" }}
          >
            Open Analysis →
          </Link>
        ) : (
          <button
            className="btn-secondary"
            style={{ flex: 1, justifyContent: "center", opacity: 0.6, cursor: "default" }}
            disabled
          >
            {paper.status === "processing" ? "Processing…" : paper.status === "pending" ? "Pending…" : "Error"}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="btn-ghost"
          style={{
            color: "#ef4444",
            padding: "9px 14px",
            border: "1px solid transparent",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef444444"; e.currentTarget.style.background = "rgba(239,68,68,0.07)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; }}
          title="Delete paper"
        >
          {deleting ? "Deleting…" : confirmDelete ? "Sure?" : "Delete"}
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPapers = useCallback(async () => {
    try {
      const data = await papersApi.list();
      setPapers(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Start polling while any paper is pending/processing
  const startPolling = useCallback(() => {
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(async () => {
      const data = await papersApi.list().catch(() => [] as Paper[]);
      setPapers(data);
      const anyProcessing = data.some((p) => p.status === "pending" || p.status === "processing");
      if (!anyProcessing && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 4000);
  }, []);

  useEffect(() => {
    fetchPapers().then(() => startPolling());
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchPapers, startPolling]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are accepted.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await papersApi.upload(file);
      await fetchPapers();
      startPolling();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [fetchPapers, startPolling]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Optimistic delete: remove from UI immediately, restore on failure
  const handleOptimisticDelete = (id: string) => {
    setPapers((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRestore = (paper: Paper) => {
    setPapers((prev) => {
      // Put the paper back in chronological order (most recent first)
      const exists = prev.find((p) => p.id === paper.id);
      if (exists) return prev;
      return [paper, ...prev].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  };

  const filtered = papers.filter((p) =>
    search === "" ||
    (p.title ?? p.filename).toLowerCase().includes(search.toLowerCase()) ||
    (p.authors ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 40px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,8,18,0.8)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--gradient-accent)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: "bold"
          }}>P</div>
          <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Papter</span>
        </Link>
        <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          {papers.length} paper{papers.length !== 1 ? "s" : ""} uploaded
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 4 }}>Your Papers</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Upload, analyze, and explore research papers
            </p>
          </div>
          <label htmlFor="dash-upload" className="btn-primary" style={{ cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? "Uploading..." : "Upload Paper"}
          </label>
          <input id="dash-upload" type="file" accept=".pdf" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            disabled={uploading} />
        </div>

        {uploadError && (
          <div style={{
            padding: "12px 16px", marginBottom: 24,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8, color: "#ef4444", fontSize: "0.875rem",
          }}>
            {uploadError}
          </div>
        )}

        {/* Drop zone */}
        <label
          htmlFor="dash-drop"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 12, padding: "20px 24px", marginBottom: 32,
            borderRadius: "var(--radius)",
            border: `2px dashed ${dragging ? "var(--accent-cyan)" : "var(--border-accent)"}`,
            background: dragging ? "rgba(6,182,212,0.06)" : "rgba(124,58,237,0.04)",
            cursor: uploading ? "wait" : "pointer",
            transition: "all 0.2s ease",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
          }}
        >
          <span style={{ fontSize: 24, fontWeight: "bold" }}>PDF</span>
          <span>Drag &amp; drop PDF files here to analyze them</span>
        </label>
        <input id="dash-drop" type="file" accept=".pdf" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {/* Search */}
        {papers.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Search papers by title or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ maxWidth: 420 }}
            />
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card" style={{ padding: 24, height: 180 }}>
                <div className="skeleton" style={{ height: 20, marginBottom: 12, width: "70%" }} />
                <div className="skeleton" style={{ height: 14, marginBottom: 8, width: "50%" }} />
                <div className="skeleton" style={{ height: 14, marginBottom: 24, width: "40%" }} />
                <div className="skeleton" style={{ height: 36, width: "100%" }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 16, fontWeight: "bold" }}>PDFs</div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8, color: "var(--text-secondary)" }}>
              {search ? "No papers match your search" : "No papers yet"}
            </h3>
            <p style={{ fontSize: "0.875rem" }}>
              {search ? "Try a different search term." : "Upload your first research paper to get started."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {filtered.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onOptimisticDelete={handleOptimisticDelete}
                onRestore={handleRestore}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
