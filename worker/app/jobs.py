"""In-memory job store and runner for the worker.

The Express backend creates a job then relays progress to the browser over SSE by
polling ``GET /jobs/{id}`` here. Jobs are process-local (sufficient for a single
worker instance); a durable queue is a later concern.
"""

from __future__ import annotations

import threading
import traceback
import uuid
from datetime import datetime, timezone

from .config import settings
from .pipeline.errors import WorkerError
from .pipeline.stages import STAGES

_JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_job(request: dict) -> dict:
    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "type": "generate",
        "status": "queued",
        "stage": None,
        "pct": 0,
        "message": "queued",
        "stages": [],
        "result": None,
        "error": None,
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    with _LOCK:
        _JOBS[job_id] = job
    return job


def get_job(job_id: str) -> dict | None:
    return _JOBS.get(job_id)


def list_jobs() -> list[dict]:
    return list(_JOBS.values())


def _update(job_id: str, **fields) -> None:
    with _LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        job.update(fields)
        job["updatedAt"] = _now()


def run_job(job_id: str, request: dict) -> None:
    """Execute the pipeline, updating the job record. Never raises."""
    _update(job_id, status="running", message="starting")
    context: dict = {"jobId": job_id, "request": request, "stages": []}
    try:
        for name, stage in STAGES:
            _update(job_id, stage=name, message=name)
            context = stage(context)
            events = context.get("stages", [])
            if events:
                last = events[-1]
                _update(job_id, stage=last["stage"], pct=last["pct"], message=last["message"],
                        stages=list(events))
        doc = context["doc"]
        _update(
            job_id,
            status="completed",
            pct=100,
            stage="done",
            message="completed",
            stages=list(context.get("stages", [])),
            result={
                "title": doc.get("title") or doc.get("name"),
                "variant": context.get("variant"),
                "sectionCount": len(doc.get("sections", [])),
                "artifacts": context.get("artifacts", {}),
                "pdf": context.get("pdf", {}),
                "fit": context.get("fit", {}),
                "imageReport": context.get("image_report", {}),
                "document": doc,
            },
        )
    except WorkerError as error:
        events = context.get("stages") or []
        _update(job_id, status="failed", stage=(events[-1]["stage"] if events else "intake"),
                message=error.message, error={"message": error.message, "status": error.status_code})
    except Exception as error:  # noqa: BLE001
        _update(job_id, status="failed", message=str(error),
                error={"message": str(error), "trace": traceback.format_exc()[-1500:]})


def start_job(request: dict) -> dict:
    job = create_job(request)
    thread = threading.Thread(target=run_job, args=(job["id"], request), daemon=True)
    thread.start()
    return job


def artifact_path(name: str):
    """Resolve an artifact name safely within the artifacts dir (no traversal)."""
    candidate = (settings.artifacts_dir / name).resolve()
    root = settings.artifacts_dir.resolve()
    if root not in candidate.parents and candidate != root:
        return None
    return candidate if candidate.exists() else None
