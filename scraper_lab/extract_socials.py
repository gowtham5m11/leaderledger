import os
import json
import pdfplumber
import regex as re

# Paths
PDF_DIR = "public/affidavits"
CANDIDATES_JSON = "src/data/candidates.json"

# Regex for social media URLs
SOCIAL_PATTERNS = {
    "facebook": r"(?:https?://)?(?:www\.)?(?:facebook\.com|fb\.com)/[a-zA-Z0-9.]{3,}",
    "instagram": r"(?:https?://)?(?:www\.)?(?:instagram\.com|ig\.me)/[a-zA-Z0-9._]{3,}",
    "x": r"(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/[a-zA-Z0-9_]{3,}",
    "youtube": r"(?:https?://)?(?:www\.)?(?:youtube\.com|youtu\.be)/(?:c/|channel/|user/|@)?[a-zA-Z0-9_-]{3,}"
}

# Regex to avoid WhatsApp/Phone numbers (10 digits)
PHONE_PATTERN = r"\b\d{10}\b"
WHATSAPP_PATTERN = r"\b(?:whatsapp|wa\.me)\b"

def clean_name(name):
    """Normalize names for matching: lowercase and replace spaces with underscores."""
    return re.sub(r'[^a-z0-9]', '_', name.lower()).strip('_')

def extract_socials_from_pdf(pdf_path):
    socials = {"facebook": None, "instagram": None, "x": None, "youtube": None}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Only first 3 pages as requested
            text = ""
            for i in range(min(3, len(pdf.pages))):
                text += pdf.pages[i].extract_text() or ""
            
            # Remove 10-digit numbers to avoid false positives if any URL contains them (unlikely for social slugs but good to be safe)
            # However, the user said "Do NOT extract or store any strings identified as WhatsApp numbers or 10-digit phone numbers."
            # So I will just make sure my patterns don't match phone numbers and I ignore phone results.
            
            for platform, pattern in SOCIAL_PATTERNS.items():
                matches = re.findall(pattern, text, re.IGNORECASE)
                for match in matches:
                    # Basic validation: ensure it doesn't look like a phone number
                    if not re.search(PHONE_PATTERN, match):
                        if not socials[platform]:
                            socials[platform] = match.strip()
                            
    except Exception as e:
        print(f"Error processing {pdf_path}: {e}")
        
    return {k: v for k, v in socials.items() if v}

def main():
    # Load candidates
    with open(CANDIDATES_JSON, 'r') as f:
        candidates = json.load(f)
    
    # Map candidates by normalized name
    # Also handle the fact that some names in JSON might have @ or other chars
    name_to_candidate = {}
    for cand in candidates:
        norm = clean_name(cand['name'])
        name_to_candidate[norm] = cand
    
    # Iterate PDFs
    pdf_files = [f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")]
    
    updated_count = 0
    for pdf_file in pdf_files:
        pdf_name_norm = pdf_file.lower().replace(".pdf", "")
        # The filenames already seem normalized (underscores)
        # But let's check for direct matches or fuzzy matches if needed.
        
        target_cand = name_to_candidate.get(pdf_name_norm)
        
        if not target_cand:
            # Try a slightly more flexible match if direct fails
            # Search for the pdf_name_norm in the keys
            for norm_key in name_to_candidate.keys():
                if norm_key in pdf_name_norm or pdf_name_norm in norm_key:
                    target_cand = name_to_candidate[norm_key]
                    break
        
        if target_cand:
            pdf_path = os.path.join(PDF_DIR, pdf_file)
            print(f"Processing {pdf_file} for {target_cand['name']}...")
            social_links = extract_socials_from_pdf(pdf_path)
            
            if social_links:
                target_cand['social_media'] = social_links
                updated_count += 1
                print(f"  Found: {social_links}")
            else:
                target_cand['social_media'] = {}
        else:
            print(f"No candidate found for {pdf_file}")

    # Write back
    with open(CANDIDATES_JSON, 'w') as f:
        json.dump(candidates, f, indent=4)
        
    print(f"\nDone! Updated {updated_count} candidates.")

if __name__ == "__main__":
    main()
