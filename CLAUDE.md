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
worker/   Python 3.14 + FastAPI agentic generation + HTML/PDF rendering, port 8000
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
| backend | `npm run lint` | Syntax-checks every file in `src/` (via `scripts/lint.mjs`). |
| worker | `npm run worker:setup` | From repo root. Creates `worker/.venv` and installs `worker/requirements.txt`. Uses cmd-safe Windows venv paths. |
| worker | `npm run worker:dev` | From repo root. uvicorn `--reload --port 8000 --app-dir worker`. |
| worker | `python -m compileall worker/app` | Syntax check; use the venv interpreter (`worker/.venv/Scripts/python`). |

## Environment

Secrets live only in untracked `.env*` files. Tracked templates: `backend/.env.example`,
`worker/.env.example`, `frontend/.env.example`.

- backend: `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES`, `CORS_ALLOWED_ORIGINS`,
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`,
  `MAX_UPLOAD_MB`, `WORKER_BASE_URL`, `WORKER_API_KEY`, `PUBLIC_BASE_URL`.
- worker: `WORKER_PORT`, `WORKER_API_KEY`, `BACKEND_BASE_URL`, `MONGODB_URI`, `AI_PROVIDER`,
  provider keys (`GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), `ARTIFACTS_DIR`,
  `CLOUDINARY_*`, `WEASYPRINT_*`, `PDF_RENDER_ENABLED`, `FIT_STRICT`.
- frontend: the **up Studio** reads `VITE_API_BASE` (defaults to `http://localhost:5000/api/v1`) in
  `infrastructure/api/UpApiClient.ts`. `frontend/.env.example` also documents AI Studio runtime-injected
  vars (`GEMINI_API_KEY`, `APP_URL`). The legacy workspace reads no runtime env vars.

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

`app/main.py` exposes `/health`, `/provider/status`, `/jobs`, `/generate`, `/render/html`,
`/render/pdf`, `/fit`, `/kb/extract`, and `/artifacts/{name}`. The pipeline is 8 stages
(`intake → inspect_materials → retrieve → plan_content → fill_sections → generate_images →
render_html → render_pdf`), each emitting progress events that the backend relays to the frontend
over SSE.

- HTML: Jinja2 (`app/render/templates/document.html.j2`) + token/geometry CSS from
  `html_renderer.build_tokens_css`. PDF: **headless Chromium via Playwright** (primary on Windows),
  **WeasyPrint** fallback, **HTML-only degrade** with a reason. A `.page` div is a screen-only frame;
  pagination is flow-based and the CSS `@page` rule (in `build_tokens_css`) is the single source of
  page size/margins — Chromium honours the CSS margin over the `page.pdf` margin option (measured).
  Page numbers use Chromium `display_header_footer` (Chromium ignores CSS `@page` margin boxes).
- **Page-fit gate** (`app/render/fit.py`): always-on CSS hardening + a **DOM preflight**
  (headless Chromium, every element vs the printable content box) + a **PyMuPDF** post-render
  verification (page size ±0.5 mm, glyphs inside margins, no blank pages). The `render_html` stage
  runs a bounded **auto-fit** loop (escalating `tighten`) until the preflight passes. Reports are
  stored at `document.fidelity.fit = {html, pdf}` and surfaced in the Studio `FitBadge`.
- Student vs instructor variants are separate template branches (the instructor copy adds a
  teacher answer key).

## Frontend architecture

Two surfaces in one SPA, toggled by `presentation/studio/AppMode` (persisted in localStorage key
`up_app_mode`):

1. **up Studio** (`src/presentation/studio/*`) — the backend-wired product: `TemplateBuilderView`
   (geometry/tokens/sections/components + live preview with a fit badge), `GenerateView` (chat
   workspace, side-by-side preview, in-place edit, revisions, fit badges + on-demand fit check),
   `DocumentsView` (list + fit column), `KnowledgeBaseView`, `ProvidersView`, `FitBadge`. Talks to the
   backend via `infrastructure/api/UpApiClient.ts` (`/api/v1`, Bearer token).
