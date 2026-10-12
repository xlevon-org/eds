"""FastAPI entrypoint for the up generation worker.

Routes:
  GET  /health                liveness + config summary (open; internal only)
  GET  /provider/status       per-capability connection checks (requires worker key)
  POST /jobs                  enqueue a generation job -> {jobId} (requires worker key)
  GET  /jobs                  list jobs
  GET  /jobs/{job_id}         job status/stages/result
  POST /generate              run a generation synchronously (tests/debug)
  POST /render/html           render a template doc dict to HTML (preview/export)
  POST /render/pdf            render a template doc dict to PDF
  POST /fit                   measure content fit (DOM preflight and/or PDF verification)
  POST /kb/extract            extract text from materials (PDF/image/link text)
  GET  /artifacts/{name}      serve a generated artifact
"""

from __future__ import annotations

import tempfile
import uuid
from pathlib import Path

from fastapi import Body, Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from . import __version__, jobs
from .config import capability_provider, is_configured, settings
from .pipeline import stages
from .pipeline.errors import WorkerError
from .providers import CAPABILITIES, capability_status, check_connection, status_for
from .render import fit as fit_engine
from .render.html_renderer import render_html
from .render.pdf_renderer import render_pdf

settings.artifacts_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="up generation worker", version=__version__)


def require_worker_key(x_worker_key: str | None = Header(default=None)) -> None:
    if not settings.worker_api_key:
        raise HTTPException(status_code=503, detail="Worker API key is not configured (set WORKER_API_KEY).")
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
            "capabilities": {cap: capability_provider(cap) or None for cap in CAPABILITIES},
            "artifactsDir": str(settings.artifacts_dir),
        },
    }


@app.get("/provider/status", dependencies=[Depends(require_worker_key)])
def provider_status() -> dict:
    text = check_connection().to_dict()
    return {"success": True, "data": {"text": text, "capabilities": capability_status()}}


@app.get("/provider/status/{capability}", dependencies=[Depends(require_worker_key)])
def provider_status_one(capability: str) -> dict:
    if capability not in CAPABILITIES:
        raise HTTPException(status_code=404, detail=f"Unknown capability '{capability}'.")
    return {"success": True, "data": status_for(capability).to_dict()}


@app.post("/jobs", dependencies=[Depends(require_worker_key)])
def create_job(payload: dict = Body(...)) -> dict:
    request = payload.get("request") or payload
    if not isinstance(request, dict) or not request.get("template"):
        raise HTTPException(status_code=422, detail="Body must include a 'request.template'.")
    job = jobs.start_job(request)
    return {"success": True, "data": {"jobId": job["id"], "status": job["status"]}}


@app.get("/jobs", dependencies=[Depends(require_worker_key)])
def list_jobs() -> dict:
    return {"success": True, "data": jobs.list_jobs()}


@app.get("/jobs/{job_id}", dependencies=[Depends(require_worker_key)])
def get_job(job_id: str) -> dict:
    job = jobs.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return {"success": True, "data": job}


@app.post("/generate", dependencies=[Depends(require_worker_key)])
def generate_sync(payload: dict = Body(...)) -> dict:
    request = payload.get("request") or payload
    if not isinstance(request, dict) or not request.get("template"):
        raise HTTPException(status_code=422, detail="Body must include a 'request.template'.")
    job = jobs.create_job(request)
    jobs.run_job(job["id"], request)
    return {"success": True, "data": jobs.get_job(job["id"])}


@app.post("/render/html", dependencies=[Depends(require_worker_key)])
def render_html_route(payload: dict = Body(...)) -> dict:
    doc = payload.get("template") or payload.get("doc")
    variant = payload.get("variant", "STUDENT")
    tighten = int(payload.get("tighten") or 0)
    try:
        html = render_html(doc, variant, tighten=tighten)
    except WorkerError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    data: dict = {"html": html, "tighten": tighten}
    # Fit is on by default so previews and exports are always measured; callers
    # that only want the markup can pass {"fit": false}.
    if payload.get("fit", True):
        geometry = (doc or {}).get("geometry", {}) if isinstance(doc, dict) else {}
        data["fit"] = fit_engine.preflight_html(html, geometry).to_dict()
    return {"success": True, "data": data}


@app.post("/fit", dependencies=[Depends(require_worker_key)])
def fit_check(payload: dict = Body(...)) -> dict:
    """Measure content fit without producing an artifact the caller must store.

    ``scope`` is one of ``html`` (DOM preflight), ``pdf`` (render + verify) or
    ``both``. Returns ``{fit: {html?: report, pdf?: report}}``.
    """
    doc = payload.get("template") or payload.get("doc")
    variant = payload.get("variant", "STUDENT")
    scope = str(payload.get("scope") or "html").lower()
    geometry = (doc or {}).get("geometry", {}) if isinstance(doc, dict) else {}
    if scope not in ("html", "pdf", "both"):
        raise HTTPException(status_code=422, detail="scope must be one of html|pdf|both.")
    try:
        html = payload.get("html") or render_html(doc, variant)
    except WorkerError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error

    result: dict = {}
    if scope in ("html", "both"):
        result["html"] = fit_engine.preflight_html(html, geometry).to_dict()
    if scope in ("pdf", "both"):
        out = Path(tempfile.gettempdir()) / f"up-fit-{uuid.uuid4().hex}.pdf"
        rendered = render_pdf(html, str(out), geometry)
        if rendered.available:
            result["pdf"] = fit_engine.verify_pdf(str(out), geometry).to_dict()
        else:
            result["pdf"] = {
                "scope": "pdf", "engine": "none", "checked": False, "ok": False,
                "reason": rendered.reason, "issues": [], "counts": {"error": 0, "warning": 0},
            }
        try:
            out.unlink(missing_ok=True)
        except OSError:
            pass
    return {"success": True, "data": {"fit": result}}


@app.post("/render/pdf", dependencies=[Depends(require_worker_key)])
def render_pdf_route(payload: dict = Body(...)):
    doc = payload.get("template") or payload.get("doc")
    variant = payload.get("variant", "STUDENT")
    try:
        html = payload.get("html") or render_html(doc, variant)
    except WorkerError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    geometry = (doc or {}).get("geometry", {}) if isinstance(doc, dict) else {}
    out = Path(tempfile.gettempdir()) / f"up-render-{uuid.uuid4().hex}.pdf"
    result = render_pdf(html, str(out), geometry)
    if not result.available:
        return JSONResponse(status_code=503, content={"success": False, "message": result.reason})
    return FileResponse(str(out), media_type="application/pdf", filename="document.pdf")


@app.post("/kb/extract", dependencies=[Depends(require_worker_key)])
def kb_extract(payload: dict = Body(...)) -> dict:
    try:
        text = stages.extract_materials_text(payload.get("materials", []))
    except WorkerError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error
    return {"success": True, "data": {"text": text, "charCount": len(text)}}


@app.get("/artifacts/{name}", dependencies=[Depends(require_worker_key)])
def get_artifact(name: str):
    path = jobs.artifact_path(name)
    if not path:
        raise HTTPException(status_code=404, detail=f"Artifact '{name}' not found.")
    media = "application/pdf" if path.suffix == ".pdf" else "text/html"
    return FileResponse(str(path), media_type=media)


@app.exception_handler(WorkerError)
async def worker_error_handler(_request, error: WorkerError):
    return JSONResponse(status_code=error.status_code, content={"success": False, "message": error.message})


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return "<h1>up worker</h1><p>Internal API. See /health.</p>"
