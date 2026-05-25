import re
import sys

def relation_for(item, cand):
    if not cand:
        return None
    text = f"{item.get('title') or ''} {item.get('snippet') or ''}"
    lc = text.lower()

    # 1. Direct name mention
    clean_name = str(cand.get('name') or '')
    clean_name = re.sub(r'\s+[sSwWdD]\/[oO]\s+.*$', '', clean_name, flags=re.IGNORECASE)
    
    # Split by non-alphanumeric characters
    name_words = [w for w in re.split(r'[^a-zA-Z0-9]+', clean_name) if len(w) >= 4]

    for w in name_words:
        if re.search(rf'\b{re.escape(w)}\b', text, re.IGNORECASE):
            return {"label": "Named in article", "kind": "name"}

    # 2. Constituency mention
    const_stem = str(cand.get('constituency') or '')
    const_stem = re.sub(r'\s*\([^)]*\)\s*$', '', const_stem).strip()
    if const_stem:
        const_words = [w for w in re.split(r'[^a-zA-Z0-9]+', const_stem) if len(w) >= 4]
        for w in const_words:
            if re.search(rf'\b{re.escape(w)}\b', text, re.IGNORECASE):
                # Pretty name construction
                pretty = " ".join([word.capitalize() for word in const_stem.lower().split() if word])
                return {"label": f"Mentions {pretty}", "kind": "constituency"}

    return None

# Test cases
test_cases = [
    {
        "cand": { "name": "Konidala Pawan Kalyan", "constituency": "PITHAPURAM" },
        "item": { "title": "Pawan Effect: Dashboard to Track Road Works - Gulte", "snippet": "Pawan Kalyan, the Deputy Chief Minister of Andhra Pradesh, has ordered the creation of a digital dashboard..." },
        "expected_kind": "name"
    },
    {
        "cand": { "name": "MUTTAMSETTI SRINIVASA RAO (AVANTHI SRINIVAS)", "constituency": "BHIMILI" },
        "item": { "title": "Avanthi Srinivas speaks on development", "snippet": "Bhimili MLA Avanthi Srinivas addressed the media." },
        "expected_kind": "name"
    },
    {
        "cand": { "name": "Bathula Balaramakrishna S/O Gangarao", "constituency": "RAJANAGARAM" },
        "item": { "title": "Gangarao foundation awards scholarships", "snippet": "Gangarao's legacy remembered." },
        "expected_kind": None
    },
    {
        "cand": { "name": "Bathula Balaramakrishna S/O Gangarao", "constituency": "RAJANAGARAM" },
        "item": { "title": "MLA Balaramakrishna visits constituency", "snippet": "Bathula Balaramakrishna inspected local roads." },
        "expected_kind": "name"
    },
    {
        "cand": { "name": "P.G.V.R.Naidu(Ganababu)", "constituency": "VISAKHAPATNAM WEST" },
        "item": { "title": "Ganababu promises development in Visakhapatnam", "snippet": "P.G.V.R. Naidu promised better roads." },
        "expected_kind": "name"
    },
    {
        "cand": { "name": "R.V.S.K.K.Ranga Rao @ Babynayana", "constituency": "BOBBILI" },
        "item": { "title": "Babynayana file nominations", "snippet": "Ranga Rao of Bobbili is campaigning." },
        "expected_kind": "name"
    },
    {
        "cand": { "name": "Miriyala Sirisha Devi", "constituency": "RAMPACHODAVARAM(ST)" },
        "item": { "title": "Development activities in Rampachodavaram area", "snippet": "Funds sanctioned for tribal areas." },
        "expected_kind": "constituency"
    }
]

failed = False
for idx, tc in enumerate(test_cases):
    rel = relation_for(tc["item"], tc["cand"])
    actual_kind = rel["kind"] if rel else None
    if actual_kind != tc["expected_kind"]:
        print(f"FAIL: Test case {idx + 1} for candidate '{tc['cand']['name']}' failed. Expected: {tc['expected_kind']}, Actual: {actual_kind}")
        failed = True
    else:
        print(f"PASS: Test case {idx + 1} for candidate '{tc['cand']['name']}' passed. Result: {rel}")

if failed:
    sys.exit(1)
else:
    print("All name matching tests passed successfully!")
