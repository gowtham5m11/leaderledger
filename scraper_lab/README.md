# leaderledger / scraper_lab

Pipeline that turns Andhra Pradesh election affidavit PDFs into the
`criminal_summary` / `criminal_details_*` / `profession` / `education` fields
on each candidate in `src/data/candidates.json` (consumed by the React frontend
in `src/components/CandidateProfile.jsx`).

## Canonical 5-stage criminal-cases flow

Stage scripts are designed to be run independently from the project root
(`.venv/bin/python scraper_lab/<script>.py`).

| # | Stage | Script | Input | Output |
|---|---|---|---|---|
| 1 | Scrape MyNeta ground truth (one-time) | `fetch_myneta.py` | MyNeta candidates_analyzed table (web) | `scraper_lab/myneta_data.json` |
| 2 | Build per-candidate page index | `find_criminal_pages.py` | `scraper_lab/affidavits/*.pdf` | `src/data/criminal_pages_index.json` |
| 3 | Extract case details (OCR + text LLM) | `detailed_criminal_history.py` | PDFs + page index + patches | `src/data/candidates.json` (`criminal_*` fields) |
| 4 | Apply manual patches | (loaded inside stage 3) | `src/data/criminal_patches.json` | (overrides stage-3 output) |
| 5 | Validate against MyNeta | `validate_with_myneta.py` | `candidates.json` + `myneta_data.json` | `src/data/myneta_validation_report.json` (stdout summary + persisted JSON) |

### End-to-end runbook

```bash
# 1. (Re-)build page index when PDFs change. ~10 min for 175 PDFs.
.venv/bin/python scraper_lab/find_criminal_pages.py --force --workers 4

# 2. Run the extraction. ~12 h for 175 candidates; --resume tolerates interruptions.
#    Uses Tesseract for OCR, then gemma3:4b in TEXT mode (no images) for parsing.
.venv/bin/python scraper_lab/detailed_criminal_history.py \
    --model gemma3:4b --workers 1 --resume

# 3. Audit the result.
.venv/bin/python scraper_lab/validate_with_myneta.py
```

## Extraction strategy

We tested several local VLM backends on Apple M1 / 8 GB RAM:

| Backend | Result | Verdict |
|---|---|---|
| `qwen2.5vl:7b` | 6 GB model swap-thrashes 8 GB RAM; >900 s per page and still times out. | Unusable. |
| `moondream:1.8b` | Fast (~5 s/page) but 1.8 B params can't follow structured-extraction prompts on dense documents; regurgitates prompt placeholders. | Unusable. |
| `gemma3:4b` (vision) | ~30 s/page but misreads FIRs (returns the same number for every column of a 3-case table). | Unusable. |
| **Tesseract OCR + `gemma3:4b` text mode** | ~37 s/page. Tesseract reads FIRs reliably (`79/2023`, `56/2023`, `74/2023`), then gemma3:4b parses the OCR text into JSON. | **Current backend.** |

A **post-extraction cleanup pass** (built into the extractor's downstream
pipeline) filters out records whose FIR doesn't match `\d+/\d{2,4}` and that
have no recognisable IPC section — this catches the model's tendency to
fabricate FIRs from noisy OCR (e.g. asset values, dates, garbled text).

### What NOT to do on an 8 GB machine

Do **not** run `qwen2.5vl:7b --workers 4` (or any 7 B+ vision model with
parallel workers). One overnight attempt produced **zero saved candidates in 6
hours** — workers crashed every ~50 min due to swap thrashing. The default
worker count is `1` for this reason; the script emits a warning if
`--workers > 1` is set.

## Data files

Under `src/data/`:

| File | Role | Owner |
|---|---|---|
| `candidates.json` | Master record consumed by the frontend. | All stages |
| `criminal_pages_index.json` | Per-candidate `pending_pages`, `conviction_pages`, `pdf_sha1`. | `find_criminal_pages.py` |
| `criminal_patches.json` | Manual overrides for candidates where extraction fails (provenance fields: `created_at`, `auditor`, `reason`, `last_verified_at`). | Human-edited |
| `myneta_validation_report.json` | Audit output: matched / exact / overcount / undercount / unmatched. | `validate_with_myneta.py` |
| `failed_extractions.jsonl` | Streaming per-failure log during extraction. | `detailed_criminal_history.py` |
| `candidates.backup_pre_*.json` | Timestamped backups before major re-extractions. | Ad-hoc |

## Companion feature pipelines (independent of criminal-cases flow)

- `gather_data.py` — download affidavits from ECI (Selenium).
- `profession_fetcher.py` — extract profession field.
- `alma_details.py` — extract education field.
- `extract_socials*.py` — extract social-media URLs (multiple OCR strategies).
- `fix_faulty_affidavits.py` — re-download specific PDFs.
- `audit_pdfs.py`, `audit_extraction.py`, `find_text_pdfs.py`, `display_criminal_info.py`, `check_pages.py` — diagnostics.

Archived one-offs live in [`_archive/`](_archive/README.md).
