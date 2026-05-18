"""Fetch per-constituency registered-electors + turnout for AP 2024 from Wikipedia.

Why Wikipedia: the ECI live results portal does not publish registered-electors
on its per-AC result pages (only votes cast). Chief Electoral Officer Andhra
Pradesh hosts the underlying SSR-2024 data on ceoandhra.nic.in / ceoap.ap.gov.in
but those gov.in hosts are unreachable from non-Indian IPs (NIC firewall).
Wikipedia's constituency articles carry the same numbers, cited to CEO AP, and
each article's 2024 election table includes a "Registered electors" row and a
"Turnout" row. We cross-validate every row against eci_results.json's
total_votes_polled so any Wikipedia editing error gets surfaced as a warning.

Per-AC URL pattern (175 ACs):
    https://en.wikipedia.org/wiki/<Constituency>_Assembly_constituency

URL slugs come from the master list article:
    https://en.wikipedia.org/wiki/List_of_constituencies_of_the_Andhra_Pradesh_Legislative_Assembly

The 2024 election table is identified by its <caption>, which has the shape
    "2024 Andhra Pradesh Legislative Assembly election : <Name> [(<electors>)]"
Electors sometimes appear in the caption's trailing parens; when missing we
read the in-table "Registered electors" row. The "Turnout" row gives votes
polled, which must equal eci_results.json's total_votes_polled.

Run:
    .venv/bin/python scraper_lab/fetch_wikipedia_electors.py
    .venv/bin/python scraper_lab/fetch_wikipedia_electors.py --resume
    .venv/bin/python scraper_lab/fetch_wikipedia_electors.py --only 1,2,3
    .venv/bin/python scraper_lab/fetch_wikipedia_electors.py --delay 1.0
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
URLS_PATH = HERE / "wikipedia_ac_urls.json"
OUT_PATH = HERE / "wikipedia_electors.json"
ECI_PATH = HERE / "eci_results.json"

LIST_URL = (
    "https://en.wikipedia.org/wiki/"
    "List_of_constituencies_of_the_Andhra_Pradesh_Legislative_Assembly"
)
USER_AGENT = "leaderledger-research/1.0 (contact: gowthamjadapalli@gmail.com)"
WIKI_BASE = "https://en.wikipedia.org"

CAPTION_2024_RE = re.compile(
    r"^\s*2024\s+Andhra\s+Pradesh\s+Legislative\s+Assembly\s+election\b",
    re.IGNORECASE,
)
CAPTION_ELECTORS_RE = re.compile(r"\(([\d,]+)\)\s*$")


def _to_int(s) -> int | None:
    s = (s or "").strip().replace(",", "")
    return int(s) if s.lstrip("-").isdigit() else None


def _to_float(s) -> float | None:
    s = (s or "").strip().replace(",", "")
    try:
        return float(s)
    except (ValueError, AttributeError):
        return None


def fetch_url_map(session: requests.Session) -> dict[int, dict]:
    """Build {constituency_no: {name, url}} from the Wikipedia list article."""
    r = session.get(LIST_URL, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # The relevant table is the only wikitable with 175 data rows.
    target = None
    for tbl in soup.select("table.wikitable"):
        rows = tbl.find_all("tr")[1:]
        if len(rows) == 175:
            target = tbl
            break
    if target is None:
        raise RuntimeError("could not find 175-row constituency table on list article")

    out: dict[int, dict] = {}
    for tr in target.find_all("tr")[1:]:
        cells = tr.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        no = _to_int(cells[0].get_text(" ", strip=True))
        link = cells[1].find("a", href=True)
        if no is None or link is None:
            continue
        name = cells[1].get_text(" ", strip=True)
        href = link["href"]
        if href.startswith("/"):
            href = WIKI_BASE + href
        out[no] = {"name": name, "url": href}
    if len(out) != 175:
        raise RuntimeError(f"expected 175 constituencies in list, got {len(out)}")
    return out


# Label variants Wikipedia editors use across the 175 AP articles.
# Order matters: prefer the "richest" label first when scanning.
ELECTOR_LABELS = ("registered electors", "total electors", "electors")
TURNOUT_LABELS = ("turnout", "total votes polled", "votes polled", "total valid votes")


def parse_constituency_page(html: str) -> dict:
    """Extract 2024 electors + turnout votes + turnout percent from a constituency page.

    Returns dict with possibly-None values:
        {electors, turnout_votes, turnout_percent, caption, votes_source}
    `votes_source` indicates which Wikipedia row label produced the votes count;
    needed to interpret cross-validation against ECI (e.g. "total valid votes"
    typically excludes NOTA, so the comparison is `wiki ≈ eci - nota`).
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(["script", "style", "sup"]):
        tag.decompose()

    out = {
        "electors": None,
        "turnout_votes": None,
        "turnout_percent": None,
        "caption": None,
        "votes_source": None,
    }

    # Find the one table whose caption begins with "2024 Andhra Pradesh ... election"
    target = None
    caption_electors = None
    for table in soup.select("table.wikitable"):
        cap = table.find("caption")
        if cap is None:
            continue
        cap_txt = cap.get_text(" ", strip=True)
        if CAPTION_2024_RE.match(cap_txt):
            target = table
            out["caption"] = cap_txt
            m = CAPTION_ELECTORS_RE.search(cap_txt)
            if m:
                caption_electors = _to_int(m.group(1))
            break

    if target is None:
        return out

    for tr in target.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if not cells:
            continue
        label_lc = " ".join(cells[:3]).lower().strip()

        # Electors row — try in priority order. In-row beats caption (some
        # captions are copy-paste errors from neighbouring constituencies).
        if out["electors"] is None:
            for lab in ELECTOR_LABELS:
                if lab in label_lc:
                    ints = [v for v in (_to_int(c) for c in cells) if v is not None]
                    if ints:
                        out["electors"] = ints[-1]
                    break

        # Votes row — try in priority order
        if out["turnout_votes"] is None:
            for lab in TURNOUT_LABELS:
                if lab in label_lc:
                    ints = [v for v in (_to_int(c) for c in cells) if v is not None]
                    floats = []
                    for c in cells:
                        if "." in c:
                            v = _to_float(c)
                            if v is not None and 0 <= v <= 100:
                                floats.append(v)
                    if ints:
                        out["turnout_votes"] = ints[0]
                        out["votes_source"] = lab
                    if floats and out["turnout_percent"] is None:
                        out["turnout_percent"] = floats[0]
                    break

    # Caption-derived electors only as a last-resort fallback
    if out["electors"] is None and caption_electors is not None:
        out["electors"] = caption_electors

    return out


