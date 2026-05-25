import os
import sys
import json
import re
import tempfile
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from datetime import datetime, timezone

import pdfplumber
from pdf2image import convert_from_path
from PIL import Image, ImageFile
import pytesseract
import ollama

# Ensure project root on sys.path so criminal_module is importable
_PROJECT_ROOT = Path(__file__).parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from criminal_module import (
    CRIMINAL_PROMPT, CRIMINAL_VLM_PROMPT, build_criminal_text_prompt,
    parse_criminal_json_response, build_criminal_summary,
    PROMPT_VERSION,
)

ImageFile.LOAD_TRUNCATED_IMAGES = True
# --- CONFIGURATION ---
DPI = 300
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
# PROMPT_VERSION imported from criminal_module — single source of truth, used in resume-skip key.
# Style 3 ("CASE 1", "CASE 2"... separate-table-per-case) is detected deterministically below.
_CASE_HEADER_RE = re.compile(r"\bCASE\s+0*(\d{1,3})\b", re.IGNORECASE)
PER_PAGE_TIMEOUT_SECS = float(os.environ.get("VLM_PAGE_TIMEOUT", "600"))
KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")
PER_CANDIDATE_TIMEOUT_SECS = float(os.environ.get("VLM_CAND_TIMEOUT", "1800"))  # 30 min hard cap

# --- OLLAMA AI HELPERS ---
def get_client(timeout=PER_PAGE_TIMEOUT_SECS):
    """Try multiple hosts to connect to Ollama on macOS."""
    hosts = ['http://127.0.0.1:11434', 'http://localhost:11434']
    for h in hosts:
        try:
            c = ollama.Client(host=h, timeout=timeout)
            c.list()
            return c
        except Exception:
            continue
    return ollama.Client(timeout=timeout)


client = get_client()


def call_ai_vision(image_path, prompt):
    """Call local Ollama model for image-based reasoning (VLM)."""
    try:
        resp = client.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt, "images": [image_path]}],
            keep_alive=KEEP_ALIVE,
        )
        return resp["message"]["content"]
    except Exception as e:
        print(f"    - Ollama Vision Error: {type(e).__name__}: {e}", flush=True)
        return ""


def call_ai_text(prompt):
    """Call local Ollama model in text-only mode (no images)."""
    try:
        resp = client.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            keep_alive=KEEP_ALIVE,
        )
        return resp["message"]["content"]
    except Exception as e:
        print(f"    - Ollama Text Error: {type(e).__name__}: {e}", flush=True)
        return ""


PROJECT_ROOT = Path(__file__).parent.parent
PDF_DIR      = PROJECT_ROOT / "scraper_lab" / "affidavits"
CANDIDATES_JSON          = PROJECT_ROOT / "src" / "data" / "candidates.json"
PATCHES_JSON             = PROJECT_ROOT / "src" / "data" / "criminal_patches.json"
CRIMINAL_PAGES_INDEX     = PROJECT_ROOT / "src" / "data" / "criminal_pages_index.json"
FAILED_JSONL             = PROJECT_ROOT / "src" / "data" / "failed_extractions.jsonl"
FAILED_JSON              = PROJECT_ROOT / "src" / "data" / "failed_extractions.json"
NEEDS_REVIEW_JSON        = PROJECT_ROOT / "src" / "data" / "needs_review_cases.json"


def _safe_name(name):
    return "".join(c if c.isalnum() else "_" for c in name).lower()


def _source_stamp(model=None):
    return f"VLM:{model or OLLAMA_MODEL}/{PROMPT_VERSION}"


_pages_index_cache = None
def load_pages_index():
    global _pages_index_cache
    if _pages_index_cache is None:
        if not CRIMINAL_PAGES_INDEX.exists():
            print(f"❌ Page index not found: {CRIMINAL_PAGES_INDEX}")
            print("   Run: .venv/bin/python scraper_lab/find_criminal_pages.py")
            _pages_index_cache = {"candidates": {}}
        else:
            with open(CRIMINAL_PAGES_INDEX, encoding="utf-8") as f:
                _pages_index_cache = json.load(f)
    return _pages_index_cache


def load_patches():
    if PATCHES_JSON.exists():
        with open(PATCHES_JSON) as f:
            return json.load(f)
    return {}


