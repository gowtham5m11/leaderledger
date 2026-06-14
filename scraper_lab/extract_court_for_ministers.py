"""Court-only backfill for ministers.

Re-extracts criminal-case details with the v4 prompt (which captures the court /
Case No. from row (b) of the Form-26 table) and merges ONLY the `court` field
into the existing cases, matched by FIR signature. Existing fir_no / sections /
description / category / counts are NEVER touched — so this cannot regress the
already-curated data (see memory: criminal_extractor_nondeterminism). The court
VALUES still come from the shuffle-prone model, so they are tagged with
`court_source` for later spot-audit, and high-case-count ministers should be
eyeballed (see memory: criminal_extractor_column_shuffle).

Usage:
    python3 extract_court_for_ministers.py --dry-run            # report only
    python3 extract_court_for_ministers.py --only kandula_durgesh
    python3 extract_court_for_ministers.py --limit 3
    python3 extract_court_for_ministers.py                      # full run, writes
"""
import os
import sys
import json
import argparse
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_PROJECT_ROOT = _HERE.parent
for p in (str(_HERE), str(_PROJECT_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from detailed_criminal_history import (
    extract_criminal_details, _safe_name, PDF_DIR, load_pages_index,
    _atomic_write_json,
)
from criminal_module import _case_signature, PROMPT_VERSION

CANDIDATES_JSON = _PROJECT_ROOT / "src" / "data" / "candidates.json"
COURT_SOURCE = f"OCR+LLM:gemma3:4b/{PROMPT_VERSION}"

_INVALID_COURT = {"", "NA", "N/A", "NIL", "-", "--", "NONE"}


def _valid_court(val):
    if not val:
        return False
    s = str(val).strip()
    return s.upper() not in _INVALID_COURT and not s.upper().startswith("NOT APPLICABLE")


def _int_or_none(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def process(cand, dry_run):
    """Return a one-line report dict; mutate cand['criminal_details_*'] in place (court only)."""
    safe = _safe_name(cand["name"])
    pdf_path = PDF_DIR / f"{safe}.pdf"
    if not pdf_path.exists():
        return {"name": cand["name"], "status": "no_pdf", "filled": 0}

    declared_total = _int_or_none(cand.get("criminal_cases"))
    fresh = extract_criminal_details(str(pdf_path), cand["id"], declared_total)

    # Build FIR-signature -> court from freshly extracted cases (both buckets).
    sig_to_court = {}
    for bucket in ("pending", "convictions"):
        for fc in fresh.get(bucket, []):
            court = fc.get("court")
            if not _valid_court(court):
                continue
            sig = _case_signature(fc)
            if sig and sig not in sig_to_court:
                sig_to_court[sig] = str(court).strip()

    filled = 0
    already = 0
    unmatched = 0
    fills = []
    existing_cases = (cand.get("criminal_details_pending") or []) + \
                     (cand.get("criminal_details_convictions") or [])
    for ec in existing_cases:
        if _valid_court(ec.get("court")):
            already += 1
            continue
        sig = _case_signature(ec)
        court = sig_to_court.get(sig)
        if court:
            ec["court"] = court
            ec["court_source"] = COURT_SOURCE
            filled += 1
            fills.append((ec.get("fir_no", "?"), court))
        else:
            unmatched += 1

    for fir, court in fills:
        print(f"      • {fir}  →  {court[:90]}")

    return {
        "name": cand["name"],
        "status": "ok",
        "cases": len(existing_cases),
        "fresh_courts": len(sig_to_court),
        "filled": filled,
        "already": already,
        "no_court_match": unmatched,
    }


def main():
    ap = argparse.ArgumentParser(description="Court-only backfill for ministers.")
    ap.add_argument("--only", help="Process only this candidate safe_name (e.g. kandula_durgesh).")
    ap.add_argument("--limit", type=int, help="Process at most N ministers.")
    ap.add_argument("--dry-run", action="store_true", help="Report only; do not write candidates.json.")
    args = ap.parse_args()

    with open(CANDIDATES_JSON, encoding="utf-8") as f:
        data = json.load(f)

    index = load_pages_index().get("candidates", {})

    targets = []
    for c in data:
        if not c.get("role"):
            continue
        if _int_or_none(c.get("criminal_cases")) in (None, 0):
            continue
        safe = _safe_name(c["name"])
        if args.only and safe != args.only:
            continue
        if safe not in index:
            print(f"  ⏭️  {c['name']}: not in page index — skipping (no affidavit).")
            continue
        targets.append(c)

    if args.limit:
        targets = targets[: args.limit]

    if not targets:
        print("No matching ministers to process.")
        return

    print(f"🚀 Court backfill for {len(targets)} minister(s). dry_run={args.dry_run}\n")

    reports = []
    for i, cand in enumerate(targets, 1):
        print(f"[{i}/{len(targets)}] {cand['name']}")
        rep = process(cand, args.dry_run)
        reports.append(rep)
        print(f"    → filled {rep.get('filled', 0)} | already {rep.get('already', 0)} "
              f"| no match {rep.get('no_court_match', 0)} | of {rep.get('cases', 0)} cases\n", flush=True)

    total_filled = sum(r.get("filled", 0) for r in reports)
    if not args.dry_run and total_filled > 0:
        _atomic_write_json(CANDIDATES_JSON, data)
        print(f"💾 Wrote {total_filled} court field(s) to candidates.json")
    elif args.dry_run:
        print(f"🔍 DRY RUN — would have filled {total_filled} court field(s); no file written.")
    else:
        print("Nothing to write (0 courts filled).")

    print("\n=== SUMMARY ===")
    for r in reports:
        if r["status"] != "ok":
            print(f"  {r['name']}: {r['status']}")
        else:
            print(f"  {r['name']}: {r['filled']}/{r['cases']} filled "
                  f"(already {r['already']}, no-match {r['no_court_match']})")


if __name__ == "__main__":
    main()
