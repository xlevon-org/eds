# CLAUDE.md

Single source of truth for working in this repository. Behavioral rules live in `.claude/CLAUDE.md`.
Skills live in `.claude/skills/` (`backend-dev`, `frontend-dev`, `qa-dev`).

`up` is an AI handbook/tute generation studio. An instructor uploads materials and the system
generates **student** and **instructor** handbooks in two formats: interactive **HTML** and print
**PDF**. Templates define the handbook's structure and styling. The app is in development and not in
use: breaking changes are fine, no backward compatibility required.

> Working name `up`; final brand name not fixed.

## Projects

No root workspaces. Three independent projects plus a shared sample-asset folder. Root `package.json`
only holds convenience scripts.

```
frontend/        React 19 + Vite 8 + TypeScript + Tailwind v4 SPA (JavaScript/TS), port 3000
backend/         Node 24 (ESM) + Express 5 + Mongoose 8 API + orchestration, port 5000
python-worker/   Python 3.14 + FastAPI agentic generation + HTML/PDF rendering, port 8000
assests/         Reference output samples (student/instructor HTML + PDF)
```

## Commands

| Where | Command | Notes |
|---|---|---|
| frontend | `npm install` | `bun.lock` is also present but npm is authoritative here. |
| frontend | `npm run dev` | Vite dev server on port 3000. |
| frontend | `npm run build` | `vite build` -> `dist/`. |
| frontend | `npm run lint` | This is `tsc --noEmit` (type check); there is no ESLint config. |
| backend | `npm run dev` | `node --watch src/server.js`. |
| backend | `npm run start` | `node src/server.js`. |
| backend | `npm run lint` | `node --check` on `src/`. |
| python-worker | `python -m venv .venv` then `pip install -r requirements.txt` | Use the venv interpreter for all worker commands. |
| python-worker | `uvicorn app.main:app --reload --port 8000 --app-dir python-worker` | From repo root. |

## Environment

Secrets live only in untracked `.env*` files. Tracked templates: `backend/.env.example`,
`python-worker/.env.example`, `frontend/.env.example`.

- backend: `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES`, `CORS_ALLOWED_ORIGINS`,
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`,
  `MAX_UPLOAD_MB`, `WORKER_BASE_URL`, `WORKER_API_KEY`, `PUBLIC_BASE_URL`.
- python-worker: `WORKER_PORT`, `WORKER_API_KEY`, `BACKEND_BASE_URL`, `MONGODB_URI`, `AI_PROVIDER`,
  provider keys (`GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), `ARTIFACTS_DIR`,
  `CLOUDINARY_*`, `WEASYPRINT_*`.
- frontend: the app currently reads **no** runtime env vars (verified: no `import.meta.env` /
  `VITE_*` usage in `src/`). `frontend/.env.example` documents AI Studio runtime-injected vars
  (`GEMINI_API_KEY`, `APP_URL`). `VITE_APP_BASE_URL` is **reserved** for when backend wiring lands.

There is **no default AI provider**. `AI_PROVIDER` plus its key must be set, and the worker exposes a
provider connection check; generation is refused while the provider is unconfigured or unreachable.

## Backend architecture (Express 5, ESM)

`src/server.js` boots: `loadEnv()` -> `connectDB()` (non-fatal in development so `/health` still
serves) -> `cloudinaryConnect()` -> `createApp().listen()`; SIGINT/SIGTERM close the server.

`src/app.js` `createApp()` (no side effects, importable by tests): helmet -> cors (allow-list) ->
`express.json` -> cookie-parser -> health route -> API routes -> 404 -> `errorHandler`.

Layout: `src/{config,routes,controllers,models,middleware,services,utils}`.
Response shape `{ success, message?, data? }`.

Responsibilities: auth, projects, material upload (to Cloudinary), template registry, generation job
enqueue + status, artifact serving. The Express layer does **not** do AI or rendering.

## Python worker architecture (FastAPI)

