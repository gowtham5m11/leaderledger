"""
Build criminal_pages_index_2019.json one PDF at a time with a per-PDF timeout.

Wraps find_criminal_pages.py --only <stem>, which exits after one PDF.
Any PDF that exceeds --timeout seconds is recorded as status=timeout and skipped.
Already-indexed PDFs are skipped automatically (find_criminal_pages.py default behaviour).

Run:
    .venv/bin/python scraper_lab/build_2019_index.py
    .venv/bin/python scraper_lab/build_2019_index.py --timeout 300  # 5-min cap per PDF
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
PDF_DIR = PROJECT_ROOT / "scraper_lab" / "affidavits_historical" / "2019"
INDEX_JSON = PROJECT_ROOT / "src" / "data" / "criminal_pages_index_2019.json"
PY = str(PROJECT_ROOT / ".venv" / "bin" / "python")
FINDER = str(PROJECT_ROOT / "scraper_lab" / "find_criminal_pages.py")


def load_index() -> dict:
    if INDEX_JSON.exists():
        return json.loads(INDEX_JSON.read_text())
    return {"candidates": {}}


def write_timeout_entry(stem: str) -> None:
    """Add a stub entry so the PDF is not retried next run."""
    data = load_index()
    data["candidates"][stem] = {
        "pdf": f"{stem}.pdf",
        "status": "timeout",
        "pending_pages": [],
        "conviction_pages": [],
        "scan_seconds": -1,
    }
    data["generated_at"] = datetime.utcnow().isoformat() + "Z"
    data["total_pdfs"] = len(data["candidates"])
    INDEX_JSON.write_text(json.dumps(data, indent=2))


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout", type=int, default=300,
                    help="Per-PDF timeout in seconds (default 300 = 5 min)")
    args = ap.parse_args()

    all_pdfs = sorted(PDF_DIR.glob("*.pdf"))

    index = load_index()
    done = set(index.get("candidates", {}).keys())
    remaining = [p for p in all_pdfs if p.stem not in done]

    log(f"Already indexed: {len(done)} / {len(all_pdfs)}")
    log(f"Remaining: {len(remaining)}  (timeout per PDF: {args.timeout}s)")

    timeouts = 0
    errors = 0

    for i, pdf in enumerate(remaining, 1):
        log(f"[{i}/{len(remaining)}] {pdf.name} ({pdf.stat().st_size // 1024}KB) ...")
        t0 = time.time()
        proc = subprocess.Popen(
            [PY, FINDER,
             "--pdf-dir", str(PDF_DIR),
             "--output-json", str(INDEX_JSON),
             "--only", pdf.stem,
             "--workers", "1"],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            # Start in a new process group so we can kill the whole tree
            start_new_session=True,
        )
        try:
            proc.wait(timeout=args.timeout)
            elapsed = round(time.time() - t0, 1)
            status = "ok" if proc.returncode == 0 else f"exit{proc.returncode}"
            log(f"  {status} ({elapsed}s)")
            if status != "ok":
                errors += 1
        except subprocess.TimeoutExpired:
            elapsed = round(time.time() - t0, 1)
            # Kill entire process group (catches tesseract/pdftoppm grandchildren)
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait()
            log(f"  TIMEOUT after {elapsed}s — writing stub and continuing")
            write_timeout_entry(pdf.stem)
            timeouts += 1

    # Final counts
    final_index = load_index()
    total = len(final_index.get("candidates", {}))
    log(f"=== Done: {total} indexed, {timeouts} timeouts, {errors} errors ===")


if __name__ == "__main__":
    sys.exit(main())
