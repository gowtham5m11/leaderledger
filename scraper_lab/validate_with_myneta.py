"""Validate src/data/candidates.json against MyNeta ground truth.

Stage 5 of the criminal-cases pipeline (see scraper_lab/README.md). Committed
2026-05 — previously an untracked local file; kept rather than deleted because
it's how we audit extraction accuracy after every (re-)extraction.

Produces:
- stdout: per-candidate match table + summary
- src/data/myneta_validation_report.json: persisted JSON report
"""
import json
import re
from pathlib import Path
from difflib import SequenceMatcher

PROJECT_ROOT = Path(__file__).parent.parent
CANDIDATES_JSON = PROJECT_ROOT / "src" / "data" / "candidates.json"
MYNETA_CACHE    = PROJECT_ROOT / "scraper_lab" / "myneta_data.json"
PATCHES_JSON    = PROJECT_ROOT / "src" / "data" / "criminal_patches.json"
INDEX_JSON      = PROJECT_ROOT / "src" / "data" / "criminal_pages_index.json"
REPORT_JSON     = PROJECT_ROOT / "src" / "data" / "myneta_validation_report.json"

HONORIFICS = re.compile(r"\b(?:Dr|Sri|Smt|Shri|Mr|Mrs|Ms|Adv|Hon|Late)\.?\s+", re.IGNORECASE)
ALIAS_PAREN = re.compile(r"\s*\([^)]*\)\s*")
ALIAS_AT = re.compile(r"\s*@\s*.*$")

def normalize_name(name):
    """Strip honorifics, parenthesized aliases, @-aliases, and extra punctuation for fuzzy matching."""
    s = name or ""
    s = ALIAS_PAREN.sub(" ", s)
    s = ALIAS_AT.sub("", s)
    s = HONORIFICS.sub("", s)
    s = s.replace(".", " ")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s

def normalize_const(c):
    s = c or ""
    s = ALIAS_PAREN.sub(" ", s)
    s = s.replace("(SC)", "").replace("(ST)", "")
    s = re.sub(r"\s+", " ", s).strip().upper()
    return s

def similar(a, b):
    return SequenceMatcher(None, normalize_name(a), normalize_name(b)).ratio()

def safe(n):
    return "".join(c if c.isalnum() else "_" for c in n).lower()

def validate():
    if not MYNETA_CACHE.exists():
        print(f"❌ MyNeta cache not found: {MYNETA_CACHE}")
        return
    if not CANDIDATES_JSON.exists():
        print(f"❌ candidates.json not found: {CANDIDATES_JSON}")
        return

    myneta_list   = json.load(open(MYNETA_CACHE))
    local_cands   = json.load(open(CANDIDATES_JSON))
    patches       = json.load(open(PATCHES_JSON)) if PATCHES_JSON.exists() else {}
    index         = json.load(open(INDEX_JSON)) if INDEX_JSON.exists() else {"candidates": {}}

    print(f"\n📊 Validating {len(local_cands)} candidates against {len(myneta_list)} MyNeta records...\n")
    print(f"{'Candidate Name':<35} | {'AI':>4} | {'MyNeta':>6} | Result")
    print("-" * 75)

    results = []
    unmatched = []
    matches_found = 0

    for cand in local_cands:
        local_name  = cand["name"]
        local_const = normalize_const(cand.get("constituency", ""))
        local_cases = (cand.get("criminal_summary") or {}).get("num_criminal_cases", 0)
        local_safe  = safe(local_name)

        best_match = None
        best_score = 0
        for m in myneta_list:
            mn_const = normalize_const(m["constituency"])
            if local_const and (local_const in mn_const or mn_const in local_const):
                score = similar(local_name, m["name"])
                if score > 0.70 and score > best_score:
                    best_score = score
                    best_match = m

        if best_match:
            matches_found += 1
            diff = local_cases - best_match["cases"]
            tag = "✅ Match" if diff == 0 else (f"⚠️ DIFF ({diff:+})" if abs(diff) > 2 else f"≈ ({diff:+})")
            print(f"{local_name:<35} | {local_cases:>4} | {best_match['cases']:>6} | {tag}")
            ix = index.get("candidates", {}).get(local_safe, {})
            results.append({
                "candidate_id": cand.get("id"),
                "candidate_name": local_name,
                "constituency": cand.get("constituency"),
                "ai_count": local_cases,
                "myneta_count": best_match["cases"],
                "diff": diff,
                "match": diff == 0,
                "within_2": abs(diff) <= 2,
                "source": (cand.get("criminal_summary") or {}).get("source", "unknown"),
                "patched": local_safe in patches,
                "index_status": ix.get("status"),
                "index_total_pages": ix.get("total_pages"),
                "myneta_match_name": best_match["name"],
                "myneta_match_score": round(best_score, 3),
            })
        else:
            unmatched.append({
                "candidate_id": cand.get("id"),
                "candidate_name": local_name,
                "constituency": cand.get("constituency"),
                "ai_count": local_cases,
            })

    exact = sum(1 for r in results if r["match"])
    within_2 = sum(1 for r in results if r["within_2"])
    overcounts = [r for r in results if r["diff"] > 0]
    undercounts = [r for r in results if r["diff"] < 0]

    summary = {
        "total_local_candidates": len(local_cands),
        "total_myneta_records": len(myneta_list),
        "matched": matches_found,
        "exact_matches": exact,
        "within_2": within_2,
        "discrepancies": matches_found - exact,
        "overcounts": len(overcounts),
        "undercounts": len(undercounts),
        "unmatched": len(unmatched),
    }

    print("\n" + "=" * 75)
    for k, v in summary.items():
        print(f"  {k:<26}: {v}")

    if overcounts:
        print(f"\n🚨 Top overcounts (possible hallucinations):")
        for r in sorted(overcounts, key=lambda x: -x["diff"])[:10]:
            print(f"  +{r['diff']:>3}  {r['candidate_name']:<40} AI={r['ai_count']} MyNeta={r['myneta_count']}")

    if undercounts:
        print(f"\n📉 Top undercounts (likely missed pages):")
        for r in sorted(undercounts, key=lambda x: x["diff"])[:10]:
            tag = " [PATCHED]" if r["patched"] else ""
            print(f"  {r['diff']:>4}  {r['candidate_name']:<40} AI={r['ai_count']} MyNeta={r['myneta_count']}{tag}")

    report = {"summary": summary, "unmatched": unmatched, "results": results}
    REPORT_JSON.write_text(json.dumps(report, indent=2))
    print(f"\n💾 wrote {REPORT_JSON}")

if __name__ == "__main__":
    validate()
