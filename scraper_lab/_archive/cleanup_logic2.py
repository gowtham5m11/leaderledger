# Archived one-off from the 2024-25 data-cleanup phase (normalised education /
# free-text fields in candidates.json). Committed 2026-05 for provenance only —
# it is NOT part of any current pipeline and is not run anymore; see
# scraper_lab/_archive/README.md. Kept rather than deleted so the history of how
# the data got into its current shape is recoverable.
import json
import re

JSON_PATH = "/Users/gowthamjadapalli/Documents/GitHub/knowyourleader/src/data/candidates.json"

def clean_education_text(text):
    if not text:
        return text
    
    original = text
    
    # Pre-clean
    text = text.replace("completed ", "")
    
    # 1. Remove pure noise strings entirely (if the string matches crime or property or numbers)
    if "Tadepalli PS Cr. No:" in text or "Supply of Goods Contract" in text or "00 345.00 3 in 958.21" in text or "088 088 P A11" in text or "2026 SRIKAKULAM" in text or "Commission Expires" in text or "7 in 2026" in text or "Rs." in text or "Rs " in text:
        # Check if we can salvage anything, usually we can't from these pure junk ones easily without specific regex, 
        # but let's just mark them to be manually fixed or use a specific dict override later.
        pass
        
    # Strip common garbage phrases regardless of where they are
    garbage_phrases = [
        r"diploma\s*degret\s*course, Same of the sero duleien university a the the yearn one the oute was completed\.\)",
        r"\(Give.*?\)", 
        r"\( mentioning.*?\)",
        r"NOTARY.*", 
        r"ADVOCATE.*",
        r"O Scanned with OKEN Scanner",
        r"Scanned with OKEN Scanner",
        r"ATTESTED.*",
        r"\*.*",
        r"NA NA.*",
        r"Not Not Applicable.*",
        r"NOT NOT APPLICABLE.*",
        r"NOT APPLICABLE.*",
        r"T MPLICAR PLICAD MAPLICABI\. росли росло росло",
        r"D APF G\.O\.No\.: 314/2012 PANTED BY GOT Page in 19 - of",
        r"Dues to depa rtments dealing N. A Government accommodation",
        r"Dues to depa rtments dealing.*",
        r"Government accommodation.*",
        r"JULEMNLY AFFIRMED AND SIGNED.*",
        r"GO\.Ms\.No\.2744/11 Approved by",
        r"GOMS1206/2011",
        r"REVENUE WOTARY.*",
        r"Commn\. Exp\. by.*",
        r"As such I have no arrears.*",
        r"I have not been Provided any Government accommodation.*",
        r"Receined Copy.*",
        r"00 AM on 26\.04\.2024.*",
        r"a candidate in the above election.*",
        r"Cell: \d+",
        r"Mobile: \d+"
    ]
    
    for phrase in garbage_phrases:
        text = re.sub(phrase, "", text, flags=re.IGNORECASE|re.DOTALL)
        
    # Extra cleanup
    text = re.sub(r' +', ' ', text)
    text = text.strip()
    text = text.lstrip(',.- \t')
    text = text.rstrip(',.- \t')
    
    # Standardize phrasing
    if text:
        text = "completed " + text
        
    return text

# Dictionary of specific overrides for completely garbled or missing data
# Based on the scratch_t1.json Review
overrides = {
    3: "completed Masters in Business Administration from Andhra University in 1996",
    5: "completed 12th Pass (Intermediate)", # Mamidi Govinda Rao (Pathapatnam)
    6: "completed B.Sc from Andhra University", # Bonela Vijaya Chandra (Parvathipuram)
    7: "completed B.Sc from Andhra University", # Gummidi Sandhyarani (Salur)
    8: "completed B.Sc (Discontinued) from V.S. Krishna College in 1991", # Atchannaidu
    10: "completed Master of Business Administration from Andhra University in 1997",
    11: "completed Master of Business Administration from Andhra University in 1997",
    17: "completed Bachelor of Law from Andhra University in 1980", # Kalavenkatarao
    18: "completed Bachelor of Law from Andhra University in 1980", # Lokam Naga Madhavi
    20: "completed B.A. from IGNOU in 2021", # Aditi Vijayalakshmi Gajapathi Raju Pusapati
    23: "completed B.A from Andhra University, Visakhapatnam", # Ganta Srinivasa Rao
    26: "completed B.Com from Andhra University in 1998", # Panchakarla Ramesh Babu
    32: "completed B.Tech from Andhra University", # Palla Srinivas Rao
    33: "completed Master of Arts (Politics) from Andhra University in 2017",
    41: "completed 10th Class (SSC) from St. Josephs English Medium High School in 1984", # Pawan Kalyan
    50: "completed Intermediate from Board of Intermediate Education, AP",
    59: "completed M.A from Andhra University, Waltair", # Kandula Durgesh
    60: "completed Intermediate from Board of Intermediate Education, AP", # Chintamaneni Prabhakar
    61: "completed B.A from Andhra University", # Dharmaraju Patsamatla
    71: "completed B.Com from Andhra University", # Satyanarayana Pithani
    73: "completed 10th Class (SSC)", # Julakanti Brahmananda Reddy
    76: "completed B.A from Andhra University", # Tenali Sravan Kumar
    78: "completed 9th Class from BSRK Municipal Schoool, Vijayawada in 1980",
    93: "completed M.A from Nagarjuna University", # Galla Madhavi
    94: "completed MBBS from Guntur Medical College", # Aravinda Babu Chadalavada
    97: "completed B.Com from Nagarjuna University in 1980", # Prathipati Pullarao
    131: "completed BDS from Rajiv Gandhi University of Health Sciences", # Ashmit Reddy
    133: "completed B.Tech from JNTU in 2011", # Kakarla Suresh
    134: "completed B.A from S.V University", # Adinarayana Reddy
    136: "completed B.E from Bangalore University", # Dagumati Venkata Krishna Reddy
    140: "completed B.E from Osmania University", # Daggupati Prasad
    148: "completed Intermediate from Board of Intermediate Education, AP", # Kurugondla Ramakrishna
    149: "completed MBBS from S.V University", # Madhavi Reddappa Gari
    153: "completed MBBS from Dr. NTR University of Health Sciences", # Palle Sindhura Reddy
    168: "completed M.A from S.V University in 1975" # Peddireddi Ramachandra Reddy
}

with open(JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

for cand in data:
    cid = cand.get('id')
    if cid in overrides:
        cand['education'] = overrides[cid]
    else:
        cand['education'] = clean_education_text(cand['education'])

with open(JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("✨ Cleanup logic 2 complete!")
