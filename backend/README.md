# up backend — Express 5 API + orchestration

Owns auth, projects, material upload (Cloudinary), templates, generation-job records, progress relay
(SSE) and artifact serving. It does **not** do AI or rendering — that is the Python worker.

Status: **bootable skeleton, verified (2026-10-12)**. `GET /health` works (MongoDB connected on this
machine against the cluster named in `backend/.env`); `handbooks`/`folders` are empty stubs; `jobs`
is 501.

> Note: another project (`D:\Per\up\backend`) may be listening on the default port 5000; run with
> `PORT=5055` (or stop it) if you see `EADDRINUSE`.

## Run

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:5000
```

## Verify

```bash
npm run lint
curl http://localhost:5000/health
```

## Layout

```
src/server.js              boot: env -> db -> cloudinary -> listen
src/app.js                 createApp(): helmet, cors, json, cookies, routes, 404, errorHandler
src/config/                env.js, db.js, cloudinary.js
src/routes/                index.js, health.js, handbooks.js, folders.js, jobs.js
src/middleware/            errorHandler.js
src/utils/                 logger.js, httpError.js
src/services/              (reserved for workerClient.js and persistence services)
```

## Notes

- MongoDB connection failure is non-fatal in development so `/health` still serves; fatal in production.
- Response shape is `{ success, message?, data? }`.
- The frontend's `HandbookApiClient` currently expects bare-array responses and legacy `/api/*` paths;
  reconcile before wiring (see root `CLAUDE.md` "Known gaps").
