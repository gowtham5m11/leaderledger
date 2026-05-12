# Committed 2026-05 (previously an untracked local file). Diagnostic for the
# criminal-cases pipeline (see scraper_lab/README.md): pretty-prints the
# extracted FIR / IPC-section / description rows per candidate as a markdown
# table. Kept, not deleted — it's the human-readable view of criminal_details_*.
import json
import os

def display_criminal_records():
    json_path = "/Users/gowthamjadapalli/Documents/GitHub/knowyourleader/src/data/candidates.json"
    
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    with open(json_path, 'r') as f:
        candidates = json.load(f)

    results = []
    
    for candidate in candidates:
        name = candidate.get("name", "Unknown")
        constituency = candidate.get("constituency", "Unknown")
        
        pending = candidate.get("criminal_details_pending", [])
        convictions = candidate.get("criminal_details_convictions", [])
        
        cases = []
        
        # Process pending cases
        for case in pending:
            fir = case.get("fir_no") or case.get("fir") or "N/A"
            sections = case.get("sections") or case.get("section") or "N/A"
            desc = case.get("description") or "N/A"
            
            # If fir is still N/A, try to extract from raw_text if it looks like Gemini output
            raw = case.get("raw_text", "")
            if fir == "N/A" and "FIR:" in raw:
                try:
                    parts = raw.split("|")
                    fir = parts[0].replace("FIR:", "").strip()
                    if len(parts) > 1:
                        desc_part = parts[1].replace("Desc:", "").strip()
                        if desc == "N/A": desc = desc_part
                except:
                    pass
            
            if fir != "N/A" or sections != "N/A":
                cases.append({"fir": fir, "sections": sections, "desc": desc, "status": "Pending"})

        # Process convictions
        for case in convictions:
            fir = case.get("fir_no") or case.get("fir") or "N/A"
            sections = case.get("sections") or case.get("section") or "N/A"
            desc = case.get("description") or "N/A"
            
            if fir != "N/A" or sections != "N/A":
                cases.append({"fir": fir, "sections": sections, "desc": desc, "status": "Convicted"})

        if cases:
            results.append({
                "name": name,
                "constituency": constituency,
                "cases": cases
            })

    if not results:
        print("No detailed criminal records found in candidates.json yet.")
        return

    print(f"# Gathered Criminal Records (FIR & IPC)\n")
    for res in results:
        print(f"## {res['name']} ({res['constituency']})")
        print("| Status | FIR No. | IPC Sections | Description |")
        print("| :--- | :--- | :--- | :--- |")
        for case in res['cases']:
            # Escape pipes for markdown
            safe_fir = str(case['fir']).replace("|", "\\|")
            safe_sections = str(case['sections']).replace("|", "\\|")
            safe_desc = str(case['desc']).replace("|", "\\|").replace("\n", " ")
            print(f"| {case['status']} | {safe_fir} | {safe_sections} | {safe_desc} |")
        print("\n")

if __name__ == "__main__":
    display_criminal_records()
