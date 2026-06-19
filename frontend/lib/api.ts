/**
 * Typed API client for the Papter FastAPI backend.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }
  return JSON.parse(text) as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Paper {
  id: string;
  filename: string;
  title: string | null;
  authors: string | null;
  page_count: number;
  status: "pending" | "processing" | "ready" | "error";
  error_message?: string | null;
  created_at: string;
  sections?: Section[];
}

export interface Section {
  id: string;
  section_type: string;
  heading_text: string | null;
  start_page: number;
  end_page: number;
  order_index: number;
  content: string;
}

export interface AllAnalyses {
  overview?: string;
  bullets?: string;
  methodology?: string;
  results?: string;
  limitations?: string;
  future_work?: string;
  gaps?: string;
  concepts?: Concept[];
}

export interface Concept {
  term: string;
  simple_explanation: string;
  analogy: string;
  category: "method" | "dataset" | "metric" | "theory" | "tool" | "model";
}

export interface Citation {
  page_number: number;
  paragraph_number: number;
  section_type: string | null;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  paper_id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
  created_at: string;
}

export interface ChatResponse {
  message: ChatMessage;
  citations: Citation[];
}

export interface CompareOut {
  report: string;
  papers: Paper[];
}

export interface OllamaStatus {
  available: boolean;
  models: string[];
  error?: string | null;
}

export interface HealthOut {
  status: string;
  ollama: OllamaStatus;
}

// ─── Papers ──────────────────────────────────────────────────────────────────

export const papersApi = {
  upload: async (file: File): Promise<Paper> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/api/papers/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  list: (): Promise<Paper[]> => apiFetch("/api/papers"),

  get: (id: string): Promise<Paper> => apiFetch(`/api/papers/${id}`),

  delete: (id: string): Promise<void> =>
    apiFetch(`/api/papers/${id}`, { method: "DELETE" }),
};

// ─── Analysis ────────────────────────────────────────────────────────────────

export const analysisApi = {
  getAll: (paperId: string): Promise<AllAnalyses> =>
    apiFetch(`/api/papers/${paperId}/analysis`),

  getOne: (paperId: string, type: string): Promise<{ content: string }> =>
    apiFetch(`/api/papers/${paperId}/analysis/${type}`),
};

// ─── Chat ────────────────────────────────────────────────────────────────────

export const chatApi = {
  send: (paperId: string, message: string, model = "qwen3:8b"): Promise<ChatResponse> =>
    apiFetch(`/api/papers/${paperId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, model }),
    }),

  history: (paperId: string): Promise<ChatMessage[]> =>
    apiFetch(`/api/papers/${paperId}/chat/history`),

  clearHistory: (paperId: string): Promise<void> =>
    apiFetch(`/api/papers/${paperId}/chat/history`, { method: "DELETE" }),

  /** Returns an EventSource for streaming responses */
  streamUrl: (paperId: string) => `${BASE_URL}/api/papers/${paperId}/chat/stream`,
};

// ─── Compare ─────────────────────────────────────────────────────────────────

export const compareApi = {
  compare: (paperIds: string[], model = "qwen3:8b"): Promise<CompareOut> =>
    apiFetch("/api/compare", {
      method: "POST",
      body: JSON.stringify({ paper_ids: paperIds, model }),
    }),
};

// ─── System ──────────────────────────────────────────────────────────────────

export const systemApi = {
  health: (): Promise<HealthOut> => apiFetch("/api/health"),
};
