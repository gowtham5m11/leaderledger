from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import os
import sys

try:
    os.environ['WDM_LOCAL'] = '1'
    os.environ['WDM_DIR'] = os.path.abspath(".wdm_test")
    
    options = Options()
    options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    
    print(f"Installing chromedriver for Chrome at {options.binary_location}...")
    driver_path = ChromeDriverManager().install()
    print(f"Driver installed at: {driver_path}")
    
    service = Service(executable_path=driver_path)
    driver = webdriver.Chrome(service=service, options=options)
    
    driver.get("https://google.com")
    print(f"Page title: {driver.title}")
    driver.quit()
    print("SUCCESS")
except Exception as e:
    print(f"FAILURE: {e}")
    import traceback
    traceback.print_exc()
