"""
Scrape criminal-case data for historical AP winners from MyNeta (myneta.info).

MyNeta extracts and hosts affidavit data in HTML tables — no PDF download or
OCR needed. This is the fallback when affidavitarchive.nic.in is unreachable.

Output: src/data/myneta_criminal_{year}.json
  dict keyed by constituency_no (str) with:
    - winner_name, winner_party, myneta_candidate_id
    - criminal_cases          (int, affidavit-stated count)
    - criminal_details_pending  (list of pending-case dicts)
    - criminal_details_convictions (list of conviction dicts)

Each case dict mirrors the format used in candidates.json:
  { fir_number, sections (list), court, description, description_brief }

Run:
    .venv/bin/python scraper_lab/fetch_myneta_criminal.py --year 2019
    .venv/bin/python scraper_lab/fetch_myneta_criminal.py --year 2019 --resume
    .venv/bin/python scraper_lab/fetch_myneta_criminal.py --year 2019 --only 1,5,10
"""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "src" / "data"
RESULTS_DIR = ROOT / "public" / "data"

YEAR_BASE = {
    2019: "https://myneta.info/andhrapradesh2019",
    2014: "https://myneta.info/andhra2014",
    2009: "https://myneta.info/ap09",
    2004: "https://myneta.info/andhraPradesh2004",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# ── Utilities ──────────────────────────────────────────────────────────────────

def log(msg: str, indent: int = 0) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {'  ' * indent}{msg}", flush=True)


def normalize(s: str) -> str:
    """Lowercase, remove punctuation/extra spaces — for fuzzy name matching."""
    s = re.sub(r"[^a-z0-9\s]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def name_overlap(a: str, b: str) -> float:
    """Word-overlap score between two strings (0–1)."""
    wa = set(normalize(a).split())
    wb = set(normalize(b).split())
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / max(len(wa), len(wb))


def get(url: str, delay: float = 1.5) -> BeautifulSoup:
    time.sleep(delay)
    r = SESSION.get(url, timeout=30)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


# ── Winners page ───────────────────────────────────────────────────────────────

def fetch_winners(year: int) -> list[dict]:
    """
    Return list of {candidate_id, name, constituency, party} for all winners.
    Falls back to all-candidates page for years without a winners view.
    """
    base = YEAR_BASE[year]
    url = f"{base}/index.php?action=show_winners&sort=default"
    log(f"Fetching winners page: {url}")
    soup = get(url, delay=2.0)

    rows = soup.select("table tr")
    winners = []
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        link = cells[1].find("a", href=True)
        if not link:
            continue
        m = re.search(r"candidate_id=(\d+)", link["href"])
        if not m:
            continue
        winners.append({
            "candidate_id": int(m.group(1)),
            "name": link.get_text(strip=True),
            "constituency": cells[2].get_text(strip=True).upper(),
            "party": cells[3].get_text(strip=True),
        })

    log(f"Found {len(winners)} winners on MyNeta")
    return winners


# ── Candidate page ─────────────────────────────────────────────────────────────

def _header_row(table) -> list[str]:
    """
    Extract column headers from a MyNeta table.
    MyNeta uses <tr style="font-weight:bold"> for header rows, not <th>.
    """
    for row in table.find_all("tr"):
        if "bold" in (row.get("style") or "").lower():
            return [c.get_text(strip=True).lower() for c in row.find_all("td")]
    return []


def _sections_list(text: str) -> list[str]:
    """Split an IPC-sections string like '143, 341, 353' into a list."""
    parts = []
    for part in re.split(r"[,;\s]+", text):
        part = part.strip()
        if re.search(r"\d", part):
            parts.append(part)
    return parts


def _parse_pending_table(table) -> list[dict]:
    """
    Parse a pending-cases table.
    Column order: Serial | FIR No | Case No | Court | IPC Sections |
                  Other Details | Charges Framed | Date | Appeal Filed | Appeal status
    """
    if table is None:
        return []

    cases = []
    skip_next = True  # skip header row
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if not cells:
            continue
        # Skip the bold header row
        if "bold" in (row.get("style") or "").lower():
            skip_next = False
            continue
        if skip_next:
            continue
        if len(cells) < 4:
            continue
        text_check = row.get_text(" ", strip=True).lower()
        if "no cases" in text_check or "--------" in text_check:
            continue

        def c(i: int) -> str:
            return cells[i].get_text(separator=" ", strip=True) if i < len(cells) else ""

        fir = c(1)
        case_no = c(2)
        court = c(3).strip()
        if case_no.strip() and case_no.strip() not in ("-", ""):
            court = f"{case_no.strip()}, {court}".strip(", ")
        ipc_text = c(4)
        other_text = c(5)
        appeal_status = c(9) if len(cells) > 9 else ""

        sections = _sections_list(ipc_text)
        other_acts: list[str] = []
        if other_text and other_text.lower() not in (
            "nil", "n/a", "-", "na", "none", "charge sheet not filed", "no", ""
        ):
            for part in re.split(r"[,;\n]+", other_text):
                part = part.strip()
                if part and len(part) > 1 and part.lower() not in ("no", "yes", "-"):
                    other_acts.append(part)

        desc = other_text if other_text else ""
        if appeal_status and appeal_status.lower() not in ("", "-", "no", "yes"):
            desc = (desc + " " + appeal_status).strip()

        if not fir and not court and not sections:
            continue

        cases.append({
            "fir_number": fir,
            "sections": sections,
            "other_acts": other_acts,
            "court": court,
            "description": desc,
            "description_brief": "",
        })

    return cases


def _parse_conviction_table(table) -> list[dict]:
    """
    Parse a convictions table.
    Column order: Serial | Case No | Court | IPC Sections | Other Details |
                  Punishment | Date convicted | Appeal Filed | Appeal status
    """
    if table is None:
        return []

    cases = []
    skip_next = True
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if not cells:
            continue
        if (cells[0].get("style") or "").lower().find("bold") != -1:
            skip_next = False
            continue
        if skip_next:
            continue
        if len(cells) < 3:
            continue
        text_check = row.get_text(" ", strip=True).lower()
        if "no cases" in text_check or "--------" in text_check:
            continue

        def c(i: int) -> str:
            return cells[i].get_text(separator=" ", strip=True) if i < len(cells) else ""

        case_no = c(1)
        court = c(2)
        ipc_text = c(3)
        other_text = c(4)
        punishment = c(5) if len(cells) > 5 else ""

        sections = _sections_list(ipc_text)
        desc_parts = [x for x in [other_text, punishment] if x and x.lower() not in ("-", "no", "yes", "")]
        desc = " | ".join(desc_parts)

        if not case_no and not court and not sections:
            continue

        cases.append({
            "fir_number": case_no,
            "sections": sections,
            "other_acts": [],
            "court": court,
            "description": desc,
            "description_brief": "",
        })

    return cases


def fetch_criminal_data(year: int, candidate_id: int) -> dict:
    """Return criminal_cases count + detail lists for one candidate."""
    base = YEAR_BASE[year]
    url = f"{base}/candidate.php?candidate_id={candidate_id}"
    soup = get(url, delay=1.5)

    # ── Total count ───────────────────────────────────────────────────────────
    # Pattern: <div>Number of Criminal Cases: <span style="font-weight:bold">16</span></div>
    criminal_cases = 0
    for tag in soup.find_all(string=re.compile(r"Number of Criminal Cases", re.I)):
        span = tag.parent.find("span")
        if span:
            try:
                criminal_cases = int(span.get_text(strip=True))
                break
            except ValueError:
                pass
        # fallback: parse number from surrounding text
        m = re.search(r"Number of Criminal Cases[^\d]*(\d+)", tag.parent.get_text(), re.I)
        if m:
            criminal_cases = int(m.group(1))
            break

    # ── Locate pending and conviction tables ──────────────────────────────────
    # MyNeta renders two adjacent tables: pending first, convictions second.
    # Pending header has "FIR No"; conviction header has "Case No" but no "FIR No".
    pending_table = None
    conviction_table = None

    for table in soup.find_all("table"):
        headers = _header_row(table)
        headers_str = " ".join(headers)
        if "fir no" in headers_str:
            pending_table = table
        elif "punishment" in headers_str or (
            "case no" in headers_str and "court" in headers_str and pending_table is not None
        ):
            conviction_table = table

    pending = _parse_pending_table(pending_table)
    convictions = _parse_conviction_table(conviction_table)

    if criminal_cases == 0:
        criminal_cases = len(pending) + len(convictions)

    return {
        "criminal_cases": criminal_cases,
        "criminal_details_pending": pending,
        "criminal_details_convictions": convictions,
    }


# ── Matching MyNeta winners → our constituency numbers ────────────────────────

def match_winners(
    myneta_winners: list[dict],
    eci_results: list[dict],
) -> list[dict]:
    """
    Pair each MyNeta winner to a constituency_no from eci_results.
    Matches on constituency name (fuzzy) then winner name (fuzzy).
    Returns list of {constituency_no, constituency_name, ...winner, ...}.
    """
    matched = []
    used = set()

    for eci in eci_results:
        cno = eci["constituency_no"]
        cname = eci["constituency_name"]
        winner_name = eci.get("winner", {}).get("name", "")

        best_score = 0.0
        best = None
        for w in myneta_winners:
            if w["candidate_id"] in used:
                continue
            c_score = name_overlap(cname, w["constituency"])
            n_score = name_overlap(winner_name, w["name"])
            score = c_score * 0.6 + n_score * 0.4
            if score > best_score:
                best_score = score
                best = w

        if best and best_score >= 0.4:
            used.add(best["candidate_id"])
            matched.append({
                "constituency_no": cno,
                "constituency_name": cname,
                "eci_winner_name": winner_name,
                "myneta_name": best["name"],
                "myneta_constituency": best["constituency"],
                "myneta_candidate_id": best["candidate_id"],
                "match_score": round(best_score, 3),
            })
        else:
            log(
                f"  No match for {cno} {cname!r} (winner: {winner_name!r}) "
                f"— best score {best_score:.2f}",
                indent=1,
            )

    return matched


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--year", type=int, required=True, choices=list(YEAR_BASE.keys()))
    ap.add_argument("--resume", action="store_true",
                    help="Skip constituencies already in the output file")
    ap.add_argument("--only", default="",
                    help="Comma-separated constituency numbers to process")
    ap.add_argument("--delay", type=float, default=1.5,
                    help="Seconds between requests (default 1.5)")
    args = ap.parse_args()

    year = args.year
    results_path = RESULTS_DIR / f"eci_results_{year}.json"
    out_path = OUT_DIR / f"myneta_criminal_{year}.json"

    if not results_path.exists():
        print(f"Results file not found: {results_path}")
        return 1

    eci_results: list[dict] = json.loads(results_path.read_text())

    # Filter to requested constituencies
    only_nos: set[int] = set()
    if args.only:
        only_nos = {int(x) for x in args.only.split(",") if x.strip()}
        eci_results = [c for c in eci_results if c["constituency_no"] in only_nos]

    # Load existing output for resume
    output: dict[str, dict] = {}
    if out_path.exists():
        output = json.loads(out_path.read_text())

    log(f"Year {year} — {len(eci_results)} constituencies to consider")

    # Step 1: get MyNeta winners
    myneta_winners = fetch_winners(year)

    # Step 2: match to our constituency numbers
    matched = match_winners(myneta_winners, eci_results)
    log(f"Matched {len(matched)}/{len(eci_results)} constituencies")

    # Step 3: scrape each candidate
    ok = fail = skip = 0
    for i, m in enumerate(matched, 1):
        cno_str = str(m["constituency_no"])

        if args.resume and cno_str in output:
            skip += 1
            continue

        log(
            f"[{i}/{len(matched)}]  {m['constituency_no']:3d} · "
            f"{m['constituency_name']} — {m['myneta_name']} "
            f"(id={m['myneta_candidate_id']}, score={m['match_score']})"
        )
        try:
            criminal = fetch_criminal_data(year, m["myneta_candidate_id"])
            output[cno_str] = {
                "constituency_name": m["constituency_name"],
                "winner_name": m["eci_winner_name"],
                "myneta_name": m["myneta_name"],
                "myneta_candidate_id": m["myneta_candidate_id"],
                "match_score": m["match_score"],
                **criminal,
            }
            ok += 1
            log(
                f"  → {criminal['criminal_cases']} cases "
                f"({len(criminal['criminal_details_pending'])} pending, "
                f"{len(criminal['criminal_details_convictions'])} convictions)",
                indent=1,
            )
        except Exception as exc:
            log(f"  ERROR: {exc}", indent=1)
            fail += 1

        # Save after every candidate (safe resume)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2))

        if i < len(matched):
            time.sleep(args.delay)

    print(f"\n{'─' * 50}")
    print(
        f"Year {year}: {ok} scraped, {fail} failed, {skip} skipped  →  {out_path}"
    )
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    import sys
    sys.exit(main())
