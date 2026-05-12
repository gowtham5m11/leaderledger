# Committed 2026-05 (previously an untracked local file). This is the single
# source of truth for the affidavit criminal-cases extraction prompt + IPC
# classification, imported by scraper_lab/detailed_criminal_history.py and
# scraper_lab/validate_with_myneta.py. Kept under version control rather than
# deleted because the whole criminal-cases pipeline (see scraper_lab/README.md)
# depends on it.
import json
import re

CONF_ACCEPT_THRESHOLD = 0.70

CRIMINAL_PROMPT = (
    "This is a page from an Indian election affidavit (Form 26) showing criminal-case details. "
    "Section 5 lists 'Pending criminal cases' and Section 6 lists 'Cases of conviction'. "
    "On these pages each case is one COLUMN of a horizontal table; rows are labelled "
    "(a) FIR No. with police-station name, (b) Court / Case No., (c) Sections of Acts, "
    "(d) Brief description of offence, (e) Whether charges framed, (f) Date of charge framing, "
    "(g) Whether appeal/application filed. "
    "Some pages show ONLY rows e/f/g (continuation pages) without an FIR No. — for those, "
    "treat the page as having no extractable case and return empty lists. "
    "For each case column with an FIR No., extract fir_no (row a), description (row d), sections (row c). "
    'Return ONLY valid JSON in this exact shape: '
    '{"pending":[{"fir_no":"...","description":"...","sections":"..."}], '
    '"convictions":[{"fir_no":"...","description":"...","sections":"..."}]}. '
    "Place an item under 'convictions' only if the page header clearly says 'Cases of conviction' or 'Section 6'. "
    "Use empty strings for missing fields."
)

# The VLM prompt is identical in spec; kept as a separate name for legacy callers.
CRIMINAL_VLM_PROMPT = CRIMINAL_PROMPT


PROMPT_VERSION = "ocr_text_v2"  # bump when build_criminal_text_prompt changes


def build_criminal_text_prompt(ocr_text):
    """Build the prompt for the OCR + text-LLM pipeline.

    The OCR text comes from Tesseract on a single rasterized affidavit page.
    A text-only LLM (e.g. gemma3:4b) reads the table from this prose and
    extracts FIR/description/sections per case. Tested as more reliable
    than VLM-based extraction on M1/8GB hardware.

    The Form-26 case tables appear in three layouts (documented in
    public/affidavit_cases_styles.pdf); the prompt teaches the model all three.
    """
    return (
        "The text below was extracted by OCR from ONE page of an Indian election affidavit (Form 26), "
        "Section 5 (Pending criminal cases) or Section 6 (Cases of conviction). "
        "These tables come in THREE layouts — recognise which one you're looking at:\n"
        "\n"
        "STYLE 1 (most common): a horizontal table. The FIRST TWO columns from the left are labels "
        "(row letter (a)/(b)/(c)... and the question text). EVERY column AFTER those two is ONE separate case. "
        "Row (a) holds the FIR No., row (c) the sections, row (d) the offence description. "
        "IMPORTANT: a column whose cells are ALL 'Not Applicable' or 'NIL' is an UNUSED template slot — do NOT count it as a case.\n"
        "\n"
        "STYLE 2: same horizontal table, but with an EXTRA TOP ROW of bare numbers like '1  2  3'. "
        "The HIGHEST number in that top row is how many cases are in THIS table. Extract exactly that many cases.\n"
        "\n"
        "STYLE 3: a SEPARATE small table for each case, each one headed 'CASE 1', 'CASE 2', etc. "
        "Count the 'CASE N' headers — that's the number of cases on this page.\n"
        "\n"
        "RULES:\n"
        "- Copy FIR numbers VERBATIM from the text (e.g. '79/2023', 'Cr.No.130/2020'). Never invent, increment, or guess a number.\n"
        "- A real case has an FIR/Crime number that looks like <digits>/<year> or 'Cr.No.<digits>/<year>'. "
        "Asset values ('Rs 5,16,480'), section numbers ('R/W 149 IPC'), dates, and 'Not Applicable'/'NIL' are NOT FIR numbers — skip them.\n"
        "- If the page is a continuation (only rows (e)/(f)/(g) visible, no FIR No.), return empty lists.\n"
        "- If the page shows the 'I declare that there is no pending criminal case' / 'I have not been convicted' alternative ticked, return empty lists.\n"
        "- Put an item under 'convictions' ONLY if the page header literally says 'Cases of conviction' or '(6)'. Otherwise use 'pending'.\n"
        "- Do NOT include any placeholder or example value from THIS prompt.\n"
        "\n"
        "Return ONLY valid JSON, starting with `{` and ending with `}`, no prose, no markdown fences:\n"
        '{"pending":[{"fir_no":"<verbatim>","description":"<short offence>","sections":"<sections>"}],"convictions":[]}\n'
        "\n"
        "OCR TEXT:\n"
        "===\n"
        f"{ocr_text}\n"
        "==="
    )

