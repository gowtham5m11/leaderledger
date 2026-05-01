import json
import os

# Paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANDIDATES_JSON = os.path.join(PROJECT_ROOT, "src", "data", "candidates.json")

def check_integrity():
    if not os.path.exists(CANDIDATES_JSON):
        print(f"Error: {CANDIDATES_JSON} not found.")
        return

    with open(CANDIDATES_JSON, 'r', encoding='utf-8') as f:
        candidates = json.load(f)

    total_website_cases = 0
    total_gathered_cases = 0
    mismatches = []

    print(f"{'Candidate Name':<40} | {'Website':<8} | {'Gathered':<8} | {'Diff'}")
    print("-" * 75)

    for cand in candidates:
        name = cand.get("name", "Unknown")
        
        # Website data (usually a string or number in 'criminal_cases')
        web_cases_raw = cand.get("criminal_cases", "0")
        try:
            # Handle cases like "2" or "NIL"
            web_cases = int(web_cases_raw) if str(web_cases_raw).isdigit() else 0
        except:
            web_cases = 0
            
        # Gathered data from PDF
        summary = cand.get("criminal_summary")
        if summary:
            gathered_cases = summary.get("num_criminal_cases", 0)
        else:
            gathered_cases = 0

        total_website_cases += web_cases
        total_gathered_cases += gathered_cases

        if web_cases != gathered_cases:
            diff = gathered_cases - web_cases
            mismatches.append({
                "name": name,
                "web": web_cases,
                "gathered": gathered_cases,
                "diff": diff
            })
            print(f"{name:<40} | {web_cases:<8} | {gathered_cases:<8} | {diff:+d}")

    print("-" * 75)
    print(f"TOTALS:")
    print(f"Website displayed cases: {total_website_cases}")
    print(f"Gathered from PDFs:      {total_gathered_cases}")
    print(f"Total Mismatches found:  {len(mismatches)}")
    
    if total_website_cases == total_gathered_cases:
        print("\nSUCCESS: All counts match perfectly!")
    else:
        print("\nWARNING: Discrepancies found between website data and PDF extraction.")

if __name__ == "__main__":
    check_integrity()
