# Committed 2026-05 (previously an untracked local file). Diagnostic for the
# criminal-cases pipeline (see scraper_lab/README.md): prints which candidates
# got criminal cases extracted and which failed. Kept, not deleted — it's the
# quick "what did extraction actually produce?" report.
import json
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
CANDIDATES_JSON = PROJECT_ROOT / "src" / "data" / "candidates.json"
FAILED_JSON = PROJECT_ROOT / "src" / "data" / "failed_extractions.json"

def audit():
    print("# Extraction Audit Report\n")
    
    # 1. Successes
    if CANDIDATES_JSON.exists():
        with open(CANDIDATES_JSON) as f:
            candidates = json.load(f)
        
        success_list = []
        for c in candidates:
            summary = c.get("criminal_summary")
            if summary and summary.get("num_criminal_cases", 0) > 0:
                success_list.append(c)
        
        print(f"## ✅ Successfully Processed Candidates ({len(success_list)})")
        if success_list:
            print("| Name | Constituency | Cases | Convictions |")
            print("| :--- | :--- | :--- | :--- |")
            for c in success_list:
                s = c["criminal_summary"]
                print(f"| {c['name']} | {c['constituency']} | {s['num_criminal_cases']} | {s['num_convictions']} |")
        else:
            print("No candidates with criminal cases found yet.")
        print("\n")

    # 2. Failures
    if FAILED_JSON.exists():
        with open(FAILED_JSON) as f:
            failures = json.load(f)
        
        print(f"## ❌ Failed Extractions ({len(failures)})")
        print("| Name | Reason |")
        print("| :--- | :--- |")
        for f in failures:
            print(f"| {f['name']} | {f['reason']} |")
    else:
        print("## ❌ Failed Extractions (0)")
        print("No failures recorded.")

if __name__ == "__main__":
    audit()
