"""Standalone test: run the criminal-extraction pipeline on a small candidate set
with a swappable VLM model, and compare against MyNeta ground truth.

Committed 2026-05 — previously an untracked local file. Kept rather than deleted
because it's the harness behind the "which backend?" table in scraper_lab/README.md
(qwen2.5vl / moondream / gemma3 comparison) and is how a new model gets evaluated.

Usage:
    .venv/bin/python scraper_lab/test_vlm_model.py qwen2.5vl:7b
"""
import os
import sys
import json
import time
import tempfile
from pathlib import Path

import ollama
from pdf2image import convert_from_path

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scraper_lab"))

from criminal_module import (  # noqa: E402
    CRIMINAL_VLM_PROMPT,
    parse_criminal_json_response,
    build_criminal_summary,
)

CANDIDATES_JSON = PROJECT_ROOT / "src" / "data" / "candidates.json"
INDEX_JSON = PROJECT_ROOT / "src" / "data" / "criminal_pages_index.json"
MYNETA_JSON = PROJECT_ROOT / "scraper_lab" / "myneta_data.json"
PDF_DIR = PROJECT_ROOT / "public" / "affidavits"

# Worst undercount candidates from the most recent audit, plus the +38 outlier
TEST_CANDIDATES = [
    "Amaranatha Reddy. N",
    "Tangirala Sowmya",
    "Yarapathineni Srinivasa Rao",
    "Kalava Srinivasulu",
    "Damacharla Janardhana Rao",
    "Kanumuru Raghu Rama Krishna Raju (R R R)",
    "M.S.Raju",
    "China Rajappa Nimmakayala",
    "Dhulipalla Narendra Kumar",
    "Kollu. Ravindra",
    "Panchakarla Ramesh Babu",   # known +38 overcount; want to confirm new model is sane
]


def safe(name):
    return "".join(c if c.isalnum() else "_" for c in name).lower()


def run_pipeline(client, model, pdf_path, pages):
    cases = {"pending": [], "convictions": []}
    for page_num in pages:
        try:
            images = convert_from_path(
                str(pdf_path), first_page=page_num, last_page=page_num, dpi=300
            )
            if not images:
                continue
            tmp = os.path.join(tempfile.gettempdir(), f"vlmtest_{os.getpid()}_{page_num}.png")
            images[0].save(tmp, "PNG")
            try:
                resp = client.chat(
                    model=model,
                    messages=[{
                        "role": "user",
                        "content": CRIMINAL_VLM_PROMPT,
                        "images": [tmp],
                    }],
                )
                raw = resp["message"]["content"]
                parsed = parse_criminal_json_response(
                    raw, page_num=page_num, method=f"VLM-{model}"
                )
                cases["pending"].extend(parsed["pending"])
                cases["convictions"].extend(parsed["convictions"])
            finally:
                if os.path.exists(tmp):
                    os.remove(tmp)
        except Exception as e:
            print(f"    page {page_num} error: {e}", flush=True)
    summary = build_criminal_summary(cases)
    return summary, cases


def main():
    if len(sys.argv) < 2:
        print("usage: test_vlm_model.py <ollama-model> [name1] [name2] ...")
        sys.exit(1)
    model = sys.argv[1]
    names = sys.argv[2:] or TEST_CANDIDATES

    cands = json.load(open(CANDIDATES_JSON))
    index = json.load(open(INDEX_JSON))
    myneta = json.load(open(MYNETA_JSON))

    by_name = {c["name"]: c for c in cands}
    myneta_by_name = {m["name"].lower(): m["cases"] for m in myneta}

    client = ollama.Client(host="http://127.0.0.1:11434")
    print(f"Testing model: {model}")
    print(f"Candidates: {len(names)}\n")

    rows = []
    start_all = time.time()
    for name in names:
        c = by_name.get(name)
        if not c:
            print(f"SKIP {name}: not in candidates.json")
            continue
        sn = safe(name)
        entry = index["candidates"].get(sn, {})
        pp = entry.get("pending_pages") or []
        cp = entry.get("conviction_pages") or []
        pages = sorted(set(pp) | set(cp))
        pdf_path = PDF_DIR / f"{sn}.pdf"
        if not pdf_path.exists():
            print(f"SKIP {name}: PDF missing")
            continue
        if not pages:
            print(f"SKIP {name}: no indexed pages")
            continue

        old = c.get("criminal_summary", {}).get("num_criminal_cases", 0)
        # MyNeta lookup (loose name match)
        mn = None
        nl = name.lower()
        for k, v in myneta_by_name.items():
            if k == nl or nl in k or k in nl:
                mn = v
                break

        print(f"\n>>> {name} ({len(pages)} pages, MyNeta={mn}, prev_AI={old})")
        t0 = time.time()
        summary, _ = run_pipeline(client, model, pdf_path, pages)
        dt = time.time() - t0
        new = summary["num_criminal_cases"]
        delta = (new - mn) if mn is not None else None
        rows.append({
            "name": name, "pages": len(pages), "myneta": mn,
            "prev_ai": old, "new_ai": new, "delta_vs_myneta": delta, "secs": round(dt, 1),
        })
        print(f"    new_AI={new}  prev_AI={old}  MyNeta={mn}  Δ_vs_MyNeta={delta}  ({dt:.1f}s)")

    print("\n" + "=" * 90)
    print(f"Model: {model}  total_time={time.time()-start_all:.1f}s")
    print(f"{'Candidate':<42} {'pgs':>4} {'MyNeta':>7} {'prev':>5} {'new':>5} {'Δ':>5} {'secs':>6}")
    for r in rows:
        d = r["delta_vs_myneta"]
        d_str = f"{d:+d}" if d is not None else "?"
        print(f"{r['name']:<42} {r['pages']:>4} {str(r['myneta']):>7} {r['prev_ai']:>5} {r['new_ai']:>5} {d_str:>5} {r['secs']:>5}s")

    out = PROJECT_ROOT / "src" / "data" / f"vlm_model_test_{model.replace(':','_').replace('/','_')}.json"
    out.write_text(json.dumps({"model": model, "rows": rows}, indent=2))
    print(f"\n💾 saved {out}")


if __name__ == "__main__":
    main()