2. **Legacy workspace** (`src/{domain,application,infrastructure,presentation,architecture}`) — a Clean
   Architecture "ScribeHow-style" handbook workspace, kept as-is. Domain:
   `domain/entities/Handbook.ts`, `domain/repositories/IHandbookRepository.ts`,
   `domain/errors/DomainError.ts` (`Result<T>`, `ErrorCode`).
   Use cases in `application/use-cases/HandbookUseCases.ts`. Adapters in `infrastructure/`
   (`api/HandbookApiClient.ts`, `pdf/JsPdfHandbookExporter.ts`, `persistence/LocalStorageHandbookRepository.ts`,
   `templates/CurriculumTemplateGenerator.ts`). DI via `presentation/context/DependencyContext.tsx`.
   It persists to localStorage and is **not** wired to the backend (dead-end for product work).

## Known gaps (verified 2026-10-12; do not assume these work)

- The backend is **implemented and wired**: JWT auth, Mongoose models, template CRUD/validate/preview,
  document generation + revisions/rollback/edit-block, jobs (polling + SSE relay), KB (sources/chunks/
  tags/search), providers status, PRD download — all under `/api/v1`. `GET /health` →
  `database:connected`. (See `atomic_system_architecture_prd.md` §24 for the verified list.)
- The worker's 8 pipeline stages are **implemented** (not stubs) and were verified end to end with the
  deterministic `AI_PROVIDER=stub` provider: HTML **and** PDF artifacts, Chromium PDF engine, and the
  page-fit gate. PDF is **not** WeasyPrint on this machine — Chromium is primary (WeasyPrint needs
  native Pango/GTK, which are absent here).
- **Remaining PRD §24.2 gaps:** template publish/archive/sample/schema/export/import; document PUT/DELETE/
  replace-part/regenerate-image; library view; job cancel/retry; worker `/kb/embed`, `/kb/search`,
  `/edit-block`, `/image/generate`; Atlas Vector Search index (retrieval is a keyword proxy); no live
  provider keys (real text/vision/image/embedding providers are implemented but unverified).
- **Port conflicts (other running projects):** `D:\Per\up\backend` (the old ClzMate API) also uses
  **port 5000**; `D:\Per\te` holds **port 3000**; another project holds **5173**. This project's dev
  stack runs on backend **5000**, worker **8000**, and Vite dev on **127.0.0.1:5199** (the legacy shell
  also uses 3000/5173 — see `CORS_ALLOWED_ORIGINS`). Free/choose ports before running several stacks.
- The **legacy** handbook workspace still persists to **localStorage** and exports PDF client-side with
  jsPDF; it is **not** wired to the backend. The new **up Studio** (`presentation/studio/*`) is the
  backend-wired surface. `HandbookApiClient.ts` / `RemoteApiHandbookRepository.ts` are **dead code**
  expecting legacy paths `GET/PUT/DELETE /api/handbooks` and must be retired before wiring.
- The legacy frontend domain model is a **click-step recorder** (`xPercent`/`yPercent` screen mockups);
  the reference sample handbooks are richer interactive lesson pages. The Studio replaces this with the
  componentized template model; the legacy model stays unused (decision deferred).
- WeasyPrint on Windows needs native Pango/GTK libraries; that is why Chromium is the primary PDF
  engine here. Keep WeasyPrint as a fallback only where those libs exist.
- Python 3.14 is very new; not all third-party wheels exist. Verify installs, do not assume.
- No CI, no Docker. There is no committed automated test suite, but the verification gate (frontend
  build + `tsc --noEmit`, backend `npm run lint` over all `src/**`, `/health`, worker boot, plus API
  and headless-UI E2E scripts) must pass for any change.

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
