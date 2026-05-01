import os
import json
import re
import pdfplumber
import ocrmac.ocrmac as ocrmac
from pdf2image import convert_from_path
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing
import tempfile
from PIL import ImageFile

# Allow loading of truncated images found in some PDFs
ImageFile.LOAD_TRUNCATED_IMAGES = True

# --- CATEGORIZATION LOGIC ---
SERIOUS_IPC = [302, 304, 307, 323, 324, 325, 326, 332, 354, 363, 364, 365, 366, 376, 379, 380, 392, 395, 396, 411, 452, 506]
CORRUPTION_IPC = [420, 406, 409, 467, 468, 471, 120] # 120B
POLITICAL_IPC = [143, 147, 148, 149, 151, 188, 283, 341, 353]
ELECTION_IPC = list(range(171, 180)) # 171A to 171I

def classify_sections(sections_text):
    text = str(sections_text).upper()
    if not text or "NIL" in text or "NOT APPLICABLE" in text:
        return "Minor/Other"
    
    # Extract all numbers
    nums = [int(n) for n in re.findall(r"\b\d+\b", text)]
    
    # Priority 1: Serious/Violent
    if any(n in SERIOUS_IPC for n in nums) or any(kw in text for kw in ["MURDER", "RAPE", "ATTEMPT TO", "DACOITY", "KIDNAP"]):
        return "Serious/Violent"
        
    # Priority 2: Corruption
    if any(n in CORRUPTION_IPC for n in nums) or any(kw in text for kw in ["PC ACT", "CHEATING", "FORGERY", "FRAUD"]):
        return "Corruption & Fraud"
        
    # Priority 3: Election
    if any(n in ELECTION_IPC for n in nums) or "REPRESENTATION OF THE PEOPLE" in text:
        return "Election Offenses"
        
    # Priority 4: Political/Protest
    if any(n in POLITICAL_IPC for n in nums) or "UNLAWFUL ASSEMBLY" in text or "RIOT" in text:
        return "Political/Protest"
    
    return "Minor/Other"


# --- CONFIG ---
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = os.path.join(PROJECT_ROOT, "public", "affidavits")
CANDIDATES_JSON = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")
OUT_JSON = os.path.join(PROJECT_ROOT, "src", "data", "criminal_details.json")
PATCHES_JSON = os.path.join(PROJECT_ROOT, "src", "data", "criminal_patches.json")

def load_patches():
    if os.path.exists(PATCHES_JSON):
        with open(PATCHES_JSON, "r") as f:
            return json.load(f)
    return {}

def get_handwritten_text(pdf_path, page_num, cand_id="global"):
    """Fallback: Converts a page to image and uses ocrmac for handwriting with unique temp names."""
    images = convert_from_path(pdf_path, first_page=page_num+1, last_page=page_num+1, dpi=150)
    temp_img = os.path.join(tempfile.gettempdir(), f"ocr_{cand_id}_{page_num}.png")
    
    try:
        images[0].save(temp_img, "PNG")
        annotations = ocrmac.OCR(temp_img).recognize()
        full_text = " ".join([a[0] for a in annotations])
        return full_text
    finally:
        if os.path.exists(temp_img):
            os.remove(temp_img)
    return ""

