"""
Download affidavit PDFs for historical AP MLAs.

Reads the winner from each constituency in public/data/eci_results_{YEAR}.json
and downloads their nomination affidavit PDF using Selenium.

Two ECI portals are used depending on the year:

  NEW PORTAL  https://affidavit.eci.gov.in/
    Covers elections from roughly mid-2019 onward.
    Used by gather_data.py for 2024.  NOT available for the AP 2019
    assembly election (held April 2019 — before the portal's coverage).

  OLD PORTAL  http://affidavitarchive.nic.in/
    Covers all elections from 2004 onward.
    ASP.NET WebForms with dropdown-cascaded AJAX.
    Only reachable from Indian IP addresses (geo-restricted).

Year → portal mapping (auto-selected, overridable with --portal):
    2019 → old portal  (AP assembly election was April 2019)
    2014 → old portal
    2009 → old portal
    2004 → old portal

Run:
    .venv/bin/python scraper_lab/fetch_history_affidavits.py --year 2019
    .venv/bin/python scraper_lab/fetch_history_affidavits.py --year 2019 --resume
    .venv/bin/python scraper_lab/fetch_history_affidavits.py --year 2019 --dry-run
    .venv/bin/python scraper_lab/fetch_history_affidavits.py --year 2019 --only 1,5,10

    # Override election label (inspect the portal's dropdown if defaults don't match):
    .venv/bin/python scraper_lab/fetch_history_affidavits.py --year 2019 --election-label "Andhra Pradesh 2019"

Output:
    scraper_lab/affidavits_historical/{year}/{cno:03d}_{constituency}_{name}.pdf
"""
from __future__ import annotations

import argparse
import json
import os
os.environ["HOME"] = "/Users/gowthamjadapalli/Documents/GitHub/leaderledger"
os.environ["WDM_LOCAL"] = "1"
import re
import shutil
import sys
sys.path.insert(0, "/Users/gowthamjadapalli/Documents/GitHub/leaderledger/.venv/lib/python3.10/site-packages")
import time
from datetime import datetime
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

ROOT = Path(__file__).parent.parent
SCRAPER_DIR = Path(__file__).parent
OUT_BASE = SCRAPER_DIR / "affidavits_historical"
RESULTS_DIR = ROOT / "public" / "data"

NEW_PORTAL = "https://affidavit.eci.gov.in/"
OLD_PORTAL = "http://affidavitarchive.nic.in/FrmElectionAffidavit.aspx"

# All supported years use the old portal (affidavitarchive.nic.in).
# AP 2019 assembly election (April 2019) pre-dates the new portal's coverage.
YEAR_PORTAL = {
    2019: "old",
    2014: "old",
    2009: "old",
    2004: "old",
}

# Best-guess election label for the old portal's dropdown (fuzzy matched).
# Run --dry-run first; if "Election label not found" appears, check the
# dropdown live and pass the real label via --election-label.
DEFAULT_ELECTION_LABELS: dict[int, str] = {
    2019: "Andhra Pradesh 2019",
    2014: "Andhra Pradesh 2014",
    2009: "Andhra Pradesh 2009",
    2004: "Andhra Pradesh 2004",
}


# ── Utilities ──────────────────────────────────────────────────────────────────

def log(msg: str, *, indent: int = 0) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {'  ' * indent}{msg}", flush=True)


def slugify(s: str) -> str:
    s = re.sub(r"[^\w\s]", "", s.lower())
    return re.sub(r"\s+", "_", s).strip("_")


def clean_name_parts(s: str) -> set[str]:
    if not s:
        return set()
    s = re.sub(r"\(.*?\)", "", str(s)).lower()
    s = re.sub(r"\b(dr|sri|smt|mr|mrs|shri|kumari|alias|advocate|er|engr)\b", "", s)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return {w for w in s.split() if len(w) > 1}


