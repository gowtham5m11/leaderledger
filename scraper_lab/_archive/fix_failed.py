# Archived one-off: retried extraction on candidates that had failed, using the
# macOS Vision OCR backend (ocrmac). Committed 2026-05 for provenance only —
# superseded by the Tesseract + gemma3:4b pipeline (see scraper_lab/README.md),
# not run anymore. Kept rather than deleted so earlier extraction attempts are
# traceable; see scraper_lab/_archive/README.md.
import os
import json
import re
from ocrmac import ocrmac
from pdf2image import convert_from_path, pdfinfo_from_path

# --- SETTINGS ---
PROJECT_ROOT = "/Users/gowthamjadapalli/Documents/GitHub/leaderledger"
PDF_DIR = os.path.join(PROJECT_ROOT, "public", "affidavits")
JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")
TEMP_IMG_DIR = os.path.join(PROJECT_ROOT, "scraper_lab", "temp_images")
os.environ["PATH"] = "/usr/local/bin:/opt/homebrew/bin:" + os.environ["PATH"]

FAILED_CANDIDATES = [
    "Ashok Bendalam", "Regam Matyalingam", "Eswara Rao Nadukuditi", "Ganta Srinivasa Rao",
    "Chirri Balaraju", "Ramakrishna Reddy Nallamilli", "Yarapathineni Srinivasa Rao",
    "Mohammed Naseer Ahmed", "Dhulipalla Narendra Kumar", "Gottipati  Ravi Kumar",
    "G Jayasurya", "Yeluri Sambasiva Rao", "Ashok Reddy Muthumula", "Vijay Kumar B.N",
    "B. Virupakshi", "Damacharla Janardhana Rao", "Dr. Ugra Narasimha Reddy Mukku",
    "B.C. Janardhan Reddy", "Ys Jagan Mohan Reddy", "Nandamuri Balakrishna",
    "Dr. Vm. Thomas", "Gurajala Jagan Mohan (Gjm)", "Chandrababu Naidu Nara"
]

def clean_name(name):
    return "".join([c if c.isalnum() else "_" for c in name]).lower()

def identify_part_b(pdf_path):
    """Finds the page number of PART B using a binary search or linear check."""
    try:
        info = pdfinfo_from_path(pdf_path)
        total = info['Pages']
        # Linear check from page 15 onwards (Part B is usually in the second half)
        start_search = max(1, total - 12)
        images = convert_from_path(pdf_path, dpi=100, first_page=start_search, last_page=total)
        
        for i, img in enumerate(images):
            page_num = start_search + i
            temp_p = f"temp_check_{page_num}.png"
            img.save(temp_p)
            text = " ".join([res[0] for res in ocrmac.OCR(temp_p).recognize()])
            os.remove(temp_p)
            if "PART B" in text.upper() or "SUMMARY" in text.upper():
                return page_num
    except:
        pass
    return None

def process_failed():
    print(f"🔍 Investigating {len(FAILED_CANDIDATES)} failed candidates...")
    results = {}
    
    for name in FAILED_CANDIDATES:
        safe = clean_name(name)
        path = os.path.join(PDF_DIR, f"{safe}.pdf")
        if not os.path.exists(path):
            continue
            
        print(f"  📄 Trying {name}...")
        part_b_page = identify_part_b(path)
        if part_b_page:
            print(f"    ✅ PART B found on page {part_b_page}")
            # OCR this page at high resolution
            img = convert_from_path(path, dpi=300, first_page=part_b_page, last_page=part_b_page)[0]
            temp_p = "temp_part_b.png"
            img.save(temp_p)
            text = " ".join([res[0] for res in ocrmac.OCR(temp_p).recognize()])
            os.remove(temp_p)
            
            # Look for Highest Education in the table
            # In Part B, it's usually Section 11 or the last item in the table
            pattern = r"(?i)(?:Highest\s+)?educational\s+qualification\s*[:\.\-]?\s*(.*)"
            match = re.search(pattern, text, re.DOTALL)
            if match:
                print(f"    ✨ Found: {match.group(1)[:100]}...")
            else:
                # Look for degree names
                edu_regex = r"(?i)(?:B\.A|B\.Sc|B\.Com|B\.Tech|M\.A|M\.Sc|MBBS|SSC|Intermediate)\.?\s*.*?(?:University|College|School)"
                match = re.search(edu_regex, text)
                if match:
                    print(f"    ✨ Found Fallback: {match.group(0)}")
        else:
            print(f"    ❌ PART B NOT found.")

if __name__ == "__main__":
    process_failed()
