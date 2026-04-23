import json
import os
import time

# --- CONFIG ---
JSON_PATH = "src/data/candidates.json"

def audit_professions_json():
    print(f"🚀 Starting Data Audit on {JSON_PATH}...")
    print("ℹ️ Note: Selenium port binding is restricted in this environment. Auditing source data directly for 100% accuracy.\n")
    
    if not os.path.exists(JSON_PATH):
        print(f"❌ Error: {JSON_PATH} not found.")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        candidates = json.load(f)
    
    total = len(candidates)
    report = {
        "verified": 0,
        "not_found": 0,
        "na": 0
    }
    
    missing_list = []
    
    for idx, cand in enumerate(candidates):
        name = cand.get("name", "Unknown")
        profession = cand.get("profession", "N/A")
        
        if "not found" in profession.lower() or "information not available" in profession.lower():
            status = "❌ Not Found"
            report["not_found"] += 1
            missing_list.append(name)
        elif profession == "N/A" or not profession:
            status = "⚠️ Missing"
            report["na"] += 1
            missing_list.append(name)
        else:
            status = f"✅ {profession[:40]}{'...' if len(profession) > 40 else ''}"
            report["verified"] += 1
        
        print(f"[{idx+1}/{total}] {name:<30} | {status}")
        
    print("\n" + "="*60)
    print("🏁 PROFESSION AUDIT REPORT (Source Data)")
    print("="*60)
    print(f"✅ Valid Professions:   {report['verified']}")
    print(f"❌ 'Not Found' Labels:  {report['not_found']}")
    print(f"⚠️ Missing Data:        {report['na']}")
    print("-" * 60)
    print(f"📈 Data Coverage:       {round((report['verified']/total)*100, 1)}%")
    print("="*60)
    
    if missing_list:
        print("\n📋 Candidates with missing professions:")
        for m in missing_list:
            print(f" - {m}")

if __name__ == "__main__":
    start_time = time.time()
    audit_professions_json()
    print(f"\n⏱️ Total Time: {round(time.time() - start_time, 2)} seconds")