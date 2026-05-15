"""
Stage 2 of the criminal-cases pipeline (see scraper_lab/README.md). Committed
2026-05 — previously an untracked local file; kept under version control rather
than deleted because the downstream extractor reads its output every run.

Scan every affidavit PDF in scraper_lab/affidavits/ and record which pages contain
the Section 5 (pending) and Section 6 (conviction) criminal-case tables.

Output: src/data/criminal_pages_index.json

How we find the tables (guided by scraper_lab/affidavit_cases_styles.pdf)
--------------------------------------------------------------------
That PDF documents what the Form-26 case tables actually look like in the wild:

  * Two record types: Section (5) "Pending criminal cases" and Section (6)
    "Cases of conviction". Each section has an alternative the candidate ticks
    when they have nothing to declare ("I declare that there is no pending
    criminal case against me" / "I declare that I have not been convicted...").
    When ticked, the table is filled with "Not Applicable" and carries no data.
  * STYLE 1 — a horizontal table; the FIRST TWO columns from the left are
    labels (row letter (a)/(b)/(c)... and the question text) and EVERY column
    after that is one case. A column whose cells are all "Not Applicable" is an
    unused template slot, and "the last column ends with 'Not Applicable' on
    all the rows" marks the END of the table.
  * STYLE 2 — the same horizontal table but with an EXTRA TOP ROW of bare
    ascending numbers (1 2 3 ...); the highest number is how many cases are in
    THAT table (boxes around the numbers are optional).
  * STYLE 3 — a SEPARATE small table per case, each headed "Case 1", "Case 2"...
  * Any of these tables can be CUT ACROSS TWO PAGES, so a case table spills onto
    continuation pages that have only rows (e)/(f)/(g)... and no FIR No. row.
  * Some affidavits leave the §5 table empty and write "As per separate list
    attached as Annexure J" in every cell — the real cases live on that
    annexure (a "(a) FIR No. with name and address of police station ... (g)
    Whether any Appeal/Application for revision..." table, one column per case).
    When the §5 table has no FIR numbers (or explicitly redirects), we use the
    annexure pages as the pending-cases pages instead.

Anchoring strategy
------------------
Section headers — (5) Pending, (6) Cases of conviction, (7) ...assets — are
templated boilerplate that appears on every affidavit, so they are reliable
boundary markers even on scanned PDFs with OCR noise. Because §6 sits directly
after §5's table and §7 directly after §6's, a section's table is exactly
[its header .. the next header − 1] — and since any of these tables can be
"cut across two pages", we keep that WHOLE span (no fixed page cap — a 25-case
Style-1 affidavit needs ~7 pages, well past the old 6-page cap). We only clamp
to the scanned pages, apply a generous sanity cap if the next-header anchor
mis-fires far down the document, fall back to a small fixed window when there
is no next-header anchor at all, and gently drop trailing pages that show no
table signal whatsoever (no FIR/Crime no., no IPC section, no (a)–(g) row
letters, no "Not Applicable" filler).

We also record, per section, the detected table `style`, a `case_count_hint`
computed by that style's counting rule above, and the candidate's own stated
totals (`abstract_pending_count` / `abstract_conviction_count`) — all as
cross-check signals for validate_with_myneta.py and the extractor.

Pipeline:
  1. Try pdfplumber text extraction per page (fast, free).
  2. If a page has < 50 chars of extractable text, fall back to Tesseract OCR
     on the rendered image (handles the ~72% scanned PDFs in the corpus).
  3. Apply regex anchors to find §5/§6/§7 header pages.
  4. Build pending_pages / conviction_pages by content within those bounds.

Run examples:
    .venv/bin/python scraper_lab/find_criminal_pages.py
    .venv/bin/python scraper_lab/find_criminal_pages.py --only chintamaneni_prabhakar
    .venv/bin/python scraper_lab/find_criminal_pages.py --force --workers 6
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError


PROJECT_ROOT = Path(__file__).parent.parent
AFFIDAVITS_DIR = PROJECT_ROOT / "public" / "affidavits"
OUTPUT_JSON = PROJECT_ROOT / "src" / "data" / "criminal_pages_index.json"

PDFPLUMBER_MIN_CHARS = 50
OCR_DPI = 200
MAX_SCAN_PAGES = 35          # how many leading pages we OCR/scan per PDF
NO_END_ANCHOR_WINDOW = 6     # fallback page window when §6/§7 can't be found
SANITY_MAX_SECTION_PAGES = 25  # absolute upper bound on one section's page span


# --- section-header anchors (boundary markers) -----------------------------
# The "strict" patterns are digit-specific and used first — near-zero false
# positives on text-extractable PDFs. The "loose" patterns drop the digit/parens
# (which Tesseract often garbles to "(S)", "1)", "6.", etc.) and anchor on the
# section name only — the fallback for scanned PDFs.
ANCHORS = {
    "section_5_strict": re.compile(r"\(\s*5\s*\)\s*Pending", re.I),
    "section_5_loose":  re.compile(r"Pending\s+[Cc]riminal\s+[Cc]ases", re.I),
    "section_6_strict": re.compile(r"\(\s*6\s*\)\s*Cases\s+of\s+conviction", re.I),
    # The §6 subsection (i)/(ii) trigger phrases ("have not been convicted",
    # "convicted for the offences") sit on the §6 header page itself, so they
    # disambiguate from the (6A) cross-reference clause that appears AFTER §6.
    "section_6_loose":  re.compile(
        r"have\s+not\s+been\s+convicted"
        r"|convicted\s+for\s+the\s+offences"
        r"|(?<!all\s)Cases?\s+of\s+[Cc]onvict",
        re.I,
    ),
    "section_7_strict": re.compile(
        r"\(\s*7\s*\)\s*(?:That\s+I\s+give|details\s+of\s+the\s+assets)",
        re.I,
    ),
    # Match standalone "(7)" line OR any of the canonical assets-section phrases.
    "section_7_loose": re.compile(
        r"^\s*\(\s*7\s*\)\s*$"
        r"|movable\s+(?:and\s+immovable\s+)?assets"
        r"|details\s+of\s+(?:the\s+|movable|immovable|deposit|investment)",
        re.I | re.M,
    ),
    # Diagnostic only — form-template phrases present on every affidavit.
    "pending_trigger":    re.compile(
        r"following\s+\S+\s+cases\s+are\s+pending|criminal\s+cases\s+are\s+pending",
        re.I,
    ),
    "conviction_trigger": re.compile(r"convicted\s+for\s+the\s+offences", re.I),
    "no_pending":         re.compile(r"no\s+pending\s+criminal\s+case", re.I),
    "no_conviction":      re.compile(r"have\s+not\s+been\s+convicted", re.I),
    # The candidate's own stated totals (Part B / abstract).
    "abstract_pending_count": re.compile(
        r"(?:total\s+(?:number\s+of\s+|no\.?\s+of\s+)?|number\s+of\s+|no\.?\s+of\s+)"
        r"pending\s+criminal\s+cases?\s*[:\-]?\s*(\d+)",
        re.I,
    ),
    "abstract_conviction_count": re.compile(
        r"(?:total\s+(?:number\s+of\s+|no\.?\s+of\s+)?|number\s+of\s+|no\.?\s+of\s+)"
        r"(?:cases?\s+of\s+conviction|convict(?:ed|ion)\s+cases?)\s*[:\-]?\s*(\d+)",
        re.I,
    ),
}


# --- table-content / style detection (from affidavit_cases_styles.pdf) -----
# An FIR/Crime number written out ("Cr.No.130/2020", "Crime No. 92/2021",
# "FIR No 79/2023", "Case No. 65 of 2023"):
FIR_QUALIFIED_RX = re.compile(
    r"(?:cr(?:ime)?\.?\s*n?o?\.?|f\.?i\.?r\.?\s*n?o?\.?|case\s*no\.?)\s*[:.]?\s*"
    r"\d{1,5}\s*(?:/|of)\s*(?:19|20)?\d{2}",
    re.I,
)
# A bare "<digits>/<year>" (Tesseract often drops the "Cr.No." prefix):
FIR_BARE_RX = re.compile(r"\b\d{1,5}\s*/\s*(?:19|20)\d{2}\b")
# Form-26 case-table row letters (a)..(g) — a populated table shows several:
ROW_LETTER_RX = re.compile(r"\(\s*([a-g])\s*\)", re.I)
# IPC / CrPC section citations ("U/s 188", "323 IPC", "Sec. 506"):
IPC_SECTION_RX = re.compile(
    r"\bu/s\b|\bsec(?:tion)?s?\.?\s*\d|\b\d{2,3}\s*(?:r/?w\s*\d+\s*)?(?:i\.?p\.?c|cr\.?p\.?c|ipc)\b",
    re.I,
)
# STYLE 3: a "Case 1" / "CASE-2" / "Case : 3" sub-table header:
CASE_HEADER_RX = re.compile(r"\bcase\s*[-:]?\s*(\d{1,3})\b", re.I)
# STYLE 2: a row of bare ascending numbers starting at 1 ("1 2 3", "1  2  3  4"):
TOP_NUMBER_ROW_RX = re.compile(r"^\W*1(?:\W+2(?:\W+3(?:\W+4(?:\W+5(?:\W+6)?)?)?)?)\W*$", re.M)

# --- "case details live in an annexure" handling ---------------------------
# Some affidavits leave the §5 table empty and write "As per separate list
# attached as Annexure J" in every cell; the actual cases are in that annexure.
# Column interleaving in pdfplumber output mangles the phrase, so we just count
# how often "as per separate" occurs on the page — a redirected table repeats it
# in every cell, an ordinary table never says it at all.
_AS_PER_SEPARATE_RX = re.compile(r"as\s+per\s+separate", re.I)

def _is_annexure_redirect(text: str) -> bool:
    return len(_AS_PER_SEPARATE_RX.findall(text)) >= 3 and bool(re.search(r"annexure", text, re.I))
# NOTE: we can't identify an annexure page by its row labels — the §5 table and
# the Annexure-J table share the SAME "(a) FIR No. ... (g) Appeal/Application"
# labels. The only reliable marker is the explicit "ANNEXURE J — Legal Cases"
# header (annexure-continuation pages are then picked up because they carry
# table content), plus the §5 cells' "As per separate list attached as
# Annexure J" redirect — and we only ever switch pending_pages to the annexure
# when that redirect is present.
ANNEXURE_HEADER_RX = re.compile(
    r"annexure\s*[-:]?\s*[a-z]\s*[-:]?\s*legal\s+cases"
    r"|legal\s+cases\s*[-:]?\s*annexure", re.I)


def _is_criminal_annexure_page(text: str) -> bool:
    return bool(ANNEXURE_HEADER_RX.search(text))


def _row_letters(text: str) -> set[str]:
    return {m.group(1).lower() for m in ROW_LETTER_RX.finditer(text)}


def detect_page_table(text: str) -> dict:
    """Classify whether a page carries case-table content and, if so, its style.

    Returns a dict with:
      has_table         bool   — page contains real case-table content
      is_continuation   bool   — table fragment with rows (d)..(g) but no FIR row
      style             "style_1" | "style_2" | "style_3" | None
      fir_numbers       list[str]  — verbatim FIR/Crime numbers seen on the page
      case_headers      list[int]  — STYLE 3 "Case N" numbers seen on the page
      style2_max        int|None   — STYLE 2: highest number in the top number row
    """
    fir_numbers = []
    for rx in (FIR_QUALIFIED_RX, FIR_BARE_RX):
        for m in rx.finditer(text):
            fir_numbers.append(re.sub(r"\s+", "", m.group(0)))
    fir_numbers = list(dict.fromkeys(fir_numbers))  # dedupe, keep order

    case_headers = sorted({int(m.group(1)) for m in CASE_HEADER_RX.finditer(text)
                           if 1 <= int(m.group(1)) <= 200})

    style2_max = None
    m = TOP_NUMBER_ROW_RX.search(text)
    if m:
        nums = [int(x) for x in re.findall(r"\d+", m.group(0))]
        # only trust it if it's a clean 1..k run
        if nums == list(range(1, len(nums) + 1)) and len(nums) >= 2:
            style2_max = nums[-1]

    letters = _row_letters(text)
    has_ipc = bool(IPC_SECTION_RX.search(text))
    # A populated Style-1/2 table page has several distinct row letters AND
    # either FIR numbers or IPC sections in the same area.
    looks_like_grid = (len(letters) >= 3 and (fir_numbers or has_ipc))
    has_table = bool(fir_numbers or case_headers or style2_max or looks_like_grid)

    # Continuation: lower row-letters present, but no top row (a) FIR-number row.
    is_continuation = (
        has_table
        and not fir_numbers
        and "a" not in letters
        and bool(letters & {"d", "e", "f", "g"})
    )

    if case_headers:
        style = "style_3"
    elif style2_max is not None:
        style = "style_2"
    elif has_table:
        style = "style_1"
    else:
        style = None

    return {
        "has_table": has_table,
        "is_continuation": is_continuation,
        "style": style,
        "fir_numbers": fir_numbers,
        "case_headers": case_headers,
        "style2_max": style2_max,
        "is_annexure": _is_criminal_annexure_page(text),
        "annexure_redirect": _is_annexure_redirect(text),
    }


def detect_markers(text: str) -> dict[str, object]:
    out: dict[str, object] = {}
    for name, rx in ANCHORS.items():
        if name in ("abstract_pending_count", "abstract_conviction_count"):
            m = rx.search(text)
            out[name] = int(m.group(1)) if m else None
        else:
            out[name] = bool(rx.search(text))
    out["table"] = detect_page_table(text)
    return out


def ocr_page(pdf_path: Path, page_num: int) -> str:
    """OCR a single PDF page (1-indexed) via pdf2image + Tesseract."""
    try:
        images = convert_from_path(
            str(pdf_path), first_page=page_num, last_page=page_num, dpi=OCR_DPI
        )
        if not images:
            return ""
        return pytesseract.image_to_string(images[0]) or ""
    except Exception as e:
        print(f"    OCR error on {pdf_path.name} p{page_num}: {e}", file=sys.stderr)
        return ""


def _get_page_count_fallback(pdf_path: Path) -> int:
    """Get page count when pdfplumber can't open the PDF — use poppler's pdfinfo."""
    from pdf2image import pdfinfo_from_path
    try:
        return pdfinfo_from_path(str(pdf_path)).get("Pages", 0)
    except Exception:
        return 0


def get_page_texts(pdf_path: Path) -> tuple[list[str], list[str]]:
    """Return per-page (text, method) for up to the first MAX_SCAN_PAGES pages.

    Tries pdfplumber first, falls back to Tesseract per-page on text-sparse
    pages, and falls back to a full Tesseract-only pipeline when pdfplumber
    can't open the PDF at all (poppler-only PDFs)."""
    texts: list[str] = []
    methods: list[str] = []

    # Pdfplumber-only fallback path: some scanned PDFs return len(pdf.pages)==0
    # but pdfinfo + pdf2image can still process them. Detect this up front so
    # we go straight to Tesseract instead of trying empty page-list access.
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            n_plumber = len(pdf.pages)
    except Exception:
        n_plumber = 0

    if n_plumber == 0:
        n = _get_page_count_fallback(pdf_path)
        max_scan = min(n, MAX_SCAN_PAGES)
        if max_scan == 0:
            return [], []
        try:
            images = convert_from_path(str(pdf_path), first_page=1, last_page=max_scan, dpi=OCR_DPI)
            for img in images:
                texts.append(pytesseract.image_to_string(img) or "")
                methods.append("tesseract")
            for _ in range(max_scan, n):
                texts.append("")
                methods.append("skipped")
        except Exception as e:
            print(f"    Full-OCR fallback error on {pdf_path.name}: {e}", file=sys.stderr)
        return texts, methods

    with pdfplumber.open(str(pdf_path)) as pdf:
        n = n_plumber
        max_scan = min(n, MAX_SCAN_PAGES)

        pages_to_ocr = []

        # First pass: try pdfplumber
        for i in range(max_scan):
            t = ""
            if i < len(pdf.pages):
                t = (pdf.pages[i].extract_text() or "").strip()

            if len(t) >= PDFPLUMBER_MIN_CHARS:
                texts.append(t)
                methods.append("pdfplumber")
            else:
                pages_to_ocr.append(i + 1)
                texts.append("")  # Placeholder
                methods.append("tesseract")

        # Second pass: batch OCR
        if pages_to_ocr:
            try:
                images = convert_from_path(
                    str(pdf_path),
                    first_page=min(pages_to_ocr),
                    last_page=max(pages_to_ocr),
                    dpi=OCR_DPI,
                )
                base = min(pages_to_ocr)
                for page_num in pages_to_ocr:
                    img = images[page_num - base]
                    texts[page_num - 1] = pytesseract.image_to_string(img) or ""
            except Exception as e:
                print(f"    Batch OCR error on {pdf_path.name}: {e}")

        # Fill remaining pages as skipped
        for i in range(max_scan, n):
            texts.append("")
            methods.append("skipped")

    return texts, methods


