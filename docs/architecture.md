# Architecture decisions

Status of the project and the decisions we have agreed on so far (logged 2026-10-12).

## Objective

An instructor uploads source materials (notes, images, links, scanned textbook pages). The system
generates **student** and **instructor** handbooks/tutes in two output formats from a template:

- **Interactive HTML** — a standalone lesson page (the format of the samples in `assests/`).
- **Print PDF** — a pixel-accurate copy of that HTML, rendered server-side with WeasyPrint.

## Repository layout

Three independent projects under one repo (no npm workspaces):

| Path | Stack | Role |
|---|---|---|
| `frontend/` | React 19 + Vite 8 + TypeScript + Tailwind v4 | Existing AI-Studio UI, **kept as-is**. Clean Architecture: `domain` / `application` / `infrastructure` / `presentation`. |
| `backend/` | Node 24 ESM + Express 5 + Mongoose 8 | Public API + orchestration: auth, projects, upload, template registry, job records, SSE progress relay, artifact serving. |
| `python-worker/` | Python 3.14 + FastAPI | Agentic generation + rendering. The **only** place AI and rendering happen. |
| `assests/` | — | Sample generated handbooks (student + instructor HTML/PDF), the output reference. |

## Agreed decisions

1. **Express = API/orchestration; Python = generation.** Route handlers never call an AI provider
   directly; they enqueue a job the worker executes.
2. **Persistence:** MongoDB for metadata/documents; Cloudinary for uploaded and generated media.
3. **Jobs:** background queue with live progress relayed to the frontend over SSE/WebSocket. No
   blocking request/response generation.
4. **AI provider:** there is **no default**. `AI_PROVIDER` + its key must be set, and the worker
   runs a live connection check (`GET /provider/status`) before generation is allowed.
5. **Response envelope (backend):** `{ success, message?, data? }`; errors carry HTTP status and
   optional `details`. 401 session, 403 role.
6. **Versioned API:** `/api/v1/*` with routes `handbooks`, `folders`, `jobs`. (`/health` is
   unversioned for ops.)
7. **Mongo connection is non-fatal in development** so `/health` still serves when the DB or its
   credentials are unavailable; fatal in production.
8. **Worker auth:** the worker is internal. Every non-`/health` route requires `X-Worker-Key`
   matching `WORKER_API_KEY`. The backend authenticates itself with the same header.
9. **PDF stack:** WeasyPrint (samples were produced by `WeasyPrint 70.0`, verified from PDF
   `/Producer` metadata). HTML templates: Jinja2. No JavaScript runs at PDF time. WeasyPrint needs
   native Pango/GTK on Windows, so it is an optional extra (`requirements-render.txt`); without it
   the pipeline degrades to HTML-only with a clear PDF-stage error.
10. **Student vs instructor variants** are separate template branches; the instructor copy adds a
    teacher answer key.

## Generation pipeline (python-worker)

`intake -> inspect_materials -> plan_content -> fill_template -> render_html -> render_pdf`

Each stage is a pure function over a shared `context` dict, individually testable, and emits a
progress event the backend relays to the frontend. The stages are stubs in this skeleton.

## Environment handling

Secrets live only in gitignored `.env*` files; tracked templates are `backend/.env.example`,
`python-worker/.env.example`, `frontend/.env.example`.

- backend vs worker share `WORKER_API_KEY`.
- In development the backend boots with no DB/Cloudinary configured (warns, continues).
- `assertProductionConfig()` fails fast when production is missing required env.

## Observed environment facts (verified, 2026-10-12)

- The backend boots and serves `GET /health`; the MongoDB connection **succeeded** on this machine
  against the cluster in `backend/.env` (Atlas IP allow-list permits it).
- The Python worker boots; `/health`, `/provider/status` (with key) and 501 `/jobs` all behave.
- Frontend lint (`tsc --noEmit`) is clean, and `vite build` succeeds.
- **Port conflicts:** another project's processes were running before this repo existed:
  - `D:\Per\up\backend` (`node server.js`) is listening on **port 5000** — the ClzMate API.
  - `D:\Per\te\app\frontend` (Next.js) is listening on **port 3000** — the `te` project.
  Both ports are the defaults for this project's `up` services; resolve before running the dev
  stack side by side.

## Deferred (not decided)

- **Canonical handbook data model.** The current frontend domain model is a click-step recorder
  (`xPercent`/`yPercent` screen mockups); the sample handbooks are richer interactive lesson pages
  (objectives, glossary, spreadsheets, quiz, answer key). Future direction: a "full guidelines
  template" that combines all design/styles/layout guidance. Not resolved yet.
- **Final brand name.** Working name `up`.
- **Frontend/backend contract reconciliation.** The frontend's `HandbookApiClient` expects legacy
  paths (`GET /api/handbooks`, bare arrays); the backend is `/api/v1` with an envelope. Must be
  reconciled when backend wiring starts.