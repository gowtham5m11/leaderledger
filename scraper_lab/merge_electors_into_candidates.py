"""Merge registered-electors + turnout into candidates.json's `election_result`.

Strict, no-estimates pipeline:

- For ACs where Wikipedia carries a 2024 "Registered electors" row
  (see `fetch_wikipedia_electors.py`, ~21/175), use that and compute
  turnout_percent from our existing ECI total_votes_polled.
- For the rest, fall back to TCPD's 2019 electors (Andhra_Pradesh_AE.csv.gz,
  staged at scraper_lab/tcpd_ap_ae.csv.gz; 100% AP coverage in 2019).
  Turnout is intentionally left null — mixing 2024 polled with 2019 electors
  would produce a derived percentage that misrepresents reality.

Adds to each candidate's `election_result`:

    total_electors:         int                 # always populated
    total_electors_year:    2024 | 2019         # year the electors number refers to
    total_electors_source:  "wikipedia_2024" | "tcpd_2019"
    turnout_percent:        float | null        # only populated when year==2024

Run:
    .venv/bin/python scraper_lab/merge_electors_into_candidates.py
    .venv/bin/python scraper_lab/merge_electors_into_candidates.py --dry-run
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path


HERE = Path(__file__).parent
CANDIDATES_PATH = HERE.parent / "src" / "data" / "candidates.json"
WIKI_PATH = HERE / "wikipedia_electors.json"
TCPD_PATH = HERE / "tcpd_ap_ae.csv.gz"


def load_wiki_by_no() -> dict[int, dict]:
    rows = json.loads(WIKI_PATH.read_text())
    return {r["constituency_no"]: r for r in rows}


def load_tcpd_2019_by_no() -> dict[int, int]:
    """Return {constituency_no: electors} from the 2019 rows of the TCPD CSV."""
    out: dict[int, int] = {}
    with gzip.open(TCPD_PATH, "rt", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("Year") != "2019":
                continue
            try:
                no = int(row["Constituency_No"])
                elec = int(row["Electors"])
            except (ValueError, TypeError, KeyError):
                continue
            if elec > 0 and no not in out:
                out[no] = elec
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    candidates = json.loads(CANDIDATES_PATH.read_text())
    wiki_by_no = load_wiki_by_no()
    tcpd_by_no = load_tcpd_2019_by_no()

    counts = {"wikipedia_2024": 0, "tcpd_2019": 0, "missing": 0}
    missing_rows: list[str] = []

    for c in candidates:
        er = c.get("election_result") or {}
        eci_no = er.get("eci_constituency_no")
        polled = er.get("total_votes_polled")
        if not eci_no:
            counts["missing"] += 1
            missing_rows.append(f"{c.get('constituency')} (no eci_no)")
            continue

        wiki = wiki_by_no.get(eci_no) or {}
        wiki_elec = wiki.get("electors")
        tcpd_elec = tcpd_by_no.get(eci_no)

        if wiki_elec:
            electors, source, year = wiki_elec, "wikipedia_2024", 2024
            turnout = round(polled / electors * 100, 2) if polled else None
        elif tcpd_elec:
            electors, source, year = tcpd_elec, "tcpd_2019", 2019
            turnout = None  # never mix years
        else:
            counts["missing"] += 1
            missing_rows.append(f"{c.get('constituency')} (eci_no={eci_no})")
            continue

        er["total_electors"] = electors
        er["total_electors_year"] = year
        er["total_electors_source"] = source
        er["turnout_percent"] = turnout
        counts[source] += 1
        c["election_result"] = er

    print(f"wikipedia_2024: {counts['wikipedia_2024']}")
    print(f"tcpd_2019:      {counts['tcpd_2019']}")
    print(f"missing:        {counts['missing']}")
    if missing_rows:
        print("missing detail:")
        for m in missing_rows[:10]:
            print(f"  {m}")

    if counts["missing"]:
        print("\nrefusing to write — every candidate must resolve to a real electors number.")
        return 2

    if args.dry_run:
        print("\n--dry-run: candidates.json NOT modified.")
        return 0

    ts = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup = CANDIDATES_PATH.with_suffix(f".json.bak_pre_electors_merge_{ts}")
    shutil.copy2(CANDIDATES_PATH, backup)
    CANDIDATES_PATH.write_text(json.dumps(candidates, indent=2, ensure_ascii=False) + "\n")
    print(f"\nbackup: {backup.name}")
    print(f"wrote:  {CANDIDATES_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