# --- PER-PAGE PIPELINE: OCR (Tesseract) -> text-only LLM ---
# VLM pipeline was abandoned because all three local VLMs we could fit on M1/8GB failed:
# qwen2.5vl:7b swap-thrashed, moondream:1.8b regurgitated prompt placeholders,
# gemma3:4b hallucinated sequential FIRs (919, 920, 921...). Tesseract reads the
# table reliably; gemma3:4b in text-only mode parses FIRs from that text correctly.
def _process_page(pil_page, page_num, cand_id):
    """Return (parsed_cases, ocr_text). ocr_text is kept so the caller can do
    style detection (CASE-N headers etc.) and abstract-count cross-checks."""
    temp_page = os.path.join(tempfile.gettempdir(), f"criminal_page_{cand_id}_{page_num}.png")
    empty = {"pending": [], "convictions": []}
    try:
        pil_page.save(temp_page, "PNG")
        try:
            ocr_text = pytesseract.image_to_string(temp_page) or ""
        except Exception as e:
            print(f"    - Tesseract error page {page_num}: {type(e).__name__}: {e}", flush=True)
            return empty, ""
        if not ocr_text.strip():
            return empty, ""
        response = call_ai_text(build_criminal_text_prompt(ocr_text))
        if not response:
            return empty, ocr_text
        parsed = parse_criminal_json_response(
            response, page_num=page_num, method=f"OCR+LLM:{OLLAMA_MODEL}",
        )
        return parsed, ocr_text
    except Exception as e:
        print(f"    - Error in page {page_num}: {type(e).__name__}: {e}", flush=True)
        return empty, ""
    finally:
        if os.path.exists(temp_page):
            os.remove(temp_page)


def _style3_case_count(ocr_texts):
    """If the candidate uses Style 3 (one 'CASE N' table per case), return the
    count of distinct CASE numbers seen. Returns 0 if Style 3 isn't detected
    (fewer than 2 distinct CASE-N headers)."""
    nums = set()
    for t in ocr_texts:
        for m in _CASE_HEADER_RE.finditer(t):
            nums.add(int(m.group(1)))
    return len(nums) if len(nums) >= 2 else 0


def extract_criminal_details(pdf_path, cand_id="global"):
    cases = {"pending": [], "convictions": []}
    safe_name = Path(pdf_path).stem

    index = load_pages_index()
    entry = index.get("candidates", {}).get(safe_name)

    if not entry:
        print(f"  - {safe_name}: no entry in page index — skipping.")
        summary = build_criminal_summary(cases)
        summary["status"] = "no_index_entry"
        summary["reason"] = "candidate not present in criminal_pages_index.json"
        summary["source"] = _source_stamp()
        summary["extracted_at"] = datetime.now(timezone.utc).isoformat()
        cases["summary"] = summary
        return cases

    if entry.get("status") == "headers_missed":
        print(f"  - {safe_name}: index status=headers_missed — flagging for manual review.")
        summary = build_criminal_summary(cases)
        summary["status"] = "needs_manual_review"
        summary["reason"] = "page index missed section headers"
        summary["source"] = _source_stamp()
        summary["extracted_at"] = datetime.now(timezone.utc).isoformat()
        cases["summary"] = summary
        return cases

    pending_pages    = entry.get("pending_pages", []) or []
    conviction_pages = entry.get("conviction_pages", []) or []
    pages_to_process = sorted(set(pending_pages) | set(conviction_pages))

    if not pages_to_process:
        print(f"  - {safe_name}: index has no case pages — recording 0 cases.")
        summary = build_criminal_summary(cases)
        summary["source"] = _source_stamp()
        summary["extracted_at"] = datetime.now(timezone.utc).isoformat()
        cases["summary"] = summary
        return cases

    print(f"  - {safe_name}: {len(pending_pages)} pending + {len(conviction_pages)} conviction page(s) "
          f"from index (pages {pages_to_process})", flush=True)

    pending_set = set(pending_pages)
    pending_ocr_texts = []
    try:
        for page_num in pages_to_process:
            print(f"    Processing page {page_num}...", flush=True)
            images = convert_from_path(
                pdf_path, first_page=page_num, last_page=page_num, dpi=DPI
            )
            if not images:
                continue
            page_result, ocr_text = _process_page(images[0], page_num=page_num, cand_id=str(cand_id))
            cases["pending"].extend(page_result["pending"])
            cases["convictions"].extend(page_result["convictions"])
            if page_num in pending_set:
                pending_ocr_texts.append(ocr_text)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n  - Error processing {pdf_path}: {e}", flush=True)

    summary = build_criminal_summary(cases)
    extracted_count = summary["num_criminal_cases"]

    # --- Count reconciliation (priority: candidate's own abstract > Style-3 header count > LLM extraction) ---
    abstract_count = entry.get("abstract_pending_count")
    style3_count = _style3_case_count(pending_ocr_texts)
    count_source = "extraction"
    if isinstance(abstract_count, int) and abstract_count > 0:
        summary["num_criminal_cases"] = abstract_count
        count_source = "abstract"
    elif style3_count and style3_count != extracted_count:
        summary["num_criminal_cases"] = style3_count
        count_source = "style3_headers"
    summary["count_source"] = count_source
    summary["extracted_count"] = extracted_count
    if abstract_count is not None:
        summary["abstract_count"] = abstract_count
    if style3_count:
        summary["style3_count"] = style3_count

    summary["source"] = _source_stamp()
    summary["extracted_at"] = datetime.now(timezone.utc).isoformat()
    cases["summary"] = summary
    return cases