def _first_page_with(markers_per_page, key, after_page: int = 0):
    """Return the 1-indexed page number of the first page (strictly after
    `after_page`) where markers[key] is truthy. None if no such page."""
    for idx, m in enumerate(markers_per_page):
        page = idx + 1
        if page <= after_page:
            continue
        if m.get(key):
            return page
    return None


def _resolve(markers_per_page, strict_key: str, loose_key: str, after_page: int = 0):
    """Try the strict anchor first, then the loose fallback. Returns
    (page, method) where method is 'header' (strict hit), 'fallback'
    (loose hit), or None (neither)."""
    p = _first_page_with(markers_per_page, strict_key, after_page)
    if p is not None:
        return p, "header"
    p = _first_page_with(markers_per_page, loose_key, after_page)
    if p is not None:
        return p, "fallback"
    return None, None


def _section_pages(markers_per_page, start, end_anchor) -> list[int]:
    """Pages for one section's case table.

    Form-26 puts §6 right after §5's table and §7 right after §6's, so a section
    table is exactly [start .. (next header) − 1] — and because a table can be
    "cut across two pages" (affidavit_cases_styles.pdf) we keep that WHOLE span
    rather than trying to detect where the grid stops mid-OCR-noise. We only
    (a) clamp to the pages we actually scanned, (b) apply a generous sanity cap
    in case the next-header anchor mis-fired far down the document, (c) fall back
    to a small fixed window when there is no next-header anchor at all, and
    (d) gently drop trailing pages that show no table-ish signal whatsoever
    (no FIR/Crime no., no IPC section, no (a)–(g) row letters, no "not
    applicable" filler) — i.e. the "last column ends with Not Applicable on all
    rows" tail described in the styles PDF — never trimming below the header page.
    """
    if start is None:
        return []
    n = len(markers_per_page)
    if end_anchor is not None:
        limit = min(end_anchor - 1, start + SANITY_MAX_SECTION_PAGES - 1)
    else:
        limit = start + NO_END_ANCHOR_WINDOW - 1
    limit = min(limit, n)
    pages = list(range(start, limit + 1))

    def _has_table_signal(page: int) -> bool:
        m = markers_per_page[page - 1]
        tbl = m.get("table") or {}
        if tbl.get("has_table"):
            return True
        txt = m.get("raw_text_lower") or ""
        if "not applicable" in txt or "not appliciable" in txt:
            return True
        return len(_row_letters(txt)) >= 2

    while len(pages) > 1 and not _has_table_signal(pages[-1]):
        pages.pop()
    return pages