def extract_criminal_details(pdf_path, cand_id="global"):
    cases = {"pending": [], "convictions": []}
    unique_cases = set()
    
    try:
        print(f"  - Opening PDF: {os.path.basename(pdf_path)}")
        with pdfplumber.open(pdf_path) as pdf:
            total_pgs = len(pdf.pages)
            print(f"  - Total pages: {total_pgs}. Scanning all pages for keywords...")
            
            in_criminal_section = False
            for i in range(total_pgs):
                page = pdf.pages[i]
                print(f"    - Checking page {i+1}/{total_pgs}...", end="\r")
                text = page.extract_text() or ""
                ocr_taken = False
                
                # DEEP SCAN FALLBACK: If we know they have cases but keep finding 0, 
                # or if the text looks like garbage, force OCR.
                words = re.findall(r'\b\w{3,}\b', text.lower())
                is_garbage = len(text) > 150 and len(words) < 5 
                
                # Deep Scan: If this is a re-run for a 0-case candidate, we might force OCR here
                # (Logic handled in process_single_candidate by passing a flag if needed)
                
                if len(text.strip()) < 150 or is_garbage:
                    text = get_handwritten_text(pdf_path, i, cand_id)
                    ocr_taken = True
                
                # Check for section headers AND table-column headers
                has_record_headers = any(re.search(kw, text, re.I) for kw in [
                    r"FIR\s*No", r"Crime\s*No", r"Police\s*Station", r"Section", r"U/S"
                ])
                
                if any(re.search(kw, text, re.I) for kw in [
                    r"\(5\)\s*pending", r"pending\s*criminal\s*cases", 
                    r"cases\s*of\s*conviction", r"\(6\)\s*cases",
                    r"Details\s*of\s*pending", r"criminal\s*cases\s*against",
                    r"item\s*5", r"5\s*pending"
                ]) or (re.search(r"pending", text, re.I) and re.search(r"criminal", text, re.I)) or has_record_headers:
                    in_criminal_section = True
                
                # Exit capture mode if we hit Assets or Liabilities (only if we're well past the headers)
                if i > 2 and any(re.search(kw, text, re.I) for kw in [r"\(7\)\s*Details", r"\(8\)\s*Details", r"ASSETS\s*AND\s*LIABILITIES"]):
                    if not has_record_headers: # Don't exit if we still see FIR/Crime headers on this page
                         in_criminal_section = False

                is_criminal_pg = in_criminal_section or any(re.search(kw, text, re.I) for kw in [
                    r"FIR\s*No", r"Police\s*Station", r"IPC", r"CrPC", r"U/S", r"Section\s*\d+", r"CR\.NO", r"CRIME\s*NO"
                ])
                
                if is_criminal_pg:
                    tables = []
                    # Only try digital table extraction if we didn't already OCR the page
                    if not ocr_taken:
                        tables = page.extract_tables()
                    
                    if not tables or not any(len(t) > 0 for t in tables):
                        # Split by case numbers or bullet points
                        blocks = re.split(r"(?:\n\s*\d+[\.\)]|\n\s*\(?[a-z]\)|\n\s*\(v?i+\))", text)
                        for block in blocks:
                            if any(k in block.upper() for k in ["FIR", "IPC", "SECTION", "P.S", "POLICE", "U/S", "CR.NO", "CRIME NO", "COURT"]):
                                clean_block = block.strip().replace("\n", " ")
                                if any(dec in clean_block.upper() for dec in ["I ALSO DECLARE", "I HEREBY DECLARE"]): continue
                                
                                # Try to find a unique identifier for deduplication
                                fir_match = re.search(r"(\d+)\s*[/|of|-]\s*(\d{2,4})", clean_block)
                                ps_match = re.search(r"P\.S|Police\s*Station\s*[:\-]\s*([A-Za-z\s]+)", clean_block, re.I)
                                ps_name = (ps_match.group(1).strip() if ps_match and ps_match.group(1) else "")
                                
                                # Highly specific key: (FIR, Year, Police Station, First 20 chars of text)
                                fir_key = (fir_match.group(1), fir_match.group(2), ps_name.lower()) if fir_match else (clean_block[:100].lower())
                                
                                if fir_key not in unique_cases:
                                    unique_cases.add(fir_key)
                                    target = "convictions" if "CONVICT" in clean_block.upper() else "pending"
                                    cases[target].append({
                                        "raw_text": clean_block[:1000],
                                        "page": i+1,
                                        "method": "Text/OCR"
                                    })
                        if tables:
                            for table in tables:
                                if not table: continue
                                
                                # Check if this is a VERTICAL table (columns are cases)
                                # Look for vertical headers in the first 2 columns
                                is_vertical = False
                                for row in table[:min(15, len(table))]:
                                    row_head = " ".join([str(c) for c in row[:2] if c is not None]).upper()
                                    if "DESCRIPTION OF OFFENCE" in row_head or "BRIEF DESCRIPTION" in row_head or "SECTION" in row_head:
                                        is_vertical = True
                                        break
                                
                                if is_vertical:
                                    # Transpose the table: columns become rows
                                    num_cols = len(table[0])
                                    transposed = []
                                    # Skip the first 2 header columns (a, b, c, d label columns)
                                    for col_idx in range(2, num_cols):
                                        new_row = [str(table[r][col_idx]) for r in range(len(table)) if col_idx < len(table[r])]
                                        transposed.append(new_row)
                                    rows_to_process = transposed
                                else:
                                    rows_to_process = table

                                for row in rows_to_process:
                                    if not row: continue
                                    # Safe cell cleaning: ignore None cells
                                    clean_row = [str(cell).strip() for cell in row if cell is not None]
                                    row_str = " ".join(clean_row)
                                    if any(kw in row_str.upper() for kw in ["IPC", "SECTION", "COURT", "CASE", "FIR", "U/S", "CR.NO", "CRIME NO", "POLICE", "PS"]):
                                        # Deduplicate tables
                                        fir_match = re.search(r"(\d+)\s*[/|of|-]\s*(\d{2,4})", row_str)
                                        fir_key = fir_match.groups() if fir_match else row_str[:50]
                                        
                                        # Try to find description column
                                        description = ""
                                        desc_keywords = ["DESCRIPTION", "OFFENCE", "NATURE", "DETAILS", "IPC"]
                                        
                                        # If vertical, the 'row' itself is the case data, just find the longest non-header part
                                        if is_vertical:
                                            # Filter out common header-like text
                                            description = " ".join([c for c in clean_row if len(c) > 30 and "DESCRIPTION" not in c.upper()])
                                        else:
                                            for idx, cell in enumerate(clean_row):
                                                if any(dk in cell.upper() for dk in desc_keywords) and len(cell) > 20:
                                                    description = cell
                                                    break
                                        
                                        if not description and len(clean_row) > 1:
                                            description = max(clean_row, key=len)

                                        if fir_key not in unique_cases:
                                            unique_cases.add(fir_key)
                                            target = "convictions" if "CONVICT" in row_str.upper() else "pending"
                                            cases[target].append({
                                                "raw_text": row_str[:1000],
                                                "description": description[:500],
                                                "page": i+1,
                                                "method": "Table"
                                            })
            
            # Categorize and Summarize
            summary = {
                "num_criminal_cases": len(cases["pending"]),
                "num_convictions": len(cases["convictions"]),
                "pending_by_category": {
                    "Serious/Violent": 0, "Corruption & Fraud": 0, "Political/Protest": 0, "Election Offenses": 0, "Minor/Other": 0
                }
            }
            
            # Advanced De-duplication Logic
            for key in ["pending", "convictions"]:
                unique_cases = []
                seen_signatures = set()
                
                for c in cases[key]:
                    # NORMALIZE SIGNATURE
                    fir = str(c.get('fir_no', '')).upper()
                    raw = str(c.get('raw_text', '')).upper()
                    sect = str(c.get('sections', '')).upper()
                    
                    combined_text = (fir + " " + raw + " " + sect).replace(" ", "")
                    # Extract Number and Year
                    fir_match = re.search(r"(\d+)\s*[/|of|-]\s*(\d{2,4})", combined_text)
                    
                    if fir_match:
                        num = str(int(fir_match.group(1)))
                        year = fir_match.group(2)
                        if len(year) == 2: year = "20" + year
                        combined_sig = f"{num}/{year}"
                    else:
                        # If no FIR, we only count it if it's high-confidence text
                        if len(raw) < 50: continue # Ignore snippets
                        combined_sig = re.sub(r'[^A-Z0-9]+', '', raw)[:50]
                    
                    if combined_sig and combined_sig not in seen_signatures:
                        seen_signatures.add(combined_sig)
                        unique_cases.append(c)
                
                cases[key] = unique_cases

            # Update Summary with De-duplicated counts
            summary["num_criminal_cases"] = len(cases["pending"])
            summary["num_convictions"] = len(cases["convictions"])
            for item in cases["pending"]:
                cat = classify_sections(item.get("sections", "") or item.get("raw_text", ""))
                item["category"] = cat
                summary["pending_by_category"][cat] += 1
            cases["summary"] = summary

    except Exception as e:
        print(f"\n  - Error processing {pdf_path}: {e}")
    
    return cases

