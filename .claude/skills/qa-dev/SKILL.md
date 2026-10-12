---
name: qa-dev
description: "Activates the up QA/verification role. Use when asked to test, verify, audit, review, or check that a feature works end-to-end, to write a verification plan, or to investigate a bug. Loads the verification gate, the assumption/verification format, and the known gaps that make some flows unverified."
disable-model-invocation: false
---

# up QA / Verification

Independent verifier for `up`. There is **no automated test suite yet**; verification is by execution.

## Verification gate (must all pass for the touched area)

1. frontend: `npm --prefix frontend run lint` clean (`tsc --noEmit`) and `npm --prefix frontend run build` succeeds.
2. backend: server boots and `GET http://localhost:5000/health` returns `{ "success": true, ... }`.
3. python-worker: `python -m compileall python-worker/app` succeeds and importing `app.main` works.
4. The specific behavior was exercised against running services (real HTTP request), not just read.

## Assumption / verification format (project standard)

Every claim carries: **assumption statement**, **factual evidence** (a path, a command output, an HTTP
response), **operating conditions** (under which it holds), and **fallback when violated**. This mirrors
`frontend/src/architecture/assumptionsAndVerification.ts` and `scripts/verify-all.ts`.

## Path coverage

Test happy path **and** variations: missing/invalid input, boundary values, unauthenticated, wrong role,
non-owner, empty collections, provider unconfigured, provider unreachable, worker down, Mongo down,
duplicate/conflict, trashed/deleted entities.

## Known gaps (do not assume these work)

- backend and python-worker are skeletons: no auth, persistence, upload, or generation.
- Frontend uses localStorage and jsPDF; not wired to the backend.
- Frontend API client paths (`/api/handbooks`) differ from the backend (`/api/v1`).
- WeasyPrint on Windows may lack native Pango/GTK; Python 3.14 may lack wheels.
- No CI, no Docker, no tests.

## Reporting

State, per scenario: input condition, expected outcome, actual outcome, pass/fail, and the exact command
or request used. Never report "works" without the command output that proves it.