def process_single_candidate(cand):
    try:
        safe_name = _safe_name(cand["name"])

        patches = load_patches()
        if safe_name in patches:
            patch = patches[safe_name]
            print(f"  - Using manual patch for {cand['name']} ({patch['num_criminal_cases']} cases)", flush=True)
            return cand["id"], {
                "summary": {
                    "num_criminal_cases": patch["num_criminal_cases"],
                    "num_convictions": patch["num_convictions"],
                    "pending_by_category": {"Patched": patch["num_criminal_cases"]},
                    "source": patch.get("source", "Manual Patch"),
                },
                "pending": [],
                "convictions": [],
            }, "Success"

        pdf_path = PDF_DIR / f"{safe_name}.pdf"
        if not pdf_path.exists():
            return cand["id"], None, "Missing PDF"

        results = extract_criminal_details(str(pdf_path), cand["id"])
        return cand["id"], results, "Success"
    except Exception as e:
        return cand["id"], None, f"{type(e).__name__}: {e}"


# --- ATOMIC SAVE ---
def _atomic_write_json(path, data):
    """Write JSON atomically: temp file in same dir, fsync, rename."""
    path = Path(path)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def _rebuild_needs_review(candidates):
    needs_review_cases = []
    for cand in candidates:
        for case in cand.get("criminal_details_pending", []) or []:
            if case.get("needs_review"):
                needs_review_cases.append({
                    "candidate_id": cand["id"], "candidate_name": cand["name"],
                    "type": "pending", "case": case,
                })
        for case in cand.get("criminal_details_convictions", []) or []:
            if case.get("needs_review"):
                needs_review_cases.append({
                    "candidate_id": cand["id"], "candidate_name": cand["name"],
                    "type": "conviction", "case": case,
                })
    if needs_review_cases:
        _atomic_write_json(NEEDS_REVIEW_JSON, needs_review_cases)
    elif NEEDS_REVIEW_JSON.exists():
        os.remove(NEEDS_REVIEW_JSON)


def commit_candidate(candidates, cand_id, result):
    """Apply one candidate's result to the candidates list and atomic-save the whole file."""
    cid = str(cand_id)
    for cand in candidates:
        if str(cand["id"]) == cid:
            cand["criminal_summary"]             = result.get("summary")
            cand["criminal_details_pending"]     = result.get("pending", [])
            cand["criminal_details_convictions"] = result.get("convictions", [])
            break
    _atomic_write_json(CANDIDATES_JSON, candidates)
    _rebuild_needs_review(candidates)