def name_score(target: set[str], row: set[str]) -> tuple[float, set[str]]:
    if not target or not row:
        return 0.0, set()
    matched_row: set[str] = set()
    count = 0
    for t in sorted(target, key=len, reverse=True):
        if t in row:
            count += 1
            matched_row.add(t)
        else:
            for r in row:
                if r not in matched_row and (
                    (len(r) == 1 and t.startswith(r)) or (len(t) == 1 and r.startswith(t))
                ):
                    count += 1
                    matched_row.add(r)
                    break
    score = count / len(target) * 100
    noise = {
        "party", "accepted", "telugu", "desam", "janasena", "independent",
        "congress", "yuvajana", "sramika", "rythu", "andhra", "pradesh",
        "national", "secular", "bharatiya", "janatha", "bahujan", "samaj", "status",
    }
    unmatched = {r for r in row if len(r) > 3 and r not in noise} - matched_row
    return score, unmatched


def wait_for_new_pdf(folder: Path, after: float, timeout: int = 90) -> Path | None:
    deadline = after + timeout
    while time.time() < deadline:
        pdfs = [p for p in folder.iterdir() if p.suffix.lower() == ".pdf" and not p.name.startswith(".")]
        if pdfs:
            newest = max(pdfs, key=lambda p: p.stat().st_ctime)
            if newest.stat().st_ctime >= after - 2:
                return newest
        time.sleep(1)
    return None


# ── Selenium helpers ───────────────────────────────────────────────────────────

def fuzzy_select(driver, sel_id: str, keyword: str, label: str, wait_secs: int = 25) -> str:
    wait = WebDriverWait(driver, wait_secs)
    clean_kw = re.sub(r"[^a-z0-9]", "", keyword.lower())
    log(f"Selecting {label} ({keyword!r}) …", indent=1)
    for attempt in range(15):
        try:
            el = wait.until(EC.presence_of_element_located((By.ID, sel_id)))
            sel = Select(el)
            if len(sel.options) <= 1:
                time.sleep(2)
                continue
            matches = [
                o.text for o in sel.options
                if clean_kw in re.sub(r"[^a-z0-9]", "", o.text.lower())
            ]
            if matches:
                best = min(matches, key=lambda x: abs(len(re.sub(r"[^a-z0-9]", "", x.lower())) - len(clean_kw)))
                sel.select_by_visible_text(best)
                driver.execute_script("arguments[0].dispatchEvent(new Event('change'))", el)
                log(f"→ {best!r}", indent=2)
                time.sleep(1.5)
                return best
        except Exception:
            pass
        time.sleep(2)
    # Print what IS in the dropdown to help the user fix --election-label
    try:
        el = driver.find_element(By.ID, sel_id)
        opts = [o.text for o in Select(el).options]
        log(f"Could not find {keyword!r} in #{sel_id}. Available options:", indent=1)
        for o in opts[:20]:
            log(f"  {o!r}", indent=2)
    except Exception:
        pass
    raise RuntimeError(f"Could not select {keyword!r} from #{sel_id}")


def get_select_options(driver, sel_id: str) -> list[str]:
    try:
        return [o.text for o in Select(driver.find_element(By.ID, sel_id)).options]
    except Exception:
        return []


# ── Old portal (affidavitarchive.nic.in) ──────────────────────────────────────

OLD_IDS = {
    "state":       "ctl00_ContentPlaceHolder1_ddlState",
    "election":    "ctl00_ContentPlaceHolder1_ddlElectionID",
    "constituency":"ctl00_ContentPlaceHolder1_ddlConstituency",
}


