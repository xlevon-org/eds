"""FastAPI entrypoint for the up generation worker.

Routes:
  GET  /health           liveness + config summary (open; internal only)
  GET  /provider/status  configured-provider connection check (requires worker key)
  POST /jobs             enqueue a generation job  (stub: 501)
  GET  /jobs/{job_id}     job status                (stub: 501)
"""

from fastapi import Depends, FastAPI, Header, HTTPException

from . import __version__
from .config import is_configured, settings
from .pipeline.errors import WorkerError
from .providers import check_connection

app = FastAPI(title="up generation worker", version=__version__)


def require_worker_key(x_worker_key: str | None = Header(default=None)) -> None:
    if not settings.worker_api_key:
        raise HTTPException(
            status_code=503,
            detail="Worker API key is not configured (set WORKER_API_KEY).",
        )
    if x_worker_key != settings.worker_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing worker API key.")


@app.get("/health")
def health() -> dict:
    return {
        "success": True,
        "data": {
            "status": "ok",
            "service": "up-worker",
            "version": __version__,
            "providerConfigured": is_configured(),
        },
    }


@app.get("/provider/status", dependencies=[Depends(require_worker_key)])
def provider_status() -> dict:
    return {"success": True, "data": check_connection().to_dict()}


@app.post("/jobs", dependencies=[Depends(require_worker_key)])
def create_job() -> dict:
    raise HTTPException(
        status_code=501, detail="Generation jobs are not implemented yet."
    )


@app.get("/jobs/{job_id}", dependencies=[Depends(require_worker_key)])
def get_job(job_id: str) -> dict:
    raise HTTPException(
        status_code=501, detail=f"Job '{job_id}' lookup is not implemented yet."
    )


@app.exception_handler(WorkerError)
async def worker_error_handler(_request, error: WorkerError) -> "JSONResponse":  # noqa: F821
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=error.status_code,
        content={"success": False, "message": error.message},
    )
