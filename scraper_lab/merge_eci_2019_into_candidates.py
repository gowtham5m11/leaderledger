"""Merge 2019 ECI results into candidates.json as `previous_mla`.

Each candidate already has `election_result.eci_constituency_no` from the
2024 merge, so we join on that number (delimitation is unchanged between
2019 and 2024 — same 175 ACs, same numbering). No name-stem matching
needed.

Adds:
    previous_mla: {
        "name":  "Ashok Bendalam",        # title-cased
        "party": "TDP",                   # short code
        "party_full": "Telugu Desam",     # ECI's full string (for tooltip / debug)
        "year":  2019,
        "votes": 79992,
        "margin": 7145,
        "runner_up": {
            "name":       "Piriya Sairaj",
            "party":      "YSRCP",
            "party_full": "Yuvajana Sramika Rythu Congress Party",
            "votes":      72847,
        },
        "source": "ECI 2019 results (via Wayback)",
        "source_url": "...",
    }

Run:
    .venv/bin/python scraper_lab/merge_eci_2019_into_candidates.py
    .venv/bin/python scraper_lab/merge_eci_2019_into_candidates.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path


HERE = Path(__file__).parent
CANDIDATES_PATH = HERE.parent / "src" / "data" / "candidates.json"
ECI_2019_PATH = HERE / "eci_results_2019.json"


# ECI's verbose party strings → the short codes used elsewhere in candidates.json
PARTY_SHORT = {
    "Telugu Desam": "TDP",
    "Yuvajana Sramika Rythu Congress Party": "YSRCP",
    "Janasena Party": "Janasena Party",  # kept verbatim (matches candidates.json)
    "Bharatiya Janata Party": "BJP",
    "Indian National Congress": "INC",
    "Bahujan Samaj Party": "BSP",
    "Communist Party of India": "CPI",
    "Communist Party of India  (Marxist)": "CPI(M)",
    "Independent": "IND",
}


def title_case(name: str) -> str:
    """Convert 'ASHOK BENDALAM' → 'Ashok Bendalam'; leave 'Nara Chandra Babu Naidu' alone."""
    if not name:
        return name
    # Preserve common initials like "Y.S." / "K.E."
    parts = re.split(r"(\s+)", name.strip())
    out = []
    for p in parts:
        if p.isspace():
            out.append(p)
            continue
        # Keep tokens that already look mixed-case (have lowercase letters)
        if any(ch.islower() for ch in p):
            out.append(p)
            continue
        # Title-case all-caps tokens, preserving dotted initials
        if "." in p and len(p) <= 4:
            out.append(p.upper())
        else:
            out.append(p.capitalize())
    return "".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    candidates = json.loads(CANDIDATES_PATH.read_text())
    eci_2019 = json.loads(ECI_2019_PATH.read_text())
    by_no = {r["constituency_no"]: r for r in eci_2019}

    matched = 0
    missing_no: list[dict] = []
    missing_2019: list[dict] = []
    repeated_winner = 0  # candidate-name matches the 2019 winner (re-elected MLA)

    for c in candidates:
        er = c.get("election_result") or {}
        eci_no = er.get("eci_constituency_no")
        if not eci_no:
            missing_no.append(c)
            continue
        row_2019 = by_no.get(eci_no)
        if not row_2019:
            missing_2019.append(c)
            continue

        w = row_2019["winner"]
        ru = row_2019["runner_up"]
        party_short = PARTY_SHORT.get(w["party"], w["party"])
        ru_party_short = PARTY_SHORT.get(ru["party"], ru["party"])
        c["previous_mla"] = {
            "name": title_case(w["name"]),
            "party": party_short,
            "party_full": w["party"],
            "year": 2019,
            "votes": w["total_votes"],
            "margin": row_2019["margin"],
            "runner_up": {
                "name": title_case(ru["name"]),
                "party": ru_party_short,
                "party_full": ru["party"],
                "votes": ru["total_votes"],
            },
            "source": "ECI 2019 results (via Wayback snapshot 2019-05-26..29)",
            "source_url": row_2019["source_url"],
        }
        matched += 1

        # Track candidates re-elected from 2019 to 2024 (informational)
        if title_case(w["name"]).split()[0].lower() in c["name"].lower() and \
           title_case(w["name"]).split()[-1].lower() in c["name"].lower():
            repeated_winner += 1

    print(f"matched: {matched}/{len(candidates)} candidates")
    print(f"  re-elected (2019→2024, name overlap): {repeated_winner}")
    if missing_no:
        print(f"  no eci_constituency_no ({len(missing_no)}): "
              f"{[c['constituency'] for c in missing_no[:5]]}")
    if missing_2019:
        print(f"  no 2019 row found ({len(missing_2019)}): "
              f"{[(c['constituency'], c['election_result']['eci_constituency_no']) for c in missing_2019[:5]]}")

    if matched != len(candidates):
        print("\nrefusing to write candidates.json with unmatched candidates.")
        return 2

    if args.dry_run:
        print("\n--dry-run: candidates.json NOT modified.")
        return 0

    ts = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup = CANDIDATES_PATH.with_suffix(f".json.bak_pre_2019_merge_{ts}")
    shutil.copy2(CANDIDATES_PATH, backup)
    CANDIDATES_PATH.write_text(json.dumps(candidates, indent=2, ensure_ascii=False) + "\n")
    print(f"\nbackup: {backup.name}")
    print(f"wrote:  {CANDIDATES_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
