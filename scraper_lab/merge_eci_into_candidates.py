"""Merge scraper_lab/eci_results.json into src/data/candidates.json.

Adds an `election_result` field to each candidate, containing the margin
over the runner-up, runner-up details, total votes polled, and NOTA count.

Constituency-name conventions differ slightly:
    - ECI:            "KODUMUR (SC)", "RAMPACHODAVARAM", "GANNAVARAM(SC)"
    - candidates.json: "KODUMUR",       "RAMPACHODAVARAM(ST)", "GANNAVARAM (GIDDI. SATYANARAYANA)"

This script normalizes both to a stem (drop any trailing "(SC)" / "(ST)"
*or* trailing "(<winner name>)") and joins on the stem. For the two stems
that resolve to two seats each (PRATHIPADU general+SC, GANNAVARAM general+SC),
we disambiguate by matching ECI's winner name against candidates.json's
candidate name.

Run:
    .venv/bin/python scraper_lab/merge_eci_into_candidates.py
    .venv/bin/python scraper_lab/merge_eci_into_candidates.py --dry-run

A backup is written to src/data/candidates.json.bak_pre_eci_merge_<ts>.json
before writing the new file (skipped under --dry-run).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path


HERE = Path(__file__).parent
CANDIDATES_PATH = HERE.parent / "src" / "data" / "candidates.json"
ECI_PATH = HERE / "eci_results.json"

# Trailing "(SC)" / "(ST)" or "(<arbitrary text>)"
_TRAIL_PAREN_RE = re.compile(r"\s*\([^)]*\)\s*$")


def stem(name: str) -> str:
    """Normalize a constituency name to its un-suffixed stem (uppercase)."""
    s = name.upper()
    # Collapse any internal whitespace and trim
    s = re.sub(r"\s+", " ", s).strip()
    # Drop trailing parenthesized suffix once (handles "(SC)", "(ST)", or "(NAME)")
    s = _TRAIL_PAREN_RE.sub("", s).strip()
    return s


def _norm_name(name: str) -> str:
    """For winner-name disambiguation: uppercase, strip punctuation/whitespace."""
    return re.sub(r"[^A-Z0-9]+", "", (name or "").upper())


def build_election_result(eci_row: dict) -> dict:
    w = eci_row["winner"]
    r = eci_row["runner_up"]
    return {
        "margin": eci_row["margin"],
        "margin_percent": eci_row["margin_percent"],
        "winner_votes": w["total_votes"],
        "winner_percent": w["percent"],
        "winner_evm_votes": w["evm_votes"],
        "winner_postal_votes": w["postal_votes"],
        "runner_up": {
            "name": r["name"],
            "party": r["party"],
            "votes": r["total_votes"],
            "percent": r["percent"],
            "evm_votes": r["evm_votes"],
            "postal_votes": r["postal_votes"],
        },
        "total_votes_polled": eci_row["total_votes_polled"],
        "nota_votes": eci_row["nota_votes"],
        "candidate_count": eci_row["candidate_count"],
        "eci_constituency_no": eci_row["constituency_no"],
        "eci_constituency_name": eci_row["constituency_name"],
        "source": "ECI (June 2024 results portal, via Wayback snapshot 2025-11-06)",
        "source_url": eci_row["source_url"],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true",
                    help="report would-be matches without writing candidates.json")
    args = ap.parse_args()

    candidates = json.loads(CANDIDATES_PATH.read_text())
    eci_rows = json.loads(ECI_PATH.read_text())

    # Index candidates by stem → list (most stems hit just 1; PRATHIPADU and
    # GANNAVARAM hit 2 each).
    by_stem: dict[str, list[dict]] = defaultdict(list)
    for c in candidates:
        by_stem[stem(c["constituency"])].append(c)

    unmatched_eci: list[str] = []
    multi_picks: list[str] = []
    used_candidate_ids: set[int] = set()
    matched = 0

    for row in eci_rows:
        s = stem(row["constituency_name"])
        candidates_here = by_stem.get(s, [])

        if not candidates_here:
            unmatched_eci.append(f"#{row['constituency_no']} {row['constituency_name']}")
            continue

        if len(candidates_here) == 1:
            target = candidates_here[0]
        else:
            # Disambiguate by winner name. ECI winner.name vs candidate.name —
            # candidate.name is the winner in candidates.json by construction.
            wn = _norm_name(row["winner"]["name"])
            picks = [c for c in candidates_here
                     if _norm_name(c["name"]) and _norm_name(c["name"]) in wn]
            if not picks:
                # Try the reverse direction in case ECI has a partial form
                picks = [c for c in candidates_here
                         if wn and wn in _norm_name(c["name"])]
            if len(picks) != 1:
                unmatched_eci.append(
                    f"#{row['constituency_no']} {row['constituency_name']} "
                    f"(ambiguous: stem={s!r}, candidates={[c['name'] for c in candidates_here]}, "
                    f"eci_winner={row['winner']['name']!r})"
                )
                continue
            target = picks[0]
            multi_picks.append(
                f"{row['constituency_name']} -> {target['constituency']} ({target['name']})"
            )

        if target["id"] in used_candidate_ids:
            unmatched_eci.append(
                f"#{row['constituency_no']} {row['constituency_name']} "
                f"(would re-use already-matched candidate id={target['id']})"
            )
            continue

        target["election_result"] = build_election_result(row)
        used_candidate_ids.add(target["id"])
        matched += 1

    unmatched_candidates = [
        f"id={c['id']} {c['constituency']} ({c['name']})"
        for c in candidates if c["id"] not in used_candidate_ids
    ]

    print(f"matched: {matched}/{len(eci_rows)} ECI rows -> candidates")
    print(f"matched: {len(used_candidate_ids)}/{len(candidates)} candidates")
    if multi_picks:
        print(f"\ndisambiguated by winner name ({len(multi_picks)}):")
        for line in multi_picks:
            print(f"  {line}")
    if unmatched_eci:
        print(f"\nunmatched ECI rows ({len(unmatched_eci)}):")
        for line in unmatched_eci:
            print(f"  {line}")
    if unmatched_candidates:
        print(f"\nunmatched candidates ({len(unmatched_candidates)}):")
        for line in unmatched_candidates:
            print(f"  {line}")

    if unmatched_eci or unmatched_candidates:
        print("\nrefusing to write candidates.json with unresolved matches.")
        return 2

    if args.dry_run:
        print("\n--dry-run: candidates.json NOT modified.")
        return 0

    ts = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup = CANDIDATES_PATH.with_suffix(f".json.bak_pre_eci_merge_{ts}")
    shutil.copy2(CANDIDATES_PATH, backup)
    CANDIDATES_PATH.write_text(json.dumps(candidates, indent=2, ensure_ascii=False) + "\n")
    print(f"\nbackup: {backup.name}")
    print(f"wrote:  {CANDIDATES_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
