import os
import json
import pdfplumber
import regex as re
from ocrmac import ocrmac
from PIL import Image
import tempfile

# Paths
PDF_DIR = "public/affidavits"
CANDIDATES_JSON = "src/data/candidates.json"

# Regex for social media URLs and Gmail
SOCIAL_PATTERNS = {
    "facebook": r"(?:https?://)?(?:www\.)?(?:facebook\.com|fb\.com)/[a-zA-Z0-9.]{3,}",
    "instagram": r"(?:https?://)?(?:www\.)?(?:instagram\.com|ig\.me)/[a-zA-Z0-9._]{3,}",
    "x": r"(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/[a-zA-Z0-9_]{3,}",
    "youtube": r"(?:https?://)?(?:www\.)?(?:youtube\.com|youtu\.be)/(?:c/|channel/|user/|@)?[a-zA-Z0-9_-]{3,}",
    "email": r"[a-zA-Z0-9._%+-]+@gmail\.com"
}

# Regex to avoid WhatsApp/Phone numbers (10 digits)
PHONE_PATTERN = r"\b\d{10}\b"

def clean_name(name):
    return re.sub(r'[^a-z0-9]', '_', name.lower()).strip('_')

def extract_socials_from_text(text):
    socials = {"facebook": None, "instagram": None, "x": None, "youtube": None, "email": None}
    for platform, pattern in SOCIAL_PATTERNS.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if not re.search(PHONE_PATTERN, match):
                if not socials[platform]:
                    # Normalize based on platform
                    val = match.strip()
                    if platform == "email":
                        val = val.lower()
                    socials[platform] = val
    return {k: v for k, v in socials.items() if v}

def extract_with_ocrmac(pdf_path):
    socials = {}
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i in range(min(3, len(pdf.pages))):
                page = pdf.pages[i]
                print(f"  Running ocrmac on page {i+1}...")
                
                # Convert page to image and save to temporary file
                # ocrmac works best with high resolution images
                img = page.to_image(resolution=200).original
                
                with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
                    img.save(tmp.name)
                    
                    # Run ocrmac
                    # ocrmac.OCR returns a list of (text, confidence, bbox)
                    results = ocrmac.OCR(tmp.name).recognize()
                    text = " ".join([res[0] for res in results])
                    
                    found = extract_socials_from_text(text)
                    socials.update(found)
                    
                # If we have all, stop
                if all(socials.get(p) for p in SOCIAL_PATTERNS):
                    break
    except Exception as e:
        print(f"  ocrmac Error: {e}")
    return socials

def main():
    # Load candidates
    with open(CANDIDATES_JSON, 'r') as f:
        candidates = json.load(f)
    
    name_to_candidate = {clean_name(cand['name']): cand for cand in candidates}
    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
    
    updated_count = 0
    total_files = len(pdf_files)
    
    for idx, pdf_file in enumerate(pdf_files):
        pdf_name_norm = pdf_file.lower().replace(".pdf", "")
        target_cand = name_to_candidate.get(pdf_name_norm)
        
        if not target_cand:
            for norm_key in name_to_candidate.keys():
                if norm_key in pdf_name_norm or pdf_name_norm in norm_key:
                    target_cand = name_to_candidate[norm_key]
                    break
        
        if target_cand:
            existing_socials = target_cand.get('social_media', {})
            
            # Only search for candidates who have NO data at all
            if existing_socials:
                print(f"[{idx+1}/{total_files}] Skipping {pdf_file} (Already has data)")
                continue

            pdf_path = os.path.join(PDF_DIR, pdf_file)
            print(f"[{idx+1}/{total_files}] Processing {pdf_file} for gaps: {target_cand['name']}...")
            
            # Step 1: Digital pass
            digital_socials = {}
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    text = ""
                    for i in range(min(3, len(pdf.pages))):
                        text += pdf.pages[i].extract_text() or ""
                    digital_socials = extract_socials_from_text(text)
            except:
                pass
            
            # Step 2: ocrmac pass for missing fields
            # We only run OCR if digital pass is missing some fields that weren't in existing_socials either
            missing_fields = [p for p in SOCIAL_PATTERNS if not existing_socials.get(p) and not digital_socials.get(p)]
            
            social_links = digital_socials
            if missing_fields:
                print(f"  Missing fields {missing_fields}, usage ocrmac...")
                ocr_results = extract_with_ocrmac(pdf_path)
                social_links.update(ocr_results)
            
            if social_links:
                if 'social_media' not in target_cand:
                    target_cand['social_media'] = {}
                
                # Merge: only update if found something new
                merged = existing_socials.copy()
                for k, v in social_links.items():
                    if v and not merged.get(k):
                        merged[k] = v
                
                if merged != existing_socials:
                    target_cand['social_media'] = merged
                    updated_count += 1
                    print(f"  Updated: {social_links}")
                    
                    with open(CANDIDATES_JSON, 'w') as f:
                        json.dump(candidates, f, indent=4)
            else:
                if 'social_media' not in target_cand:
                    target_cand['social_media'] = {}

    print(f"\nDone! ocrmac batch updated {updated_count} candidates.")

if __name__ == "__main__":
    main()
