import os
import json
import time
import shutil
import re
import traceback
import requests
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Import the check function from our audit script
from audit_pdfs import check_pdf

# --- CONFIG ---
SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRAPER_DIR)
FINAL_DIR = os.path.join(PROJECT_ROOT, "public", "affidavits")
JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")
TEMP_DIR = os.path.expanduser("~/Downloads")

# The 32 faulty candidates identified by the audit
FAULTY_NAMES = [
    "Gummidi Sandhyarani", "R.V.S.K.K.Ranga Rao @ Babynayana", "Eswara Rao Nadukuditi",
    "Lokam Naga Madhavi", "Vishnu Kumar Raju Penmetsa", "Anitha Vangalapudi",
    "Bathula Balaramakrishna S/O Gangarao", "Kolikapudi Srinivasa Rao",
    "Ramakrishna Reddy Nallamilli", "Kolusu Partha Sarathy", "Bandaru Satyananda Rao",
    "Datla Subbaraju (Buchibabu)", "Jogeswara Rao.V", "Vanamadi Venkateswara Rao @ Kondababu",
    "Chintamaneni Prabhakar", "Dharmaraju Patsamatla", "Vasamsetti. Subash",
    "Giddi. Satyanarayana", "Tenali Sravan Kumar", "Bonda Umamaheswararao",
    "Kumar Raja Varla", "Gonuguntla Venkata Siva Sita Rama Anzanneyllu",
    "Aravinda Babu Chadalavada", "G Jayasurya", "Vegesana Narendra Varma Raju",
    "B. Virupakshi", "K.E. Shyam Kumar", "Gummanur Jayaram",
    "Adinarayana Reddy Chadipirala", "Bandaru Sravani Sree", "S. Savitha", "Dr. Vm. Thomas"
]

os.makedirs(TEMP_DIR, exist_ok=True)

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def clean_string(s):
    if not s: return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(s)).lower()

def clean_name_parts(s):
    if not s: return set()
    s = re.sub(r'\(.*?\)', '', str(s)).lower()
    s = re.sub(r'\b(dr|sri|smt|mr|mrs|shri|kumari|alias|advocate|er|engr)\b', '', s)
    s = re.sub(r'[^a-zA-Z0-9\s]', ' ', s)
    return set(s.split())

def wait_for_new_file(folder, start_time, timeout=60):
    while time.time() - start_time < timeout:
        files = [os.path.join(folder, f) for f in os.listdir(folder) 
                 if f.lower().endswith('.pdf') and not f.startswith('.')]
        if files:
            newest = max(files, key=os.path.getctime)
            if os.path.getctime(newest) >= (start_time - 2):
                return newest
        time.sleep(1)
    return None

def wait_and_select(driver, element_id, keyword):
    log(f"   ⌛ Selecting '{keyword}' for {element_id}...")
    wait = WebDriverWait(driver, 30)
    for i in range(3): # Try 3 times
        try:
            # Wait for visibility
            el = wait.until(EC.visibility_of_element_located((By.ID, element_id)))
            
            # Click it to simulate user focus
            driver.execute_script("arguments[0].click();", el)
            time.sleep(1)
            
            sel = Select(el)
            
            # Debug: Log options if we are struggling
            if i > 0:
                opts = [o.text for o in sel.options[:10]]
                log(f"   ℹ️ Available options in {element_id} (first 10): {opts}")

            clean_k = clean_string(keyword)
            found = False
            for opt in sel.options:
                if clean_k in clean_string(opt.text):
                    sel.select_by_visible_text(opt.text)
                    # Trigger multiple events to ensure site reacts
                    driver.execute_script("arguments[0].dispatchEvent(new Event('change'))", el)
                    driver.execute_script("arguments[0].dispatchEvent(new Event('blur'))", el)
                    found = True
                    break
            
            if found:
                time.sleep(3) # Wait for AJAX
                return True
            
        except Exception as e:
            log(f"   ⚠️ Selection attempt {i+1} failed for {element_id}: {str(e)[:50]}")
        time.sleep(2)
    return False

