# Committed 2026-05 (previously an untracked local file). One-line diagnostic
# for the criminal-cases pipeline (see scraper_lab/README.md): lists which
# affidavit PDFs have an extractable text layer vs. which are pure scans (the
# ~72% that need Tesseract). Kept, not deleted — it's how we sized the OCR cost.
import pdfplumber
import glob
import os

pdf_files = glob.glob("public/affidavits/*.pdf")
for pdf_path in pdf_files[:20]:
    with pdfplumber.open(pdf_path) as pdf:
        has_text = False
        for i in range(min(5, len(pdf.pages))):
            if pdf.pages[i].extract_text():
                has_text = True
                break
        if has_text:
            print(f"Has text: {os.path.basename(pdf_path)}")
