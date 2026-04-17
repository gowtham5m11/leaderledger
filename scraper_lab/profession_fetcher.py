import os
import json
import re
import pdfplumber
import tempfile
from datetime import datetime
from PIL import Image
try:
    from ocrmac import ocrmac
    HAS_OCRMAC = True
except ImportError:
    HAS_OCRMAC = False

# --- PATHS ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(PROJECT_ROOT, "public", "affidavits")
JSON_PATH = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")

def get_timestamp():
    return datetime.now().strftime("%H:%M:%S")

def clean_profession_text(text):
    """Surgical cleaning of extracted labels and OCR noise."""
    if not text: return "Not Found"
    
    # Remove candidate/spouse prefixes and miscellaneous characters
    text = re.sub(r'\(a\)|Self|\(b\)|Spouse|[:\-\—\–\.\,]', '', text, flags=re.IGNORECASE)
    
    # Remove random noise but keep alphabet and common symbols
    text = re.sub(r'[^a-zA-Z\s,&/]', '', text)
    text = text.strip()
    
    # Clean up multiple spaces
    text = re.sub(r'\s+', ' ', text)
    
    lower = text.lower()
    
    # Rejection list for known OCR hallucinations/garbage
    garbage_list = ['percy', 'not applicable', 'nil nil', 'atp', 'acquired', 's/o', 'd/o', 'not found', 'notnot']
    if any(g == lower for g in garbage_list):
        return "Not Found"
    if any(g in lower for g in garbage_list if len(g) > 4):
        return "Not Found"

    # Too short rejection
    if len(text) < 3 and lower not in ['mla', 'mp', 'ips', 'ias', 'ifs']:
        return "Not Found"
        
    return text

def extract_fields(content):
    """Finds Self and Spouse professions in a block of text."""
    res = {"self": "Not Found", "spouse": "Not Found", "success": False}
    
    # capturing the block between (9) and (9A) or similar
    section_match = re.search(r"\(9\)\s*Details\s*of\s*profession.*?\n(.*?)(?=\(9A\)|9A|\d+\s*Details|Source\s*of\s*income|$)", content, re.IGNORECASE | re.DOTALL)
    if not section_match:
        section_match = re.search(r"\(a\)\s*Self.*?\n(.*)", content, re.IGNORECASE | re.DOTALL)
        
    if section_match:
        block = section_match.group(1)
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        
        values = []
        for line in lines:
            val = re.sub(r'^\(a\)\s*Self[ \-\:\—\–\s\.\,]*', '', line, flags=re.IGNORECASE)
            val = re.sub(r'^\(b\)\s*Spouse[ \-\:\—\–\s\.\,]*', '', val, flags=re.IGNORECASE)
            val = val.strip(' :-–—.,')
            if val:
                cleaned = clean_profession_text(val)
                if cleaned != "Not Found":
                    values.append(cleaned)
        
        if len(values) >= 1:
            res["self"] = values[0]
            res["success"] = True
        if len(values) >= 2:
            res["spouse"] = values[1]
            
    return res

def process_candidate(cand):
    safe_name = "".join([c if c.isalnum() else "_" for c in cand['name']]).lower()
    pdf_path = os.path.join(PDF_DIR, f"{safe_name}.pdf")
    
    if not os.path.exists(pdf_path): return {"status": "Missing", "msg": "PDF Missing"}

    try:
        with pdfplumber.open(pdf_path) as pdf:
            likely_pages = []
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and "(9)" in text and "profession" in text.lower():
                    res = extract_fields(text)
                    if res["success"]:
                        res.update({"status": "Success", "pgno": i+1, "method": "digital"})
                        return res
                    likely_pages.append(i)
                elif not text:
                    if 10 <= i <= 25 or i >= len(pdf.pages) - 5:
                        likely_pages.append(i)

            for i in sorted(list(set(likely_pages))):
                page = pdf.pages[i]
                img = page.to_image(resolution=200).original
                with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
                    img.save(tmp.name)
                    ocr_results = ocrmac.OCR(tmp.name).recognize()
                    ocr_text = "\n".join([r[0] for r in ocr_results])
                    
                    if "(9)" in ocr_text or "profession" in ocr_text.lower():
                        res = extract_fields(ocr_text)
                        if res["success"]:
                            res.update({"status": "Success", "pgno": i+1, "method": "OCR"})
                            return res
                            
        return {"status": "Failed", "msg": "Profession section not found"}
    except Exception as e:
        return {"status": "Error", "msg": str(e)}

def main():
    if not os.path.exists(JSON_PATH):
        print(f"Error: {JSON_PATH} not found.")
        return

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        candidates = json.load(f)

    total = len(candidates)
    print(f"[{get_timestamp()}] 🚀 Initiating scan for {total} candidates...\n")

    stats = {"success": 0, "failed": 0, "missing": 0}
    
    for i, cand in enumerate(candidates):
        current_idx = i + 1
        remaining = total - current_idx
        
        # Output format: 1/175 scanning [name] gathered profession[value] on pgno[number] remaining[count]
        print(f"[{get_timestamp()}] {current_idx}/{total} Scanning {cand['name']}...", end="\r")
        
        result = process_candidate(cand)
        
        ts = get_timestamp()
        if result["status"] == "Success":
            cand['profession'] = result['self']
            cand['spouse_profession'] = result['spouse']
            profession = result['self']
            pgno = result['pgno']
            print(f"[{ts}] {current_idx}/{total} ✅ {cand['name']:<30} | Gathered profession[{profession:<15}] on pgno[{pgno:<2}] remaining[{remaining}]")
            stats["success"] += 1
        else:
            cand['profession'] = "Not Found"
            if result["status"] == "Missing": stats["missing"] += 1
            else: stats["failed"] += 1
            msg = result.get("msg", "Unknown error")
            print(f"[{ts}] {current_idx}/{total} ❌ {cand['name']:<30} | {msg:<34} remaining[{remaining}]")

        # Save every 5 candidates
        if current_idx % 5 == 0:
            with open(JSON_PATH, 'w', encoding='utf-8') as f:
                json.dump(candidates, f, indent=2)

    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(candidates, f, indent=2)

    print(f"\n[{get_timestamp()}] 🏁 SCAN COMPLETE | Success: {stats['success']} | Failed: {stats['failed']} | Missing: {stats['missing']}")

if __name__ == "__main__":
    main()