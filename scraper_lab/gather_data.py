import os
import json
import time
import shutil
import re
import sys
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import subprocess

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================
INSTANCE_NAME = "Worker_A"  
START_INDEX = 0             
END_INDEX = 999             # Set high to catch everything missing
# ==========================================

SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRAPER_DIR)
FINAL_DIR = os.path.join(PROJECT_ROOT, "public", "affidavits")
JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")

TEMP_DIR = os.path.join(FINAL_DIR, f"temp_{INSTANCE_NAME}")
os.makedirs(FINAL_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

def log(message):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{INSTANCE_NAME}] {message}", flush=True)

def clean_string(s):
    if not s: return ""
    s = re.sub(r'\(.*?\)', '', str(s))
    return re.sub(r'[^a-zA-Z0-9]', '', s).lower()

def clean_name_parts(s):
    if not s: return set()
    # Remove bracketed content and common prefixes
    s = re.sub(r'\(.*?\)', '', str(s)).lower()
    s = re.sub(r'\b(dr|sri|smt|mr|mrs|shri|kumari|alias|advocate|er|engr)\b', '', s)
    s = re.sub(r'[^a-zA-Z0-9\s]', ' ', s)
    parts = set(s.split())
    # Filter out very short words unless they look like initials
    return parts

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

def wait_and_select_fuzzy(driver, element_id, keyword, field_name):
    wait = WebDriverWait(driver, 25)
    clean_keyword = clean_string(keyword)
    log(f"⏳ Selecting {field_name} (Searching: {keyword})...")
    
    for attempt in range(15):
        try:
            el = wait.until(EC.presence_of_element_located((By.ID, element_id)))
            sel = Select(el)
            if len(sel.options) <= 1:
                time.sleep(2); continue

            target_text = None
            potential_matches = []
            for opt in sel.options:
                opt_clean = clean_string(opt.text)
                if clean_keyword in opt_clean or opt_clean in clean_keyword:
                    potential_matches.append(opt.text)
            
            if potential_matches:
                target_text = min(potential_matches, key=lambda x: abs(len(clean_string(x)) - len(clean_keyword)))

            if target_text:
                sel.select_by_visible_text(target_text)
                driver.execute_script("arguments[0].dispatchEvent(new Event('change'))", el)
                log(f"   ∟ SUCCESS: {target_text}")
                time.sleep(1.5)
                return target_text
        except: pass
        time.sleep(2)
    raise Exception(f"Could not find {keyword}")

def get_alternatives(driver, element_id, keyword):
    try:
        el = Select(driver.find_element(By.ID, element_id))
        clean_k = clean_string(keyword)
        matches = []
        for opt in el.options:
            if clean_k in clean_string(opt.text):
                matches.append(opt.text)
        return sorted(matches, key=lambda x: abs(len(clean_string(x)) - len(clean_k)))
    except: return []