# --- MAIN EXECUTION ---
def main():
    if not os.path.exists(CANDIDATES_JSON):
        print(f"Error: {CANDIDATES_JSON} not found.")
        return

    with open(CANDIDATES_JSON, 'r', encoding='utf-8') as f:
        candidates = json.load(f)

    # --- MIGRATION LOGIC ---
    # If the old log file exists, merge it into candidates.json and then we will delete it
    if os.path.exists(OUT_JSON):
        print(f"Migrating data from {os.path.basename(OUT_JSON)} into candidates.json...")
        try:
            with open(OUT_JSON, 'r', encoding='utf-8') as f:
                old_details = json.load(f)
            
            for cand in candidates:
                cid = str(cand["id"])
                if cid in old_details:
                    cand["criminal_summary"] = old_details[cid].get("summary")
                    cand["criminal_details_pending"] = old_details[cid].get("pending", [])
                    cand["criminal_details_convictions"] = old_details[cid].get("convictions", [])
            
            # Save the migrated data immediately
            with open(CANDIDATES_JSON, 'w', encoding='utf-8') as f:
                json.dump(candidates, f, indent=2)
            
            # Delete the old file as requested
            os.remove(OUT_JSON)
            print(f"Migration complete. {os.path.basename(OUT_JSON)} has been removed.")
        except Exception as e:
            print(f"Warning during migration: {e}")

