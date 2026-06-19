# Papter

Papter is an AI-powered research paper analysis tool. Upload any PDF research paper and get structured summaries, citation-backed answers, research gap detection, interactive concept maps, and side-by-side paper comparisons — all running locally.

---

## Features

| Feature | Description |
|---|---|
| **AI Summary** | Comprehensive overview, key findings, methodology, results, limitations, and future work |
| **Citation-Backed Chat** | Ask questions about the paper — every answer references exact page and paragraph |
| **Research Gap Analysis** | Automatically identifies limitations and open problems from the paper |
| **Concept Map** | Interactive knowledge graph of methods, datasets, metrics, and models |
| **Paper Comparison** | Upload multiple papers and generate a structured comparison report |

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — API framework
- [SQLAlchemy](https://www.sqlalchemy.org/) + [SQLite](https://www.sqlite.org/) — relational data storage
- [ChromaDB](https://www.trychroma.com/) — vector database for semantic search
- [Ollama](https://ollama.com/) — local LLM inference
- [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) — sentence embeddings
- [PyMuPDF](https://pymupdf.readthedocs.io/) + [pdfplumber](https://github.com/jsvine/pdfplumber) — PDF extraction

**Frontend**
- [Next.js 14](https://nextjs.org/) — React framework
- [React Flow](https://reactflow.dev/) — interactive concept map
- Vanilla CSS with a dark-mode design system

---

## Prerequisites

Before running Papter, install the following:

1. **Python 3.10+** — [python.org](https://www.python.org/downloads/)
2. **Node.js 18+** — [nodejs.org](https://nodejs.org/)
3. **Ollama** — [ollama.com](https://ollama.com/download)

After installing Ollama, pull the required model:

```bash
ollama pull qwen3:8b
```

> Any Ollama-compatible model can be used. `qwen3:8b` is the recommended default for a good balance of speed and quality.

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/papter.git
cd papter
```

### 2. Backend setup

```bash
cd backend

# Create a virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env if you need to change any defaults (see Configuration section below)
```

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local if your backend runs on a different port
```

---

## Running the Application

Open two terminals and start both servers simultaneously.

**Terminal 1 — Backend:**

```bash
cd papter

# Activate virtual environment (if not already active)
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS / Linux

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd papter/frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The backend API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## Configuration

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./papter.db` | Database connection string |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded PDF files |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `DEFAULT_LLM_MODEL` | `qwen3:8b` | Ollama model for analysis and chat |
| `OLLAMA_TIMEOUT` | `120` | Request timeout in seconds |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | ChromaDB storage directory |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |

---

## Project Structure

```
papter/
├── backend/
│   ├── db/                  # Database models and session management
│   ├── models/              # Pydantic schemas
│   ├── routers/             # API route handlers
│   │   ├── papers.py        # Upload, list, get, delete papers
│   │   ├── analysis.py      # Retrieve AI analysis results
│   │   ├── chat.py          # Citation-backed chat (streaming)
│   │   └── compare.py       # Multi-paper comparison
│   ├── services/            # Core business logic
│   │   ├── summarizer.py    # Ollama-based analysis generation
│   │   ├── embeddings.py    # BGE embedding model
│   │   ├── vector_store.py  # ChromaDB operations
│   │   ├── rag.py           # Retrieval-augmented generation
│   │   └── llm.py           # Ollama client utilities
│   ├── pdf_processor.py     # PDF text and metadata extraction
│   ├── main.py              # FastAPI app entry point
│   └── requirements.txt
│
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx         # Landing page
│   │   ├── dashboard/       # Paper management dashboard
│   │   └── paper/[id]/      # Paper analysis view
│   ├── components/          # Reusable UI components
│   │   ├── SummaryPanel.tsx
│   │   ├── ChatInterface.tsx
│   │   ├── ConceptMap.tsx
│   │   ├── GapAnalysis.tsx
│   │   └── CompareModal.tsx
│   └── lib/
│       └── api.ts           # Typed API client
│
├── uploads/                 # Uploaded PDFs (git-ignored)
├── chroma_data/             # Vector database (git-ignored)
├── papter.db                # SQLite database (git-ignored)
└── .gitignore
```

---

## How It Works

1. **Upload** — A PDF is uploaded and saved to disk. A background task begins immediately.
2. **Extract** — PyMuPDF and pdfplumber extract full text, sections, and metadata from the PDF.
3. **Chunk & Embed** — Text is split into paragraphs and embedded using the BGE model.
4. **Store** — Embeddings are stored in ChromaDB; metadata goes into SQLite.
5. **Analyse** — Ollama runs the LLM to generate summaries, gap analysis, and concept extraction.
6. **Ready** — The paper status changes to `ready`. All analysis features become available.

---

## Deleting Papers

Papers can be deleted at any time — including while they are still being processed. The backend safely cancels the background ingestion task before cleaning up the database record, PDF file, and ChromaDB vectors.

---

## Notes

- The embedding model (`BAAI/bge-small-en-v1.5`) is downloaded automatically from Hugging Face on first run. This requires an internet connection and approximately 130 MB of disk space.
- The Ollama model (`qwen3:8b`) must be pulled manually before first use (see Prerequisites above).
- All analysis runs locally — no data leaves your machine.
