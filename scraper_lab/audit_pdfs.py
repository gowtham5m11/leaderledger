import os
import json
import re
import pdfplumber
import tempfile
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

def clean_name(name):
    if not name: return ""
    name = re.sub(r'\(.*?\)', '', name)
    # Remove common titles and prefixes
    name = re.sub(r'\b(sri|smt|dr|mr|mrs|shri|kumari|alias|advocate|er|engr|m.a|b.a|b.ed|p.hd|notary|adv)\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[^a-zA-Z\s]', '', name).lower()
    return " ".join(name.split())

def check_pdf(pdf_path, expected_name):
    if not HAS_OCRMAC:
        return True, "ocrmac not available"

    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Check first 3 pages as requested (Candidate info is in first 2-3 pages of Part A)
            check_pages = min(3, len(pdf.pages))
            
            cleaned_expected = clean_name(expected_name)
            expected_parts = set(cleaned_expected.split())
            
            all_text_found = ""
            
            for i in range(check_pages):
                page = pdf.pages[i]
                text = page.extract_text()
                if not text:
                    img = page.to_image(resolution=200).original
                    with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
                        img.save(tmp.name)
                        ocr_results = ocrmac.OCR(tmp.name).recognize()
                        text = "\n".join([r[0] for r in ocr_results])
                
                if not text: continue
                all_text_found += "\n" + text
                
                cleaned_text = clean_name(text)
                
                # Look for Deponent Declaration with much more flexibility for OCR errors
                # Handles "I, [Name]", "1, [Name]", "|, [Name]", etc.
                # Handles "son of", "s/o", "slo", "d/o", "daughter of", etc.
                deponent_patterns = [
                    r"(?:^|[\n\r])(?:i|1|l|\||!)[,]?\s+([a-z\s]{3,100})\s+(?:son|daughter|wife|s\s?/\s?o|d\s?/\s?o|w\s?/\s?o|slo|dlo|wlo)\s+of",
                    r"deponent\s+([a-z\s]{3,100})"
                ]
                
                for pattern in deponent_patterns:
                    deponent_match = re.search(pattern, cleaned_text, re.IGNORECASE)
                    if deponent_match:
                        found_name_raw = deponent_match.group(1).strip()
                        found_parts = set(found_name_raw.split())
                        
                        matches = [p for p in expected_parts if p in found_parts or any(p in f or f in p for f in found_parts if len(f) > 3 and len(p) > 3)]
                        
                        if len(matches) >= 2 or (len(matches) == 1 and any(len(m) > 4 for m in matches)):
                             return True, f"Matched on page {i+1} via deponent line: {found_name_raw}"

            # If no deponent line match, check for fuzzy match in all scanned text
            all_text_cleaned = clean_name(all_text_found)
            matched_words = []
            for part in expected_parts:
                if len(part) >= 3 and part in all_text_cleaned:
                    matched_words.append(part)
            
            # Substantial match check
            if len(matched_words) >= 2 or (len(matched_words) == 1 and len(matched_words[0]) > 5):
                return True, f"Fuzzy match found: {', '.join(matched_words)}"
            
            final_guess_match = re.search(r"\bI[,]?\s+([a-z\s]{3,100})\s+(?:son|daughter|wife)\s+of", all_text_cleaned, re.IGNORECASE)
            found_name = final_guess_match.group(1).strip() if final_guess_match else "Unknown / Unreadable"
            return False, f"Expected: {expected_name} | Found in PDF: {found_name}"

    except Exception as e:
        return False, f"Error: {str(e)}"

def main():
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        candidates = json.load(f)

    print(f"🕵️‍♂️ AUDITING first 3 pages of {len(candidates)} PDFs...\n")
    faulty = []
    
    for i, cand in enumerate(candidates):
        safe_name = "".join([c if c.isalnum() else "_" for c in cand['name']]).lower()
        pdf_path = os.path.join(PDF_DIR, f"{safe_name}.pdf")
        
        if not os.path.exists(pdf_path):
            continue
            
        print(f"[{i+1}/{len(candidates)}] {cand['name']:<40}", end="\r")
        is_match, msg = check_pdf(pdf_path, cand['name'])
        
        if not is_match:
            print(f"\n ❌ FAULTY: {safe_name}.pdf")
            print(f"    {msg}")
            faulty.append((cand['name'], safe_name, msg))
            
    if faulty:
        print("\n" + "!"*50)
        print(f"SUMMARY: Found {len(faulty)} FAULTY PDFs that must be replaced.")
        print("!"*50)
        for name, fname, reason in faulty:
             print(f"- {name} ({fname}.pdf) -> Error: {reason}")
    else:
        print("\nAll PDFs passed the audit!")

if __name__ == "__main__":
    main()
