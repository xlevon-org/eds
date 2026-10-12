---
name: backend-dev
description: "Activates the up backend developer role. Use when working in backend/ — Express routes, controllers, Mongoose models, auth/JWT middleware, Cloudinary material uploads, generation-job orchestration, artifact serving, or debugging API behavior. Loads verified knowledge of the Express 5 ESM API and its coordination with the Python worker."
disable-model-invocation: false
---

# up Backend Developer

Backend developer for `up`. Verified context for `backend/`. Code is the source of truth; re-read before relying on this.

## Stack

- Node 24, **ESM** (`"type": "module"`), Express 5, Mongoose 8, helmet, cors, cookie-parser,
  `express-rate-limit`, `jsonwebtoken`, `bcryptjs`, `multer` (uploads), `cloudinary`, `dotenv`, `zod`.
- Tests: none yet. Verification = server boots + `GET /health` responds.

## Before writing code, state assumptions

1. Route already exists? (`src/routes/`) Controller? (`src/controllers/`) Service? (`src/services/`)
2. Guard: `auth` plus which role/resource check (project ownership, template ownership)?
3. Upload path (Cloudinary), provider/job path (worker), failure paths (missing fields, bad ObjectId,
   not found, not owner)?
4. Existing helper to reuse? (`utils/validators.js`, `utils/httpError.js`, `services/workerClient.js`)

## Startup and middleware

`src/server.js`: `loadEnv()` -> `connectDB()` -> `cloudinaryConnect()` -> `createApp().listen()`.
`connectDB()` failure is **non-fatal in development** (logs a warning so `/health` still serves) and
fatal in production.

`src/app.js` `createApp()`: helmet -> cors (allow-list from `CORS_ALLOWED_ORIGINS`) -> `express.json`
-> cookie-parser -> `GET /health` -> `/api/v1` routes -> JSON 404 -> `errorHandler`.

## Response contract

`{ success, message?, data? }`. `errorHandler` maps CastError/ValidationError -> 400, hides 5xx detail.
Keep this shape: the frontend relies on it.

## Contracts to honour

- The frontend's `frontend/src/infrastructure/api/HandbookApiClient.ts` expects
  `GET /handbooks`, `PUT /handbooks/:id`, `DELETE /handbooks/:id`, `GET /folders`.
  The backend is versioned under `/api/v1`; reconcile base paths before wiring, and update the client
  (`DependencyContext.tsx`) in the same change.
- Jobs: enqueue returns `202` with a `jobId`; status is read via `GET /jobs/:id` and streamed via SSE
  at `GET /jobs/:id/events`.

## Worker coordination

- `services/workerClient.js` calls the Python worker with `WORKER_API_KEY`; never expose the worker.
- The worker owns AI + rendering. The API owns auth, storage, job records and progress relay.

## Env (`backend/.env.example`)

`PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES`, `CORS_ALLOWED_ORIGINS`,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`,
`MAX_UPLOAD_MB`, `WORKER_BASE_URL`, `WORKER_API_KEY`, `PUBLIC_BASE_URL`. Add any new var to
`.env.example` in the same change.

## Done checklist

1. Route mounted; guard and resource check correct.
2. Inputs validated (zod), `$`/dotted keys stripped, ObjectIds validated, no mass assignment.
3. No secrets or raw `error.message` in 5xx responses or logs.
4. New env var documented in `.env.example`.
5. Server boots; `GET /health` verified against a running instance.
