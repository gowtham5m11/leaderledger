"""
Audit downloaded historical affidavit PDFs against expected candidate names.

Reads scraper_lab/affidavits_historical/{year}/, extracts the constituency
number from each filename, looks up the expected winner from eci_results_{year}.json,
and verifies the PDF belongs to that person using text extraction + OCR.

Usage:
    .venv/bin/python scraper_lab/audit_historical_affidavits.py --year 2019
    .venv/bin/python scraper_lab/audit_historical_affidavits.py --year 2019 --only 1,5,10
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

from audit_pdfs import check_pdf

SCRAPER_DIR = Path(__file__).parent
PROJECT_ROOT = SCRAPER_DIR.parent


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def parse_cno(filename: str) -> int | None:
    m = re.match(r"^(\d+)_", filename)
    return int(m.group(1)) if m else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--year", type=int, required=True,
                    help="Election year (e.g. 2019)")
    ap.add_argument("--only", default="",
                    help="Comma-separated constituency numbers to check")
    args = ap.parse_args()

    year = args.year
    only = {int(x) for x in args.only.split(",") if x.strip()}

    results_path = PROJECT_ROOT / "public" / "data" / f"eci_results_{year}.json"
    if not results_path.exists():
        print(f"Results file not found: {results_path}")
        return

    data = json.loads(results_path.read_text())
    lookup: dict[int, dict] = {
        c["constituency_no"]: {
            "name": c["winner"]["name"],
            "party": c["winner"].get("party", ""),
            "constituency": c["constituency_name"],
        }
        for c in data
    }

    pdf_dir = SCRAPER_DIR / "affidavits_historical" / str(year)
    if not pdf_dir.exists():
        print(f"No download directory found: {pdf_dir}")
        print(f"Run: .venv/bin/python scraper_lab/fetch_history_affidavits.py --year {year}")
        return

    # Map constituency_no → PDF path
    pdfs: dict[int, Path] = {}
    for p in sorted(pdf_dir.glob("*.pdf")):
        cno = parse_cno(p.name)
        if cno is not None:
            pdfs[cno] = p

    to_check = sorted(only if only else lookup.keys())

    ok = wrong = unreadable = missing = 0
    wrong_list: list[tuple[int, str, str, str]] = []

    print(f"\nYear {year} — {pdf_dir}")
    print(f"{'─' * 65}")

    for cno in to_check:
        info = lookup.get(cno)
        if not info:
            continue

        name = info["name"]
        pdf = pdfs.get(cno)

        if not pdf:
            print(f"  [{cno:3d}] 📭 MISSING     {name}")
            missing += 1
            continue

        is_match, msg = check_pdf(str(pdf), name)

        if "ocrmac not available" in msg:
            # ocrmac absent — fall back to pdfplumber text-only check
            is_match, msg = _text_only_check(str(pdf), name)

        if is_match:
            print(f"  [{cno:3d}] ✅ OK          {name}")
            ok += 1
        elif "Unknown" in msg or "Unreadable" in msg or "Error" in msg:
            print(f"  [{cno:3d}] ⚠️  UNREADABLE  {name}  ({msg})")
            unreadable += 1
        else:
            print(f"  [{cno:3d}] ❌ WRONG       {name}")
            print(f"            └─ {msg}")
            wrong += 1
            wrong_list.append((cno, name, pdf.name, msg))

    total = ok + wrong + unreadable + missing
    print(f"\n{'─' * 65}")
    print(f"Checked   : {total}")
    print(f"  ✅ OK        : {ok}")
    print(f"  ❌ Wrong PDF : {wrong}")
    print(f"  ⚠️  Unreadable: {unreadable}")
    print(f"  📭 Missing   : {missing}")

    if wrong_list:
        print(f"\nRe-download wrong PDFs with:")
        cnos = ",".join(str(c) for c, *_ in wrong_list)
        print(f"  .venv/bin/python scraper_lab/fix_faulty_affidavits.py --year {year} --only {cnos}")
        print()
        for cno, name, fname, _ in wrong_list:
            print(f"  [{cno:3d}] {name}  ({fname})")


def _text_only_check(pdf_path: str, expected_name: str) -> tuple[bool, str]:
    """Fallback when ocrmac is unavailable: pdfplumber text extraction only."""
    import pdfplumber

    def clean(s: str) -> str:
        s = re.sub(r"\(.*?\)", "", s)
        s = re.sub(r"\b(sri|smt|dr|mr|mrs|shri|kumari|alias|advocate|er|engr)\b", "", s, flags=re.I)
        return re.sub(r"[^a-z\s]", "", s.lower())

    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = ""
            for page in pdf.pages[:3]:
                t = page.extract_text() or ""
                text += " " + t
    except Exception as exc:
        return False, f"Error: {exc}"

    if not text.strip():
        return False, "Unreadable (no extractable text)"

    cleaned_text = clean(text)
    expected_parts = {w for w in clean(expected_name).split() if len(w) >= 3}
    matched = [p for p in expected_parts if p in cleaned_text]

    if len(matched) >= 2 or (len(matched) == 1 and len(matched[0]) > 5):
        return True, f"Text match: {', '.join(matched)}"
    return False, f"Unknown / Unreadable (matched {len(matched)}/{len(expected_parts)} name parts)"


if __name__ == "__main__":
    main()