def append_failure(record):
    record = dict(record)
    record["timestamp"] = datetime.now(timezone.utc).isoformat()
    with open(FAILED_JSONL, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")


def consolidate_failures():
    """Read the streaming JSONL into a single JSON list for compatibility."""
    if not FAILED_JSONL.exists():
        return 0
    failures = []
    with open(FAILED_JSONL, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                failures.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    _atomic_write_json(FAILED_JSON, failures)
    return len(failures)


# --- ARGS ---
def _parse_args():
    import argparse
    p = argparse.ArgumentParser(description="Extract criminal-case details from affidavit PDFs.")
    p.add_argument("--only", type=str, default=None,
                   help="Process only the candidate whose safe_name matches.")
    p.add_argument("--limit", type=int, default=None,
                   help="Process at most N candidates (after --only filtering).")
    p.add_argument("--workers", type=int, default=1,
                   help="Parallel worker processes. Default 1 (recommended for CPU-bound Ollama).")
    p.add_argument("--model", type=str, default=os.environ.get("OLLAMA_MODEL", "gemma3:4b"),
                   help="Ollama model tag for the text-mode parsing step (default gemma3:4b).")
    p.add_argument("--resume", action="store_true",
                   help="Skip candidates already extracted by this model+prompt-version.")
    return p.parse_args()


def main():
    args = _parse_args()

    # Propagate --model into the env so worker processes (which re-import this module) see it.
    os.environ["OLLAMA_MODEL"] = args.model
    global OLLAMA_MODEL
    OLLAMA_MODEL = args.model

    if args.workers > 1:
        print("⚠️  --workers > 1 with a single Ollama runner usually does NOT speed things up "
              "and has caused worker crashes in the past. Default of 1 recommended.", flush=True)

    with open(CANDIDATES_JSON, encoding="utf-8") as f:
        candidates = json.load(f)

    try:
        client.list()
        print("✅ Ollama is running.", flush=True)
    except Exception as e:
        print(f"❌ Ollama not reachable: {e}", flush=True)
        return

    to_process = candidates
    if args.only:
        to_process = [c for c in to_process if _safe_name(c["name"]) == args.only]
        if not to_process:
            print(f"❌ No candidate matched --only={args.only}")
            return

    if args.resume:
        target_stamp = _source_stamp(args.model)
        before = len(to_process)
        to_process = [
            c for c in to_process
            if (c.get("criminal_summary") or {}).get("source") != target_stamp
        ]
        print(f"↪️  --resume: skipping {before - len(to_process)} candidates already at {target_stamp}", flush=True)

    if args.limit is not None:
        to_process = to_process[: args.limit]

    total_queue = len(to_process)
    workers = max(1, args.workers)
    label = f"--only {args.only}" if args.only else f"ALL {total_queue}"
    print(f"🚀 Processing {label} candidates "
          f"(model={args.model}, workers={workers}, prompt={PROMPT_VERSION})", flush=True)

    if total_queue == 0:
        print("✅ Nothing to do.")
        return

    completed = 0
    success_count = 0
    failure_count = 0
    name_by_id = {str(c["id"]): c["name"] for c in candidates}

    def _handle_result(cand_id, results, status):
        nonlocal completed, success_count, failure_count
        completed += 1
        cand_name = name_by_id.get(str(cand_id), str(cand_id))
        if status == "Success" and results and "summary" in results:
            success_count += 1
            num = results["summary"].get("num_criminal_cases", 0)
            print(f"  [{completed}/{total_queue}] ✅ {cand_name} ({num} cases)", flush=True)
            commit_candidate(candidates, cand_id, results)
        else:
            failure_count += 1
            print(f"  [{completed}/{total_queue}] ❌ {cand_name}: {status}", flush=True)
            append_failure({"id": cand_id, "name": cand_name, "reason": str(status)})

    try:
        if workers == 1:
            for cand in to_process:
                cand_id, results, status = process_single_candidate(cand)
                _handle_result(cand_id, results, status)
        else:
            with ProcessPoolExecutor(max_workers=workers) as pool:
                futures = {pool.submit(process_single_candidate, c): c for c in to_process}
                for fut in as_completed(futures):
                    c = futures[fut]
                    try:
                        cand_id, results, status = fut.result(timeout=PER_CANDIDATE_TIMEOUT_SECS)
                    except FuturesTimeoutError:
                        cand_id, results, status = c["id"], None, (
                            f"timeout after {PER_CANDIDATE_TIMEOUT_SECS:.0f}s "
                            f"(worker may be hung; persisting partial state)"
                        )
                    except Exception as e:
                        cand_id, results, status = c["id"], None, f"{type(e).__name__}: {e}"
                    _handle_result(cand_id, results, status)
    except KeyboardInterrupt:
        print("\n\n🛑 STOPPING: Ctrl+C detected. Partial state already saved per-candidate.", flush=True)

    consolidated = consolidate_failures()
    print(f"\n🏁 Done. Success: {success_count}, Failed: {failure_count}, "
          f"Failure log: {FAILED_JSONL.name} ({consolidated} entries consolidated to {FAILED_JSON.name})",
          flush=True)


if __name__ == "__main__":
    main()
