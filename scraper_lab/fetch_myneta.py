"""
Stage 1 of the criminal-cases pipeline (see scraper_lab/README.md). Committed
2026-05 — previously an untracked local file; kept rather than deleted because
it's how scraper_lab/myneta_data.json (our ground-truth cache) is regenerated.

Scrape MyNeta's "candidates_analyzed" listing for AP 2024 across all pages
and write a flat JSON cache consumed by validate_with_myneta.py.

The page structure changes slightly between page 1 (table id="table1") and
pages 2-119 (anonymous table with class "w3-table w3-bordered"), so this
scraper finds the table by header content (any table whose header row contains
the word "Candidate") instead of by id/class.

Output: scraper_lab/myneta_data.json   (list[{name, constituency, party, cases}])

Run:
    .venv/bin/python scraper_lab/fetch_myneta.py
    .venv/bin/python scraper_lab/fetch_myneta.py --pages 1-10   # subset
    .venv/bin/python scraper_lab/fetch_myneta.py --resume       # skip pages
                                                                  already cached
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

PROJECT_ROOT = Path(__file__).parent.parent
OUT_PATH = Path(__file__).parent / "myneta_data.json"

BASE_URL = (
    "https://www.myneta.info/AndhraPradesh2024/index.php"
    "?action=summary&subAction=candidates_analyzed&sort=candidate"
)
USER_AGENT = "Mozilla/5.0 (research; leaderledger.in data validation)"
DEFAULT_DELAY_SEC = 1.2
TOTAL_PAGES = 119  # MyNeta paginates ~20 rows per page; 119 covers AP 2024.


def fetch_page(session: requests.Session, page: int, timeout: int = 30) -> str:
    url = f"{BASE_URL}&page={page}"
    r = session.get(url, timeout=timeout)
    r.raise_for_status()
    return r.text


def parse_candidates_table(html: str) -> list[dict]:
    """Find the table whose header row contains 'Candidate' and extract rows.

    Columns observed on MyNeta AP 2024:
        0 Sno | 1 Candidate | 2 Constituency | 3 Party | 4 Criminal Case |
        5 Education | 6 Total Assets | 7 Liabilities
    """
    soup = BeautifulSoup(html, "html.parser")
    target = None
    for tbl in soup.find_all("table"):
        rows = tbl.find_all("tr")
        if not rows:
            continue
        header_text = " ".join(c.get_text(strip=True) for c in rows[0].find_all(["td", "th"]))
        if "Candidate" in header_text and "Constituency" in header_text:
            target = tbl
            break
    if target is None:
        return []

    out: list[dict] = []
    for row in target.find_all("tr")[1:]:
        cols = row.find_all("td")
        if len(cols) < 5:
            continue
        name = cols[1].get_text(strip=True)
        # Strip the ▽/△ sort glyph that occasionally leaks in if the page
        # rendered with the sort indicator on a name column (defensive).
        name = re.sub(r"[▽△∇∆]", "", name).strip()
        constituency = cols[2].get_text(strip=True)
        # MyNeta tags reservation status inline ("KODUMUR (SC)"); strip it so
        # constituency strings can be matched 1:1 against candidates.json.
        constituency = re.sub(r"\s*\((SC|ST)\)\s*$", "", constituency, flags=re.I)
        party = cols[3].get_text(strip=True)
        cases_text = cols[4].get_text(strip=True)
        m = re.search(r"\d+", cases_text)
        cases = int(m.group()) if m else 0
        if name:
            out.append({
                "name": name,
                "constituency": constituency,
                "party": party,
                "cases": cases,
            })
    return out


def parse_pages_arg(spec: str | None) -> list[int]:
    if spec is None:
        return list(range(1, TOTAL_PAGES + 1))
    pages: set[int] = set()
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if "-" in chunk:
            a, b = chunk.split("-", 1)
            pages.update(range(int(a), int(b) + 1))
        elif chunk:
            pages.add(int(chunk))
    return sorted(p for p in pages if 1 <= p <= TOTAL_PAGES)


def load_existing() -> tuple[list[dict], set[tuple[str, str]]]:
    if not OUT_PATH.exists():
        return [], set()
    data = json.loads(OUT_PATH.read_text())
    seen = {(r.get("name", ""), r.get("constituency", "")) for r in data}
    return data, seen


def main():
    p = argparse.ArgumentParser(description="Scrape MyNeta AP 2024 candidates table.")
    p.add_argument("--pages", type=str, default=None,
                   help='Page range, e.g. "1-10" or "1,2,5-7". Default: all 1-119.')
    p.add_argument("--delay", type=float, default=DEFAULT_DELAY_SEC,
                   help=f"Seconds between requests (default {DEFAULT_DELAY_SEC}).")
    p.add_argument("--resume", action="store_true",
                   help="Append to existing cache instead of overwriting; "
                        "deduplicates by (name, constituency).")
    p.add_argument("--out", type=str, default=str(OUT_PATH),
                   help="Output JSON path.")
    args = p.parse_args()

    pages = parse_pages_arg(args.pages)
    if not pages:
        print("No pages selected.", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out)

    if args.resume:
        all_records, seen = load_existing()
        print(f"Resume: loaded {len(all_records)} existing records.")
    else:
        all_records, seen = [], set()

    sess = requests.Session()
    sess.headers["User-Agent"] = USER_AGENT

    started = time.time()
    new_added = 0
    for i, page in enumerate(pages, 1):
        try:
            html = fetch_page(sess, page)
            rows = parse_candidates_table(html)
        except Exception as e:
            print(f"  [{i}/{len(pages)}] page {page}: ERROR {e}", file=sys.stderr)
            continue

        before = len(all_records)
        for r in rows:
            key = (r["name"], r["constituency"])
            if key in seen:
                continue
            seen.add(key)
            all_records.append(r)
        added = len(all_records) - before
        new_added += added
        print(f"  [{i}/{len(pages)}] page {page}: parsed {len(rows)} rows, +{added} new "
              f"(total {len(all_records)})")

        # Persist every 10 pages so a crash mid-scrape doesn't lose progress.
        if i % 10 == 0:
            out_path.write_text(json.dumps(all_records, indent=2))

        if i < len(pages):
            time.sleep(args.delay)

    out_path.write_text(json.dumps(all_records, indent=2))
    elapsed = time.time() - started
    print(f"\nDone. {new_added} new records added; cache size {len(all_records)}.")
    print(f"Elapsed: {elapsed/60:.1f} min")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
