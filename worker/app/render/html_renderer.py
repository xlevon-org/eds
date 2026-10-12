"""Render a filled document dict to standalone, print-ready HTML.

The template JSON (geometry + designTokens + sections/components) is the single
source of truth. The same structure is rendered in the browser preview and here,
so preview and export stay aligned by contract.
"""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..pipeline.errors import ValidationError
from .fit import page_geometry

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml", "j2"]),
    trim_blocks=True,
    lstrip_blocks=True,
)

# Font tokens -> websafe stacks (offline-safe; no network at render time).
_FONT_STACKS = {
    "bodyFont": "'Segoe UI', system-ui, -apple-system, Arial, sans-serif",
    "headingFont": "'Segoe UI Semibold', 'Segoe UI', system-ui, Arial, sans-serif",
    "monoFont": "'Cascadia Mono', Consolas, 'Courier New', monospace",
}


def _font_css(name: str, value: str) -> str:
    if not value:
        return _FONT_STACKS.get(name, "system-ui, sans-serif")
    if any(t in value.lower() for t in ("serif", "sans", "mono", "system-ui")):
        return value
    return f"'{value}', {_FONT_STACKS.get(name, 'system-ui, sans-serif')}"


def _num(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _fit_hardening_css(tighten: int = 0) -> str:
    """CSS that makes content *fit* the page rather than overflow it.

    Always-on. This is what turns the flow-pagination model into a guarantee:
    unbreakable tokens wrap, media/tables cannot exceed the content box, and
    atomic blocks are told where they may break. ``tighten`` is the bounded
    auto-fit escalation applied when the preflight still reports overflow.
    """
    parts = [
        # 1) nothing may exceed the content box horizontally
        "img, svg, video, canvas, iframe, table, pre, figure, blockquote { max-width: 100%; }",
        "figure img, .media-placeholder img { height: auto; }",
        # 2) long tokens/URLs wrap instead of bleeding off the page
        "p, li, td, th, h1, h2, h3, h4, h5, h6, figcaption, .callout, .prose,"
        " .toc-item span, .badge, .question { overflow-wrap: anywhere; word-break: break-word; }",
        "pre { white-space: pre-wrap; overflow-wrap: anywhere; overflow-x: hidden; }",
        "pre code { white-space: inherit; overflow-wrap: anywhere; }",
        # 3) fixed layout -> a wide table compresses + wraps instead of overflowing
        "table { table-layout: fixed; }",
        "th, td { vertical-align: top; overflow-wrap: anywhere; }",
        "thead { display: table-header-group; }",  # repeat header across pages
        # 4) grid/flex children must be allowed to shrink
        ".grid > * { min-width: 0; }",
        ".section { min-width: 0; }",
        # 5) break control: keep atomic blocks whole, never orphan a heading
        "figure, table, .callout, .question, .answer-key, .toc, .glossary,"
        " .objectives, .media-placeholder, .cover, .badge { break-inside: avoid; }",
        "tr, li { break-inside: avoid; }",
        "h1, h2, h3, h4, h5, h6 { break-after: avoid; break-inside: avoid; }",
        # 6) typographic honesty
        "p, li { orphans: 2; widows: 2; }",
    ]
    if tighten >= 1:
        # conservative escalation: single-column grids, tighter leading
        parts.append(".grid { grid-template-columns: 1fr !important; }")
    if tighten >= 2:
        parts.append("img, svg { max-height: 40vh; }")
        parts.append(".callout, .answer-key, .toc { padding: 8px 10px; }")
    return "\n".join(parts)



def build_tokens_css(design_tokens: dict, geometry: dict, tighten: int = 0) -> str:
    p = (design_tokens or {}).get("palette", {}) or {}
    t = (design_tokens or {}).get("typography", {}) or {}
    sp = (design_tokens or {}).get("spacing", {}) or {}
    rad = (design_tokens or {}).get("radius", {}) or {}
    borders = (design_tokens or {}).get("borders", {}) or {}

    # Geometry is normalised once (orientation-aware) and shared with the fit gate
    # so preview, HTML export and PDF verification all measure the same box.
    geo = page_geometry(geometry)
    w = geo["widthMm"]
    h = geo["heightMm"]
    orient = geo["orientation"]
    mt = geo["marginsMm"]["top"]
    mr = geo["marginsMm"]["right"]
    mb = geo["marginsMm"]["bottom"]
    ml = geo["marginsMm"]["left"]

    base_pt = _num(t.get("baseFontPt", 11), 11.0)
    if tighten > 0:
        base_pt = max(8.0, base_pt - tighten)

    return f"""
:root {{
  --color-primary: {p.get('primary', '#1f6feb')};
  --color-secondary: {p.get('secondary', '#6e7781')};
  --color-accent: {p.get('accent', '#d97706')};
  --color-background: {p.get('background', '#ffffff')};
  --color-surface: {p.get('surface', '#f6f8fa')};
  --color-text: {p.get('text', '#1f2328')};
  --color-muted: {p.get('mutedText', '#57606a')};
  --color-border: {p.get('border', '#d0d7de')};
  --color-success: {p.get('success', '#1a7f37')};
  --color-warning: {p.get('warning', '#9a6700')};
  --color-danger: {p.get('danger', '#cf222e')};
  --color-info: {p.get('info', '#0969da')};
  --font-body: {_font_css('bodyFont', t.get('bodyFont', ''))};
  --font-head: {_font_css('headingFont', t.get('headingFont', ''))};
  --font-mono: {_font_css('monoFont', t.get('monoFont', ''))};
  --base-pt: {base_pt};
  --lh: {t.get('lineHeight', 1.5)};
  --space-unit: {sp.get('unitPx', 4)}px;
  --radius-md: {rad.get('md', 6)}px;
  --border-w: {borders.get('widthPt', 0.5)}pt;
  --page-w: {w}mm;
  --page-h: {h}mm;
  --content-w: {geo['contentWidthMm']}mm;
}}
@page {{
  size: {w}mm {h}mm {orient};
  margin: {mt}mm {mr}mm {mb}mm {ml}mm;
  @bottom-right {{ content: counter(page) " / " counter(pages); font-family: var(--font-body);
                   font-size: 8pt; color: var(--color-muted); }}
}}
* {{ box-sizing: border-box; }}
html {{ background: #e9ecef; }}
body {{ font-family: var(--font-body); font-size: calc(var(--base-pt) * 1pt);
        line-height: var(--lh); color: var(--color-text); background: var(--color-background);
        margin: 0; }}
.page {{ width: var(--page-w); min-height: var(--page-h); margin: 16px auto;
         padding: {mt}mm {mr}mm {mb}mm {ml}mm;
         background: var(--color-background); box-shadow: 0 1px 4px rgba(0,0,0,.18); }}
@media print {{
  html {{ background: #fff; }}
  .page {{ margin: 0; box-shadow: none; padding: 0; }}
  .screen-only {{ display: none !important; }}
}}
h1, h2, h3, h4 {{ font-family: var(--font-head); margin: 0 0 .4em; line-height: 1.2; }}
h1 {{ font-size: 2em; }} h2 {{ font-size: 1.45em; }} h3 {{ font-size: 1.18em; }} h4 {{ font-size: 1em; }}
p {{ margin: 0 0 .7em; }}
ul, ol {{ margin: 0 0 .7em; padding-left: 1.4em; }}
.section {{ margin-bottom: 1.2em; }}
.callout {{ border-left: 4px solid var(--color-info); background: var(--color-surface);
            border-radius: var(--radius-md); padding: 10px 12px; margin: 0 0 1em; }}
.callout.warning {{ border-color: var(--color-warning); }}
.callout.tip {{ border-color: var(--color-success); }}
.callout.definition {{ border-color: var(--color-secondary); }}
.callout.danger {{ border-color: var(--color-danger); }}
.callout .callout-title {{ font-weight: 700; margin-bottom: 4px; }}
.grid {{ display: grid; gap: var(--space-unit); }}
.grid.cols-1 {{ grid-template-columns: 1fr; }}
.grid.cols-2 {{ grid-template-columns: 1fr 1fr; }}
.grid.cols-3 {{ grid-template-columns: 1fr 1fr 1fr; }}
.grid.cols-4 {{ grid-template-columns: repeat(4, 1fr); }}
figure {{ margin: 0 0 1em; }}
figure img {{ max-width: 100%; border-radius: var(--radius-md); }}
figcaption, .caption {{ font-size: .85em; color: var(--color-muted); margin-top: 4px; }}
.media-placeholder {{ border: 1px dashed var(--color-border); border-radius: var(--radius-md);
                      padding: 24px; text-align: center; color: var(--color-muted);
                      background: var(--color-surface); }}
table {{ border-collapse: collapse; width: 100%; margin: 0 0 1em; font-size: .95em; }}
th, td {{ border: 1px solid var(--color-border); padding: 6px 8px; text-align: left; }}
th {{ background: var(--color-surface); }}
tr:nth-child(even) td {{ background: #fafbfc; }}
hr {{ border: 0; border-top: var(--border-w) solid var(--color-border); margin: 1em 0; }}
pre {{ background: var(--color-surface); border: 1px solid var(--color-border);
       border-radius: var(--radius-md); padding: 10px; font-family: var(--font-mono); }}
code {{ font-family: var(--font-mono); }}
.toc {{ border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px 16px; }}
.toc .toc-item {{ display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }}
.toc .toc-item .dots {{ flex: 1; border-bottom: 1px dotted var(--color-border); margin: 0 6px; }}
.cover {{ min-height: 60%; display: flex; flex-direction: column; justify-content: center;
          text-align: center; padding: 24px 0; }}
.cover h1 {{ font-size: 2.6em; }}
.cover .subtitle {{ color: var(--color-muted); font-size: 1.1em; }}
.cover .meta {{ margin-top: 24px; color: var(--color-muted); font-size: .9em; }}
.page-break {{ break-after: page; page-break-after: always; }}
.objectives, .glossary {{ margin: 0 0 1em; }}
.question {{ margin: 0 0 .9em; }}
.question .qnum {{ font-weight: 700; margin-right: 6px; }}
.answer-key {{ background: var(--color-surface); border: 1px solid var(--color-border);
               border-radius: var(--radius-md); padding: 12px; }}
.badge {{ display: inline-block; font-size: .75em; padding: 1px 8px; border-radius: 999px;
          background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-muted); }}
{_fit_hardening_css(tighten)}
"""



def _collect_toc(doc: dict) -> list[dict]:
    items: list[dict] = []
    max_level = (doc.get("documentDefaults", {}) or {}).get("tocIncludeLevels", [1, 2, 3])
    for section in doc.get("sections", []):
        for comp in section.get("components", []):
            if comp.get("type") == "Heading":
                level = int((comp.get("props") or {}).get("level", 2))
                if level in max_level:
                    items.append({"text": (comp.get("props") or {}).get("text", ""), "level": level})
    return items


def render_html(doc: dict, variant: str = "STUDENT", tighten: int = 0) -> str:
    if not isinstance(doc, dict) or not doc.get("sections"):
        raise ValidationError("Document must be an object with a non-empty 'sections' array.")

    doc = dict(doc)
    toc_items = _collect_toc(doc)
    for section in doc.get("sections", []):
        for comp in section.get("components", []):
            if comp.get("type") == "Toc" and not (comp.get("props") or {}).get("items"):
                comp.setdefault("props", {})["items"] = toc_items

    tokens_css = build_tokens_css(doc.get("designTokens", {}), doc.get("geometry", {}), tighten=tighten)
    template = _env.get_template("document.html.j2")
    return template.render(doc=doc, variant=variant, tokens_css=tokens_css, tighten=tighten)