def download_and_verify(driver, candidate):
    log(f"🔎 TARGET: {candidate['name']} ({candidate.get('party')})")
    driver.get("https://affidavit.eci.gov.in/")
    time.sleep(3)
    
    try:
        if not wait_and_select(driver, "electionType", "General Election 2024"): return False
        if not wait_and_select(driver, "election", "AC - GENERAL"): return False
        if not wait_and_select(driver, "states", "Andhra Pradesh"): return False
        
        # New: Phase 1 is often required for 2024 AP elections
        try:
            if driver.find_elements(By.ID, "phase"):
                wait_and_select(driver, "phase", "1")
        except: pass
        
        # Strip constituency name of anything in parentheses
        raw_const = candidate['constituency'].split('(')[0].strip().split(' (')[0].strip()
        
        # Wait for constId to populate (it should have more than 1 option once loaded)
        log(f"   ⏳ Waiting for {raw_const} to appear in constId...")
        for _ in range(10):
            try:
                sel = Select(driver.find_element(By.ID, "constId"))
                if len(sel.options) > 1: break
            except: pass
            time.sleep(1)
            
        if not wait_and_select(driver, "constId", raw_const): return False
        
        log("   🖱️ Clicking Filter...")
        filter_xpath = "//button[@id='btnFilter'] | //button[contains(., 'Search')] | //button[contains(text(), 'Filter')]"
        btn = WebDriverWait(driver, 20).until(EC.element_to_be_clickable((By.XPATH, filter_xpath)))
        driver.execute_script("arguments[0].click();", btn)
        time.sleep(5)

        # Look for "Accepted" tab
        try:
            acc_tab = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'Accepted')]")))
            driver.execute_script("arguments[0].click();", acc_tab)
            time.sleep(3)
        except: 
            log("   ℹ️ 'Accepted' tab not clickable, maybe already on it or site changed.")

        found = False
        page_num = 1
        
        while page_num <= 3:
            rows = driver.find_elements(By.XPATH, "//table//tr[td]")
            target_parts = clean_name_parts(candidate['name'])
            
            for row in rows:
                row_text = row.text.lower()
                if "rejected" in row_text or "withdrawn" in row_text: continue
                
                row_parts = clean_name_parts(row_text.splitlines()[0])
                intersection = target_parts.intersection(row_parts)
                
                # Party check
                party_match = False
                t_party = clean_string(candidate.get('party',''))
                if t_party in clean_string(row_text): party_match = True
                elif t_party == 'tdp' and 'telugu desam' in row_text: party_match = True
                elif t_party == 'ysrcp' and 'yuvajana' in row_text: party_match = True
                elif t_party == 'bjp' and 'bharatiya' in row_text: party_match = True
                elif t_party == 'janasena' and 'jana sena' in row_text: party_match = True

                # Match if at least 1 significant name part matches AND party matches
                # Or if the name is very long and we have a partial match
                if (len(intersection) >= 1 and party_match):
                    log(f"   ✨ Preliminary match in table: {row.text.splitlines()[0]} (Page {page_num})")
                    view_btn = row.find_element(By.LINK_TEXT, "View more")
                    driver.execute_script("arguments[0].click();", view_btn)
                    found = True
                    break
            
            if found: break
            
            # Try next page
            try:
                # The next button sometimes has different structures
                next_btns = driver.find_elements(By.XPATH, "//a[contains(text(), 'Next')] | //a[contains(., '»')]")
                if next_btns:
                    log(f"   ⏭️ Candidate not on page {page_num}, trying next page...")
                    driver.execute_script("arguments[0].click();", next_btns[0])
                    time.sleep(5)
                    page_num += 1
                else: break
            except:
                break
        
        if not found:
            log(f"   ❌ Candidate '{candidate['name']}' not found in search results after {page_num} pages.")
            return False

        # --- NEW: Switch to the newly opened tab ---
        time.sleep(5)
        if len(driver.window_handles) > 1:
            driver.switch_to.window(driver.window_handles[-1])
            log(f"   📑 Switched to profile tab: {driver.title}")
            
        # Set download behavior via CDP (Chrome DevTools Protocol) to be absolutely sure
        driver.execute_cdp_cmd('Page.setDownloadBehavior', {
            'behavior': 'allow',
            'downloadPath': os.path.abspath(TEMP_DIR)
        })

        # --- USER MANUAL CLICK STEP ---
        log(f"\n👉 TARGET: {candidate['name']} ({candidate['party']})")
        log(f"🚨 ACTION REQUIRED: Click the 'Download' button in the browser window NOW.")
        log(f"   (The script will automatically detect the file in your Downloads folder)")
        
        start_time = time.time()
        temp_file = wait_for_new_file(TEMP_DIR, start_time, timeout=300) # Give user 5 mins
        
        if temp_file:
            log("   🔍 VERIFYING DOWNLOAD...")
            # Use strict audit logic on the newly downloaded file
            is_valid, msg = check_pdf(temp_file, candidate['name'])
            
            # Optimistic Move: If user clicked it, and it's 'Unknown' (OCR fail), we still keep it.
            if is_valid or "Unknown" in msg or "Unreadable" in msg:
                if not is_valid:
                    log(f"   ⚠️ IDENTITY UNCERTAIN (OCR issue), but keeping it since you clicked the button.")
                
                safe_name = "".join([c if c.isalnum() else "_" for c in candidate['name']]).lower()
                final_path = os.path.join(FINAL_DIR, f"{safe_name}.pdf")
                if os.path.exists(final_path): os.remove(final_path)
                shutil.move(temp_file, final_path)
                log(f"   ✅ FIXED: {candidate['name']}")
                return True
            else:
                log(f"   ❌ VERIFICATION FAILED (WRONG NAME): {msg}")
                os.remove(temp_file)
        else:
            log("   ❌ Download timed out.")
    
    except Exception:
        log(f"   ☢️ CRITICAL ERROR:\n{traceback.format_exc()}")
    
    return False