def _style_and_hint(markers_per_page, page_list: list[int]) -> tuple[str | None, int | None]:
    """Apply the affidavit_cases_styles.pdf counting rules over `page_list`:
      STYLE 3 → number of distinct "Case N" headers
      STYLE 2 → sum over Style-2 table-pages of that page's highest top-row number
      STYLE 1 → number of distinct FIR/Crime numbers
    Returns (style, case_count_hint). style is the dominant style seen.
    """
    if not page_list:
        return None, None
    case_nums: set[int] = set()
    style2_total = 0
    style2_seen = False
    fir_nums: set[str] = set()
    styles_seen: set[str] = set()
    for page in page_list:
        tbl = markers_per_page[page - 1].get("table") or {}
        if tbl.get("style"):
            styles_seen.add(tbl["style"])
        for c in tbl.get("case_headers") or []:
            case_nums.add(c)
        if tbl.get("style2_max"):
            style2_total += int(tbl["style2_max"])
            style2_seen = True
        for f in tbl.get("fir_numbers") or []:
            fir_nums.add(f)

    if "style_3" in styles_seen and case_nums:
        return "style_3", len(case_nums)
    if "style_2" in styles_seen and style2_seen:
        return "style_2", style2_total
    if styles_seen:
        return "style_1", (len(fir_nums) or None)
    return None, None