def load_eci_polled() -> dict[int, dict]:
    """Return {constituency_no: {polled, nota}} from eci_results.json."""
    if not ECI_PATH.exists():
        return {}
    data = json.loads(ECI_PATH.read_text())
    return {
        row["constituency_no"]: {
            "polled": row.get("total_votes_polled"),
            "nota": row.get("nota_votes", 0) or 0,
        }
        for row in data
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
    ap.add_argument("--only", default="", help="comma-separated AC numbers")
    ap.add_argument("--delay", type=float, default=1.0,
                    help="seconds between Wikipedia requests")
    ap.add_argument("--refresh-urls", action="store_true",
                    help="re-fetch the constituency URL map even if cached")
    args = ap.parse_args()

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # 1) Build / load the URL map
    if URLS_PATH.exists() and not args.refresh_urls:
        url_map = {int(k): v for k, v in json.loads(URLS_PATH.read_text()).items()}
        print(f"loaded URL map from cache ({len(url_map)} entries)")
    else:
        print("fetching URL map from Wikipedia list article…")
        url_map = fetch_url_map(session)
        URLS_PATH.write_text(json.dumps({str(k): v for k, v in url_map.items()},
                                        indent=2, ensure_ascii=False) + "\n")
        print(f"  wrote {URLS_PATH} ({len(url_map)} entries)")
        time.sleep(args.delay)

    # 2) Pick targets
    if args.only:
        targets = sorted({int(x) for x in args.only.split(",") if x.strip()})
    else:
        targets = sorted(url_map.keys())

    by_no = load_existing()
    if args.resume:
        before = len(targets)
        targets = [n for n in targets if n not in by_no]
        print(f"resume: skipping {before - len(targets)} already-fetched")

    if not targets:
        print("nothing to do")
        return 0

    # 3) ECI cross-validation source
    eci_polled = load_eci_polled()

    started = time.time()
    failures: list[tuple[int, str]] = []

    for i, n in enumerate(targets, 1):
        entry = url_map.get(n)
        if entry is None:
            failures.append((n, "no URL in map"))
            continue
        url = entry["url"]
        try:
            r = session.get(url, timeout=60)
            r.raise_for_status()
            parsed = parse_constituency_page(r.text)
        except Exception as e:
            print(f"  [{i}/{len(targets)}] S01{n:<3} ERROR: {e}")
            failures.append((n, str(e)))
            continue

        # Cross-validate: wiki's votes-row either matches ECI's total_polled
        # (label "Turnout") or matches polled-minus-NOTA (label "Total valid
        # votes"). Either is acceptable.
        eci_row = eci_polled.get(n) or {}
        eci_polled_n = eci_row.get("polled")
        eci_nota = eci_row.get("nota", 0)
        wiki_v = parsed["turnout_votes"]
        validation_ok = False
        validation_note = "no eci row"
        if eci_polled_n is not None and wiki_v is not None:
            diff_incl = wiki_v - eci_polled_n
            diff_excl = wiki_v - (eci_polled_n - eci_nota)
            if abs(diff_incl) <= 50:
                validation_ok = True
                validation_note = "matches polled"
            elif abs(diff_excl) <= 50:
                validation_ok = True
                validation_note = "matches polled-NOTA"
            else:
                validation_note = f"diff_incl={diff_incl:+d} diff_excl={diff_excl:+d}"
        elif wiki_v is None:
            validation_note = "missing turnout_votes"

        row = {
            "constituency_no": n,
            "constituency_name": entry["name"],
            "electors": parsed["electors"],
            "turnout_votes_wiki": wiki_v,
            "turnout_percent_wiki": parsed["turnout_percent"],
            "votes_source": parsed["votes_source"],
            "eci_total_votes_polled": eci_polled_n,
            "eci_nota_votes": eci_nota,
            "validation_ok": validation_ok,
            "validation_note": validation_note,
            "source_url": url,
            "caption": parsed["caption"],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        by_no[n] = row

        elapsed = time.time() - started
        elec_str = f"{parsed['electors']:>9,}" if parsed["electors"] else "    none "
        votes_str = f"{wiki_v:>9,}" if wiki_v else "    none "
        flag = "OK " if validation_ok else "WARN"
        print(f"  [{i}/{len(targets)}] S01{n:<3} {entry['name'][:22]:<22}  "
              f"electors={elec_str}  votes={votes_str}  {flag} {validation_note}  "
              f"({elapsed:.0f}s)")

        if i % 10 == 0:
            save_all(by_no)
        if i < len(targets):
            time.sleep(args.delay)

    save_all(by_no)

    # Summary
    populated = sum(1 for r in by_no.values() if r["electors"])
    ok = sum(1 for r in by_no.values() if r["validation_ok"])
    print(f"\nwrote {OUT_PATH}  ({len(by_no)} rows)")
    print(f"  electors populated: {populated} / {len(by_no)}")
    print(f"  validation_ok:      {ok} / {len(by_no)}")
    if failures:
        print(f"failures: {len(failures)}")
        for n, msg in failures:
            print(f"  S01{n}: {msg}")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
