import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# --- CONFIG ---
TARGET_URL = "http://localhost:5173/knowyourleader/#/list"

def setup_fast_driver():
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

def audit_socials():
    driver = setup_fast_driver()
    print(f"🚀 Starting audit on {TARGET_URL}...")
    
    report = {
        "verified": 0,
        "missing": 0,
        "errors": 0
    }
    
    try:
        driver.get(TARGET_URL)
        wait = WebDriverWait(driver, 15)
        
        # Initial scan to get count
        wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "leader-card")))
        total_to_audit = len(driver.find_elements(By.CLASS_NAME, "leader-card"))
        print(f"📊 Found {total_to_audit} candidates. Beginning deep audit...\n")
        
        for idx in range(total_to_audit):
            try:
                # Always re-navigate/wait to avoid stale context
                if idx > 0:
                    driver.get(TARGET_URL)
                    wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "leader-card")))
                
                cards = driver.find_elements(By.CLASS_NAME, "leader-card")
                if idx >= len(cards):
                    print(f"⚠️ Index {idx} out of range (current cards: {len(cards)}). Skipping.")
                    continue
                    
                card = cards[idx]
                name = card.find_element(By.TAG_NAME, "h3").text.strip()
                
                # Click to open profile
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", card)
                time.sleep(0.2)
                driver.execute_script("arguments[0].click();", card)
                
                # Wait for specific profile content OR a longer timeout
                time.sleep(1.5) # React transitions + API avatars often take time
                
                # Try to find the socials section specifically
                page_source = driver.page_source.lower()
                found = []
                if "facebook.com" in page_source: found.append("FB")
                if "instagram.com" in page_source: found.append("IG")
                if "twitter.com" in page_source or "x.com" in page_source: found.append("X")
                if "youtube.com" in page_source: found.append("YT")
                
                if found:
                    status = f"✅ {' '.join(found)}"
                    report["verified"] += 1
                else:
                    # Double check if we are actually on a profile
                    if "official social media" in page_source:
                        status = "⚪ No links found in object"
                    elif "loading" in page_source:
                        status = "⏳ Still loading..."
                    else:
                        status = "⚪ Missing / Not Found"
                    report["missing"] += 1
                
                print(f"[{idx+1}/{total_to_audit}] {name}: {status}")
                
            except Exception as e:
                print(f"❌ Error at index {idx}: {str(e)[:100]}...")
                report["errors"] += 1
                driver.get(TARGET_URL)
                time.sleep(1)

    except Exception as e:
        print(f"☢️ Audit Crash: {e}")
    finally:
        driver.quit()
        
    print("\n" + "="*40)
    print("🏁 FINAL AUDIT REPORT")
    print("="*40)
    print(f"✅ Verified Socials: {report['verified']}")
    print(f"⚪ Missing Socials:  {report['missing']}")
    print(f"⚠️ Errors/Skips:     {report['errors']}")
    print(f"📈 Coverage Rate:    {round((report['verified']/(report['verified']+report['missing'] or 1))*100, 1)}%")
    print("="*40)

if __name__ == "__main__":
    start_time = time.time()
    audit_socials()
    print(f"\n⏱️ Total Time: {round(time.time() - start_time, 2)} seconds")