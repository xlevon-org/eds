# Working Rules — up

Project facts, commands and architecture live in the root `CLAUDE.md`. This file holds only behavioral rules for this repo.

## Communication
- Lead with the conclusion; structured output (lists, tables) over prose; no filler, no flattery, no process narration.
- Acknowledge briefly ("Got it.") only to confirm understanding.
- No emojis in commits, code or docs.

## Method
- State assumptions with evidence before writing code. Do not claim correctness that was not verified by running something (build, lint, import, or a request against a running service).
- Cover failure paths and variations, not only the happy path. After each task state the conditions under which it works.
- Code beats docs. When a doc disagrees with code, trust code and correct the doc in the same change.
- Fix root causes in shared code, then grep sibling callers. Do not patch symptoms.
- Prefer editing existing files and reusing existing helpers; delete only after grepping for importers/references.
- Do not create report or notes files inside the repo; explain in chat.

## Code style
- `frontend/` is **TypeScript** (React 19, Vite 8, Tailwind v4). Use TS types; do not add `.js` components.
- `backend/` is **modern JavaScript, ESM** (`import`/`export`, `"type": "module"`). No TypeScript there.
- `worker/` is typed Python where useful; keep pipeline stages pure and individually testable.
- No comments unless the code cannot express the intent.
- Descriptive names, booleans with auxiliary verbs (`isLoading`, `hasError`).
- Follow existing layer boundaries (frontend: domain / application / infrastructure / presentation; backend: routes / controllers / services / models / middleware).
- Backend responses: `{ success, message?, data? }`. Role failures are 403, session failures 401.
- Never call an AI provider directly from a route handler; go through the worker job pipeline.

## Safety
- Never print, commit or copy values from `.env*` or any credential. Real secrets belong only in gitignored files.
- The worker is internal: it must require `WORKER_API_KEY` and must not be exposed publicly.
- No backward-compatibility shims: the app is not in production.

## Review checklist
- Handles bad input, missing auth, wrong role, non-owner access.
- No hardcoded secrets; inputs validated before reaching Mongo; reject `$`/dotted keys.
- Provider is configured and reachable before generation; refuse otherwise with a clear error.
- Follows project conventions; no dead code left behind.
