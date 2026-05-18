"""Fetch ECI 2019 AP Assembly constituency results.

Sibling of fetch_eci_results.py (which does the 2024 election). Same
Wayback-backed approach — the 2019 portal lived at
`results.eci.gov.in/ac/en/constituencywise/ConstituencywiseS01<N>.htm`
and has been overwritten by later election cycles, but archive.org has
snapshots from May 26–29, 2019 (the days around counting).

Two structural differences from the 2024 pages:
  1. Heading is "Andhra Pradesh-<Constituency Name>" (no constituency #
     prefix). We don't have the # in the page text, so we trust the URL
     for the constituency number.
  2. The candidates table is nested *inside* an outer layout-table, so
     the header row isn't rows[0]. We search every table for a row
     whose cells include "Candidate" and "Total Votes" — that row is
     the header, and data rows follow.

Output: scraper_lab/eci_results_2019.json, same shape as eci_results.json.

Run:
    .venv/bin/python scraper_lab/fetch_eci_2019.py
    .venv/bin/python scraper_lab/fetch_eci_2019.py --resume
    .venv/bin/python scraper_lab/fetch_eci_2019.py --only 1,2,3
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup


HERE = Path(__file__).parent
OUT_PATH = HERE / "eci_results_2019.json"

WAYBACK_PREFIX = "https://web.archive.org/web/20190530/"
ECI_URL_TMPL = (
    "http://results.eci.gov.in/ac/en/constituencywise/ConstituencywiseS01{n}.htm"
)
USER_AGENT = "Mozilla/5.0 (research; leaderledger.in election-results)"
CONSTITUENCY_COUNT = 175

# Heading on each page looks like: "Andhra Pradesh-Ichchapuram" (it appears
# inside an <h1>, <h2>, or just a <td>). We match that prefix.
HEADING_RE = re.compile(r"Andhra\s+Pradesh\s*-\s*(.+)", re.IGNORECASE)


def fetch_one(session: requests.Session, n: int, timeout: int = 60) -> tuple[str, str]:
    url = WAYBACK_PREFIX + ECI_URL_TMPL.format(n=n)
    r = session.get(url, timeout=timeout, allow_redirects=True)
    r.raise_for_status()
    return r.url, r.text


def _to_int(s: str) -> int:
    s = (s or "").strip().replace(",", "")
    return int(s) if s.lstrip("-").isdigit() else 0


def _to_float(s: str) -> float:
    s = (s or "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_page(html: str, n: int) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    # 1) Find the constituency name from any tag containing "Andhra Pradesh-<...>"
    constituency_name = ""
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "td", "th", "span", "div"]):
        txt = tag.get_text(" ", strip=True)
        m = HEADING_RE.search(txt or "")
        if not m:
            continue
        name_part = m.group(1).strip()
        # Drop trailing junk that creeps in when the tag has more text after
        # the heading (e.g. "Andhra Pradesh-Ichchapuram Result Status O.S.N. ...").
        name_part = re.split(r"\s+(Result Status|Result|O\.?S\.?N\.?)\b", name_part)[0]
        name_part = name_part.strip()
        if 1 <= len(name_part) <= 60 and not name_part.upper().startswith("LIVE"):
            constituency_name = name_part
            break
    if not constituency_name:
        raise ValueError("could not find constituency heading on page")

    # 2) Find the candidates table — its header row (any row in any table)
    #    contains "Candidate" AND "Total Votes". The data rows follow the
    #    header in the same table.
    target_table = None
    header_idx = -1
    for tbl in soup.find_all("table"):
        rows = tbl.find_all("tr")
        for i, row in enumerate(rows):
            cells = [c.get_text(" ", strip=True) for c in row.find_all(["td", "th"])]
            joined = " | ".join(cells)
            if "Candidate" in joined and "Total Votes" in joined and "Party" in joined:
                target_table = tbl
                header_idx = i
                break
        if target_table is not None:
            break
    if target_table is None:
        raise ValueError("could not find candidates table on page")

    # 3) Parse rows after the header
    rows: list[dict] = []
    totals_row: dict | None = None
    for tr in target_table.find_all("tr")[header_idx + 1:]:
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if len(cells) < 7:
            continue
        row = {
            "name": cells[1],
            "party": cells[2],
            "evm_votes": _to_int(cells[3]),
            "postal_votes": _to_int(cells[4]),
            "total_votes": _to_int(cells[5]),
            "percent": _to_float(cells[6]),
        }
        if row["name"].strip().upper() == "TOTAL":
            totals_row = row
            continue
        if row["total_votes"] == 0 and not row["party"]:
            # Defensive: skip blank-out rows
            continue
        rows.append(row)

    if len(rows) < 2:
        raise ValueError(f"only {len(rows)} candidate rows found, expected >=2")

    nota_row = next((r for r in rows if r["name"].strip().upper() == "NOTA"), None)
    candidate_rows = [r for r in rows if r["name"].strip().upper() != "NOTA"]
    candidate_rows.sort(key=lambda r: r["total_votes"], reverse=True)

    winner = candidate_rows[0]
    runner_up = candidate_rows[1]
    total_polled = (
        totals_row["total_votes"] if totals_row else sum(r["total_votes"] for r in rows)
    )
    nota_votes = nota_row["total_votes"] if nota_row else 0

    return {
        "constituency_no": n,
        "constituency_name": constituency_name.upper(),
        "winner": winner,
        "runner_up": runner_up,
        "margin": winner["total_votes"] - runner_up["total_votes"],
        "margin_percent": round(winner["percent"] - runner_up["percent"], 2),
        "total_votes_polled": total_polled,
        "nota_votes": nota_votes,
        "candidate_count": len(candidate_rows),
    }


def load_existing() -> dict[int, dict]:
    if not OUT_PATH.exists():
        return {}
    try:
        return {row["constituency_no"]: row for row in json.loads(OUT_PATH.read_text())}
    except Exception:
        return {}


def save_all(by_no: dict[int, dict]) -> None:
    ordered = [by_no[n] for n in sorted(by_no.keys())]
    OUT_PATH.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--delay", type=float, default=1.5)
    args = ap.parse_args()

    if args.only:
        targets = sorted({int(x) for x in args.only.split(",") if x.strip()})
    else:
        targets = list(range(1, CONSTITUENCY_COUNT + 1))

    by_no = load_existing()
    if args.resume:
        before = len(targets)
        targets = [n for n in targets if n not in by_no]
        print(f"resume: skipping {before - len(targets)} already-fetched constituencies")

    if not targets:
        print("nothing to do")
        return 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    failures: list[tuple[int, str]] = []
    started = time.time()

    for i, n in enumerate(targets, 1):
        try:
            final_url, html = fetch_one(session, n)
            parsed = parse_page(html, n)
            parsed["source_url"] = final_url
            parsed["fetched_at"] = datetime.now(timezone.utc).isoformat()
            by_no[n] = parsed
            elapsed = time.time() - started
            print(f"  [{i}/{len(targets)}] S01{n:<3}  {parsed['constituency_name']:<25}  "
                  f"WIN {parsed['winner']['name']:<28} ({parsed['winner']['party'][:18]})  "
                  f"margin={parsed['margin']:>6}  ({elapsed:.0f}s)")
        except requests.HTTPError as e:
            print(f"  [{i}/{len(targets)}] S01{n:<3}  HTTP {e.response.status_code}")
            failures.append((n, f"HTTP {e.response.status_code}"))
        except Exception as e:
            print(f"  [{i}/{len(targets)}] S01{n:<3}  ERROR: {e}")
            failures.append((n, str(e)))

        if i % 10 == 0:
            save_all(by_no)
        if i < len(targets):
            time.sleep(args.delay)

    save_all(by_no)
    print(f"\nwrote {OUT_PATH}  ({len(by_no)} constituencies)")
    if failures:
        print(f"failures: {len(failures)}")
        for n, msg in failures:
            print(f"  S01{n}: {msg}")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
