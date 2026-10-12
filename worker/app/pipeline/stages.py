"""Generation pipeline stages.

Order: intake -> inspect_materials -> retrieve -> plan_content -> fill_sections ->
generate_images -> render_html -> render_pdf.

Each stage is a pure-ish function over a shared ``context`` dict, appends a progress
event, and returns the context. Stages fail loudly with WorkerError subclasses; the
runner records the failing stage and preserves whatever artifacts were produced.
"""

from __future__ import annotations

import base64
import copy
import re
from pathlib import Path
from typing import Callable

from .. import providers
from ..config import settings
from ..render import fit
from ..render.html_renderer import render_html
from ..render.pdf_renderer import render_pdf
from .errors import PdfUnavailable, ValidationError

MAX_CONTEXT_CHARS = 6000


def _emit(context: dict, stage: str, pct: int, message: str) -> None:
    context.setdefault("stages", []).append(
        {"stage": stage, "pct": pct, "message": message}
    )


def _sentences(text: str) -> list[str]:
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text.replace("\n", " "))
    return [p.strip() for p in parts if p.strip()]


def _first(context: dict, n: int = 3) -> str:
    ctx = context.get("context_text", "")
    sents = _sentences(ctx)
    return " ".join(sents[:n]) if sents else ""


def intake(context: dict) -> dict:
    request = context.get("request") or {}
    doc = request.get("template")
    if not isinstance(doc, dict) or not doc.get("sections"):
        raise ValidationError("Request must include a 'template' object with a non-empty 'sections' array.")
    context["doc"] = copy.deepcopy(doc)
    context["variant"] = (request.get("variant") or "STUDENT").upper()
    context["instruction"] = (request.get("instruction") or "").strip()
    _emit(context, "intake", 10, f"Accepted template '{doc.get('title') or doc.get('name') or 'untitled'}'.")
    return context


def inspect_materials(context: dict) -> dict:
    request = context["request"]
    texts: list[str] = []
    for material in request.get("materials", []) or []:
        mtype = (material.get("type") or "").lower()
        if material.get("text"):
            texts.append(str(material["text"]))
            continue
        data = None
        if material.get("b64"):
            data = base64.b64decode(material["b64"])
        elif material.get("path") and Path(material["path"]).exists():
            data = Path(material["path"]).read_bytes()
        if data is None:
            continue
        if mtype == "pdf":
            try:
                import pymupdf  # noqa: F401

                pdf = pymupdf.open(stream=data, filetype="pdf")
                for page in pdf:
                    texts.append(page.get_text())
                pdf.close()
            except Exception as error:  # noqa: BLE001
                raise ValidationError(f"Failed to extract PDF '{material.get('name')}': {error}") from error
        elif mtype in ("text", "markdown", "md", "txt"):
            texts.append(data.decode("utf-8", errors="replace"))
    context["materials_text"] = "\n".join(texts)[:MAX_CONTEXT_CHARS]
    _emit(context, "inspect_materials", 25, f"Inspected {len(request.get('materials', []) or [])} material(s).")
    return context


def extract_materials_text(materials: list) -> str:
    """Standalone helper for the KB extraction endpoint."""
    context = inspect_materials({"request": {"materials": materials or []}, "stages": []})
    return context.get("materials_text", "")


def retrieve(context: dict) -> dict:
    kb = context["request"].get("kbChunks", []) or []
    instruction = context["instruction"]
    keywords = {w.lower() for w in re.findall(r"[a-zA-Z]{4,}", instruction)}
    scored: list[tuple[int, str]] = []
    for chunk in kb:
        content = str(chunk.get("content", ""))
        score = sum(1 for w in keywords if w in content.lower()) if keywords else 0
        scored.append((score, content))
    scored.sort(key=lambda s: s[0], reverse=True)
    ranked = [c for _, c in scored[: settings.kb_top_k]]
    context["context_text"] = ("\n".join(ranked) + "\n" + context.get("materials_text", ""))[:MAX_CONTEXT_CHARS]
    method = "keyword" if kb else "materials-only"
    _emit(context, "retrieve", 40, f"Retrieved {len(ranked)} KB chunk(s) ({method}).")
    return context


