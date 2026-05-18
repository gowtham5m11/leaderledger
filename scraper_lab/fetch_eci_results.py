"""Fetch ECI 2024 AP Assembly constituency results.

Source of truth: the ECI live results portal at the time of declaration
(June 2024). ECI has since recycled `results.eci.gov.in` for the May 2026
elections, but the Internet Archive snapshotted every constituency page on
2025-11-06 (right before that handover), so this scraper hits Wayback's
"nearest snapshot" redirect rather than the now-dead live URL.

Per-constituency URL pattern (175 total):
    https://web.archive.org/web/20251106/
    https://results.eci.gov.in/AcResultGenJune2024/ConstituencywiseS01{N}.htm

Each page has a single candidates table with columns:
    S.N. | Candidate | Party | EVM Votes | Postal Votes | Total Votes | % of Votes

Output: scraper_lab/eci_results.json, a list of:
    {
        "constituency_no": int,        # 1..175
        "constituency_name": str,      # e.g. "ICHCHAPURAM"
        "winner":     {"name", "party", "evm_votes", "postal_votes",
                       "total_votes", "percent"},
        "runner_up":  {...same shape...},
        "margin": int,                 # winner.total - runner_up.total
        "margin_percent": float,       # winner.% - runner_up.%
        "total_votes_polled": int,     # sum of all rows (candidates + NOTA)
        "nota_votes": int,             # 0 if no NOTA row
        "candidate_count": int,        # excludes NOTA
        "source_url": str,             # the Wayback URL we read
        "fetched_at": str,             # ISO timestamp
    }

ECI's per-constituency result page intentionally omits registered-electors
totals — that data lives on CEO AP and is sourced separately. See
`fetch_wikipedia_electors.py` + `merge_electors_into_candidates.py`.

Run:
    .venv/bin/python scraper_lab/fetch_eci_results.py
    .venv/bin/python scraper_lab/fetch_eci_results.py --resume
    .venv/bin/python scraper_lab/fetch_eci_results.py --only 1,2,3
    .venv/bin/python scraper_lab/fetch_eci_results.py --delay 2.0
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
OUT_PATH = HERE / "eci_results.json"

WAYBACK_PREFIX = "https://web.archive.org/web/20251106/"
ECI_URL_TMPL = (
    "https://results.eci.gov.in/AcResultGenJune2024/ConstituencywiseS01{n}.htm"
)
USER_AGENT = "Mozilla/5.0 (research; leaderledger.in election-results)"
CONSTITUENCY_COUNT = 175

# Heading on each page looks like:
#   "Assembly Constituency 1 - Ichchapuram (Andhra Pradesh)"
HEADING_RE = re.compile(
    r"Assembly\s+Constituency\s+(\d+)\s*-\s*(.+?)\s*\(Andhra Pradesh\)",
    re.IGNORECASE,
)


def fetch_one(session: requests.Session, n: int, timeout: int = 60) -> tuple[str, str]:
    """Return (final_url, html). Raises on non-200."""
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

    # 1) Constituency name from heading
    constituency_name = ""
    for tag in soup.find_all(["h1", "h2", "h3", "h4"]):
        txt = tag.get_text(" ", strip=True)
        m = HEADING_RE.search(txt)
        if m:
            # Sanity check that the heading constituency number matches `n`
            if int(m.group(1)) != n:
                raise ValueError(
                    f"heading says constituency {m.group(1)} but URL was {n}: {txt!r}"
                )
            constituency_name = m.group(2).strip()
            break
    if not constituency_name:
        raise ValueError("could not find constituency heading on page")

    # 2) The candidates table: pick the table whose header row contains
    #    "Candidate" and "Total Votes".
    target = None
    for tbl in soup.find_all("table"):
        rows = tbl.find_all("tr")
        if not rows:
            continue
        header_cells = [c.get_text(" ", strip=True) for c in rows[0].find_all(["td", "th"])]
        header = " | ".join(header_cells)
        if "Candidate" in header and "Total Votes" in header:
            target = tbl
            break
    if target is None:
        raise ValueError("could not find candidates table on page")

    # Column layout we expect:
    #   0 S.N. | 1 Candidate | 2 Party | 3 EVM Votes | 4 Postal Votes |
    #   5 Total Votes | 6 % of Votes
    rows: list[dict] = []
    totals_row: dict | None = None
    for tr in target.find_all("tr")[1:]:
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
        # Bottom-of-table summary row has name="Total" and no party.
        if row["name"].strip().upper() == "TOTAL":
            totals_row = row
            continue
        rows.append(row)

    if len(rows) < 2:
        raise ValueError(f"only {len(rows)} candidate rows found, expected >=2")

    # 3) Separate NOTA from real candidates
    nota_row = next((r for r in rows if r["name"].strip().upper() == "NOTA"), None)
    candidate_rows = [r for r in rows if r["name"].strip().upper() != "NOTA"]

    # The page is already sorted descending by total votes, but be defensive:
    candidate_rows.sort(key=lambda r: r["total_votes"], reverse=True)

    winner = candidate_rows[0]
    runner_up = candidate_rows[1]
    # Prefer ECI's printed totals row; fall back to summing the per-candidate rows + NOTA.
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
        data = json.loads(OUT_PATH.read_text())
        return {row["constituency_no"]: row for row in data}
    except Exception:
        return {}


def save_all(by_no: dict[int, dict]) -> None:
    ordered = [by_no[n] for n in sorted(by_no.keys())]
    OUT_PATH.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--resume", action="store_true",
                    help="skip constituencies already in eci_results.json")
    ap.add_argument("--only", default="",
                    help="comma-separated constituency numbers to fetch (e.g. 1,2,3)")
    ap.add_argument("--delay", type=float, default=1.5,
                    help="seconds to sleep between requests (default 1.5)")
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
                  f"margin={parsed['margin']:>6}  "
                  f"({elapsed:.0f}s elapsed)")
        except requests.HTTPError as e:
            print(f"  [{i}/{len(targets)}] S01{n:<3}  HTTP {e.response.status_code}: {e}")
            failures.append((n, f"HTTP {e.response.status_code}"))
        except Exception as e:
            print(f"  [{i}/{len(targets)}] S01{n:<3}  ERROR: {e}")
            failures.append((n, str(e)))

        # Save incrementally every 10 so we don't lose progress if interrupted.
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
