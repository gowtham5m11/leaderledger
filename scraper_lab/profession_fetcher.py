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
PATCH_PATH = os.path.join(PROJECT_ROOT, "src", "data", "profession_patches.json")

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
    """Finds Self profession in a block of text with multiple fallbacks."""
    res = {"self": "Not Found", "success": False}
    
    # 1. Standard Anchor (9) in Part A
    section_match = re.search(r"(?:\(9\)|9\.?|\[9\])\s*Details\s*of\s*(?:profession|occupation).*?\n(.*?)(?=\(9A\)|9A|10\.?\s*Details|Source\s*of\s*income|$)", content, re.IGNORECASE | re.DOTALL)
    
    # 2. Fallback: Part B Abstract Section
    if not section_match:
        # Part B usually has a row labeled 9 or similar
        section_match = re.search(r"PART\s*B.*?9\.?\s*(?:Details\s*of\s*)?(?:profession|occupation)(.*?)(?=10|$)", content, re.IGNORECASE | re.DOTALL)

    # 3. Last Resort: Just find "Self" near "profession"
    if not section_match and "profession" in content.lower():
        section_match = re.search(r"(?:profession|occupation).*?(Self.*?)(?=10|$|Spouse)", content, re.IGNORECASE | re.DOTALL)

    if section_match:
        block = section_match.group(1)
        
        # Self Fallback: Look for (a) or Self or Candidate
        self_match = re.search(r"(?:\(a\)|Self|Candidate)[ \-\:\—\–\s\.\,]*(.*?)(?=\(b\)|Spouse|$)", block, re.IGNORECASE | re.DOTALL)
        # If still no self match, but we have a block, try to take the first line if it's not the label itself
        if not self_match and len(block.strip()) > 5:
            first_line = block.strip().split("\n")[0]
            if len(first_line) > 3:
                res["self"] = clean_profession_text(first_line)
                res["success"] = (res["self"] != "Not Found")

        if self_match:
            val = self_match.group(1).strip(" \n:-–—.,")
            if val:
                cleaned = clean_profession_text(val)
                if cleaned != "Not Found":
                    res["self"] = cleaned
                    res["success"] = True
                    
    return res

def process_candidate(cand):
    safe_name = "".join([c if c.isalnum() else "_" for c in cand['name']]).lower()
    pdf_path = os.path.join(PDF_DIR, f"{safe_name}.pdf")
    
    if not os.path.exists(pdf_path): return {"status": "Missing", "msg": "PDF Missing"}

    try:
        with pdfplumber.open(pdf_path) as pdf:
            likely_pages = set()
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if "(9)" in text and "profession" in text.lower():
                    res = extract_fields(text)
                    if res["success"]:
                        res.update({"status": "Success", "pgno": i+1, "method": "digital"})
                        return res
                
                # If we're at page 10-30, or the last 6 pages, it's a likely page
                if 10 <= i <= 28 or i >= len(pdf.pages) - 6:
                    likely_pages.add(i)

            for i in sorted(list(likely_pages)):
                page = pdf.pages[i]
                # High resolution for better OCR
                img = page.to_image(resolution=250).original
                with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
                    img.save(tmp.name)
                    ocr_results = ocrmac.OCR(tmp.name).recognize()
                    ocr_text = "\n".join([r[0] for r in ocr_results])
                    
                    # More flexible trigger
                    if "(9)" in ocr_text or "profession" in ocr_text.lower() or "occupation" in ocr_text.lower() or "PART B" in ocr_text:
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
    
    # Load patches if they exist
    patches = {}
    if os.path.exists(PATCH_PATH):
        try:
            with open(PATCH_PATH, 'r', encoding='utf-8') as f:
                patches = json.load(f)
        except:
            print(f"⚠️ Warning: Could not parse {PATCH_PATH}")

    for i, cand in enumerate(candidates):
        current_idx = i + 1
        remaining = total - current_idx
        
        # Check for manual patch FIRST or as a fallback
        safe_key = "".join([c if c.isalnum() else "_" for c in cand['name']]).lower()
        
        # Logic: If already has profession and it is not "Not Found", skip.
        # Otherwise, try automated scan. If automated fails, check patches.
        
        has_valid_profession = cand.get('profession') and cand.get('profession') != "Not Found"
        
        if has_valid_profession:
            print(f"[{get_timestamp()}] {current_idx}/{total} ⏩ Skipping {cand['name']:<30} | Already has profession[{cand['profession']:<15}] remaining[{remaining}]")
            stats["success"] += 1
            continue
            
        print(f"[{get_timestamp()}] {current_idx}/{total} Scanning {cand['name']}...", end="\r")
        
        result = process_candidate(cand)
        
        ts = get_timestamp()
        if result["status"] == "Success":
            cand['profession'] = result['self']
            profession = result['self']
            pgno = result['pgno']
            print(f"[{ts}] {current_idx}/{total} ✅ {cand['name']:<30} | Gathered profession[{profession:<15}] on pgno[{pgno:<2}] remaining[{remaining}]")
            stats["success"] += 1
        else:
            # Automated failed, check manual patches
            if safe_key in patches:
                cand['profession'] = patches[safe_key].get('profession', 'Not Found')
                print(f"[{ts}] {current_idx}/{total} 🛠️  Patched {cand['name']:<30} | Manual Patch Applied            remaining[{remaining}]")
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