def hunt_candidate(driver, candidate):
    log(f"🚀 MISSION: {candidate['name']}")
    driver.get("https://affidavit.eci.gov.in/")
    wait = WebDriverWait(driver, 25)

    try:
        # 1-4: DROPDOWNS
        wait_and_select_fuzzy(driver, "electionType", "General Election 2024", "Type")
        wait_and_select_fuzzy(driver, "election", "AC - GENERAL", "Category")
        wait_and_select_fuzzy(driver, "states", "Andhra Pradesh", "State")
        try: wait_and_select_fuzzy(driver, "phase", "1", "Phase")
        except: pass
        
        raw_const = candidate['constituency'].split('(')[0].strip()
        const_alternatives = get_alternatives(driver, "constId", raw_const)
        
        found = False
        main_win = driver.current_window_handle

        for const_name in const_alternatives:
            if found: break
            log(f"📍 Trying Constituency: {const_name}")
            sel = Select(driver.find_element(By.ID, "constId"))
            sel.select_by_visible_text(const_name)
            driver.execute_script("arguments[0].dispatchEvent(new Event('change'))", driver.find_element(By.ID, "constId"))
            time.sleep(1)

            # 5. FILTER
            filter_xpath = "//button[@id='btnFilter'] | //button[contains(., 'Filter')]"
            btn = wait.until(EC.element_to_be_clickable((By.XPATH, filter_xpath)))
            driver.execute_script("arguments[0].click();", btn)
            
            # 6. ACCEPTED TAB
            time.sleep(4)
            try:
                acc_xpath = "//a[contains(text(),'Accepted')] | //button[contains(.,'Accepted')] | //li[contains(.,'Accepted')][not(contains(@class, 'active'))]"
                accs = driver.find_elements(By.XPATH, acc_xpath)
                if accs:
                    driver.execute_script("arguments[0].click();", accs[0])
                    time.sleep(4)
            except: pass

            # 7. SEARCH TABLE
            page = 1
            # Handle multiple possible name targets (original + alias)
            target_names = [candidate['name']]
            if candidate.get('alias'):
                target_names.append(candidate['alias'])
            
            target_sets = [clean_name_parts(tn) for tn in target_names]

            while not found:
                log(f"   🔎 Scanning {const_name} Page {page}...")
                time.sleep(3) # Give it more time to load
                rows = driver.find_elements(By.XPATH, "//table//tr[td]")
                if not rows: 
                    # Try one more time with a longer wait before giving up
                    time.sleep(3)
                    rows = driver.find_elements(By.XPATH, "//table//tr[td]")
                    if not rows: break
                
                for row in rows:
                    row_text = row.text.lower()
                    if "rejected" in row_text or "withdrawn" in row_text:
                        continue
                    
                    lines = row_text.splitlines()
                    name_line = lines[0] if lines else row_text
                    row_parts = clean_name_parts(name_line)
                    
                    found_match = False
                    for target_parts in target_sets:
                        similarity, unmatched_long_parts = get_similarity_enhanced(target_parts, row_parts)
                        if similarity >= 50 and not unmatched_long_parts:
                            found_match = True
                            break
                    
                    if found_match:
                        
                        # --- PARTY VERIFICATION ---
                        row_party_line = [l for l in lines if "party :" in l]
                        if row_party_line:
                            r_party_raw = row_party_line[0].split(":")[1].strip()
                            t_party_raw = candidate.get('party', '')
                            
                            tp_set = clean_name_parts(t_party_raw)
                            rp_set = clean_name_parts(r_party_raw)
                            p_sim, p_unmatched = get_similarity_enhanced(tp_set, rp_set)

                            # If parties are extremely different (especially if they have unmatched long words)
                            # but allow for common name substrings or short acronyms
                            is_p_match = (p_sim >= 50 and not p_unmatched) or (clean_string(t_party_raw) in clean_string(r_party_raw))
                            
                            # Acronym check for TDP, YSRCP, BJP, etc.
                            if not is_p_match:
                                t_acr = clean_string(t_party_raw).lower()
                                r_full = r_party_raw.lower()
                                if t_acr == 'tdp' and 'telugu desam' in r_full: is_p_match = True
                                elif t_acr == 'ysrcp' and ('yuvajana' in r_full or 'ysr' in r_full): is_p_match = True
                                elif t_acr == 'bjp' and 'bharatiya janata' in r_full: is_p_match = True
                                elif t_acr == 'jsp' and 'janasena' in r_full: is_p_match = True
                                elif t_acr == 'inc' and 'indian national congress' in r_full: is_p_match = True

                            # Hard-refusal for known similar party confusion cases
                            if "jatiyajanasena" in clean_string(r_party_raw) and "jatiya" not in clean_string(t_party_raw):
                                is_p_match = False

                            if not is_p_match:
                                # log(f"      - Party mismatch: JSON has '{t_party_raw}', Row has '{r_party_raw}'")
                                continue
                        # --------------------------
                            
                        log(f"   ✨ MATCH FOUND: {candidate['name']} ({t_party_raw}) matched with '{name_line}' ({r_party_raw})")
                        view_btn = row.find_element(By.LINK_TEXT, "View more")
                        driver.execute_script("arguments[0].click();", view_btn)
                        found = True
                        break
                
                if found: break
                try:
                    next_btn = driver.find_elements(By.XPATH, "//a[contains(@class, 'next')] | //li[contains(@class, 'next')]/a | //a[contains(., 'Next')]")
                    if not next_btn or "disabled" in next_btn[0].find_element(By.XPATH, "./..").get_attribute("class"):
                        break
                    driver.execute_script("arguments[0].click();", next_btn[0])
                    page += 1
                    time.sleep(2)
                except: break

        # 8. DOWNLOAD
        if found:
            time.sleep(6)
            if len(driver.window_handles) > 1:
                driver.switch_to.window(driver.window_handles[-1])
            
            dl_xpath = "//button[contains(@onclick, 'increaseDownloadCount')] | //button[contains(., 'Download')]"
            try:
                dl_btn = wait.until(EC.element_to_be_clickable((By.XPATH, dl_xpath)))
                click_time = time.time()
                driver.execute_script("arguments[0].click();", dl_btn)
                
                log("   ⏳ Downloading...")
                temp_file = wait_for_new_file(TEMP_DIR, click_time)
                
                if temp_file:
                    final_path = os.path.join(FINAL_DIR, candidate['filename'])
                    if os.path.exists(final_path): os.remove(final_path)
                    shutil.move(temp_file, final_path)
                    log(f"   ✅ SUCCESS: {candidate['filename']}")
                    if len(driver.window_handles) > 1:
                        driver.close()
                        driver.switch_to.window(main_win)
                    return True
            except Exception as e: log(f"   ☢️ DL Fail: {str(e)[:40]}")

    except Exception as e: log(f"   ☢️ FAIL: {str(e)[:80]}")
    return False

