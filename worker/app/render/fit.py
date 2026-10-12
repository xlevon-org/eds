"""Content-fit and page-alignment verification (the *fit gate*).

Two measured guarantees — never assumed:

1. ``preflight_html`` (DOM): renders the export HTML in headless Chromium at the
   template's page geometry and asserts every element stays inside the printable
   content box (no horizontal overflow, no block taller than one page). This is
   the same measurement the browser would do, so it catches overflow *before* a
   clipped PDF is ever produced.
2. ``verify_pdf`` (PyMuPDF): opens the produced PDF and asserts the page size
   matches the configured geometry within ±0.5 mm, that glyphs stay inside the
   ``@page`` margins, and that no page is blank.

Both return a serialisable :class:`FitReport` so the backend can store it beside
the artifact (``document.fidelity.fit``) and the UI can display it.

Geometry semantics match ``html_renderer.build_tokens_css`` exactly: the CSS
``@page`` rule is the single source of truth (Chromium honours the CSS margin,
verified empirically on Windows).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

MM_PER_INCH = 25.4
PT_PER_INCH = 72.0
PX_PER_INCH = 96.0

DEFAULT_WIDTH_MM = 210.0
DEFAULT_HEIGHT_MM = 297.0
DEFAULT_MARGINS_MM = {"top": 20.0, "right": 18.0, "bottom": 20.0, "left": 18.0}

# Tolerance for DOM measurement (sub-pixel rounding) and PDF glyph extents.
DOM_TOLERANCE_PX = 1.5
PDF_TOLERANCE_PT = 2.0
PDF_SIZE_TOLERANCE_MM = 0.5

_FOOTER_RE = re.compile(r"^\s*page\s+\d+\s+of\s+\d+\s*$", re.IGNORECASE)


def _num(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def page_geometry(geometry: dict | None) -> dict:
    """Normalise template geometry into effective page + content dimensions (mm)."""
    g = geometry or {}
    w = _num(g.get("widthMm"), DEFAULT_WIDTH_MM)
    h = _num(g.get("heightMm"), DEFAULT_HEIGHT_MM)
    orient = str(g.get("orientation") or "portrait").lower()
    if orient.startswith("land") and w < h:
        w, h = h, w
    m = g.get("marginsMm") or {}
    mt = _num(m.get("top"), DEFAULT_MARGINS_MM["top"])
    mr = _num(m.get("right"), DEFAULT_MARGINS_MM["right"])
    mb = _num(m.get("bottom"), DEFAULT_MARGINS_MM["bottom"])
    ml = _num(m.get("left"), DEFAULT_MARGINS_MM["left"])
    return {
        "widthMm": w,
        "heightMm": h,
        "orientation": orient,
        "marginsMm": {"top": mt, "right": mr, "bottom": mb, "left": ml},
        "contentWidthMm": max(w - ml - mr, 1.0),
        "contentHeightMm": max(h - mt - mb, 1.0),
    }


def mm_to_pt(value: float) -> float:
    return value * PT_PER_INCH / MM_PER_INCH


def mm_to_px(value: float) -> float:
    return value * PX_PER_INCH / MM_PER_INCH


@dataclass
class FitIssue:
    code: str
    severity: str  # "error" | "warning"
    message: str
    detail: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {"code": self.code, "severity": self.severity, "message": self.message, "detail": self.detail}


@dataclass
class FitReport:
    scope: str  # "html" | "pdf"
    engine: str = "none"
    checked: bool = False
    reason: str = ""
    page: dict = field(default_factory=dict)
    metrics: dict = field(default_factory=dict)
    issues: list[FitIssue] = field(default_factory=list)

    def add(self, code: str, severity: str, message: str, **detail) -> None:
        self.issues.append(FitIssue(code, severity, message, detail))

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "warning")

    @property
    def ok(self) -> bool:
        """True when the export is usable: checked and no error-level issues."""
        return self.checked and self.error_count == 0

    def to_dict(self) -> dict:
        return {
            "scope": self.scope,
            "engine": self.engine,
            "checked": self.checked,
            "ok": self.ok,
            "reason": self.reason,
            "page": self.page,
            "metrics": self.metrics,
            "issues": [i.to_dict() for i in self.issues],
            "counts": {"error": self.error_count, "warning": self.warning_count},
        }


# ---------------------------------------------------------------------------
# HTML / DOM preflight
# ---------------------------------------------------------------------------

# Measures the rendered DOM against the printable content box of `.page`.
# Returns only offenders + aggregates so the payload stays small.
_PREFLIGHT_JS = r"""
(arg) => {
  const tol = arg.tol;
  const page = document.querySelector('.page') || document.body;
  const cs = getComputedStyle(page);
  const pr = page.getBoundingClientRect();
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const cbLeft = pr.left + padL;
  const cbRight = pr.right - padR;
  const contentH = arg.contentHeightPx;

  const atomicTags = new Set(['FIGURE', 'TABLE', 'PRE']);
  const atomicClasses = ['callout', 'question', 'answer-key', 'toc', 'glossary',
                         'cover', 'media-placeholder', 'objectives', 'answer-key'];
  const isAtomic = (el) => atomicTags.has(el.tagName) ||
      atomicClasses.some((c) => el.classList && el.classList.contains(c));

  const offenders = [];
  const tall = [];
  let checked = 0;
  document.querySelectorAll('.page *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    checked += 1;
    const overR = r.right - cbRight;
    const overL = cbLeft - r.left;
    const self = el.scrollWidth - el.clientWidth;
    if (overR > tol || overL > tol || self > tol) {
      offenders.push({
        tag: el.tagName,
        cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 60),
        overRight: Math.round(overR * 10) / 10,
        overLeft: Math.round(overL * 10) / 10,
        selfOverflow: Math.round(self),
        width: Math.round(r.width),
        text: (el.textContent || '').replace(/\s+/g, ' ').slice(0, 50),
      });
    }
    if (isAtomic(el) && r.height > contentH + tol) {
      tall.push({
        tag: el.tagName,
        cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 60),
        height: Math.round(r.height),
        text: (el.textContent || '').replace(/\s+/g, ' ').slice(0, 40),
      });
    }
  });

  const doc = document.documentElement;
  return {
    checked,
    contentBox: { left: cbLeft, right: cbRight, width: cbRight - cbLeft },
    contentHeight: contentH,
    pageWidth: pr.width,
    pageHeight: pr.height,
    documentOverflow: doc.scrollWidth - doc.clientWidth,
    offenders: offenders.slice(0, 40),
    offenderCount: offenders.length,
    tall: tall.slice(0, 20),
    tallCount: tall.length,
  };
}
"""


def preflight_html(html: str, geometry: dict | None = None, *, timeout_ms: int = 30000) -> FitReport:
    """Measure the export HTML in headless Chromium against the content box."""
    geo = page_geometry(geometry)
    report = FitReport(scope="html", engine="chromium", page=geo)
    content_height_px = mm_to_px(geo["contentHeightMm"])
    page_width_px = mm_to_px(geo["widthMm"])

    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # noqa: BLE001
        report.reason = f"playwright unavailable: {type(exc).__name__}: {exc}"
        return report

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--no-sandbox"])
            page = browser.new_page(
                viewport={"width": max(1400, int(page_width_px + 200)), "height": 1200}
            )
            page.set_content(html, wait_until="load", timeout=timeout_ms)
            data = page.evaluate(_PREFLIGHT_JS, {"tol": DOM_TOLERANCE_PX, "contentHeightPx": content_height_px})
            browser.close()
    except Exception as exc:  # noqa: BLE001
        report.reason = f"preflight failed: {type(exc).__name__}: {exc}"
        return report

    report.checked = True
    report.metrics = {
        "elementsChecked": data["checked"],
        "contentBoxPx": round(data["contentBox"]["width"], 1),
        "contentHeightPx": round(content_height_px, 1),
        "offenderCount": data["offenderCount"],
        "tallCount": data["tallCount"],
        "documentOverflowPx": round(data["documentOverflow"], 1),
    }

    for o in data["offenders"]:
        report.add(
            "horizontal_overflow",
            "error",
            f"<{o['tag'].lower()}> exceeds the content box by {o['overRight']}px "
            f"({o['text'] or o['cls'] or 'no text'})",
            **o,
        )
    for t in data["tall"]:
        severity = "warning" if t["tag"] in ("TABLE", "PRE") else "error"
        report.add(
            "block_taller_than_page",
            severity,
            f"<{t['tag'].lower()}> is {t['height']}px tall (> one page {round(content_height_px)}px); "
            "it will be fragmented.",
            **t,
        )
    if data["documentOverflow"] > DOM_TOLERANCE_PX:
        report.add(
            "document_overflow",
            "error",
            f"document scrollWidth exceeds the viewport by {round(data['documentOverflow'], 1)}px.",
            overflowPx=round(data["documentOverflow"], 1),
        )
    return report


# ---------------------------------------------------------------------------
# PDF verification
# ---------------------------------------------------------------------------


def verify_pdf(pdf_path: str, geometry: dict | None = None) -> FitReport:
    """Verify page size + glyph extents + no blank pages on the produced PDF."""
    geo = page_geometry(geometry)
    report = FitReport(scope="pdf", engine="pymupdf", page=geo)
    try:
        import pymupdf  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        report.reason = f"pymupdf unavailable: {type(exc).__name__}: {exc}"
        return report

    exp_w = mm_to_pt(geo["widthMm"])
    exp_h = mm_to_pt(geo["heightMm"])
    ml = mm_to_pt(geo["marginsMm"]["left"])
    mr = mm_to_pt(geo["marginsMm"]["right"])
    mt = mm_to_pt(geo["marginsMm"]["top"])
    mb = mm_to_pt(geo["marginsMm"]["bottom"])
    size_tol = mm_to_pt(PDF_SIZE_TOLERANCE_MM)

    doc = pymupdf.open(pdf_path)
    report.checked = True
    extents = {"minx": 1e9, "maxx": -1e9, "miny": 1e9, "maxy": -1e9}
    blank_pages: list[int] = []
    fonts: set[str] = set()
    sizes: list[dict] = []

    for index, page in enumerate(doc):
        pw, ph = page.rect.width, page.rect.height
        sizes.append({"page": index + 1, "widthPt": round(pw, 1), "heightPt": round(ph, 1)})
        if abs(pw - exp_w) > size_tol or abs(ph - exp_h) > size_tol:
            report.add(
                "page_size_mismatch",
                "error",
                f"page {index + 1} is {pw / PT_PER_INCH * MM_PER_INCH:.1f}×"
                f"{ph / PT_PER_INCH * MM_PER_INCH:.1f}mm, expected "
                f"{geo['widthMm']:.1f}×{geo['heightMm']:.1f}mm.",
                page=index + 1,
            )
        try:
            for f in page.get_fonts():
                if len(f) > 3 and f[3]:
                    fonts.add(str(f[3]))
        except Exception:  # noqa: BLE001 - font listing is best-effort
            pass

        blocks = [b for b in page.get_text("blocks") if len(b) >= 5 and b[6] == 0]
        images = page.get_images(full=True)
        if not blocks and not images:
            blank_pages.append(index + 1)

        content_bottom_limit = ph - 2.0  # nothing may cross the page edge
        for b in blocks:
            x0, y0, x1, y1 = b[0], b[1], b[2], b[3]
            text = (b[4] or "").strip()
            extents["minx"] = min(extents["minx"], x0)
            extents["maxx"] = max(extents["maxx"], x1)
            extents["miny"] = min(extents["miny"], y0)
            extents["maxy"] = max(extents["maxy"], y1)
            in_footer_zone = y0 >= ph - mb - PDF_TOLERANCE_PT
            is_footer = bool(_FOOTER_RE.match(text))
            if x0 < ml - PDF_TOLERANCE_PT or x1 > pw - mr + PDF_TOLERANCE_PT:
                report.add(
                    "horizontal_bleed",
                    "error",
                    f"page {index + 1}: text crosses the horizontal margin "
                    f"(x=[{x0:.1f},{x1:.1f}]pt, allowed [{ml:.1f},{pw - mr:.1f}]).",
                    page=index + 1,
                    text=text[:60],
                )
            if y0 < mt - PDF_TOLERANCE_PT:
                report.add(
                    "top_bleed",
                    "error",
                    f"page {index + 1}: content enters the top margin (y0={y0:.1f}pt < {mt:.1f}).",
                    page=index + 1,
                    text=text[:60],
                )
            if y1 > content_bottom_limit:
                report.add(
                    "bottom_bleed",
                    "error",
                    f"page {index + 1}: content crosses the page edge (y1={y1:.1f}pt > {content_bottom_limit:.1f}).",
                    page=index + 1,
                    text=text[:60],
                )
            elif not is_footer and not in_footer_zone and y1 > ph - mb + PDF_TOLERANCE_PT:
                report.add(
                    "bottom_bleed",
                    "warning",
                    f"page {index + 1}: content intrudes into the bottom margin "
                    f"(y1={y1:.1f}pt > {ph - mb:.1f}).",
                    page=index + 1,
                    text=text[:60],
                )

    page_count = doc.page_count
    doc.close()

    if blank_pages:
        report.add(
            "blank_page",
            "warning",
            f"blank page(s): {blank_pages} (possible stray page break).",
            pages=blank_pages,
        )

    report.metrics = {
        "pageCount": page_count,
        "pages": sizes,
        "textExtents": {k: (round(v, 1) if v < 1e8 else None) for k, v in extents.items()},
        "contentBoxPt": {
            "left": round(ml, 1),
            "right": round(exp_w - mr, 1),
            "top": round(mt, 1),
            "bottom": round(exp_h - mb, 1),
        },
        "fonts": sorted(fonts),
        "blankPages": blank_pages,
    }
    return report
