"""PDF rendering.

Primary engine on Windows/dev: headless Chromium via Playwright (full CSS + @page
fidelity, no native Pango/GTK needed). Fallback: WeasyPrint when its native libs are
present. If neither is available the caller degrades to HTML-only with a clear reason.

Geometry single source of truth: the CSS ``@page`` rule emitted by
``html_renderer.build_tokens_css``. Chromium was measured to honour the CSS margin
over the ``page.pdf`` margin option, so ``prefer_css_page_size=True`` is set and the
option margins are passed only as a fallback. Page numbers are drawn with Chromium's
``display_header_footer`` template because Chromium ignores CSS ``@page`` margin boxes
(the ``@bottom-right`` counter in the CSS is kept purely for WeasyPrint).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .fit import page_geometry


@dataclass
class PdfResult:
    path: str | None
    engine: str
    available: bool
    reason: str
    footer: dict = field(default_factory=dict)


def _mm(value, default):
    try:
        return f"{float(value)}mm"
    except (TypeError, ValueError):
        return f"{default}mm"


def _footer_template(geo: dict, page_numbers: bool, left_text: str) -> str:
    if not page_numbers and not left_text:
        return "<div></div>"
    ml = geo["marginsMm"]["left"]
    mr = geo["marginsMm"]["right"]
    counter = (
        "<span>Page <span class='pageNumber'></span> of <span class='totalPages'></span></span>"
        if page_numbers
        else "<span></span>"
    )
    safe_left = (
        left_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )
    return (
        "<div style=\"width:100%;font-size:8px;color:#57606a;font-family:Arial,sans-serif;"
        f"padding:0 {mr}mm 0 {ml}mm;box-sizing:border-box;display:flex;"
        "justify-content:space-between;align-items:flex-end;\">"
        f"<span>{safe_left}</span>{counter}</div>"
    )


def render_pdf(
    html: str,
    out_path: str,
    geometry: dict | None = None,
    *,
    page_numbers: bool = True,
    footer_text: str = "",
) -> PdfResult:
    """Render HTML to PDF. Never raises for engine absence; returns a reason instead."""
    geometry = geometry or {}
    geo = page_geometry(geometry)
    width = _mm(geo["widthMm"], 210)
    height = _mm(geo["heightMm"], 297)
    m = geo["marginsMm"]
    margins = {
        "top": _mm(m.get("top"), 20),
        "right": _mm(m.get("right"), 18),
        "bottom": _mm(m.get("bottom"), 20),
        "left": _mm(m.get("left"), 18),
    }
    # Only draw a footer when the bottom margin can hold it without colliding.
    footer_on = (page_numbers or bool(footer_text)) and float(m.get("bottom", 20)) >= 8
    footer_meta = {"enabled": footer_on, "pageNumbers": bool(page_numbers)}

    # 1) Chromium (Playwright)
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--no-sandbox"])
            page = browser.new_page()
            page.set_content(html, wait_until="load")
            page.emulate_media(media="print")
            page.pdf(
                path=out_path,
                width=width,
                height=height,
                margin=margins,
                prefer_css_page_size=True,  # CSS @page is authoritative for size AND margin
                print_background=True,
                display_header_footer=footer_on,
                header_template="<div></div>",
                footer_template=_footer_template(geo, page_numbers, footer_text),
            )
            browser.close()
        return PdfResult(out_path, "chromium", True, "ok", footer_meta)
    except Exception as chrom_err:  # noqa: BLE001 - report and try next engine
        chromium_reason = f"chromium: {type(chrom_err).__name__}"
        # reset file if partially written
        try:
            import os
            if os.path.exists(out_path):
                os.remove(out_path)
        except OSError:
            pass

    # 2) WeasyPrint (honours the CSS @page margin box for page numbers itself)
    try:
        from weasyprint import HTML

        HTML(string=html, base_url=out_path).write_pdf(out_path)
        return PdfResult(out_path, "weasyprint", True, "ok", footer_meta)
    except Exception as wp_err:  # noqa: BLE001
        wp_reason = f"weasyprint: {type(wp_err).__name__}"

    return PdfResult(
        None, "none", False,
        f"No PDF engine available ({chromium_reason}; {wp_reason}). HTML-only output produced.",
        footer_meta,
    )