def compute_section_ranges(markers_per_page: list[dict]) -> dict:
    """Resolve §5/§6/§7 boundaries (strict-first-then-loose, each constrained to
    pages at-or-after the previous boundary), then build pending/conviction page
    lists from the table content inside those bounds.
    """
    n = len(markers_per_page)

    s5, m5 = _resolve(markers_per_page, "section_5_strict", "section_5_loose", 0)
    s6, m6 = _resolve(
        markers_per_page, "section_6_strict", "section_6_loose",
        after_page=(s5 or 0),
    )
    s7, m7 = _resolve(
        markers_per_page, "section_7_strict", "section_7_loose",
        after_page=(s6 or s5 or 0),
    )

    # Pending table = [§5 .. §6) — or [§5 .. §7) if §6 wasn't found.
    pending_end = s6 if s6 is not None else s7
    pending_pages = _section_pages(markers_per_page, s5, pending_end)
    # Conviction table = [§6 .. §7).
    conviction_pages = _section_pages(markers_per_page, s6, s7)

    # --- annexure fallback -------------------------------------------------
    # When the §5 table is empty and just says "As per separate list attached
    # as Annexure J", the real cases are on the annexure pages. Find the
    # contiguous run of legal-cases-annexure pages (it sits well after §5).
    annexure_pages: list[int] = []
    first_annex = next((i + 1 for i, m in enumerate(markers_per_page)
                        if (m.get("table") or {}).get("is_annexure")), None)
    if first_annex is not None:
        annexure_pages = [first_annex]
        for p in range(first_annex + 1, n + 1):
            tbl = markers_per_page[p - 1].get("table") or {}
            if tbl.get("is_annexure") or tbl.get("has_table"):
                annexure_pages.append(p)
            else:
                break
        annexure_pages = annexure_pages[:SANITY_MAX_SECTION_PAGES]
    # Only redirect to the annexure when the §5 table literally says so (or §5
    # was never found) — never just because §5's OCR came back FIR-less.
    pending_redirects = any((markers_per_page[p - 1].get("table") or {}).get("annexure_redirect")
                            for p in pending_pages)
    used_annexure = bool(annexure_pages) and (pending_redirects or not pending_pages)
    if used_annexure:
        pending_pages = annexure_pages

    # The candidate's own stated totals (first occurrence wins).
    abstract_pending = next(
        (m["abstract_pending_count"] for m in markers_per_page
         if m.get("abstract_pending_count") is not None), None)
    abstract_conviction = next(
        (m["abstract_conviction_count"] for m in markers_per_page
         if m.get("abstract_conviction_count") is not None), None)

    # If the candidate explicitly states zero pending / zero conviction cases,
    # honour that — the "Not Applicable" filled table carries no real rows.
    if abstract_pending == 0:
        pending_pages = []
    if abstract_conviction == 0:
        conviction_pages = []

    pending_style, pending_hint = _style_and_hint(markers_per_page, pending_pages)
    conviction_style, conviction_hint = _style_and_hint(markers_per_page, conviction_pages)

    return {
        "pending_pages": pending_pages,
        "conviction_pages": conviction_pages,
        "header_pages": {
            "section_5": s5,
            "section_6": s6,
            "section_7": s7,
            "pending_trigger":    _first_page_with(markers_per_page, "pending_trigger"),
            "conviction_trigger": _first_page_with(markers_per_page, "conviction_trigger"),
        },
        "anchoring_method": {"section_5": m5, "section_6": m6, "section_7": m7},
        "abstract_pending_count": abstract_pending,
        "abstract_conviction_count": abstract_conviction,
        "pending_table_style": pending_style,
        "conviction_table_style": conviction_style,
        "pending_case_count_hint": pending_hint,
        "conviction_case_count_hint": conviction_hint,
        "annexure_pages": annexure_pages,
        "pending_from_annexure": used_annexure,
    }


