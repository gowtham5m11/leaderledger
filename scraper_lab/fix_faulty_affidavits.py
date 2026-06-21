"""
Manually re-download a faulty affidavit PDF and verify it.

Navigates affidavit.eci.gov.in to the candidate's profile page, then waits
for YOU to click the Download button. Verifies the downloaded PDF matches
the candidate name before moving it to the correct output directory.

Usage:
    # 2024 (default) — falls back to legacy hardcoded list if --names omitted
    .venv/bin/python scraper_lab/fix_faulty_affidavits.py
    .venv/bin/python scraper_lab/fix_faulty_affidavits.py --names "Ganta Srinivasa Rao"

    # Historical year — specify by name or constituency number
    .venv/bin/python scraper_lab/fix_faulty_affidavits.py --year 2019 --names "Y.S. Jaganmohan Reddy"
    .venv/bin/python scraper_lab/fix_faulty_affidavits.py --year 2019 --only 1,5,10

Output:
    2024  → scraper_lab/affidavits/{safe_name}.pdf
    2019+ → scraper_lab/affidavits_historical/{year}/{cno:03d}_{constituency}_{name}.pdf
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import time
import traceback
from datetime import datetime
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from audit_pdfs import check_pdf

SCRAPER_DIR = Path(__file__).parent
PROJECT_ROOT = SCRAPER_DIR.parent
TEMP_DIR = Path.home() / "Downloads"

# 2024 fallback when --names is omitted
LEGACY_2024_TARGETS = [
    "Ganta Srinivasa Rao",
]


# ── Utilities ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def slugify(s: str) -> str:
    s = re.sub(r"[^\w\s]", "", s.lower())
    return re.sub(r"\s+", "_", s).strip("_")


def clean_string(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]", "", str(s)).lower() if s else ""


def clean_name_parts(s: str) -> set[str]:
    if not s:
        return set()
    s = re.sub(r"\(.*?\)", "", str(s)).lower()
    s = re.sub(r"\b(dr|sri|smt|mr|mrs|shri|kumari|alias|advocate|er|engr)\b", "", s)
    s = re.sub(r"[^a-zA-Z0-9\s]", " ", s)
    return set(s.split())


def wait_for_new_pdf(folder: Path, after: float, timeout: int = 300) -> Path | None:
    deadline = after + timeout
    while time.time() < deadline:
        pdfs = [p for p in folder.iterdir() if p.suffix.lower() == ".pdf" and not p.name.startswith(".")]
        if pdfs:
            newest = max(pdfs, key=lambda p: p.stat().st_ctime)
            if newest.stat().st_ctime >= after - 2:
                return newest
        time.sleep(1)
    return None


# ── Portal navigation ──────────────────────────────────────────────────────────

def wait_and_select(driver, element_id: str, keyword: str) -> bool:
    log(f"   ⌛ Selecting '{keyword}' in #{element_id} …")
    wait = WebDriverWait(driver, 30)
    for attempt in range(3):
        try:
            el = wait.until(EC.visibility_of_element_located((By.ID, element_id)))
            driver.execute_script("arguments[0].click();", el)
            time.sleep(1)
            sel = Select(el)
            if attempt > 0:
                log(f"   ℹ️  Options in #{element_id}: {[o.text for o in sel.options[:10]]}")
            clean_k = clean_string(keyword)
            for opt in sel.options:
                if clean_k in clean_string(opt.text):
                    sel.select_by_visible_text(opt.text)
                    driver.execute_script("arguments[0].dispatchEvent(new Event('change'))", el)
                    driver.execute_script("arguments[0].dispatchEvent(new Event('blur'))", el)
                    time.sleep(3)
                    return True
        except Exception as exc:
            log(f"   ⚠️  Attempt {attempt + 1} failed for #{element_id}: {str(exc)[:60]}")
        time.sleep(2)
    return False


def navigate_to_candidate(driver, candidate: dict, election_type: str) -> bool:
    """Open affidavit.eci.gov.in and navigate to the candidate's profile page."""
    driver.get("https://affidavit.eci.gov.in/")
    time.sleep(3)

    if not wait_and_select(driver, "electionType", election_type):
        return False
    if not wait_and_select(driver, "election", "AC - GENERAL"):
        return False
    if not wait_and_select(driver, "states", "Andhra Pradesh"):
        return False
    try:
        if driver.find_elements(By.ID, "phase"):
            wait_and_select(driver, "phase", "1")
    except Exception:
        pass

    raw_const = candidate["constituency"].split("(")[0].strip()
    log(f"   ⏳ Waiting for '{raw_const}' in constId …")
    for _ in range(10):
        try:
            if len(Select(driver.find_element(By.ID, "constId")).options) > 1:
                break
        except Exception:
            pass
        time.sleep(1)
    if not wait_and_select(driver, "constId", raw_const):
        return False

    log("   🖱️  Clicking Filter …")
    filter_xpath = "//button[@id='btnFilter'] | //button[contains(.,'Search')] | //button[contains(.,'Filter')]"
    btn = WebDriverWait(driver, 20).until(EC.element_to_be_clickable((By.XPATH, filter_xpath)))
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(5)

    try:
        acc = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'Accepted')]"))
        )
        driver.execute_script("arguments[0].click();", acc)
        time.sleep(3)
    except Exception:
        log("   ℹ️  'Accepted' tab not clickable.")

    # Scan up to 3 pages for the candidate
    target_parts = clean_name_parts(candidate["name"])
    t_party = clean_string(candidate.get("party", ""))
    for page in range(1, 4):
        rows = driver.find_elements(By.XPATH, "//table//tr[td]")
        for row in rows:
            row_text = row.text.lower()
            if "rejected" in row_text or "withdrawn" in row_text:
                continue
            row_parts = clean_name_parts(row_text.splitlines()[0])
            if not target_parts.intersection(row_parts):
                continue
            party_match = (
                t_party in clean_string(row_text)
                or (t_party == "tdp" and "telugu desam" in row_text)
                or (t_party == "ysrcp" and "yuvajana" in row_text)
                or (t_party == "bjp" and "bharatiya" in row_text)
                or (t_party == "jsp" and "janasena" in row_text)
                or (t_party == "inc" and "indian national congress" in row_text)
            )
            if not party_match:
                continue
            log(f"   ✨ Match: {row.text.splitlines()[0]} (page {page})")
            driver.execute_script("arguments[0].click();", row.find_element(By.LINK_TEXT, "View more"))
            return True

        try:
            nxt = driver.find_elements(By.XPATH, "//a[contains(text(),'Next')] | //a[contains(.,'»')]")
            if not nxt:
                break
            log(f"   ⏭️  Trying page {page + 1} …")
            driver.execute_script("arguments[0].click();", nxt[0])
            time.sleep(5)
        except Exception:
            break

    log(f"   ❌ '{candidate['name']}' not found after scanning pages.")
    return False