def get_similarity_enhanced(target_set, row_set):
    """Calculates similarity and returns also unmatched long words in row."""
    if not target_set or not row_set: return 0, set()
    
    matches = 0
    matched_row_parts = set()
    target_list = sorted(list(target_set), key=len, reverse=True)
    row_list = list(row_set)

    for t in target_list:
        # Exact match
        if t in row_set:
            matches += 1
            matched_row_parts.add(t)
        else:
            # Initial match
            for r in row_list:
                if r not in matched_row_parts:
                    if (len(r) == 1 and t.startswith(r)) or (len(t) == 1 and r.startswith(t)):
                        matches += 1
                        matched_row_parts.add(r)
                        break
    
    score = (matches / len(target_set)) * 100
    
    # Identify row parts that were NOT matched and are long (to avoid false positives)
    # Filter row set for significant words (exclude party names, status words, etc)
    significant_row_parts = {r for r in row_set if len(r) > 3 
                              and r not in {'party', 'accepted', 'telugu', 'desam', 'janasena', 'independent', 'congress', 'yuvajana', 'sramika', 'rythu',
                                            'andhra', 'pradesh', 'national', 'secular', 'bharatiya', 'janatha', 'bahujan', 'samaj', 'status'}}
    unmatched_long_parts = significant_row_parts - matched_row_parts
        
    return score, unmatched_long_parts

def main():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    all_missing = []
    for c in data:
        safe_name = "".join([char if char.isalnum() else "_" for char in c['name']]).lower()
        fname = f"{safe_name}.pdf"
        if not os.path.exists(os.path.join(FINAL_DIR, fname)):
            all_missing.append({**c, "filename": fname})
    targets = all_missing[START_INDEX:END_INDEX]
    if not targets:
        log("✅ Range complete."); return
    log(f"🖥️ Instance '{INSTANCE_NAME}' starting {len(targets)} missions.")
    options = Options()
    options.add_experimental_option("prefs", {"download.default_directory": os.path.abspath(TEMP_DIR), "download.prompt_for_download": False, "plugins.always_open_pdf_externally": True, "profile.managed_default_content_settings.images": 2})
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    try:
        for i, cand in enumerate(targets, 1):
            log(f"\n--- MISSION {i}/{len(targets)} ---")
            hunt_candidate(driver, cand)
            time.sleep(4)
    finally: driver.quit()

if __name__ == "__main__": main()