def main():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Final 11 candidates
    remaining_targets = [
        "R.V.S.K.K.Ranga Rao @ Babynayana", "Anitha Vangalapudi", 
        "Ramakrishna Reddy Nallamilli", "Giddi. Satyanarayana", 
        "Bonda Umamaheswararao", "Gonuguntla Venkata Siva Sita Rama Anzanneyllu", 
        "G Jayasurya", "Vegesana Narendra Varma Raju", "K.E. Shyam Kumar", 
        "Gummanur Jayaram", "Bandaru Sravani Sree"
    ]
    
    targets = [c for c in data if c['name'] in remaining_targets]
    
    if not targets:
         log("🎉 No remaining targets found in candidates.json!")
         return

    log(f"🚀 Starting FINAL PUSH for {len(targets)} candidates.")

    # Environment Setup
    os.environ['WDM_LOCAL'] = '1'
    os.environ['WDM_DIR'] = os.path.join(SCRAPER_DIR, ".wdm")
    
    options = Options()
    options.add_experimental_option("prefs", {
        "download.default_directory": os.path.abspath(TEMP_DIR),
        "download.prompt_for_download": False,
        "plugins.always_open_pdf_externally": True
    })
    
    # UI Mode Flags
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    # Use a local user-data-dir
    user_data_dir = os.path.join(SCRAPER_DIR, "chrome_user_data")
    os.makedirs(user_data_dir, exist_ok=True)
    options.add_argument(f"--user-data-dir={user_data_dir}")

    log("🎬 Launching Chrome...")
    try:
        service = Service(executable_path=ChromeDriverManager().install(), log_output=os.path.join(SCRAPER_DIR, "chromedriver.log"))
        driver = webdriver.Chrome(service=service, options=options)
        driver.maximize_window()
        # Set a long implicit wait just in case
        driver.implicitly_wait(5)
    except Exception:
        log(f"💥 Failed to launch Chrome. Error:\n{traceback.format_exc()}")
        return

    try:
        for i, cand in enumerate(targets):
            log(f"\n[{i+1}/{len(targets)}] Redownloading...")
            success = download_and_verify(driver, cand)
            if not success:
                log(f"   ❌ FAILED to fix {cand['name']}")
            
            # Clean up window
            while len(driver.window_handles) > 1:
                driver.switch_to.window(driver.window_handles[-1])
                driver.close()
                driver.switch_to.window(driver.window_handles[0])
            time.sleep(2)
    finally:
        if driver: driver.quit()
        # DANGER REMOVED: Do not delete your Downloads folder!

if __name__ == "__main__":
    main()