_SERIOUS_IPC    = [302, 304, 307, 323, 324, 325, 326, 332, 354, 363, 364, 365, 366, 376, 379, 380, 392, 395, 396, 411, 452, 506]
_CORRUPTION_IPC = [420, 406, 409, 467, 468, 471, 120]
_POLITICAL_IPC  = [143, 147, 148, 149, 151, 188, 283, 341, 353]
_ELECTION_IPC   = list(range(171, 180))

_FIR_PATTERN = re.compile(r"(\d+)\s*(?:[/\-]|OF)\s*(\d{2,4})", re.IGNORECASE)
_JSON_OBJECT_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


def _classify_sections(sections_text):
    text = str(sections_text).upper()
    if not text or "NIL" in text or "NOT APPLICABLE" in text:
        return "Minor/Other"
    nums = [int(n) for n in re.findall(r"\b\d+\b", text)]
    if any(n in _SERIOUS_IPC for n in nums) or any(kw in text for kw in ["MURDER", "RAPE", "ATTEMPT TO", "DACOITY", "KIDNAP"]):
        return "Serious/Violent"
    if any(n in _CORRUPTION_IPC for n in nums) or any(kw in text for kw in ["PC ACT", "CHEATING", "FORGERY", "FRAUD"]):
        return "Corruption & Fraud"
    if any(n in _ELECTION_IPC for n in nums) or "REPRESENTATION OF THE PEOPLE" in text:
        return "Election Offenses"
    if any(n in _POLITICAL_IPC for n in nums) or "UNLAWFUL ASSEMBLY" in text or "RIOT" in text:
        return "Political/Protest"
    return "Minor/Other"


def _coerce_json(response_text):
    """Try strict json.loads; if narration wraps the JSON, regex out the first {...} block and retry."""
    cleaned = response_text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    m = _JSON_OBJECT_PATTERN.search(cleaned)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def parse_criminal_json_response(response_text, page_num=1, method="AI"):
    result = {"pending": [], "convictions": []}
    ai_data = _coerce_json(response_text)
    if ai_data is None:
        print(f"    - Invalid JSON from model on page {page_num}")
        return result
    for bucket in ("pending", "convictions"):
        for case in ai_data.get(bucket, []):
            if not isinstance(case, dict):
                continue
            if not (case.get("fir_no") or case.get("description")):
                continue
            case["page"] = page_num
            case["method"] = method
            case["raw_text"] = f"FIR: {case.get('fir_no', '')} | Desc: {case.get('description', '')}"
            conf = case.get("confidence")
            if conf is not None and conf < CONF_ACCEPT_THRESHOLD:
                case["needs_review"] = True
            result[bucket].append(case)
    return result


# Backwards-compatible alias used by existing callers
def parse_gemini_criminal_response(response_text, page_num=1):
    return parse_criminal_json_response(response_text, page_num=page_num, method="Gemini")


def _case_signature(case):
    """Return a dedup key for a case. Prefer FIR-number/year; fall back to fir_no+sections."""
    fir  = str(case.get("fir_no", "")).upper()
    sect = str(case.get("sections", "")).upper()
    raw  = str(case.get("raw_text", "")).upper()
    combined = re.sub(r"[^A-Z0-9/\-]", "", fir + raw + sect)
    m = _FIR_PATTERN.search(combined)
    if m:
        year = m.group(2)
        if len(year) == 2:
            year = "20" + year
        return f"{int(m.group(1))}/{year}"
    fallback = re.sub(r"[^A-Z0-9]+", "", fir + sect)
    if fallback:
        return fallback[:80]
    return re.sub(r"[^A-Z0-9]+", "", raw)[:80]