`app/main.py` exposes `/health`, `/provider/status`, and job endpoints. The pipeline is a sequence of
stages (intake -> material inspection -> content plan -> template fill -> HTML render -> PDF render),
each stage emitting progress events that the backend relays to the frontend over SSE/WebSocket.

- HTML: Jinja2 templates. PDF: **WeasyPrint** (the sample assets were produced by `WeasyPrint 70.0`;
  verified from PDF `/Producer` metadata), so no JavaScript runs at PDF time.
- Student vs instructor variants are separate template branches (the instructor copy adds a
  teacher answer key).

## Frontend architecture (kept as-is)

`src/{domain,application,infrastructure,presentation,architecture}` — a Clean Architecture
"ScribeHow-style" handbook workspace. Domain: `domain/entities/Handbook.ts`,
`domain/repositories/IHandbookRepository.ts`, `domain/errors/DomainError.ts` (`Result<T>`, `ErrorCode`).
Use cases in `application/use-cases/HandbookUseCases.ts`. Adapters in `infrastructure/`
(`api/HandbookApiClient.ts`, `pdf/JsPdfHandbookExporter.ts`, `persistence/LocalStorageHandbookRepository.ts`,
`templates/CurriculumTemplateGenerator.ts`). DI via `presentation/context/DependencyContext.tsx`.

## Known gaps (verified 2026-10-12; do not assume these work)

- The backend serves `GET /health` and empty stubs (`handbooks`/`folders`), and `jobs` is 501: no
  auth, no persistence, no generation, no upload. The MongoDB connection **works** from this machine
  against the cluster in `backend/.env` (Atlas allow-list permits this IP).
- The python-worker boots; `/health` and `/provider/status` work, `/jobs` is 501, and pipeline
  stages are stubs. PDF rendering (WeasyPrint) is unverified on Windows (needs native Pango/GTK).
- **Port conflicts (other running projects):** `D:\Per\up\backend` (`node server.js`, the old
  ClzMate API) holds **port 5000**, and `D:\Per\te\app\frontend` (Next.js) holds **port 3000**.
  Both are this project's default dev ports. Resolve before running the dev stack side by side.
- The frontend still persists to **localStorage** (`DependencyContext.tsx` default) and exports PDF
  client-side with jsPDF. It is **not** wired to the backend. `RemoteApiHandbookRepository` exists
  but is only used by the verification script. The app reads no runtime env vars.
- The frontend's API client (`HandbookApiClient.ts`) expects legacy paths `GET/PUT/DELETE /api/handbooks`
  and `GET /api/folders`; the backend is versioned under `/api/v1`. The two contracts must be reconciled
  before wiring.
- The frontend domain model is a **click-step recorder** (`xPercent`/`yPercent` screen mockups). The
  reference sample handbooks are richer interactive lesson pages (objectives, glossary, spreadsheets,
  quiz, answer key). This product-model gap is **unresolved** (decision deferred).
- WeasyPrint on Windows needs native Pango/GTK libraries; verify before relying on it.
- Python 3.14 is very new; not all third-party wheels exist. Verify installs, do not assume.
- No CI, no test suite, no Docker.

## Conventions

- Conventional commits `type(scope): description`; scopes: `frontend`, `backend`, `worker`, `config`,
  `docs`. No emojis.
- No comments unless the code cannot say it; descriptive boolean names (`isLoading`, `hasError`).
- Frontend is TypeScript (the old "JavaScript only" rule does **not** apply here).
- Docs that disagree with observed behavior are wrong: trust the observation and fix the doc.

## Security

- Auth: JWT (`Authorization: Bearer`) plus httpOnly cookie, matching the existing frontend 401 flow.
- All input validated before it reaches Mongo; `$`/dotted keys stripped (NoSQL injection).
- Only `.env.example` templates are committed. Rotate any secret that was ever committed.
- Backend and worker authenticate with `WORKER_API_KEY`; the worker is never publicly exposed.