def download_old_portal(driver, wait, candidate: dict, temp_dir: Path, out_path: Path) -> bool:
    """Navigate affidavitarchive.nic.in and download the candidate's affidavit PDF."""
    from selenium.common.exceptions import WebDriverException, TimeoutException
    name = candidate["name"]
    constituency = candidate["constituency"]
    election_label = candidate["election_label"]
    target_parts = clean_name_parts(name)

    try:
        driver.get(OLD_PORTAL)
    except TimeoutException:
        try:
            driver.find_element(By.ID, OLD_IDS["state"])
            log("Warning: Page load timed out but State dropdown is present. Proceeding.", indent=1)
        except Exception:
            log("Error: Page load timed out and State dropdown not found.", indent=1)
            return False
    except WebDriverException as exc:
        if "ERR_CONNECTION_TIMED_OUT" in str(exc) or "ERR_NAME_NOT_RESOLVED" in str(exc):
            log(
                "Cannot reach affidavitarchive.nic.in — the site is geo-restricted to "
                "Indian IP addresses. Run this script from a machine inside India.",
                indent=1,
            )
            raise SystemExit(1)
        raise
    time.sleep(2)

    try:
        # State → Election → Constituency cascade
        fuzzy_select(driver, OLD_IDS["state"], "Andhra Pradesh", "State")
        time.sleep(2)  # wait for election dropdown to populate
        fuzzy_select(driver, OLD_IDS["election"], election_label, "Election")
        time.sleep(2)
        fuzzy_select(driver, OLD_IDS["constituency"], constituency, "Constituency")
        time.sleep(2)

        # Click the Show / Search button
        for btn_text in ["Show", "Search", "Submit", "Go"]:
            btns = driver.find_elements(By.XPATH, f"//input[@value='{btn_text}'] | //button[contains(.,'{btn_text}')]")
            if btns:
                driver.execute_script("arguments[0].click();", btns[0])
                break
        time.sleep(3)

        # Find the candidate in the results table
        rows = driver.find_elements(By.XPATH, "//table//tr[td]")
        if not rows:
            log("No candidate rows found on old portal page", indent=2)
            return False

        found_row = None
        for row in rows:
            text = row.text
            row_parts = clean_name_parts(text.splitlines()[0] if text.splitlines() else text)
            score, unmatched = name_score(target_parts, row_parts)
            if score >= 50 and not unmatched:
                log(f"Matched: {name!r} in row: {text[:60]!r}", indent=2)
                found_row = row
                break

        if not found_row:
            log(f"Candidate not found on old portal: {name}", indent=2)
            return False

        # Click View / Download link
        for link_text in ["View", "Download", "Affidavit"]:
            links = found_row.find_elements(By.PARTIAL_LINK_TEXT, link_text)
            if links:
                click_time = time.time()
                driver.execute_script("arguments[0].click();", links[0])
                main_win = driver.current_window_handle
                time.sleep(4)

                # Handle new tab/window for the PDF
                if len(driver.window_handles) > 1:
                    driver.switch_to.window(driver.window_handles[-1])

                # Try a Download button inside the PDF view page
                dl_btns = driver.find_elements(By.XPATH, "//button[contains(.,'Download')] | //a[contains(.,'Download')]")
                if dl_btns:
                    driver.execute_script("arguments[0].click();", dl_btns[0])
                    click_time = time.time()

                pdf = wait_for_new_pdf(temp_dir, click_time)
                if pdf:
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    if out_path.exists():
                        out_path.unlink()
                    shutil.move(str(pdf), str(out_path))
                    size_kb = out_path.stat().st_size // 1024
                    log(f"Saved → {out_path.name} ({size_kb} KB)", indent=2)
                    if len(driver.window_handles) > 1:
                        driver.close()
                        driver.switch_to.window(main_win)
                    return True
                break

        log("PDF did not appear within 90 s", indent=2)

    except Exception as exc:
        log(f"Error: {exc}", indent=2)

    return False


# ── New portal (affidavit.eci.gov.in) — kept for reference / future years ──────