def plan_content(context: dict) -> dict:
    sections = context["doc"].get("sections", [])
    plan = [{"name": s.get("name"), "instruction": s.get("aiInstruction", "")} for s in sections]
    context["plan"] = plan
    _emit(context, "plan_content", 50, f"Planned {len(plan)} section(s).")
    return context


def _text_for(component: dict, section: dict, context: dict) -> str:
    pr = component.setdefault("props", {})
    if pr.get("text"):
        return pr["text"]
    topic = section.get("name") or context["doc"].get("title") or "this topic"
    instruction = section.get("aiInstruction") or context.get("instruction") or ""
    grounded = _first(context, 3)
    base = providers.text_complete(
        f"{topic}: {instruction}".strip(": ") or topic,
        system="Write one short instructional paragraph.",
    )
    return (base + (" " + grounded if grounded else "")).strip()


def fill_sections(context: dict) -> dict:
    doc = context["doc"]
    instruction = context["instruction"]
    for section in doc.get("sections", []):
        for component in section.get("components", []):
            ctype = component.get("type")
            pr = component.setdefault("props", {})
            if ctype == "Heading":
                pr.setdefault("text", section.get("name") or doc.get("title") or "Section")
                pr.setdefault("level", 2)
            elif ctype in ("Paragraph", "RichText"):
                pr["text"] = _text_for(component, section, context)
            elif ctype in ("BulletList", "NumberedList"):
                if not pr.get("items"):
                    pr["items"] = [s for s in _sentences(_first(context, 5))[:3]] or [
                        f"Key point about {section.get('name', 'the topic')}.",
                        instruction or "Follow the section instruction.",
                    ]
            elif ctype == "ObjectiveList":
                pr.setdefault("title", "Learning objectives")
                if not pr.get("items"):
                    pr["items"] = [
                        f"Understand {section.get('name', 'the topic')}.",
                        "Apply the concept with a worked example.",
                        "Check understanding with a short activity.",
                    ]
            elif ctype == "Glossary":
                pr.setdefault("title", "Keywords and definitions")
                if not pr.get("items"):
                    pr["items"] = [
                        {"term": "Model", "definition": "A simplified representation used to explore outcomes."},
                        {"term": "Variable", "definition": "A value that can change in the model."},
                    ]
            elif ctype in ("TableBlock", "RubricTable"):
                pr.setdefault("headers", ["Item", "Description"])
                if not pr.get("rows"):
                    pr["rows"] = [["Example", instruction or "Content generated from the template."]]
            elif ctype == "CoverContainer":
                pr.setdefault("title", doc.get("title") or "Student Handbook")
                pr.setdefault("subtitle", doc.get("subtitle") or "")
                pr.setdefault("meta", f"{context['variant'].title()} edition · {doc.get('courseCode', '')}")
            elif ctype == "CalloutBox":
                pr.setdefault("intent", "info")
                pr["text"] = pr.get("text") or (instruction or "Remember this point.")
            elif ctype == "QuestionItem":
                pr.setdefault("number", "Q1")
                pr["text"] = pr.get("text") or (instruction or "Answer the question.")
            elif ctype == "MediaAssetBlock":
                pr.setdefault("alt", f"Illustration for {section.get('name', 'section')}")
                pr.setdefault("prompt", (section.get("imageInstruction") or {}).get("promptTemplate", section.get("name", "")))
    if context["variant"] == "INSTRUCTOR":
        doc.setdefault("sections", []).append({
            "id": "answer-key",
            "name": "Answer key",
            "layoutType": "standard",
            "components": [{
                "id": "answer-key-1",
                "type": "AnswerKey",
                "props": {"title": "Teacher answer key", "items": ["Answers follow the student edition."]},
            }],
        })
    _emit(context, "fill_sections", 65, f"Filled {len(doc.get('sections', []))} section(s) for {context['variant']}.")
    return context