def process_single_candidate(cand):
    """Worker function for parallel processing."""
    try:
        safe_name = "".join([c if c.isalnum() else "_" for c in cand['name']]).lower()
        
        # CHECK FOR MANUAL PATCH FIRST
        patches = load_patches()
        if safe_name in patches:
            patch = patches[safe_name]
            print(f"  - Using manual patch for {cand['name']} ({patch['num_criminal_cases']} cases)")
            results = {
                "summary": {
                    "num_criminal_cases": patch['num_criminal_cases'],
                    "num_convictions": patch['num_convictions'],
                    "pending_by_category": {"Patched": patch['num_criminal_cases']},
                    "source": patch.get("source", "Manual Patch")
                },
                "pending": [],
                "convictions": []
            }
            return cand['id'], results, "Success"

        pdf_path = os.path.join(PDF_DIR, f"{safe_name}.pdf")
        if not os.path.exists(pdf_path):
            return cand['id'], None, "Missing PDF"

        results = extract_criminal_details(pdf_path, cand['id'])
        return cand['id'], results, "Success"
    except Exception as e:
        return cand['id'], None, str(e)

def main():
    with open(CANDIDATES_JSON, 'r', encoding='utf-8') as f:
        candidates = json.load(f)

    # 1. Process EVERYONE (All 175)
    to_process = candidates
    total_queue = len(to_process)
    print(f"🚀 Full Scan: Processing ALL {total_queue} candidates.")
    
    if total_queue == 0:
        print("✅ All candidates already match website counts. Nothing to do!")
        return

    # 2. Parallel Processing
    cpus = max(1, multiprocessing.cpu_count() - 1)
    print(f"⚡ Using {cpus} CPU cores for parallel OCR...")
    
    results_map = {}
    try:
        with ProcessPoolExecutor(max_workers=cpus) as executor:
            # Store (id, name) in the mapping
            futures = {executor.submit(process_single_candidate, cand): (cand['id'], cand['name']) for cand in to_process}
            
            count = 0
            for future in as_completed(futures):
                try:
                    cid, cname = futures[future]
                    cand_id, results, status = future.result()
                    
                    if status == "Success" and results and 'summary' in results:
                        count += 1
                        print(f"  [{count}/{total_queue}] Finished {cname} ({results['summary']['num_criminal_cases']} cases)")
                        results_map[str(cid)] = results
                    else:
                        print(f"  - Failed processing {cname}: {status}")

                    # Intermediate save every 10 completions
                    if count % 10 == 0:
                        update_and_save(candidates, results_map)
                        results_map = {}
                except Exception as e:
                    print(f"  - Future failed: {e}")
    except KeyboardInterrupt:
        print("\n\n🛑 STOPPING: Ctrl+C detected. Shutting down workers...")
        executor.shutdown(wait=False, cancel_futures=True)
        update_and_save(candidates, results_map)
        print("Done. Some processes may take a few seconds to exit.")
        return

    # Final save
    update_and_save(candidates, results_map)
    print("\n🏁 Turbo Scan Complete!")

def update_and_save(candidates, results_map):
    """Helper to update the main candidate list with new results."""
    for cand in candidates:
        cid_str = str(cand['id'])
        if cid_str in results_map:
            res = results_map[cid_str]
            cand["criminal_summary"] = res.get("summary")
            cand["criminal_details_pending"] = res.get("pending", [])
            cand["criminal_details_convictions"] = res.get("convictions", [])
            
    with open(CANDIDATES_JSON, 'w', encoding='utf-8') as f:
        json.dump(candidates, f, indent=2)

if __name__ == "__main__":
    main()