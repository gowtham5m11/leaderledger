"""
Extract educational qualification and PAN number from 2019 AP assembly affidavit PDFs.

Each affidavit is a scanned Form 26.  Two fields are extracted per candidate:

  education  — from Part A section (10) "My educational qualification is as under"
  pan_number — from Part A section 4 "Permanent Account Number" (candidate / Self row)

Results are written back into public/data/eci_results_2019.json under
winner["education"] and winner["pan_number"].

The script skips candidates whose PDF is missing (3 gaps: cno 19, 32, 46).

Run:
    .venv/bin/python scraper_lab/extract_2019_edu_pan.py
    .venv/bin/python scraper_lab/extract_2019_edu_pan.py --resume
    .venv/bin/python scraper_lab/extract_2019_edu_pan.py --only 1,5,10
    .venv/bin/python scraper_lab/extract_2019_edu_pan.py --workers 1
"""
from __future__ import annotations

import argparse
import gc
import json
import os
import re
import sys
import tempfile
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
import pytesseract
from pdf2image import convert_from_path
from PIL import ImageFile
import ollama

ImageFile.LOAD_TRUNCATED_IMAGES = True

PROJECT_ROOT = Path(__file__).parent.parent
PDF_DIR = PROJECT_ROOT / "scraper_lab" / "affidavits_historical" / "2019"
RESULTS_JSON = PROJECT_ROOT / "public" / "data" / "eci_results_2019.json"

OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
OCR_DPI = 200
PDFPLUMBER_MIN_CHARS = 50
KEEP_ALIVE = "30m"

# Source stamp written to results (lets --resume detect already-done entries)
EXTRACT_STAMP = "edu_pan_v1"

# Regex anchors for Form 26 sections
_FORM26_RE = re.compile(r"FORM\s*2\s*6|FORM26", re.I)
_PAN_RE = re.compile(r"Permanent\s+Account\s+Number|PAN\s*\(|PAN\)?\s+and\s+status", re.I)
_EDU_RE = re.compile(r"educational\s+qualif|My\s+educational|10\s*\)|^\s*\(10\)\s", re.I | re.M)
_PARTB_RE = re.compile(r"PART\s*[\-–]?\s*B\b|ABSTRACT\s+OF\s+THE\s+DETAILS", re.I)


def _get_client():
    for host in ["http://127.0.0.1:11434", "http://localhost:11434"]:
        try:
            c = ollama.Client(host=host, timeout=120)
            c.list()
            return c
        except Exception:
            pass
    return ollama.Client(timeout=120)


def _call_llm(client, prompt: str) -> str:
    try:
        resp = client.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0, "seed": 42},
            keep_alive=KEEP_ALIVE,
        )
        return resp["message"]["content"]
    except Exception as e:
        print(f"    LLM error: {type(e).__name__}: {e}", flush=True)
        return ""


_PAN_PROMPT = """\
You are extracting a PAN number from Indian election affidavit text (Form 26, Section 4).
Section 4 contains a table with columns: S.No | Names | Permanent Account Number (PAN) | Financial year | Total income.
Row 1 (labelled "Self" or "1" or the candidate's name) contains the candidate's own PAN.

Extract only the candidate's own PAN (row 1 / Self row).
A PAN is exactly 10 characters: 5 uppercase letters, 4 digits, 1 uppercase letter (e.g. ABCDE1234F).

Return ONLY a JSON object with one key:
{{"pan_number": "XXXXX1234X"}}

If no valid PAN is found for the candidate, or PAN is NIL / "No PAN allotted", return:
{{"pan_number": null}}

Text:
{text}
"""

_EDU_PROMPT = """\
You are extracting educational qualifications from Indian election affidavit text (Form 26, Section 10).
Section 10 says "My educational qualification is as under:" followed by the candidate's stated qualification.

Extract the candidate's highest educational qualification as a short string.
Examples: "MBBS from Andhra University (1985)", "B.Sc", "10th Standard", "SSC", "Graduate", "Illiterate", "Post Graduate"

Return ONLY a JSON object with one key:
{{"education": "degree details here"}}

If education details are completely unreadable or absent, return:
{{"education": null}}

Text:
{text}
"""


def _ocr_page(pdf_path: str, page_num: int) -> str:
    """Return OCR text for one page. Falls back to pdfplumber if extractable."""
    with pdfplumber.open(pdf_path) as pdf:
        pg = pdf.pages[page_num - 1]
        txt = pg.extract_text() or ""
    if len(txt.strip()) >= PDFPLUMBER_MIN_CHARS:
        return txt
    imgs = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=OCR_DPI)
    if not imgs:
        return ""
    tmp = os.path.join(tempfile.gettempdir(), f"edu_pan_p{page_num}_{os.getpid()}.png")
    try:
        imgs[0].save(tmp, "PNG")
        return pytesseract.image_to_string(tmp) or ""
    except Exception:
        return ""
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def _safe_name(s: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in s).lower()


def _slugify(s: str) -> str:
    s = re.sub(r"[^\w\s]", "", s.lower())
    return re.sub(r"\s+", "_", s).strip("_")


def _parse_llm_json(raw: str, key: str):
    """Extract the first JSON object from LLM output and return value for key."""
    m = re.search(r"\{[^{}]+\}", raw, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group())
        return obj.get(key)
    except json.JSONDecodeError:
        return None


