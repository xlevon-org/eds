# up worker — agentic generation + rendering

FastAPI service that turns instructor materials into **student** and **instructor** handbooks as
interactive **HTML** and print **PDF**. It is internal: the Express backend is the only caller and
every non-health route requires the shared `WORKER_API_KEY`.

Status: **bootable skeleton**. `/health` and `/provider/status` work; pipeline stages are stubs;
`/jobs` returns 501.

## Setup

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

cp .env.example .env    # then set WORKER_API_KEY and an AI provider
```

## Run

```bash
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # from worker/
# or from repo root:
worker/.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000 --app-dir worker
```

## Verify

```bash
curl http://localhost:8000/health
curl -H "X-Worker-Key: <WORKER_API_KEY>" http://localhost:8000/provider/status
```

## PDF rendering (optional)

PDF is produced by **WeasyPrint** (the sample assets under `assests/` were produced by
`WeasyPrint 70.0`). WeasyPrint needs native libraries — Pango/GTK on Windows — so it ships in
`requirements-render.txt`, separate from the core install. Without it, generation still produces
HTML and the PDF stage reports a clear error.

```bash
.venv/Scripts/python -m pip install -r requirements-render.txt   # requires native Pango/GTK
```

## Layout

```
app/main.py             FastAPI routes: /health, /provider/status, /jobs
app/config.py           env settings (no default AI provider)
app/providers.py        provider registry + live connection check
app/pipeline/stages.py  intake -> inspect -> plan -> fill -> render_html -> render_pdf (stubs)
app/pipeline/errors.py  typed worker errors
artifacts/              rendered output (git-ignored)
```

## Notes

- There is **no default AI provider**. Generation is refused until `AI_PROVIDER` and its key are set
  and `/provider/status` reports `reachable: true`.
- The worker is never exposed publicly; the backend authenticates with `X-Worker-Key`.
