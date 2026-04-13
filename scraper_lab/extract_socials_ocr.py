import os
import json
import ssl

# Bypass SSL certificate verification for model downloads
ssl._create_default_https_context = ssl._create_unverified_context

# Set EasyOCR path before importing easyocr
os.environ['EASYOCR_MODULE_PATH'] = os.path.join(os.getcwd(), "scraper_lab/.EasyOCR")
os.makedirs(os.environ['EASYOCR_MODULE_PATH'], exist_ok=True)

import pdfplumber
import regex as re
import numpy as np
import easyocr
from PIL import Image

# Paths
PDF_DIR = "public/affidavits"
CANDIDATES_JSON = "src/data/candidates.json"

# Regex for social media URLs
SOCIAL_PATTERNS = {
    "facebook": r"(?:https?://)?(?:www\.)?(?:facebook\.com|fb\.com)/[a-zA-Z0-9.]{3,}",
    "instagram": r"(?:https?://)?(?:www\.)?(?:instagram\.com|ig\.me)/[a-zA-Z0-9._]{3,}",
    "x": r"(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/[a-zA-Z0-9_]{3,}",
    "youtube": r"(?:https?://)?(?:www\.)?(?:youtube\.com|youtu\.be)/(?:c/|channel/|user/|@)?[a-zA-Z0-9_-]{3,}",
    "email": r"[a-zA-Z0-9._%+-]+@gmail\.com"
}

# Regex to avoid WhatsApp/Phone numbers (10 digits)
PHONE_PATTERN = r"\b\d{10}\b"

# Create local model directory
MODELS_DIR = os.path.join(os.getcwd(), "scraper_lab/ocr_models")
os.makedirs(MODELS_DIR, exist_ok=True)

# Global OCR Reader
print("Initializing OCR Reader on GPU (Apple Silicon MPS)...")
reader = easyocr.Reader(['en'], gpu=True, model_storage_directory=MODELS_DIR) 

def clean_name(name):
    return re.sub(r'[^a-z0-9]', '_', name.lower()).strip('_')

def extract_socials_from_text(text):
    socials = {"facebook": None, "instagram": None, "x": None, "youtube": None, "email": None}
    for platform, pattern in SOCIAL_PATTERNS.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            if not re.search(PHONE_PATTERN, match):
                if not socials[platform]:
                    socials[platform] = match.strip().lower() # Emails are usually lowercase
    return {k: v for k, v in socials.items() if v}

def extract_socials_with_ocr(pdf_path):
    socials = {}
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i in range(min(3, len(pdf.pages))):
                page = pdf.pages[i]
                print(f"  Performing OCR on page {i+1}...")
                
                # Convert page to image
                img = page.to_image(resolution=150)
                # easyocr needs a numpy array or file path
                img_np = np.array(img.original)
                
                # Read text
                results = reader.readtext(img_np, detail=0)
                text = " ".join(results)
                
                # Extract
                found = extract_socials_from_text(text)
                socials.update(found)
                
                # If we found at least one of each, we can stop
                if all(socials.get(p) for p in SOCIAL_PATTERNS):
                    break
    except Exception as e:
        print(f"  OCR Error on {pdf_path}: {e}")
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
            # Flexible match
            for norm_key in name_to_candidate.keys():
                if norm_key in pdf_name_norm or pdf_name_norm in norm_key:
                    target_cand = name_to_candidate[norm_key]
                    break
        
        if target_cand:
            # Check if we already have all the info (including email)
            existing_socials = target_cand.get('social_media', {})
            
            # If the user only wants Gmail now, we check if email is already there
            if existing_socials.get('email'):
                 print(f"[{idx+1}/{total_files}] Skipping {pdf_file} (already has Email)")
                 continue

            pdf_path = os.path.join(PDF_DIR, pdf_file)
            print(f"[{idx+1}/{total_files}] Processing {pdf_file} for Gmail/Socials: {target_cand['name']}...")
            
            # Step 1: Digital Tries (fast)
            digital_socials = {}
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    text = ""
                    for i in range(min(3, len(pdf.pages))):
                        text += pdf.pages[i].extract_text() or ""
                    digital_socials = extract_socials_from_text(text)
            except:
                pass
            
            # Step 2: OCR Try if digital found nothing or is missing email
            social_links = digital_socials
            if not digital_socials or not digital_socials.get('email'):
                ocr_results = extract_socials_with_ocr(pdf_path)
                social_links.update(ocr_results)
            
            if social_links:
                # MERGE with existing data
                if 'social_media' not in target_cand:
                    target_cand['social_media'] = {}
                
                target_cand['social_media'].update(social_links)
                updated_count += 1
                print(f"  Updated Data: {target_cand['social_media']}")
                
                # Save incrementally
                with open(CANDIDATES_JSON, 'w') as f:
                    json.dump(candidates, f, indent=4)
            else:
                target_cand['social_media'] = {}

    print(f"\nDone! OCR run updated {updated_count} additional candidates.")

if __name__ == "__main__":
    main()