def navigate_to_constituency(driver, candidate: dict, election_type: str) -> bool:
    """Navigate to the constituency results page without searching for a specific candidate."""
    driver.get("https://affidavit.eci.gov.in/")
    time.sleep(3)
    if not wait_and_select(driver, "electionType", election_type):
        return False
    if not wait_and_select(driver, "election", "AC - GENERAL"):
        return False
    if not wait_and_select(driver, "states", "Andhra Pradesh"):
        return False
    try:
        if driver.find_elements(By.ID, "phase"):
            wait_and_select(driver, "phase", "1")
    except Exception:
        pass
    raw_const = candidate["constituency"].split("(")[0].strip()
    log(f"   ⏳ Waiting for '{raw_const}' in constId …")
    for _ in range(10):
        try:
            if len(Select(driver.find_element(By.ID, "constId")).options) > 1:
                break
        except Exception:
            pass
        time.sleep(1)
    if not wait_and_select(driver, "constId", raw_const):
        return False
    log("   🖱️  Clicking Filter …")
    filter_xpath = "//button[@id='btnFilter'] | //button[contains(.,'Search')] | //button[contains(.,'Filter')]"
    btn = WebDriverWait(driver, 20).until(EC.element_to_be_clickable((By.XPATH, filter_xpath)))
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(5)
    return True


def download_and_verify(driver, candidate: dict, election_type: str, out_path: Path,
                        manual: bool = False) -> bool:
    log(f"🔎 TARGET: {candidate['name']} ({candidate.get('party', '')})")
    try:
        if manual:
            if not navigate_to_constituency(driver, candidate, election_type):
                return False
            log(f"\n👉 MANUAL MODE: Find '{candidate['name']}' in the browser and click 'View more', then Download.")
            log(f"   (Watching {TEMP_DIR} for a new PDF — 5-minute timeout)")
        elif not navigate_to_candidate(driver, candidate, election_type):
            return False

        time.sleep(5)
        if len(driver.window_handles) > 1:
            driver.switch_to.window(driver.window_handles[-1])
            log(f"   📑 Switched to profile tab: {driver.title}")

        driver.execute_cdp_cmd("Page.setDownloadBehavior", {
            "behavior": "allow",
            "downloadPath": str(TEMP_DIR.resolve()),
        })

        log(f"\n👉 TARGET: {candidate['name']} ({candidate.get('party', '')})")
        log(f"🚨 ACTION REQUIRED: Click the 'Download' button in the browser window NOW.")
        log(f"   (Watching {TEMP_DIR} for a new PDF — 5-minute timeout)")

        start_time = time.time()
        temp_file = wait_for_new_pdf(TEMP_DIR, start_time)

        if not temp_file:
            log("   ❌ Download timed out.")
            return False

        log("   🔍 VERIFYING DOWNLOAD …")
        is_valid, msg = check_pdf(str(temp_file), candidate["name"])

        if is_valid or "Unknown" in msg or "Unreadable" in msg:
            if not is_valid:
                log(f"   ⚠️  Identity uncertain (OCR issue) — keeping since you clicked.")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            if out_path.exists():
                out_path.unlink()
            shutil.move(str(temp_file), str(out_path))
            log(f"   ✅ FIXED: {candidate['name']} → {out_path.name}")
            return True

        log(f"   ❌ VERIFICATION FAILED (wrong name): {msg}")
        temp_file.unlink(missing_ok=True)

    except Exception:
        log(f"   ☢️  CRITICAL ERROR:\n{traceback.format_exc()}")

    return False