def extract_candidate(pdf_path: str) -> dict:
    """Scan a Form 26 PDF and return {"education": ..., "pan_number": ...}."""
    client = _get_client()
    path = Path(pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)

    pan_context: list[str] = []
    edu_context: list[str] = []

    pan_found = False
    edu_found = False
    form26_started = False

    for pg in range(1, total_pages + 1):
        text = _ocr_page(pdf_path, pg)

        if not form26_started and _FORM26_RE.search(text):
            form26_started = True

        if not form26_started:
            continue

        if not pan_found and _PAN_RE.search(text):
            pan_found = True
            pan_context.append(text)
            # grab next page too — table may spill
            if pg + 1 <= total_pages:
                pan_context.append(_ocr_page(pdf_path, pg + 1))

        if not edu_found and _EDU_RE.search(text):
            edu_found = True
            edu_context.append(text)
            if pg + 1 <= total_pages and not _PARTB_RE.search(text):
                edu_context.append(_ocr_page(pdf_path, pg + 1))

        if pan_found and edu_found:
            break

    # LLM extraction
    pan_number = None
    if pan_context:
        raw = _call_llm(client, _PAN_PROMPT.format(text="\n\n".join(pan_context)[:3000]))
        pan_number = _parse_llm_json(raw, "pan_number")

    education = None
    if edu_context:
        raw = _call_llm(client, _EDU_PROMPT.format(text="\n\n".join(edu_context)[:3000]))
        education = _parse_llm_json(raw, "education")

    gc.collect()

    return {
        "pan_number": pan_number,
        "education": education,
        "edu_pan_source": EXTRACT_STAMP,
        "edu_pan_extracted_at": datetime.now(timezone.utc).isoformat(),
        "pan_found_in_pdf": pan_found,
        "edu_found_in_pdf": edu_found,
    }


def _atomic_write(path: Path, data) -> None:
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def _process_one(args: tuple) -> tuple:
    """Worker entry point — returns (cno, result_dict | None, status_str)."""
    cno, pdf_path, name = args
    try:
        result = extract_candidate(pdf_path)
        return cno, result, "ok"
    except Exception as e:
        return cno, None, f"{type(e).__name__}: {e}"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--resume", action="store_true",
                    help="Skip candidates that already have edu_pan_source set.")
    ap.add_argument("--only", default="",
                    help="Comma-separated constituency numbers to process.")
    ap.add_argument("--workers", type=int, default=2,
                    help="Parallel worker processes (default 2; use 1 if Ollama is memory-constrained).")
    ap.add_argument("--model", default=None,
                    help="Ollama model (default gemma3:4b).")
    args = ap.parse_args()

    global OLLAMA_MODEL
    if args.model:
        OLLAMA_MODEL = args.model
        os.environ["OLLAMA_MODEL"] = args.model

    # Verify Ollama is up
    try:
        _get_client().list()
        print("✅ Ollama running.", flush=True)
    except Exception as e:
        print(f"❌ Ollama not reachable: {e}", flush=True)
        sys.exit(1)

    results = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))

    only = {int(x) for x in args.only.split(",") if x.strip()}

    work: list[tuple] = []
    for c in sorted(results, key=lambda x: x["constituency_no"]):
        cno = c["constituency_no"]
        if only and cno not in only:
            continue
        winner = c["winner"]
        if args.resume and winner.get("edu_pan_source") == EXTRACT_STAMP:
            continue

        # Build expected PDF filename from constituency_no, constituency_name, winner name
        pdf_name = f"{cno:03d}_{_slugify(c['constituency_name'])}_{_slugify(winner['name'])}.pdf"
        pdf_path = PDF_DIR / pdf_name
        if not pdf_path.exists():
            # fallback: glob by constituency number prefix
            matches = sorted(PDF_DIR.glob(f"{cno:03d}_*.pdf"))
            if not matches:
                print(f"  [{cno}] no PDF found — skipping", flush=True)
                continue
            pdf_path = matches[0]

        work.append((cno, str(pdf_path), winner["name"]))

    if not work:
        print("Nothing to process.", flush=True)
        return

    print(f"Processing {len(work)} candidates with {args.workers} worker(s)…", flush=True)

    done = 0
    failed = 0

    def _commit(cno: int, result: dict) -> None:
        nonlocal results
        data = json.loads(RESULTS_JSON.read_text(encoding="utf-8"))
        for c in data:
            if c["constituency_no"] == cno:
                c["winner"].update(result)
                break
        _atomic_write(RESULTS_JSON, data)
        results = data

    if args.workers <= 1:
        for cno, pdf_path, name in work:
            print(f"[{cno}] {name} …", flush=True)
            t0 = time.time()
            cno_ret, result, status = _process_one((cno, pdf_path, name))
            elapsed = round(time.time() - t0, 1)
            if result:
                _commit(cno_ret, result)
                done += 1
                print(f"  ✓ PAN={result.get('pan_number')} edu={result.get('education')!r} ({elapsed}s)", flush=True)
            else:
                failed += 1
                print(f"  ✗ {status} ({elapsed}s)", flush=True)
    else:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(_process_one, item): item for item in work}
            for future in as_completed(futures):
                cno, pdf_path, name = futures[future]
                try:
                    cno_ret, result, status = future.result()
                except Exception as e:
                    print(f"  [{cno}] worker exception: {e}", flush=True)
                    failed += 1
                    continue

                if result:
                    _commit(cno_ret, result)
                    done += 1
                    print(f"  [{cno}] {name}: PAN={result.get('pan_number')} "
                          f"edu={result.get('education')!r}", flush=True)
                else:
                    failed += 1
                    print(f"  [{cno}] {name}: FAILED — {status}", flush=True)

    print(f"\n=== Done: {done} extracted, {failed} failed ===", flush=True)


if __name__ == "__main__":
    main()
