# RepoLens

RepoLens is a production-oriented portfolio project that combines a deterministic **Codebase Doctor** with a repository-aware **AI Interviewer**.

## What it does

1. Accepts a GitHub repository URL.
2. Safely downloads the GitHub archive and applies file-count, size and path-safety limits.
3. Detects languages, file metrics, imports, top-level architecture and code-quality/security patterns.
4. Uses an optional OpenAI-compatible model to produce deeper repository insights.
5. Creates project-specific technical interview questions.
6. Evaluates answers against the repository evidence.
7. Produces a developer report.

## Stack

- Frontend: Next.js 16, TypeScript, Tailwind CSS 4, React Flow, Lucide
- Backend: FastAPI, SQLAlchemy 2, Pydantic
- Database: PostgreSQL (SQLite is the zero-config local fallback)
- Repository access: GitHub REST API archive endpoint
- AI: OpenAI-compatible Chat Completions API

## Local development

### Option A: Docker Compose

Requires Docker Desktop.

```bash
docker compose up --build
```

Open `http://localhost:3000` and API docs at `http://localhost:8000/docs`.

### Option B: run services directly

Backend:

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env  # Windows
# cp .env.example .env   # macOS/Linux
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
copy .env.example .env.local  # Windows
# cp .env.example .env.local   # macOS/Linux
npm run dev
```

## AI configuration

The app works without an AI key using deterministic fallback summaries/questions/evaluations. For richer results, set:

```env
AI_API_KEY=your_key
AI_MODEL=gpt-4o-mini
```

For another OpenAI-compatible provider, also set `AI_BASE_URL`.

## GitHub access

Public repositories work without a token. A GitHub token can increase API limits and can be used for repositories accessible to that token. Use a fine-grained token with the minimum required repository read permissions.

## Production deployment

### Backend

Deploy `backend/` as a Docker web service. Set:

- `DATABASE_URL` to managed PostgreSQL
- `FRONTEND_URL` to the deployed frontend origin
- `GITHUB_TOKEN` optionally
- `AI_API_KEY` optionally
- `AI_BASE_URL` optionally
- `AI_MODEL`

The container starts FastAPI on port 8000 and exposes `/health`.

### Frontend

Deploy `frontend/` to Vercel or another Node hosting platform. Set:

```env
NEXT_PUBLIC_API_URL=https://your-api.example.com
```

Then run `npm run build` and `npm run start`.

## Important production hardening

This repository intentionally keeps the first release authentication-free so it can be deployed as a portfolio demo. Before turning it into a multi-user SaaS, add:

- authentication and per-user authorization
- rate limiting at the edge/API gateway
- persistent job queue (Redis + worker)
- repository result caching
- secret scanning that does not persist source code unnecessarily
- stricter outbound network controls
- structured logging and error monitoring
- database migrations with Alembic
- private repository OAuth/GitHub App flow instead of collecting personal access tokens

## Tests

```bash
cd backend
pytest
```
