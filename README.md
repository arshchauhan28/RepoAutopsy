# RepoAutopsy

**RepoAutopsy** is a production-grade codebase intelligence, architectural diagnostics, and developer assessment platform. It conducts automated forensic autopsies on GitHub repositories to uncover structural patterns, dependency health, design weaknesses, and code quality issues, while evaluating developer comprehension through repository-grounded assessments.

---

## Core Product Capabilities

RepoAutopsy operates across five unified diagnostic modules:

```
Overview  |  Anatomy  |  Diagnostics  |  Case Report  |  CodeVitals
```

1. **Overview**: High-level repository telemetry, primary language distributions, architectural complexity scores, file count metrics, and commit metadata.
2. **Anatomy**:
   - **Interactive Architecture Map**: Top-level subsystem clustering and inter-component communication topology.
   - **File Explorer**: Recursive directory navigator with file-level metrics, line counts, and inline code inspection.
   - **Dependency Explorer**: Module-level dependency graphs, external package analysis, and circular dependency cycle detection.
3. **Diagnostics**: Forensic issue detection categorizing bugs, security vulnerabilities, architectural antipatterns, and maintainability concerns with actionable remediation steps, root-cause grouping, and confidence indicators.
4. **Case Report**: Comprehensive forensic briefing synthesizing architectural strengths, system design breakdowns, key technical priorities, and exportable Markdown documentation.
5. **CodeVitals 2.0**:
   - **Option 1 — Complete Codebase Assessment**: Evaluates comprehensive understanding of the whole repository (10 Quick, 20 Standard, 30 In-depth questions) across Beginner, Intermediate, and Advanced difficulties.
   - **Option 2 — Component Assessment**: Dynamically discovers codebase subsystems (API Routes, Frontend Pages, Data Models, Core Logic) and generates component-scoped assessments.
   - **Option 3 — Team Assessment & Hackathon Readiness**: Multi-member collaborative assessments featuring cryptographic organizer and invite tokens, 1-click WhatsApp sharing, teammate assignments (70% component / 30% shared architecture), component coverage matrices, single point of failure (SPOF) gap detection, and hackathon judge Q&A prep.

---

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, React Flow, Lucide Icons
- **Backend**: FastAPI, Python 3.12, SQLAlchemy 2.0, Pydantic v2
- **Database**: SQLite (zero-config local default with enforced foreign-key pragmas) / PostgreSQL (production-ready)
- **Repository Ingestion**: GitHub REST API with safe in-memory zip archive extraction and traversal guards
- **AI Integration**: OpenAI-compatible Chat Completions API with structured JSON outputs and deterministic fallback engines

---

## Security & Reliability Architecture

RepoAutopsy has been hardened for production deployment:

- **Cryptographic Token Authorization**:
  - `organizer_token` (32-byte secret): Protects team administration, member results, and invitation controls.
  - `invite_token` (16-byte secret): Scoped participant invitation access; revocable at any time by the organizer without deleting assessment records.
  - `session_token` (32-byte secret): Prevents Insecure Direct Object Reference (IDOR) attacks on assessment attempts.
  - Constant-time verification (`secrets.compare_digest`) across all credential endpoints to eliminate timing attacks.
- **Assessment Integrity & Anti-Cheat**:
  - Server-side answer masking: Explanations, rubrics, and correct options are sanitized from API responses for active/unanswered questions.
  - Authoritative backend grading: Client-side score payloads are never trusted.
  - Tamper protection: Turns already evaluated cannot be re-answered or brute-forced.
  - Atomic batch submission (`POST /interviews/{id}/submit`): Evaluates all questions within a single transactional boundary to protect against network drops.
- **AI Safety & Cost Control**:
  - Prompt injection isolation: Candidate answers are isolated in explicit `<developer_response>` boundaries with strict evaluator guardrails.
  - Bounded request timeouts: 15-second timeouts on all LLM calls with automatic fallback to evidence-backed rubrics.
  - Re-use of shared architecture questions to minimize unnecessary LLM tokens.
- **Abuse Prevention & Rate Limiting**:
  - Sliding-window in-memory rate limiting with route-specific tiers (analysis, team creation, submission).
  - Strict regex validation for GitHub owners and repositories to prevent path manipulation.
  - Archive safety: 40MB compressed limit, 120MB decompression ceiling, max 2,500 files, and binary file filtering.

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- npm 10+
- Optional: Docker Desktop

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

FastAPI server runs at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Next.js frontend runs at `http://localhost:3000`.

---

## Configuration & Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./repolens.db` |
| `FRONTEND_URL` | Allowed frontend origin for CORS | `http://localhost:3000` |
| `GITHUB_TOKEN` | Optional GitHub personal access token for higher API limits | `None` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID for user sign-in | `None` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | `None` |
| `GITHUB_APP_ID` | Optional GitHub App ID for repository installation access | `None` |
| `GITHUB_WEBHOOK_SECRET` | Secret key for verifying GitHub webhook signatures (HMAC SHA-256) | `None` |
| `SESSION_SECRET` | Secret string for session HMAC tokens | `insecure-dev-session-secret...` |
| `SESSION_EXPIRE_DAYS` | User session lifetime in days | `14` |
| `AI_API_KEY` | Optional OpenAI or compatible API key | `None` |
| `AI_BASE_URL` | Optional custom base URL for OpenAI-compatible providers | `None` |
| `AI_MODEL` | LLM model identifier | `openai/gpt-oss-20b` |
| `MAX_REPO_SIZE_MB` | Maximum allowed repository archive size | `40` |
| `MAX_FILES` | Maximum repository files processed | `2500` |
| `ENVIRONMENT` | Runtime environment (`development`, `testing`, `production`) | `development` |

### Background Worker Configuration

Run the dedicated background job worker to process automated PR Autopsies asynchronously:
```bash
cd backend
python worker.py
```

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://127.0.0.1:8000` |

---

## Running Automated Tests

### Backend Test Suite
```bash
cd backend
.\.venv\Scripts\python -m pytest tests/ -v
```
*Executes all 35 unit, integration, and security tests covering analyzers, API routes, component discovery, team orchestration, rate limiting, and prompt injection defenses.*

### Frontend Production Build & Type Checking
```bash
cd frontend
npm run build
```
*Validates TypeScript compilation, route bundling, and static optimization.*

---

## Production Deployment

### Backend (Docker / Cloud Run / VPS)
Deploy `backend/` using Docker or standard WSGI/ASGI runner:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```
Ensure `DATABASE_URL` points to managed PostgreSQL, and set `FRONTEND_URL` to your production frontend domain.

### Frontend (Vercel / Node Hosting)
Deploy `frontend/` to Vercel or similar platform. Set `NEXT_PUBLIC_API_URL` to your production API endpoint. Run `npm run build` and `npm start`.

---

## License

MIT License. Designed and maintained for modern engineering teams and hackathon projects.
