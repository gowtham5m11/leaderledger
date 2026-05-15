import os
import json
import re
import pdfplumber
import tempfile
from datetime import datetime

# --- PATHS ---
PROJECT_ROOT = "/Users/gowthamjadapalli/Documents/GitHub/leaderledger"
PDF_DIR = os.path.join(PROJECT_ROOT, "public", "affidavits")
JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")

def get_timestamp():
    return datetime.now().strftime("%H:%M:%S")

def clean_profession_text(text):
    if not text: return "Not Found"
    text = re.sub(r'\(a\)|Self|\(b\)|Spouse|[:\-\—\–\.\,]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'[^a-zA-Z\s,&/]', '', text)
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)
    
    lower = text.lower()
    garbage_list = ['percy', 'not applicable', 'nil nil', 'atp', 'acquired', 's/o', 'd/o', 'not found', 'notnot']
    if any(g == lower for g in garbage_list): return "Not Found"
    if len(text) < 3 and lower not in ['mla', 'mp', 'ips', 'ias', 'ifs']: return "Not Found"
    return text

def extract_fields(content):
    res = {"self": "Not Found", "spouse": "Not Found", "success": False}
    section_match = re.search(r"\(9\)\s*Details\s*of\s*profession.*?\n(.*?)(?=\(9A\)|9A|\d+\s*Details|Source\s*of\s*income|$)", content, re.IGNORECASE | re.DOTALL)
    if not section_match:
        section_match = re.search(r"\(a\)\s*Self.*?\n(.*)", content, re.IGNORECASE | re.DOTALL)
        
    if section_match:
        block = section_match.group(1)
        spouse_match = re.search(r"(?:spouse|b\)).*?\n(.*)", block, re.IGNORECASE | re.DOTALL)
        if spouse_match:
            res["self"] = clean_profession_text(block[:spouse_match.start()].strip())
            res["spouse"] = clean_profession_text(spouse_match.group(1).strip())
        else:
            res["self"] = clean_profession_text(block)
            res["spouse"] = "Not Found"
        res["success"] = (res["self"] != "Not Found")
    return res

def process_pdfs():
    with open(JSON_PATH, 'r', encoding='utf-8') as f: candidates = json.load(f)
    print(f"🚀 Found {len(candidates)} candidates. Processing missing professions...")

    updated = 0
    skipped = 0
    
    for cand in candidates:
        prof = cand.get('profession', "")
        if prof and prof != "Not Found" and len(prof.strip()) > 3:
            skipped += 1
            print(f"⏩ Skipping {cand['name']} (Already has profession: {prof})")
            continue

        safe_name = "".join([c if c.isalnum() else "_" for c in cand['name']]).lower()
        pdf_path = os.path.join(PDF_DIR, f"{safe_name}.pdf")
        
        if not os.path.exists(pdf_path):
            print(f"➖ Skipping {cand['name']} (PDF not found)")
            continue

        try:
            with pdfplumber.open(pdf_path) as pdf:
                found = False
                for pgno, page in enumerate(pdf.pages):
                    if found: break
                    text = page.extract_text(layout=True)
                    if not text: text = page.extract_text()
                    if not text: continue
                    
                    if "Details of profession" in text or "Details of Profession" in text or "(9) Details of" in text:
                        result = extract_fields(text)
                        if result["success"]:
                            cand['profession'] = result["self"]
                            cand['spouse_profession'] = result["spouse"]
                            print(f"✅ {cand['name']} | Gathered profession[{result['self']}]")
                            found = True
                            updated += 1
                            
                if not found:
                    cand['profession'] = "Not Found"
                    print(f"❌ {cand['name']} | Profession section not found")
        except Exception as e:
            print(f"❌ Error on {cand['name']}: {str(e)[:50]}")
            
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(candidates, f, indent=2)
        
    print(f"\n🏁 Finished! Updated {updated}, Skipped {skipped}.")

if __name__ == "__main__": process_pdfs()
