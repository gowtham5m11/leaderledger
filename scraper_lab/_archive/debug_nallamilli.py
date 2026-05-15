import pdfplumber
import os
import re

pdf_path = "/Users/gowthamjadapalli/Documents/GitHub/leaderledger/public/affidavits/ramakrishna_reddy_nallamilli.pdf"

with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ""
        print(f"--- PAGE {i+1} ---")
        print(text[:500])
        if any(kw in text.upper() for kw in ["CRIMINAL", "FIR", "PENDING", "IPC"]):
            print(">>> KEYWORD FOUND ON THIS PAGE")
