"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { chatApi, type ChatMessage, type Citation } from "@/lib/api";

// ─── Citation Card ────────────────────────────────────────────────────────────
function CitationCard({ citation }: { citation: Citation }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(!open)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        background: open ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.03)",
        border: "1px solid var(--border-accent)",
        borderRadius: 8, padding: "8px 12px",
        cursor: "pointer", transition: "all 0.2s ease",
        marginBottom: 4,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--accent-violet-light)", textTransform: "uppercase" }}>
            Page {citation.page_number}
          </span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Para {citation.paragraph_number}
          </span>
          {citation.section_type && (
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 6px", borderRadius: 4, textTransform: "capitalize" }}>
              {citation.section_type.replace("_", " ")}
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <p style={{
          marginTop: 8, fontSize: "0.8rem", color: "var(--text-secondary)",
          lineHeight: 1.6, fontStyle: "italic",
          borderTop: "1px solid var(--border)", paddingTop: 8,
          fontFamily: "'Fira Code', monospace",
        }}>
          &quot;{citation.snippet}&quot;
        </p>
      )}
    </button>
  );
}



// ─── Message ──────────────────────────────────────────────────────────────────
function Message({ msg }: { msg: ChatMessage & { streaming?: boolean } }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      gap: 8,
      animation: "fadeUp 0.3s ease",
    }}>
      <div className={isUser ? "chat-bubble-user" : "chat-bubble-assistant"}>
        {msg.content}
        {msg.streaming && <span style={{ opacity: 0.6 }}>▌</span>}
      </div>
      {!isUser && msg.citations && msg.citations.length > 0 && (
        <div style={{ maxWidth: "85%", width: "100%" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Sources from paper
          </p>
          {msg.citations.map((c, i) => (
            <CitationCard key={i} citation={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat Interface ───────────────────────────────────────────────────────────
export default function ChatInterface({ paperId, model = "qwen3:8b" }: { paperId: string; model?: string }) {
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load history
  useEffect(() => {
    chatApi.history(paperId).then((hist) => {
      setMessages(hist);
      setLoadingHistory(false);
    }).catch(() => setLoadingHistory(false));
  }, [paperId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      paper_id: paperId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    // Streaming via SSE
    const streamMsgId = `stream-${Date.now()}`;
    const streamMsg: ChatMessage & { streaming: boolean } = {
      id: streamMsgId,
      paper_id: paperId,
      role: "assistant",
      content: "",
      citations: [],
      created_at: new Date().toISOString(),
      streaming: true,
    };
    setMessages((prev) => [...prev, streamMsg]);

    try {
      const evtSource = new EventSource(
        `${chatApi.streamUrl(paperId)}?message=${encodeURIComponent(text)}&model=${model}`
      );

      // Fallback: use POST for non-GET-able SSE
      // Since SSE requires GET but we need POST, use fetch with ReadableStream
      evtSource.close();

      const resp = await fetch(chatApi.streamUrl(paperId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, model }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let citations: Citation[] = [];
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: citations")) continue;
          if (line.startsWith("event: token")) continue;
          if (line.startsWith("event: done")) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamMsgId ? { ...m, streaming: false, citations } : m
              )
            );
            continue;
          }
          if (line.startsWith("data: ")) {
            const raw = line.slice(6);
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                citations = parsed as Citation[];
              } else if (typeof parsed === "string") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamMsgId
                      ? { ...m, content: m.content + parsed }
                      : m
                  )
                );
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      // Fallback to blocking chat
      try {
        const resp = await chatApi.send(paperId, text, model);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? { ...resp.message, citations: resp.citations, streaming: false }
              : m
          )
        );
      } catch (e2: unknown) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId
              ? { ...m, content: `Error: ${e2 instanceof Error ? e2.message : "Unknown error"}`, streaming: false }
              : m
          )
        );
      }
    } finally {
      setSending(false);
    }
  }, [input, paperId, model, sending]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    if (!confirm("Clear chat history?")) return;
    await chatApi.clearHistory(paperId).catch(() => null);
    setMessages([]);
  };

  const SUGGESTIONS = [
    "What is the main contribution of this paper?",
    "Explain the methodology used.",
    "What datasets were used in the experiments?",
    "What are the key limitations?",
    "What future work do the authors suggest?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: 500 }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        borderRadius: "var(--radius) var(--radius) 0 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: "bold" }}>Chat</span>
          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>AI Research Assistant</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 8px", borderRadius: 99 }}>
            RAG · {model}
          </span>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="btn-ghost" style={{ fontSize: "0.8rem" }}>
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "20px",
        display: "flex", flexDirection: "column", gap: 16,
        background: "var(--bg-primary)",
      }}>
        {loadingHistory ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", paddingTop: 40 }}>Loading history…</div>
        ) : messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20, paddingTop: 20 }}>
            <div style={{ fontSize: 32, fontWeight: "bold" }}>AI Assistant</div>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Ask anything about this paper</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 20 }}>
                Every answer is backed by citations from the paper
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 560 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  style={{
                    padding: "8px 14px", fontSize: "0.8rem", borderRadius: 8,
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-violet)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <Message key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        borderRadius: "0 0 var(--radius) var(--radius)",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about the paper… (Enter to send)"
            className="input-field"
            style={{ flex: 1, minHeight: 44, maxHeight: 120, resize: "none" }}
            disabled={sending}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="btn-primary"
            style={{ padding: "11px 20px", opacity: (!input.trim() || sending) ? 0.5 : 1 }}
          >
            {sending ? "..." : "↑"}
          </button>
        </div>
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
          Answers are grounded in the paper · No hallucinations · All citations shown
        </p>
      </div>
    </div>
  );
}
