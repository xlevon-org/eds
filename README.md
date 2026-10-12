# up — Student Handbook & Tute Generation Studio

Instructors upload source materials (notes, images, links, scanned textbook pages), and the system
generates **student** and **instructor** handbooks/tutes as two output formats:

- **Interactive HTML** — a standalone, self-contained lesson page (the format of the sample assets).
- **Print PDF** — a pixel-accurate copy of that HTML, rendered server-side.

Generation is template-driven: a template is a full guideline document (layout + styles + required
sections), and the AI fills it from the uploaded materials.

> Working name: **up**. The final brand name is not yet fixed.

## Repository layout

| Path | Stack | Role |
|---|---|---|
| `frontend/` | React 19, Vite 8, TypeScript, Tailwind v4 | Existing AI-Studio UI ("up Workspace"), kept as-is. Clean Architecture (`src/domain`, `src/application`, `src/infrastructure`, `src/presentation`). |
| `backend/` | Node 24 (ESM), Express 5, Mongoose 8 | Public API, auth, projects, material upload, template registry, job orchestration, artifact serving. |
| `worker/` | Python, FastAPI | Agentic generation: inspect materials -> plan content -> fill template -> render HTML + PDF (student/instructor variants). |
| `assests/` | — | Sample generated handbooks (student + instructor HTML/PDF) used as the output reference. |
| `.claude/`, `.agents/`, `.remember/`, `.impeccable/` | — | Agent instructions and tooling (see `CLAUDE.md`). |

## Architecture

```
frontend (React 19 + TS)  --HTTP-->  backend/ (Express 5 API + orchestration)
                                          |  Mongo (metadata)   Cloudinary (media)
                                          |  enqueue generation job
                                          v
                                    worker/ (FastAPI, agentic pipeline)
                                          |  AI provider (configurable, connection-checked)
                                          v
                                    HTML (Jinja2) --> PDF (WeasyPrint)
```

- **Storage:** MongoDB for metadata/documents, Cloudinary for uploaded/generated media.
- **Jobs:** background queue with live progress over SSE/WebSocket (no blocking requests).
- **AI provider:** no default. A provider must be explicitly configured and its connection verified
  before generation can start.

## Run locally

```bash
# frontend
npm --prefix frontend install
npm --prefix frontend run dev        # http://localhost:3000

# backend (Express 5)
npm --prefix backend install
cp backend/.env.example backend/.env # then fill values
npm --prefix backend run dev         # http://localhost:5000

# python worker
python -m venv worker/.venv
worker/.venv/Scripts/python -m pip install -r worker/requirements.txt
cp worker/.env.example worker/.env
worker/.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000 --app-dir worker
```

Never commit `.env*` files or credentials; only `.env.example` templates are tracked.

## Verification gate

There is **no automated test suite yet**. Claim "works" only after:

1. `npm --prefix frontend run lint` is clean (this is `tsc --noEmit`).
2. `npm --prefix frontend run build` succeeds.
3. The backend boots and answers `GET /health` against a running instance.
4. The Python worker imports/boots and answers `GET /health`.

Details, environment variables, architecture and known gaps: [`CLAUDE.md`](CLAUDE.md).
