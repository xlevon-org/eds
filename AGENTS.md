# AGENTS.md

Instructions for AI coding agents working on **up** (AI handbook/tute generation studio).

Single source of truth: `CLAUDE.md` (commands, environment, architecture, known broken areas).
Behavioral rules: `.claude/CLAUDE.md`. Skills: `.claude/skills/` (`backend-dev`, `frontend-dev`, `qa-dev`).

Do not duplicate their content here. When a document contradicts something you observed (build
output, lint, a live HTTP response), trust the observation and fix the document.

Repository shape:

- `backend/` — Express 5 API + orchestration (Node ESM).
- `frontend/` — React 19 + Vite + TypeScript SPA (existing AI Studio app, kept as-is).
- `worker/` — FastAPI agentic generation + HTML/PDF rendering.

Verification gate: there is no automated test suite. Claim "works" only after the touched app builds
(`npm run build` in `frontend/`), `npm run lint` is clean (frontend = `tsc --noEmit`), the backend
answers `GET /health` against a running instance, and the Python worker imports/boots.