def download_new_portal(driver, wait, candidate: dict, temp_dir: Path, out_path: Path) -> bool:
    """Navigate affidavit.eci.gov.in and download the candidate's affidavit PDF."""
    name = candidate["name"]
    party = candidate["party"]
    constituency = candidate["constituency"]
    election_label = candidate["election_label"]
    target_parts = clean_name_parts(name)

    driver.get(NEW_PORTAL)
    time.sleep(2)

    try:
        fuzzy_select(driver, "electionType", election_label, "Election Type")
        fuzzy_select(driver, "election", "AC - GENERAL", "Category")
        fuzzy_select(driver, "states", "Andhra Pradesh", "State")
        try:
            fuzzy_select(driver, "phase", "1", "Phase")
        except Exception:
            pass

        raw_const = constituency.split("(")[0].strip()
        clean_const = re.sub(r"[^a-z0-9]", "", raw_const.lower())
        const_matches = [
            o for o in get_select_options(driver, "constId")
            if clean_const in re.sub(r"[^a-z0-9]", "", o.lower())
        ]
        if not const_matches:
            log(f"No constituency match for {raw_const!r}", indent=2)
            return False

        main_win = driver.current_window_handle
        found = False

        for const_opt in const_matches:
            if found:
                break
            log(f"Trying constituency: {const_opt!r}", indent=2)
            sel = Select(driver.find_element(By.ID, "constId"))
            sel.select_by_visible_text(const_opt)
            driver.execute_script("arguments[0].dispatchEvent(new Event('change'))", driver.find_element(By.ID, "constId"))
            time.sleep(1)

            btn_xpath = "//button[@id='btnFilter'] | //button[contains(.,'Filter')]"
            btn = wait.until(EC.element_to_be_clickable((By.XPATH, btn_xpath)))
            driver.execute_script("arguments[0].click();", btn)
            time.sleep(4)

            try:
                acc = driver.find_elements(By.XPATH, "//a[contains(text(),'Accepted')] | //li[contains(.,'Accepted')][not(contains(@class,'active'))]")
                if acc:
                    driver.execute_script("arguments[0].click();", acc[0])
                    time.sleep(3)
            except Exception:
                pass

            page = 1
            while not found:
                log(f"Scanning page {page} …", indent=3)
                time.sleep(3)
                rows = driver.find_elements(By.XPATH, "//table//tr[td]")
                if not rows:
                    time.sleep(3)
                    rows = driver.find_elements(By.XPATH, "//table//tr[td]")
                    if not rows:
                        break

                for row in rows:
                    row_text = row.text.lower()
                    if "rejected" in row_text or "withdrawn" in row_text:
                        continue
                    lines = row.text.splitlines()
                    row_parts = clean_name_parts(lines[0] if lines else row.text)
                    score, unmatched = name_score(target_parts, row_parts)
                    if score < 50 or unmatched:
                        continue

                    party_lines = [l for l in lines if "party :" in l.lower()]
                    if party_lines:
                        r_party = party_lines[0].split(":", 1)[-1].strip()
                        t_clean = re.sub(r"[^a-z]", "", party.lower())
                        r_clean = re.sub(r"[^a-z]", "", r_party.lower())
                        is_match = (
                            t_clean in r_clean or r_clean in t_clean
                            or (t_clean == "tdp" and "telugudesam" in r_clean)
                            or (t_clean == "ysrcp" and ("yuvajana" in r_clean or "ysr" in r_clean))
                            or (t_clean == "bjp" and "bharatiya" in r_clean)
                            or (t_clean == "inc" and "indiannational" in r_clean)
                            or (t_clean == "jsp" and "janasena" in r_clean)
                        )
                        if not is_match:
                            continue

                    log(f"Matched: {name!r}", indent=3)
                    view_btn = row.find_element(By.LINK_TEXT, "View more")
                    driver.execute_script("arguments[0].click();", view_btn)
                    found = True
                    break

                if found:
                    break
                try:
                    nxt = driver.find_elements(By.XPATH, "//a[contains(@class,'next')] | //li[contains(@class,'next')]/a | //a[contains(.,'Next')]")
                    if not nxt or "disabled" in nxt[0].find_element(By.XPATH, "./..").get_attribute("class"):
                        break
                    driver.execute_script("arguments[0].click();", nxt[0])
                    page += 1
                    time.sleep(2)
                except Exception:
                    break

        if not found:
            log(f"Candidate not found: {name} ({constituency})", indent=2)
            return False

        time.sleep(6)
        if len(driver.window_handles) > 1:
            driver.switch_to.window(driver.window_handles[-1])

        dl_xpath = "//button[contains(@onclick,'increaseDownloadCount')] | //button[contains(.,'Download')]"
        dl_btn = wait.until(EC.element_to_be_clickable((By.XPATH, dl_xpath)))
        click_time = time.time()
        driver.execute_script("arguments[0].click();", dl_btn)
        log("Downloading …", indent=2)

        pdf = wait_for_new_pdf(temp_dir, click_time)
        if pdf:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            if out_path.exists():
                out_path.unlink()
            shutil.move(str(pdf), str(out_path))
            size_kb = out_path.stat().st_size // 1024
            log(f"Saved → {out_path.name} ({size_kb} KB)", indent=2)
            if len(driver.window_handles) > 1:
                driver.close()
                driver.switch_to.window(main_win)
            return True

        log("PDF did not appear within 90 s", indent=2)

    except Exception as exc:
        log(f"Error: {exc}", indent=2)

    return False


# ── Main ───────────────────────────────────────────────────────────────────────

