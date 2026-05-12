import os
import json
import re
import pdfplumber
import tempfile
import time
from datetime import datetime
from PIL import Image

# Local AI fallback
try:
    import ollama
    HAS_OLLAMA = True
except ImportError:
    HAS_OLLAMA = False

try:
    from pdf2image import convert_from_path, pdfinfo_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False

# --- PATHS ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDIDATES_JSON = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")
PATCHES_JSON = os.path.join(PROJECT_ROOT, "src", "data", "profession_patches.json")
PDF_DIR = os.path.join(PROJECT_ROOT, "public", "affidavits")

def extract_with_ollama(pdf_path, candidate_name):
    """Fallback strategy using Ollama Vision (gemma3:4b) on the last few pages."""
    if not HAS_OLLAMA or not HAS_PDF2IMAGE:
        return None

    try:
        info = pdfinfo_from_path(pdf_path)
        total_pages = info.get("Pages", 0)
        if total_pages == 0: return None

        # Search the last 10 pages where Part B summary usually lives
        start_page = max(1, total_pages - 9)
        pages = convert_from_path(pdf_path, first_page=start_page, last_page=total_pages)
        
        temp_crop = os.path.join(tempfile.gettempdir(), f"ollama_scan_{int(time.time())}.png")
        
        # Iterate backwards from the end (Part B is usually near the very end)
        for i, page_img in enumerate(reversed(pages)):
            page_num = total_pages - i
            page_img.save(temp_crop, "PNG")
            
            prompt = (
                f"This is an election affidavit for {candidate_name}. "
                "I need to find the 'ABSTRACT' table (PART B). "
                "Look for a table with row 9 labeled 'Profession/Occupation'. "
                "Tell me the 'Self' and 'Spouse' values. "
                "Format EXACTLY as JSON: {\"self\": \"...\", \"spouse\": \"...\"}. "
                "If not found, return {\"self\": \"Not Found\", \"spouse\": \"Not Found\"}"
            )
            
            try:
                response = ollama.chat(
                    model='gemma3:4b',
                    messages=[{"role": "user", "content": prompt, "images": [temp_crop]}]
                )
                raw_response = response['message']['content']
            except Exception as e:
                print(f"⚠️ Ollama Error: {e}")
                continue
                
            if not raw_response: continue

            # Clean and parse JSON
            json_str = raw_response.replace('```json', '').replace('```', '').strip()
            try:
                data = json.loads(json_str)
                if data.get('self') and data['self'].lower() not in ['not found', 'nil', '']:
                    if os.path.exists(temp_crop): os.remove(temp_crop)
                    return data['self'], "ollama_vision"
            except:
                pass
                
        if os.path.exists(temp_crop): os.remove(temp_crop)
        return None
    except Exception as e:
        print(f"❌ Ollama Fallback failed for {candidate_name}: {e}")
        return None

def extract_fields(text):
    """Traditional OCR/Digital extraction logic."""
    text = text.replace('\n', ' ')
    
    # Try multiple common patterns for Part B
    patterns = [
        r'9\s+Profession/Occupation\s+\(a\)\s+Self\s+([^(\n]+)',
        r'Profession/Occupation.*?Self\s+([^(\n]+)',
        r'Self\s+Profession\s*:\s*([^(\n]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1).strip()
            # Clean common OCR noise
            val = re.sub(r'\(.*?\)', '', val).strip()
            if len(val) > 2 and val.lower() not in ['nil', 'n/a']:
                return val
    return None

def process_candidate(candidate, patches):
    name = candidate['name']
    
    # 1. Check Patches First
    if name in patches:
        candidate['profession'] = patches[name]
        candidate['extraction_method'] = "manual_patch"
        return True

    # 2. Skip if already extracted correctly
    if candidate.get('profession') and candidate['profession'] != "Not Found":
        # Keep existing method if already there, else mark as legacy
        if not candidate.get('extraction_method'):
            candidate['extraction_method'] = "local_ocr_legacy"
        return False

    # 3. Try PDF extraction
    filename = name.lower().replace(' ', '_') + ".pdf"
    pdf_path = os.path.join(PDF_DIR, filename)
    
    if not os.path.exists(pdf_path):
        print(f"⚠️ PDF not found for {name}")
        return False

    print(f"🔍 Processing {name}...")
    
    # 3a. Try Local OCR/Digital Extraction first (Free/Fast)
    extracted = None
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Check last 5 pages for Part B
            for page in reversed(pdf.pages[-5:]):
                text = page.extract_text()
                if text:
                    extracted = extract_fields(text)
                    if extracted:
                        candidate['profession'] = extracted
                        candidate['extraction_method'] = "local_ocr"
                        print(f"✅ Local OCR found for {name}: {extracted}")
                        return True
    except:
        pass

    # 3b. Try Ollama Vision Fallback (Smart/Powerful)
    if not extracted and HAS_OLLAMA:
        print(f"🧠 Local OCR failed. Triggering Ollama Vision for {name}...")
        vision_result = extract_with_ollama(pdf_path, name)
        if vision_result:
            prof, method = vision_result
            candidate['profession'] = prof
            candidate['extraction_method'] = method
            print(f"✨ Ollama Vision found for {name}: {prof}")
            return True

    candidate['profession'] = "Not Found"
    candidate['extraction_method'] = "failed"
    return False

def main():
    print(f"🚀 Starting Profession Extraction Pipeline")
    
    with open(CANDIDATES_JSON, 'r') as f:
        candidates = json.load(f)
    
    try:
        with open(PATCHES_JSON, 'r') as f:
            patches = json.load(f)
    except FileNotFoundError:
        patches = {}

    updated_count = 0
    for candidate in candidates:
        if process_candidate(candidate, patches):
            updated_count += 1
            # Save every 5 candidates to prevent data loss
            if updated_count % 5 == 0:
                with open(CANDIDATES_JSON, 'w') as f:
                    json.dump(candidates, f, indent=2)

    with open(CANDIDATES_JSON, 'w') as f:
        json.dump(candidates, f, indent=2)
    
    print(f"\n✅ Finished! Updated {updated_count} candidates.")

if __name__ == "__main__":
    main()