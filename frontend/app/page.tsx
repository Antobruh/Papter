"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { papersApi } from "@/lib/api";

// ─── Feature Cards Data ───────────────────────────────────────────────────────
const FEATURES = [
  {
    title: "AI Summarization",
    desc: "Comprehensive overviews generated instantly from your paper.",
    color: "var(--accent-violet)",
  },
  {
    title: "Citation-Backed Chat",
    desc: "Ask anything about the paper. Every answer is grounded in exact page and paragraph citations.",
    color: "var(--accent-cyan)",
  },
  {
    title: "Research Gap Detector",
    desc: "Automatically surface limitations, missing areas, and future research opportunities.",
    color: "#f472b6",
  },
  {
    title: "Concept Explainer",
    desc: "Technical terms explained with simple language, real-world analogies, and examples.",
    color: "#fbbf24",
  },
  {
    title: "Paper Comparison",
    desc: "Upload multiple papers and generate a structured side-by-side comparison report.",
    color: "#34d399",
  },
  {
    title: "Concept Map",
    desc: "Interactive knowledge graph showing concepts, methods, datasets and their relationships.",
    color: "#fb923c",
  },
];



// ─── Component ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setUploadError("Please upload a PDF file.");
        return;
      }
      setUploading(true);
      setUploadError(null);
      try {
        const paper = await papersApi.upload(file);
        router.push(`/paper/${paper.id}`);
      } catch (e: unknown) {
        setUploadError(e instanceof Error ? e.message : "Upload failed.");
        setUploading(false);
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ background: "var(--gradient-hero)", minHeight: "100vh" }}>
      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 48px",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(10,8,18,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--gradient-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            P
          </div>
          <span style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.02em" }}>
            Papter
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/dashboard" className="nav-link">Dashboard</Link>
          <Link href="/dashboard" className="btn-primary" style={{ padding: "9px 20px", fontSize: "0.85rem" }}>
            Upload Paper →
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "100px 24px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >



        <h1
          className="animate-fade-up"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            maxWidth: 800,
            marginBottom: 24,
            animationDelay: "0.1s",
            opacity: 0,
          }}
        >
          Understand Research{" "}
          <span style={{ color: "var(--accent-cyan-light)" }}>in Minutes.</span>
        </h1>

        <p
          className="animate-fade-up"
          style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)",
            color: "var(--text-secondary)",
            maxWidth: 600,
            lineHeight: 1.7,
            marginBottom: 48,
            animationDelay: "0.2s",
            opacity: 0,
          }}
        >
          Upload any research paper PDF and get AI-powered summaries, citation-backed
          answers, research gap analysis, and interactive concept maps — all seamlessly
          powered by intelligent context-aware analysis.
        </p>



        {/* Drop Zone */}
        <div
          className="animate-fade-up"
          style={{ animationDelay: "0.4s", opacity: 0, width: "100%", maxWidth: 560 }}
        >
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            htmlFor="hero-upload"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              padding: "48px 32px",
              borderRadius: "var(--radius-lg)",
              border: `2px dashed ${dragging ? "var(--accent-cyan)" : "var(--border-accent)"}`,
              background: dragging
                ? "rgba(6,182,212,0.06)"
                : "rgba(124,58,237,0.06)",
              cursor: uploading ? "wait" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: dragging ? "0 0 40px rgba(6,182,212,0.2)" : "var(--shadow-glow)",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700 }} className={uploading ? "animate-spin-slow" : "animate-float"}>
              {uploading ? "O" : "PDF"}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 6 }}>
                {uploading ? "Uploading & Processing..." : "Drop your research paper here"}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                {uploading ? "This may take a moment" : "PDF files only · Drag & drop or click to browse"}
              </div>
            </div>
            {!uploading && (
              <span className="btn-primary">Choose PDF File</span>
            )}
            {uploading && (
              <div style={{
                width: 200,
                height: 4,
                borderRadius: 2,
                background: "var(--border)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  background: "var(--gradient-accent)",
                  animation: "shimmer 1.5s infinite",
                  backgroundSize: "200% 100%",
                }} />
              </div>
            )}
          </label>
          <input
            id="hero-upload"
            type="file"
            accept=".pdf"
            style={{ display: "none" }}
            onChange={onFileInput}
            disabled={uploading}
          />
          {uploadError && (
            <p style={{ color: "#ef4444", textAlign: "center", marginTop: 12, fontSize: "0.875rem" }}>
              {uploadError}
            </p>
          )}
          <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Or{" "}
            <Link href="/dashboard" style={{ color: "var(--accent-violet-light)", textDecoration: "none" }}>
              go to Dashboard
            </Link>{" "}
            to manage your papers
          </p>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <span className="section-label">What Papter Does</span>
          <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginTop: 12, letterSpacing: "-0.02em" }}>
            Everything you need to understand research
          </h2>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card" style={{ padding: 28 }}>
              <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>{f.title}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 48px",
        background: "rgba(255,255,255,0.02)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <span className="section-label">How it Works</span>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, marginTop: 12, marginBottom: 48 }}>
            From PDF to insight in 4 steps
          </h2>
          <div style={{ display: "flex", gap: 0, alignItems: "stretch", flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { step: "01", title: "Upload PDF", desc: "Drop your research paper — PyMuPDF extracts text, metadata, and sections automatically." },
              { step: "02", title: "AI Processes", desc: "Text is chunked, embedded with BGE, stored in ChromaDB, and analyzed by Qwen3 via Ollama." },
              { step: "03", title: "Get Summaries", desc: "Receive executive, beginner, and ELI5 summaries plus key findings and methodology." },
              { step: "04", title: "Explore & Ask", desc: "Chat with citations, explore concept maps, detect gaps, and compare papers." },
            ].map((item, i) => (
              <div key={item.step} style={{ flex: "1 1 200px", padding: "0 24px", position: "relative" }}>
                {i < 3 && (
                  <div style={{
                    position: "absolute", right: 0, top: "30%",
                    color: "var(--text-muted)", fontSize: "1.5rem",
                  }}>→</div>
                )}
                <div style={{
                  fontSize: "3rem", fontWeight: 900,
                  background: "var(--gradient-accent)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  marginBottom: 12,
                }}>
                  {item.step}
                </div>
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>{item.title}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section style={{
        padding: "80px 48px",
        textAlign: "center",
        background: "linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(6,182,212,0.05) 100%)",
        borderTop: "1px solid var(--border)",
      }}>
        <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: 16 }}>
          Ready to understand your first paper?
        </h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
          Upload a PDF and start exploring in seconds.
        </p>
        <Link href="/dashboard" className="btn-primary" style={{ fontSize: "1rem", padding: "14px 36px" }}>
          Get Started →
        </Link>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{
        padding: "32px 48px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        color: "var(--text-muted)",
        fontSize: "0.8rem",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <span>© 2024 Papter</span>
        <span>Built with FastAPI · Next.js</span>
      </footer>
    </div>
  );
}