def generate_images(context: dict) -> dict:
    provider = (context["request"].get("imageProvider") or settings.ai_image_provider or "").strip()
    generated = 0
    for section in context["doc"].get("sections", []):
        img_cfg = section.get("imageInstruction") or {}
        if not img_cfg.get("enabled"):
            continue
        for component in section.get("components", []):
            if component.get("type") == "MediaAssetBlock":
                (component.setdefault("props", {})).setdefault("prompt", img_cfg.get("promptTemplate", ""))
                generated += 1
    reason = "" if provider else "no image provider configured; placeholders used"
    context["image_report"] = {"requested": generated, "provider": provider, "reason": reason}
    _emit(context, "generate_images", 72, f"Image slots prepared: {generated} ({reason or 'provider selected'}).")
    return context


def render_html_stage(context: dict) -> dict:
    doc = context["doc"]
    geometry = doc.get("geometry", {})
    variant = context["variant"]

    # Always-on CSS hardening makes content fit; the preflight measures the result.
    tighten = 0
    html = render_html(doc, variant, tighten=tighten)
    report = fit.preflight_html(html, geometry)
    attempts = 0
    # Bounded auto-fit: escalate safe CSS tightening until the preflight passes,
    # then keep the tightened HTML. This is what *enforces* "fits the page".
    while report.checked and report.error_count and attempts < 2:
        attempts += 1
        tighten = attempts
        html = render_html(doc, variant, tighten=tighten)
        report = fit.preflight_html(html, geometry)

    out = settings.artifacts_dir / f"{context['jobId']}.html"
    out.write_text(html, encoding="utf-8")
    context.setdefault("artifacts", {})["html"] = out.name
    context["html"] = html
    context["tighten"] = tighten
    fit_ctx = context.setdefault("fit", {})
    fit_ctx["html"] = report.to_dict()

    status = "ok" if report.ok else f"{report.error_count} error(s), {report.warning_count} warning(s)"
    suffix = f"; auto-fit x{tighten}" if tighten else ""
    _emit(context, "render_html", 85, f"Rendered HTML ({len(html)} bytes); fit={status}{suffix}.")
    return context


def render_pdf_stage(context: dict) -> dict:
    doc = context["doc"]
    defaults = doc.get("documentDefaults", {}) or {}
    page_numbers = defaults.get("pageNumbers") is not False
    fit_ctx = context.setdefault("fit", {})

    if not settings.pdf_render_enabled:
        context.setdefault("artifacts", {})["pdf"] = None
        context["pdf"] = {"available": False, "engine": "none", "reason": "PDF_RENDER_ENABLED=false"}
        fit_ctx["pdf"] = {
            "scope": "pdf", "engine": "none", "checked": False, "ok": True,
            "reason": "PDF_RENDER_ENABLED=false", "issues": [], "counts": {"error": 0, "warning": 0},
        }
        _emit(context, "render_pdf", 100, "PDF rendering disabled by configuration.")
        return context

    out = settings.artifacts_dir / f"{context['jobId']}.pdf"
    result = render_pdf(
        context["html"],
        str(out),
        doc.get("geometry", {}),
        page_numbers=page_numbers,
        footer_text=doc.get("title") or doc.get("name") or "",
    )
    context["artifacts"]["pdf"] = out.name if result.available else None
    context["pdf"] = {
        "available": result.available,
        "engine": result.engine,
        "reason": result.reason,
        "footer": result.footer,
    }

    # Post-render verification against the *real* PDF (page size, margins, blanks).
    if result.available:
        vreport = fit.verify_pdf(str(out), doc.get("geometry", {}))
        fit_ctx["pdf"] = vreport.to_dict()
        v_status = "ok" if vreport.ok else f"{vreport.error_count} error(s), {vreport.warning_count} warning(s)"
    else:
        fit_ctx["pdf"] = {
            "scope": "pdf", "engine": "none", "checked": False, "ok": False,
            "reason": result.reason, "issues": [], "counts": {"error": 0, "warning": 0},
        }
        v_status = "unavailable"

    _emit(
        context, "render_pdf", 100,
        f"PDF engine={result.engine} available={result.available}; fit={v_status}.",
    )
    return context


STAGES: list[tuple[str, Callable[[dict], dict]]] = [
    ("intake", intake),
    ("inspect_materials", inspect_materials),
    ("retrieve", retrieve),
    ("plan_content", plan_content),
    ("fill_sections", fill_sections),
    ("generate_images", generate_images),
    ("render_html", render_html_stage),
    ("render_pdf", render_pdf_stage),
]
