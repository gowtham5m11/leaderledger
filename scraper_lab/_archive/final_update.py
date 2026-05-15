import json
import os
import pdfplumber
import regex as re

CANDIDATES_JSON = "/Users/gowthamjadapalli/Documents/GitHub/leaderledger/src/data/candidates.json"
PDF_DIR = "/Users/gowthamjadapalli/Documents/GitHub/leaderledger/public/affidavits"

# DATA FROM BROWSER SEARCH
BROWSER_DATA = {
    "Bathula Balaramakrishna S/O Gangarao": {
        "facebook": "https://www.facebook.com/battulabalaramakrishna/",
        "x": "https://x.com/BattulaBalarama",
        "instagram": "https://www.instagram.com/balaramakrishnabattula/"
    },
    "Kolikapudi Srinivasa Rao": {
        "facebook": "https://www.facebook.com/p/Kolikapudi-Srinivasa-Rao-100069940747834/",
        "x": "https://x.com/rao_kolikapudi",
        "instagram": "https://www.instagram.com/kolikapudi.srinivasarao/"
    },
    "Kolusu Partha Sarathy": {
        "facebook": "https://www.facebook.com/kolusu.parthasarathy.official/",
        "x": "https://x.com/kpsarathyTDP",
        "instagram": "https://www.instagram.com/kolusu.parthasarathy/"
    },
    "Bandaru Satyananda Rao": {
        "facebook": "https://www.facebook.com/BandaruSatyanandaRao/",
        "x": "https://x.com/BSatyanandaRao",
        "instagram": "https://www.instagram.com/bandaru_satyanandarao/"
    },
    "Bandaru Satyanarayana Murthy": {
        "facebook": "https://www.facebook.com/BandaruSNM/",
        "x": "https://x.com/BandaruSNMTDP",
        "instagram": "https://www.instagram.com/bandarusnm/"
    },
    "Chintamaneni Prabhakar": {
        "facebook": "https://www.facebook.com/ChintamaneniTDP/",
        "x": "https://x.com/ChintamaneniTDP",
        "instagram": "https://www.instagram.com/chintamanenitdp/"
    },
    "Dharmaraju Patsamatla": {
        "facebook": "https://www.facebook.com/Dharmaraju.Patsamatla.JSPunguturu/",
        "x": "https://x.com/DharmarajuPdr",
        "instagram": "https://www.instagram.com/patsamatla_dharmaraju_pdr/"
    },
    "Vasamsetti Subash": {
        "facebook": "https://www.facebook.com/vasamsettisubashyuvasena/",
        "x": "https://x.com/ministersubashv",
        "instagram": "https://www.instagram.com/vasamsettisubash/"
    },
    "Tenali Sravan Kumar": {
        "facebook": "https://www.facebook.com/SravanKumarMLA/",
        "x": "https://x.com/SravanTenali",
        "instagram": "https://www.instagram.com/sravankumar.tenali/"
    },
    "Kumar Raja Varla": {
        "facebook": "https://www.facebook.com/VarlaKumarRajaOfficial/",
        "x": "https://x.com/VarlaKumarRaja",
        "instagram": "https://www.instagram.com/kumarvarla/"
    }
}

SOCIAL_PATTERNS = {
    "facebook": r"(?:https?://)?(?:www\.)?(?:facebook\.com|fb\.com)/[a-zA-Z0-9.]{3,}",
    "instagram": r"(?:https?://)?(?:www\.)?(?:instagram\.com|ig\.me)/[a-zA-Z0-9._]{3,}",
    "x": r"(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/[a-zA-Z0-9_]{3,}",
    "youtube": r"(?:https?://)?(?:www\.)?(?:youtube\.com|youtu\.be)/(?:c/|channel/|user/|@)?[a-zA-Z0-9_-]{3,}",
    "email": r"[a-zA-Z0-9._%+-]+@gmail\.com"
}

def extract_socials_from_text(text):
    socials = {}
    for platform, pattern in SOCIAL_PATTERNS.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            val = matches[0].strip()
            if platform == "email": val = val.lower()
            socials[platform] = val
    return socials

def main():
    with open(CANDIDATES_JSON, 'r') as f:
        candidates = json.load(f)
    
    updated_count = 0
    
    for cand in candidates:
        name = cand['name']
        
        # 1. Apply Browser Data
        if name in BROWSER_DATA:
            if 'social_media' not in cand: cand['social_media'] = {}
            for k, v in BROWSER_DATA[name].items():
                if not cand['social_media'].get(k):
                    cand['social_media'][k] = v
                    updated_count += 1
        
        # 2. Extract from PDFs if missing major socials
        has_major = any(cand.get('social_media', {}).get(p) for p in ['facebook', 'instagram', 'x'])
        if not has_major:
            # Match PDF filename
            safe_name = "".join([c if c.isalnum() else "_" for c in name]).lower()
            pdf_path = os.path.join(PDF_DIR, f"{safe_name}.pdf")
            
            if os.path.exists(pdf_path):
                print(f"Extracting for {name}...")
                try:
                    with pdfplumber.open(pdf_path) as pdf:
                        # Scan first 5 and last 2 pages
                        pages = set(range(min(5, len(pdf.pages)))) | set(range(max(0, len(pdf.pages)-2), len(pdf.pages)))
                        text = ""
                        for p in sorted(list(pages)):
                            text += pdf.pages[p].extract_text() or ""
                        
                        found = extract_socials_from_text(text)
                        if found:
                            if 'social_media' not in cand: cand['social_media'] = {}
                            for k, v in found.items():
                                if not cand['social_media'].get(k):
                                    cand['social_media'][k] = v
                                    updated_count += 1
                except:
                    pass

    with open(CANDIDATES_JSON, 'w') as f:
        json.dump(candidates, f, indent=4)
        
    print(f"Done! Final update cycle changed {updated_count} fields.")

if __name__ == "__main__":
    main()