def build_driver(temp_dir: Path) -> webdriver.Chrome:
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--ignore-certificate-errors")
    options.add_argument("--allow-running-insecure-content")
    options.page_load_strategy = "eager"
    options.add_argument(f"--user-data-dir={temp_dir / 'chrome_profile'}")
    options.add_experimental_option("prefs", {
        "download.default_directory": str(temp_dir.resolve()),
        "download.prompt_for_download": False,
        "plugins.always_open_pdf_externally": True,
        "profile.managed_default_content_settings.images": 2,
    })
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.set_page_load_timeout(60)  # fail fast if server is unreachable
    return driver


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--year", type=int, required=True,
                    choices=list(YEAR_PORTAL.keys()),
                    help="Election year to process")
    ap.add_argument("--election-label", default="",
                    help=(
                        "Override the election dropdown label. Default is guessed from --year "
                        "(e.g. 'Andhra Pradesh 2019'). Inspect the portal's dropdown if "
                        "the default doesn't match what you see."
                    ))
    ap.add_argument("--portal", choices=["old", "new"],
                    help="Force a specific portal (default: auto from --year)")
    ap.add_argument("--resume", action="store_true",
                    help="Skip constituencies where PDF already exists")
    ap.add_argument("--only", default="",
                    help="Comma-separated constituency numbers (e.g. 1,5,10)")
    ap.add_argument("--delay", type=float, default=4.0,
                    help="Seconds to wait between constituencies (default 4.0)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print what would be downloaded without opening a browser")
    args = ap.parse_args()

    year = args.year
    portal = args.portal or YEAR_PORTAL[year]
    election_label = args.election_label or DEFAULT_ELECTION_LABELS[year]

    results_path = RESULTS_DIR / f"eci_results_{year}.json"
    if not results_path.exists():
        print(f"Results file not found: {results_path}")
        return 1

    constituencies = json.loads(results_path.read_text())
    out_dir = OUT_BASE / str(year)
    temp_dir = out_dir / "_temp"

    if args.only:
        only_nos = {int(x) for x in args.only.split(",") if x.strip()}
        constituencies = [c for c in constituencies if c["constituency_no"] in only_nos]

    targets: list[dict] = []
    for c in constituencies:
        cno = c["constituency_no"]
        winner = c["winner"]
        name_slug = slugify(winner["name"])
        const_slug = slugify(c["constituency_name"])
        filename = f"{cno:03d}_{const_slug}_{name_slug}.pdf"
        dest = out_dir / filename

        if args.resume and dest.exists():
            continue

        targets.append({
            "constituency_no": cno,
            "constituency": c["constituency_name"],
            "name": winner["name"],
            "party": winner["party"],
            "election_label": election_label,
            "dest": dest,
            "filename": filename,
        })

    print(f"\nYear {year}  |  portal: {portal}  |  election: {election_label!r}")
    print(f"Constituencies to process: {len(targets)} "
          f"(skipped {len(constituencies) - len(targets)} already downloaded)")

    if not targets:
        print("Nothing to do.")
        return 0

    if args.dry_run:
        for t in targets:
            print(f"  [{t['constituency_no']:3d}] {t['name']:<38} ({t['party']}) → {t['filename']}")
        return 0

    temp_dir.mkdir(parents=True, exist_ok=True)
    driver = build_driver(temp_dir)
    wait = WebDriverWait(driver, 25)

    download_fn = download_old_portal if portal == "old" else download_new_portal

    ok = fail = 0
    started = time.time()
    try:
        for i, cand in enumerate(targets, 1):
            elapsed = time.time() - started
            log(
                f"[{i}/{len(targets)}]  {cand['constituency_no']:3d} · "
                f"{cand['name']} ({cand['party']})  ({elapsed:.0f}s)"
            )
            success = download_fn(driver, wait, cand, temp_dir, cand["dest"])
            ok += success
            fail += not success
            if i < len(targets):
                time.sleep(args.delay)
    finally:
        driver.quit()
        try:
            temp_dir.rmdir()
        except OSError:
            pass

    print(f"\n{'─'*50}")
    print(f"Year {year}: {ok} downloaded, {fail} failed, "
          f"{len(constituencies) - len(targets)} skipped")
    return 0 if fail == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
