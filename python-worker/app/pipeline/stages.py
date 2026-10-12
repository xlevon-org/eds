"""Generation pipeline stages (stubs).

Order: intake -> inspect_materials -> plan_content -> fill_template ->
render_html -> render_pdf. Each stage is a pure, individually testable function
that receives the accumulated ``context`` dict and returns the updated context.
Every stage also emits a progress event consumed by the backend relay.
"""

from typing import Callable

from .errors import StageNotImplemented


def intake(context: dict) -> dict:
    """Normalise the generation request (materials, template, variants)."""
    raise StageNotImplemented("intake")


def inspect_materials(context: dict) -> dict:
    """Extract text/structure/images from uploaded materials (OCR, links, images)."""
    raise StageNotImplemented("inspect_materials")


def plan_content(context: dict) -> dict:
    """Ask the AI provider to plan the handbook content against the template."""
    raise StageNotImplemented("plan_content")


def fill_template(context: dict) -> dict:
    """Map planned content onto the template's sections (student + instructor)."""
    raise StageNotImplemented("fill_template")


def render_html(context: dict) -> dict:
    """Render the interactive HTML handbook from Jinja2 templates."""
    raise StageNotImplemented("render_html")


def render_pdf(context: dict) -> dict:
    """Render the print PDF from the HTML via WeasyPrint (optional; needs native libs)."""
    raise StageNotImplemented("render_pdf")


STAGES: list[tuple[str, Callable[[dict], dict]]] = [
    ("intake", intake),
    ("inspect_materials", inspect_materials),
    ("plan_content", plan_content),
    ("fill_template", fill_template),
    ("render_html", render_html),
    ("render_pdf", render_pdf),
]