def build_criminal_summary(cases):
    for key in ("pending", "convictions"):
        unique_list = []
        seen = set()
        for c in cases[key]:
            sig = _case_signature(c)
            if not sig or sig in seen:
                continue
            seen.add(sig)
            unique_list.append(c)
        cases[key] = unique_list

    summary = {
        "num_criminal_cases": len(cases["pending"]),
        "num_convictions": len(cases["convictions"]),
        "pending_by_category": {
            "Serious/Violent": 0, "Corruption & Fraud": 0,
            "Political/Protest": 0, "Election Offenses": 0, "Minor/Other": 0,
        },
    }
    for item in cases["pending"]:
        cat = _classify_sections(item.get("sections", "") or item.get("raw_text", ""))
        item["category"] = cat
        summary["pending_by_category"][cat] += 1
    return summary


if __name__ == "__main__":
    # Strict JSON, multi-bucket, low-confidence flag
    test_json = (
        '{"pending": [{"fir_no": "45/2019", "description": "Attempt to murder", "sections": "307 IPC", "confidence": 0.5}],'
        ' "convictions": [{"fir_no": "12/2015", "description": "Cheating", "sections": "420 IPC", "confidence": 0.9}]}'
    )
    parsed = parse_criminal_json_response(test_json, page_num=3, method="VLM")
    assert len(parsed["pending"]) == 1 and parsed["pending"][0]["page"] == 3
    assert parsed["pending"][0].get("needs_review") is True
    assert parsed["convictions"][0].get("needs_review") is None

    # Lenient parser: narration around JSON
    narrated = 'Sure, here is the JSON:\n```json\n{"pending":[{"fir_no":"7/2020","description":"Theft","sections":"379 IPC"}],"convictions":[]}\n```\nLet me know if you need more.'
    p2 = parse_criminal_json_response(narrated, page_num=4, method="VLM")
    assert len(p2["pending"]) == 1 and p2["pending"][0]["fir_no"] == "7/2020", "lenient parse failed"

    # FIR regex broadening: dotted, dashed, OF
    for fir, expected in [
        ("FIR.No.79/2023", "79/2023"),
        ("FIR No. 56-2023", "56/2023"),
        ("Crime No 12 OF 2019", "12/2019"),
    ]:
        sig = _case_signature({"fir_no": fir, "description": "x", "sections": "302"})
        assert sig == expected, f"FIR sig mismatch: {fir!r} -> {sig!r} expected {expected!r}"

    # Dedup keeps a case with FIR but short raw_text (regression for old len(raw)<50 drop)
    short = {"fir_no": "1/24", "description": "x", "sections": "y", "raw_text": "short", "page": 1, "method": "t"}
    cases = {"pending": [short], "convictions": []}
    s = build_criminal_summary(cases)
    assert s["num_criminal_cases"] == 1, "short-raw_text case was dropped"

    # Different FIRs from same page must NOT collapse via fallback signature
    distinct = {
        "pending": [
            {"fir_no": "79/2023", "description": "a", "sections": "302", "raw_text": "FIR: 79/2023 | Desc: a"},
            {"fir_no": "56/2023", "description": "b", "sections": "307", "raw_text": "FIR: 56/2023 | Desc: b"},
            {"fir_no": "74/2023", "description": "c", "sections": "324", "raw_text": "FIR: 74/2023 | Desc: c"},
        ],
        "convictions": [],
    }
    s2 = build_criminal_summary(distinct)
    assert s2["num_criminal_cases"] == 3, f"distinct FIRs collapsed: {s2}"

    # Same FIR appearing on continuation pages collapses to one
    same = {
        "pending": [
            {"fir_no": "5/22", "description": "x", "sections": "302", "raw_text": "FIR: 5/22 | Desc: x", "page": 4},
            {"fir_no": "5/22", "description": "x", "sections": "302", "raw_text": "FIR: 5/22 | Desc: x", "page": 5},
        ],
        "convictions": [],
    }
    s3 = build_criminal_summary(same)
    assert s3["num_criminal_cases"] == 1, "same FIR on adjacent pages should dedup"

    print("✅  criminal_module self-test passed")