# ── Data loaders ───────────────────────────────────────────────────────────────

def load_targets_2024(names: list[str]) -> list[dict]:
    data = json.loads((PROJECT_ROOT / "src" / "data" / "candidates.json").read_text())
    out_dir = SCRAPER_DIR / "affidavits"
    targets = []
    for c in data:
        if c["name"] not in names:
            continue
        targets.append({
            "name": c["name"],
            "party": c.get("party", ""),
            "constituency": c.get("constituency", ""),
            "dest": out_dir / f"{slugify(c['name'])}.pdf",
        })
    return targets


def load_targets_historical(year: int, names: list[str], only: set[int]) -> list[dict]:
    results_path = PROJECT_ROOT / "public" / "data" / f"eci_results_{year}.json"
    if not results_path.exists():
        raise FileNotFoundError(f"Results file not found: {results_path}")
    data = json.loads(results_path.read_text())
    out_dir = SCRAPER_DIR / "affidavits_historical" / str(year)
    targets = []
    for c in data:
        cno = c["constituency_no"]
        winner = c["winner"]
        w_name = winner["name"]
        if names and w_name not in names:
            continue
        if only and cno not in only:
            continue
        filename = f"{cno:03d}_{slugify(c['constituency_name'])}_{slugify(w_name)}.pdf"
        targets.append({
            "name": w_name,
            "party": winner.get("party", ""),
            "constituency": c["constituency_name"],
            "constituency_no": cno,
            "dest": out_dir / filename,
        })
    return targets


# ── Chrome ─────────────────────────────────────────────────────────────────────

def build_driver() -> webdriver.Chrome:
    options = Options()
    options.add_experimental_option("prefs", {
        "download.default_directory": str(TEMP_DIR.resolve()),
        "download.prompt_for_download": False,
        "plugins.always_open_pdf_externally": True,
    })
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    user_data_dir = SCRAPER_DIR / "chrome_user_data"
    user_data_dir.mkdir(exist_ok=True)
    options.add_argument(f"--user-data-dir={user_data_dir}")
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    driver.maximize_window()
    driver.implicitly_wait(5)
    return driver


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--year", type=int, default=2024,
                    help="Election year (default: 2024)")
    ap.add_argument("--names", default="",
                    help="Comma-separated candidate names to fix")
    ap.add_argument("--only", default="",
                    help="Comma-separated constituency numbers (historical years only)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print targets without opening a browser")
    ap.add_argument("--manual", action="store_true",
                    help="Navigate to constituency page and wait for user to click View more + Download manually")
    args = ap.parse_args()

    year = args.year
    names = [n.strip() for n in args.names.split(",") if n.strip()]
    only = {int(x) for x in args.only.split(",") if x.strip()}
    # New ECI portal uses specific labels per election (not "General Election YYYY")
    _election_labels: dict[int, str] = {
        2024: "General Election 2024",
        2019: "Election-May-2019",
    }
    election_type = _election_labels.get(year, f"General Election {year}")

    if year == 2024:
        if not names:
            names = LEGACY_2024_TARGETS
        targets = load_targets_2024(names)
    else:
        if not names and not only:
            ap.error("For historical years, provide --names or --only.")
        targets = load_targets_historical(year, names, only)

    if not targets:
        log("No matching candidates found.")
        return

    log(f"Year {year} | election: {election_type!r} | {len(targets)} target(s)")

    if args.dry_run:
        for t in targets:
            print(f"  [{t.get('constituency_no', '---')}]  {t['name']:<40} ({t['party']})  →  {t['dest']}")
        return

    os.environ["WDM_LOCAL"] = "1"
    os.environ["WDM_DIR"] = str(SCRAPER_DIR / ".wdm")

    log("🎬 Launching Chrome …")
    driver = build_driver()

    try:
        for i, cand in enumerate(targets, 1):
            log(f"\n[{i}/{len(targets)}] Redownloading {cand['name']} …")
            success = download_and_verify(driver, cand, election_type, cand["dest"], manual=args.manual)
            if not success:
                log(f"   ❌ FAILED: {cand['name']}")
            # Close any extra tabs before next candidate
            while len(driver.window_handles) > 1:
                driver.switch_to.window(driver.window_handles[-1])
                driver.close()
                driver.switch_to.window(driver.window_handles[0])
            time.sleep(2)
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
