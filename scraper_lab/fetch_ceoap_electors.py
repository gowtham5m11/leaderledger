"""Fetch registered-electors for the 154 ACs missing from wikipedia_electors.json.

Source: CEO Andhra Pradesh Form-20 PDFs (official GE-2024 result sheets).
URL: https://ceoandhra.nic.in/ceoap_new/ceo/Form20_AC - 2024.html

Each PDF is a scanned Form-20. Page 1 header contains:
    "Total No. of Electors in Assembly Constituency/Segment : <N>"
We OCR only page 1 at DPI=150, extract that line, and update
wikipedia_electors.json (setting `electors` and `electors_source="ceoap_2024"`).
merge_electors_into_candidates.py reads this field and uses "ceoap_2024"
as the source label instead of "wikipedia_2024".

Only processes ACs where electors is currently None in wikipedia_electors.json.
Use --all to re-process every AC (for validation / refresh).

Run:
    .venv/bin/python scraper_lab/fetch_ceoap_electors.py
    .venv/bin/python scraper_lab/fetch_ceoap_electors.py --all
    .venv/bin/python scraper_lab/fetch_ceoap_electors.py --only 14,15,16
    .venv/bin/python scraper_lab/fetch_ceoap_electors.py --delay 1.5
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

try:
    import pdfplumber
    from pdf2image import convert_from_path
    import pytesseract
except ImportError:
    print("ERROR: pdfplumber, pdf2image and pytesseract are required.")
    sys.exit(1)


HERE = Path(__file__).parent
WIKI_PATH = HERE / "wikipedia_electors.json"

BASE_URL = "https://ceoandhra.nic.in/ceoap_new/ceo/"
FORM20_PAGE = BASE_URL + "Form20_AC - 2024.html"
USER_AGENT = "leaderledger-research/1.0 (contact: gowthamjadapalli@gmail.com)"

# Line-level pattern: match the "Total No. of Electors" line then extract
# the last 6+ digit number on that same line.
# Two separator styles seen in the wild:
#   "... Constituency/Segment : 231232"   (colon)
#   "... Constituency/segment ....223353." (dots, no colon)
# We must NOT cross newlines — [^:] crosses them by default.
ELECTORS_LINE_RE = re.compile(
    r"Total\s+No\.?\s*of\s+Electors[^\n]+",
    re.IGNORECASE,
)
_BIG_NUMBER_RE = re.compile(r"[\d,]+")


def fetch_pdf_url_map(session: requests.Session) -> dict[int, str]:
    """Return {constituency_no: full_pdf_url} from the Form-20 AC index page."""
    r = session.get(FORM20_PAGE, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    out: dict[int, str] = {}
    for a in soup.find_all("a", href=True):
        txt = a.get_text(strip=True)
        m = re.match(r"AC_0*(\d+)$", txt)
        if m:
            no = int(m.group(1))
            href = a["href"]
            out[no] = BASE_URL + href
    if len(out) != 175:
        raise RuntimeError(f"expected 175 PDF links, got {len(out)}")
    return out


def load_wiki() -> list[dict]:
    return json.loads(WIKI_PATH.read_text())


def save_wiki(rows: list[dict]) -> None:
    WIKI_PATH.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")


def extract_text_first_page(pdf_path: str) -> str:
    """Return text from page 1.  Try pdfplumber first (fast, accurate for
    text-native PDFs); fall back to OCR at DPI=200 for scanned pages."""
    with pdfplumber.open(pdf_path) as pdf:
        native = pdf.pages[0].extract_text() or ""
    if ELECTORS_LINE_RE.search(native):
        return native
    imgs = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=300)
    return pytesseract.image_to_string(imgs[0]) if imgs else ""


def extract_electors(text: str) -> int | None:
    m = ELECTORS_LINE_RE.search(text)
    if not m:
        return None
    line = m.group(0)
    # Collect all digit-sequences on this line, keep the last one with 6+ digits
    # (AP constituencies have 100k-400k electors; anything < 100k is noise).
    candidates = [
        int(tok.replace(",", ""))
        for tok in _BIG_NUMBER_RE.findall(line)
        if len(tok.replace(",", "")) >= 6
    ]
    return candidates[-1] if candidates else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--all", action="store_true",
                    help="re-process every AC, not just those missing electors")
    ap.add_argument("--only", default="",
                    help="comma-separated AC numbers to process")
    ap.add_argument("--delay", type=float, default=1.0,
                    help="seconds between requests (default 1.0)")
    args = ap.parse_args()

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    print("fetching PDF URL map from Form-20 index page…")
    pdf_urls = fetch_pdf_url_map(session)
    print(f"  found {len(pdf_urls)} PDF links")

    rows = load_wiki()
    by_no: dict[int, dict] = {r["constituency_no"]: r for r in rows}

    if args.only:
        targets = sorted({int(x) for x in args.only.split(",") if x.strip()})
    elif args.all:
        targets = sorted(pdf_urls.keys())
    else:
        targets = sorted(n for n in pdf_urls if not by_no.get(n, {}).get("electors"))

    if not targets:
        print("nothing to do — all ACs already have electors populated.")
        print("use --all to force a full re-run.")
        return 0

    print(f"processing {len(targets)} ACs…")

    failures: list[tuple[int, str]] = []
    started = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, no in enumerate(targets, 1):
            url = pdf_urls.get(no)
            if not url:
                failures.append((no, "no PDF URL"))
                continue

            pdf_path = str(Path(tmpdir) / f"ac_{no:03d}.pdf")
            try:
                r = session.get(url, timeout=120, stream=True)
                r.raise_for_status()
                with open(pdf_path, "wb") as f:
                    for chunk in r.iter_content(65536):
                        f.write(chunk)
            except Exception as e:
                print(f"  [{i}/{len(targets)}] S01{no:<3} DOWNLOAD ERROR: {e}")
                failures.append((no, f"download: {e}"))
                continue

            try:
                text = extract_text_first_page(pdf_path)
                electors = extract_electors(text)
            except Exception as e:
                print(f"  [{i}/{len(targets)}] S01{no:<3} OCR ERROR: {e}")
                failures.append((no, f"ocr: {e}"))
                continue

            elapsed = time.time() - started
            elec_str = f"{electors:>9,}" if electors else "    NONE "
            status = "OK " if electors else "WARN"
            wiki_name = (by_no.get(no) or {}).get("constituency_name", "?")
            print(f"  [{i}/{len(targets)}] S01{no:<3} {wiki_name[:22]:<22}  "
                  f"electors={elec_str}  {status}  ({elapsed:.0f}s)")

            if electors is not None:
                row = by_no.get(no)
                if row is None:
                    # Should not happen since wikipedia_electors.json has all 175
                    by_no[no] = {
                        "constituency_no": no,
                        "constituency_name": wiki_name,
                        "electors": electors,
                        "electors_source": "ceoap_2024",
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
                else:
                    row["electors"] = electors
                    row["electors_source"] = "ceoap_2024"
                    row["fetched_at"] = datetime.now(timezone.utc).isoformat()

            if i % 10 == 0:
                ordered = [by_no[n] for n in sorted(by_no.keys())]
                save_wiki(ordered)

            if i < len(targets):
                time.sleep(args.delay)

    ordered = [by_no[n] for n in sorted(by_no.keys())]
    save_wiki(ordered)

    populated = sum(1 for r in by_no.values() if r.get("electors"))
    print(f"\nwrote {WIKI_PATH}  ({len(by_no)} rows)")
    print(f"  electors populated: {populated} / {len(by_no)}")
    if failures:
        print(f"  failures ({len(failures)}):")
        for n, msg in failures:
            print(f"    S01{n}: {msg}")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
