# Archived scripts

One-off / debug / superseded scripts moved out of `scraper_lab/` so the active
pipeline is greppable. Kept under version control rather than deleted so prior
data-fix decisions remain auditable.

| Script | Purpose | Why archived |
|---|---|---|
| `debug_nallamilli.py` | One-off debug of a single candidate's extraction. | Diagnostic ran once. |
| `testing.py` | Ad-hoc Python REPL scratchpad. | Development noise. |
| `test_selenium.py` | Test Selenium/Chrome setup. | Environment validation. |
| `final_update.py` | Hardcoded social-media URLs for ~8 candidates. | One-off data fix; values now in `candidates.json`. |
| `targeted_update.py` | Hardcoded education-field patches for ~10 candidates. | One-off data fix. |
| `cleanup_logic2.py` | Remove duplicate/test candidates. | Cleanup ran once. |
| `cleanup_logic3.py` | Hardcoded education-field patches for ~50 candidates. | One-off data fix. |
| `fix_failed.py` | Re-process failed extractions via legacy OCRmac. | Superseded by the OCR+LLM pipeline. |

Any of these can be revived via `git mv scraper_lab/_archive/<name>.py scraper_lab/<name>.py`.