def derive_status(section_5_found, section_6_found) -> str:
    if section_5_found or section_6_found:
        return "ok"
    return "headers_missed"


def _pdf_sha1(pdf_path: Path) -> str:
    h = hashlib.sha1()
    with open(pdf_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def scan_pdf(pdf_path_str: str) -> tuple[str, dict]:
    """Worker entry point — must be picklable for ProcessPoolExecutor."""
    pdf_path = Path(pdf_path_str)
    safe_name = pdf_path.stem
    started = time.time()
    try:
        sha1 = _pdf_sha1(pdf_path)
        texts, methods = get_page_texts(pdf_path)
        markers_per_page = []
        for t in texts:
            m = detect_markers(t)
            m["raw_text_lower"] = t.lower()
            markers_per_page.append(m)

        sm = compute_section_ranges(markers_per_page)

        if not methods:
            extraction_method = "empty"
        elif all(m == "pdfplumber" for m in methods):
            extraction_method = "pdfplumber"
        elif all(m == "tesseract" for m in methods):
            extraction_method = "tesseract"
        else:
            extraction_method = "mixed"

        s5 = sm["header_pages"]["section_5"]
        s6 = sm["header_pages"]["section_6"]

        result = {
            "pdf": pdf_path.name,
            "pdf_sha1": sha1,
            "total_pages": len(texts),
            "extraction_method": extraction_method,
            "pending_pages": sm["pending_pages"],
            "conviction_pages": sm["conviction_pages"],
            "section_5_header_page":   s5,
            "section_6_header_page":   s6,
            "section_7_header_page":   sm["header_pages"]["section_7"],
            "pending_trigger_page":    sm["header_pages"]["pending_trigger"],
            "conviction_trigger_page": sm["header_pages"]["conviction_trigger"],
            "anchoring_method":        sm["anchoring_method"],
            "abstract_pending_count":     sm["abstract_pending_count"],
            "abstract_conviction_count":  sm["abstract_conviction_count"],
            "pending_table_style":        sm["pending_table_style"],
            "conviction_table_style":     sm["conviction_table_style"],
            "pending_case_count_hint":    sm["pending_case_count_hint"],
            "conviction_case_count_hint": sm["conviction_case_count_hint"],
            "annexure_pages":             sm["annexure_pages"],
            "pending_from_annexure":      sm["pending_from_annexure"],
            "status": derive_status(s5 is not None, s6 is not None),
            "scan_seconds": round(time.time() - started, 1),
        }
        return safe_name, result
    except Exception as e:
        return safe_name, {
            "pdf": pdf_path.name,
            "status": "error",
            "error": f"{type(e).__name__}: {e}",
            "scan_seconds": round(time.time() - started, 1),
        }


def load_existing_index() -> dict:
    if OUTPUT_JSON.exists():
        try:
            with open(OUTPUT_JSON, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"candidates": {}}


def write_index(index: dict) -> None:
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    index["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    index["total_pdfs"] = len(index.get("candidates", {}))
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)


def print_summary(index: dict) -> None:
    candidates = index.get("candidates", {})
    counts: dict[str, int] = {}
    method_counts = {"pdfplumber": 0, "tesseract": 0, "mixed": 0}
    style_counts: dict[str, int] = {}
    for entry in candidates.values():
        st = entry.get("status", "error")
        counts[st] = counts.get(st, 0) + 1
        m = entry.get("extraction_method")
        if m in method_counts:
            method_counts[m] += 1
        ps = entry.get("pending_table_style")
        if ps:
            style_counts[ps] = style_counts.get(ps, 0) + 1
    fallback_5 = fallback_6 = fallback_7 = 0
    for entry in candidates.values():
        am = entry.get("anchoring_method") or {}
        if am.get("section_5") == "fallback": fallback_5 += 1
        if am.get("section_6") == "fallback": fallback_6 += 1
        if am.get("section_7") == "fallback": fallback_7 += 1

    print("\n=== Summary ===")
    print(f"  Total indexed:       {len(candidates)}")
    for st in ("ok", "headers_missed", "error"):
        print(f"  {st:<20} {counts.get(st, 0)}")
    print(f"  pdfplumber-only:     {method_counts['pdfplumber']}")
    print(f"  tesseract-only:      {method_counts['tesseract']}")
    print(f"  mixed:               {method_counts['mixed']}")
    print(f"  §5 via fallback:     {fallback_5}")
    print(f"  §6 via fallback:     {fallback_6}")
    print(f"  §7 via fallback:     {fallback_7}")
    print(f"  pending table styles: {style_counts}")
    print(f"  Output:              {OUTPUT_JSON}")


def parse_args():
    p = argparse.ArgumentParser(description="Build per-candidate criminal-pages index.")
    p.add_argument("--force", action="store_true",
                   help="Re-scan even PDFs already present in the index.")
    p.add_argument("--only", type=str, default=None,
                   help="Scan only this candidate stem (no .pdf), e.g. chintamaneni_prabhakar.")
    p.add_argument("--limit", type=int, default=None,
                   help="Scan at most N PDFs (after filtering).")
    p.add_argument("--workers", type=int, default=4,
                   help="Parallel worker processes (default 4). Use 1 to debug.")
    return p.parse_args()


def main():
    args = parse_args()

    if not AFFIDAVITS_DIR.exists():
        print(f"❌ Affidavits dir not found: {AFFIDAVITS_DIR}", file=sys.stderr)
        sys.exit(1)

    all_pdfs = sorted(AFFIDAVITS_DIR.glob("*.pdf"))
    if args.only:
        all_pdfs = [p for p in all_pdfs if p.stem == args.only]
        if not all_pdfs:
            print(f"❌ No PDF matched --only={args.only}", file=sys.stderr)
            sys.exit(1)

    index = load_existing_index()
    candidates = index.setdefault("candidates", {})

    if args.force:
        to_scan = all_pdfs
    else:
        to_scan = [p for p in all_pdfs if p.stem not in candidates]

    if args.limit is not None:
        to_scan = to_scan[: args.limit]

    print(f"PDFs total:        {len(all_pdfs)}")
    print(f"Already indexed:   {len(candidates)}")
    print(f"To scan this run:  {len(to_scan)}  (workers={args.workers})")

    if not to_scan:
        print("Nothing to do.")
        print_summary(index)
        return

    started = time.time()
    completed = 0
    pending_paths = [str(p) for p in to_scan]

    def _report(name, result):
        print(f"  [{completed}/{len(pending_paths)}] {name}: "
              f"{result.get('status')} "
              f"(P={len(result.get('pending_pages', []))}"
              f"{'/' + str(result['pending_case_count_hint']) if result.get('pending_case_count_hint') else ''}, "
              f"C={len(result.get('conviction_pages', []))}, "
              f"{result.get('pending_table_style') or '-'}, "
              f"{result.get('extraction_method', '?')}, "
              f"{result.get('scan_seconds', '?')}s)")

    if args.workers <= 1:
        for path in pending_paths:
            name, result = scan_pdf(path)
            candidates[name] = result
            completed += 1
            _report(name, result)
            if completed % 10 == 0:
                write_index(index)
    else:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(scan_pdf, p): p for p in pending_paths}
            for fut in as_completed(futures):
                name, result = fut.result()
                candidates[name] = result
                completed += 1
                _report(name, result)
                if completed % 10 == 0:
                    write_index(index)

    write_index(index)
    elapsed = time.time() - started
    print(f"\nElapsed: {elapsed/60:.1f} min")
    print_summary(index)


if __name__ == "__main__":
    main()
