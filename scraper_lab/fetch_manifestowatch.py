"""Scrape TDP AP 2024 manifesto promises from manifestowatch.in.

Fetches all 160 promise pages and maps each to the LeaderLedger achievements
schema so they can be seeded into Firestore via scripts/seed_achievements.mjs.

Output: scraper_lab/manifestowatch_promises.json

Run:
    python3 scraper_lab/fetch_manifestowatch.py
    python3 scraper_lab/fetch_manifestowatch.py --resume   # skip already-fetched slugs
    python3 scraper_lab/fetch_manifestowatch.py --delay 1.5
"""

import argparse
import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE = "https://manifestowatch.in"
ELECTION = "/elections/andhra-pradesh-assembly-2024/promises"
OUTPUT = Path(__file__).parent / "manifestowatch_promises.json"
HEADERS = {"User-Agent": "LeaderLedger-research-bot/1.0 (+https://leaderledger.in)"}

ALL_SLUGS = [
    "promise-tdpap24-temple-attacks-commission",
    "promise-tdpap24-scst-justice-named-victims",
    "promise-tdpap24-bc-justice-named-victims",
    "promise-tdpap24-dev-vision-2047-state",
    "promise-tdpap24-food-processing-incentives",
    "promise-tdpap24-ind-restore-brand-ap-investments",
    "promise-tdpap24-kapu-15000cr-fund",
    "promise-tdpap24-brahmin-corporation-credit-society",
    "promise-tdpap24-aryavysya-corporation-funds",
    "promise-tdpap24-upper-caste-poor-corporations",
    "promise-tdpap24-edu-fee-direct-to-colleges",
    "promise-tdpap24-health-digital-health-cards",
    "promise-tdpap24-housing-complete-pucca-houses",
    "promise-tdpap24-housing-land-allotment",
    "promise-tdpap24-uttarandhra-visakha-financial-capital",
    "promise-tdpap24-kshatriya-bhogapuram-airport-naming",
    "promise-tdpap24-power-rooftop-solar-bills",
    "promise-tdpap24-excise-liquor-prices-ban-toxic",
    "promise-tdpap24-supersix2-skill-census",
    "promise-tdpap24-supersix-youth-jobs-allowance",
    "promise-tdpap24-rayalaseema-kurnool-highcourt-bench",
    "promise-tdpap24-women-anganwadi-asha-benefits",
    "promise-tdpap24-agri-zbnf-organic-farming",
    "promise-tdpap24-agri-tenant-farmer-cards",
    "promise-tdpap24-agri-drip-irrigation-subsidy",
    "promise-tdpap24-uttarandhra-visakha-railway-zone",
    "promise-tdpap24-supersix2-p4-poor-to-rich",
    "promise-tdpap24-supersix2-amaravati",
    "promise-tdpap24-uttarandhra-vizag-steel-protect",
    "promise-tdpap24-supersix-deepam-gas",
    "promise-tdpap24-supersix2-gsdp-growth",
    "promise-tdpap24-supersix2-soubhagya-patham",
    "promise-tdpap24-supersix2-piped-drinking-water",
    "promise-tdpap24-supersix-free-bus-women",
    "promise-tdpap24-supersix-women-1500",
    "promise-tdpap24-supersix-annadata-sukhibhava",
    "promise-tdpap24-supersix-talliki-vandanam",
    "promise-tdpap24-weavers-gst-free-power",
    "promise-tdpap24-mega-dsc-job-calendar",
    "promise-tdpap24-bc-self-employment-10000cr",
    "promise-tdpap24-bc-corporation-funding",
    "promise-tdpap24-bc-nomination-small-communities",
    "promise-tdpap24-bc-33pc-legislature-resolution",
    "promise-tdpap24-bc-34pc-local-bodies",
    "promise-tdpap24-bc-sub-plan",
    "promise-tdpap24-bc-protection-law",
    "promise-tdpap24-bc-pension-4000",
    "promise-tdpap24-comm-goldsmiths-corporation",
    "promise-tdpap24-comm-fishermen-boat-aid",
    "promise-tdpap24-comm-fishermen-ban-aid-go217",
    "promise-tdpap24-comm-rajaka-dhobighat-power",
    "promise-tdpap24-comm-vaddera-quarry-royalty",
    "promise-tdpap24-comm-geetha-liquor-10pc",
    "promise-tdpap24-women-restore-festival-wedding-gifts",
    "promise-tdpap24-women-kalalaku-rekkalu-loans",
    "promise-tdpap24-women-working-hostels",
    "promise-tdpap24-women-p4-empowerment",
    "promise-tdpap24-women-shg-loans-10lakh",
    "promise-tdpap24-dairy-gopala-mitra-reappointment",
    "promise-tdpap24-dairy-cattle-subsidies-package",
    "promise-tdpap24-emp-volunteers-honorarium-10000",
    "promise-tdpap24-emp-outsourcing-contract-schemes",
    "promise-tdpap24-emp-salary-1st-arrears-corp",
    "promise-tdpap24-emp-prc-ir",
    "promise-tdpap24-emp-cps-gps-review",
    "promise-tdpap24-emp-restore-dignity",
    "promise-tdpap24-aryavysya-kanyaka-parameshwari-day",
    "promise-tdpap24-aryavysya-business-environment",
    "promise-tdpap24-aryavysya-traders-interest-free-loans",
    "promise-tdpap24-kapu-bhavans-construction",
    "promise-tdpap24-kapu-youth-women-skilling",
    "promise-tdpap24-pr-local-body-honorarium-increase",
    "promise-tdpap24-pr-budget-5pc-to-10pc",
    "promise-tdpap24-pr-development-vision",
    "promise-tdpap24-pr-restore-system-local-governance",
    "promise-tdpap24-pr-fc-funds-direct-to-panchayats",
    "promise-tdpap24-rayalaseema-mission-rayalaseema",
    "promise-tdpap24-rayalaseema-cbic-cluster",
    "promise-tdpap24-rayalaseema-automobile-hub",
    "promise-tdpap24-rayalaseema-horticulture-seed-capital",
    "promise-tdpap24-rayalaseema-priority-basic-facilities",
    "promise-tdpap24-uttarandhra-kotipalli-narsapur-railway",
    "promise-tdpap24-uttarandhra-cashew-coconut-prices",
    "promise-tdpap24-uttarandhra-vizag-chennai-corridor",
    "promise-tdpap24-governance-restore-law-order",
    "promise-tdpap24-governance-strengthen-systems",
    "promise-tdpap24-agrigold-victims-asset-sale",
    "promise-tdpap24-lawyers-infrastructure-stipend-academy",
    "promise-tdpap24-journalists-free-house-site",
    "promise-tdpap24-tourism-circuits",
    "promise-tdpap24-dev-comprehensive-economic-development",
    "promise-tdpap24-aqua-cold-storage-power-package",
    "promise-tdpap24-law-drugs-100-days",
    "promise-tdpap24-veda-yuvagalam-unemployment-allowance",
    "promise-tdpap24-brahmin-funeral-rite-buildings",
    "promise-tdpap24-brahmin-temple-trust-board-member",
    "promise-tdpap24-brahmin-recognize-purohits-occupation",
    "promise-tdpap24-temple-restore-historical-structures",
    "promise-tdpap24-temple-vedic-agama-autonomy",
    "promise-tdpap24-temple-archaka-wage-ddn-increase",
    "promise-tdpap24-temple-archaka-min-wage-private",
    "promise-tdpap24-temple-hindu-endowment-board",
    "promise-tdpap24-infra-wfh-workstations",
    "promise-tdpap24-infra-ports-airports-railways",
    "promise-tdpap24-infra-social-infrastructure",
    "promise-tdpap24-infra-village-mandal-district-roads",
    "promise-tdpap24-edu-ambedkar-overseas-restore",
    "promise-tdpap24-edu-go117-reopen-schools",
    "promise-tdpap24-edu-kg-pg-syllabus-review",
    "promise-tdpap24-health-free-generic-ncd-medicines",
    "promise-tdpap24-health-jan-aushadhi-mandal-centres",
    "promise-tdpap24-health-25lakh-family-insurance",
    "promise-tdpap24-gov-free-sand-policy",
    "promise-tdpap24-edu-fee-reimbursement-restore",
    "promise-tdpap24-food-ration-distribution-review",
    "promise-tdpap24-food-anna-canteens",
    "promise-tdpap24-work-sanitation-workers-board",
    "promise-tdpap24-work-building-construction-board-restore",
    "promise-tdpap24-work-chandranna-bima-restore",
    "promise-tdpap24-work-green-tax-reduction",
    "promise-tdpap24-work-go21-repeal-fines",
    "promise-tdpap24-work-drivers-15000-aid",
    "promise-tdpap24-work-driver-empowerment-corporation",
    "promise-tdpap24-price-control-petrol-diesel",
    "promise-tdpap24-tax-abolish-garbage-review-house",
    "promise-tdpap24-irr-pending-projects-rayalaseema-uttarandhra",
    "promise-tdpap24-irr-river-linking-water-every-acre",
    "promise-tdpap24-irr-projects-fast-track",
    "promise-tdpap24-irr-polavaram-complete",
    "promise-tdpap24-gov-land-titling-repeal",
    "promise-tdpap24-agri-sericulture-promotion",
    "promise-tdpap24-agri-apmc-act",
    "promise-tdpap24-agri-warehouses-cold-storage",
    "promise-tdpap24-agri-farm-labour-corporation",
    "promise-tdpap24-agri-price-stabilization-fund",
    "promise-tdpap24-agri-equipment-subsidy",
    "promise-tdpap24-agri-solar-pumpsets",
    "promise-tdpap24-agri-9hr-free-power",
    "promise-tdpap24-scst-fill-backlog-posts",
    "promise-tdpap24-scst-restore-discontinued-schemes",
    "promise-tdpap24-scst-tribal-teachers-go3",
    "promise-tdpap24-scst-subplan-funds",
    "promise-tdpap24-scst-pension-50",
    "promise-tdpap24-scst-district-categorization",
    "promise-tdpap24-pension-chronic-illness-10000",
    "promise-tdpap24-pension-severe-disability-15000",
    "promise-tdpap24-pension-disabled-6000",
    "promise-tdpap24-pension-increase-4000",
    "promise-tdpap24-christian-jerusalem-pilgrim-aid",
    "promise-tdpap24-christian-cemetery-land",
    "promise-tdpap24-christian-church-construction-aid",
    "promise-tdpap24-christian-missionaries-property-board",
    "promise-tdpap24-muslim-mosque-maintenance-haj-aid",
    "promise-tdpap24-muslim-imams-as-qazis",
    "promise-tdpap24-muslim-imam-mauzam-honorarium",
    "promise-tdpap24-muslim-noorbasha-corp-finance",
    "promise-tdpap24-muslim-eidgah-khabristan-hajhouse",
    "promise-tdpap24-muslim-pension-50",
    "promise-tdpap24-ex-servicemen-corporation",
    "promise-tdpap24-kshatriya-alluri-memorial-amaravati",
    # fulfilled (from ?sg=fulfilled filter)
    "promise-tdpap24-kshatriya-bhogapuram-airport-naming",  # may dup — deduped below
    "promise-tdpap24-gov-land-titling-repeal",
    "promise-tdpap24-pension-chronic-illness-10000",
    "promise-tdpap24-pension-disabled-6000",
    "promise-tdpap24-pension-increase-4000",
]

# Deduplicate while preserving order
seen = set()
SLUGS = []
for s in ALL_SLUGS:
    if s not in seen:
        seen.add(s)
        SLUGS.append(s)

# ManifestoWatch status → LeaderLedger manifesto_status
STATUS_MAP = {
    "fulfilled": "delivered",
    "on track": "in_progress",
    "stalled": "broken",
    "pending": "promised",
    "partially done": "in_progress",
}

# ManifestoWatch category → LeaderLedger category
CATEGORY_MAP = {
    "welfare": "welfare",
    "governance": "policy",
    "infrastructure": "infrastructure",
    "agriculture": "welfare",
    "economy": "investment",
    "women": "welfare",
    "culture": "policy",
    "education": "welfare",
    "health": "welfare",
    "jobs": "investment",
    "housing": "welfare",
    "energy": "infrastructure",
    "water": "infrastructure",
}


def parse_promise(slug: str, html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    # Title
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else slug

    # Status — first span whose class string contains 'bg-status-'
    status_raw = ""
    for span in soup.find_all("span"):
        cls = " ".join(span.get("class", []))
        if "bg-status-" in cls and "bg-status-partial" not in cls:
            status_raw = span.get_text(strip=True).lower()
            break
    manifesto_status = STATUS_MAP.get(status_raw, "promised")

    # Category — span with bg-white/10 text-white/80 (category chip in hero)
    category_raw = ""
    for span in soup.find_all("span"):
        cls = " ".join(span.get("class", []))
        if "bg-white/10" in cls and "text-white/80" in cls:
            category_raw = span.get_text(strip=True).lower()
            break
    category = CATEGORY_MAP.get(category_raw, "policy")

    # Manifesto quote — p.italic inside blockquote
    manifesto_text = ""
    bq = soup.find("blockquote")
    if bq:
        p = bq.find("p", class_=lambda c: c and "italic" in c)
        if not p:
            p = bq.find("p")
        if p:
            manifesto_text = p.get_text(strip=True).strip('"').strip('“').strip('”')

    # Assessment text — p.text-white/70 inside div.bg-deep-slate
    assessment = ""
    assessment_div = soup.find("div", class_=lambda c: c and "bg-deep-slate" in c)
    if assessment_div:
        p = assessment_div.find("p", class_=lambda c: c and "text-white/70" in c)
        if p:
            assessment = p.get_text(strip=True)

    # Last updated — p.font-mono.text-xs.text-white/40.mt-1
    last_updated = ""
    for p in soup.find_all("p"):
        cls = " ".join(p.get("class", []))
        if "font-mono" in cls and "text-xs" in cls and "mt-1" in cls:
            text = p.get_text(strip=True)
            # "Last updated14 Jun 2026" → strip label
            last_updated = re.sub(r"^Last updated\s*", "", text)
            break

    # Source URL — external link to the manifesto PDF
    source_url = ""
    source_doc = ""
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("https://") and "telugudesam" in href:
            source_url = href
            # source doc text lives in a <p> sibling with the truncate class
            p = a.find("p", class_=lambda c: c and "truncate" in c)
            if p:
                source_doc = p.get_text(strip=True)
            break

    # Confidence level
    confidence = ""
    for span in soup.find_all("span"):
        cls = " ".join(span.get("class", []))
        if "bg-status-partial" in cls and "text-status-partial" in cls:
            confidence = span.get_text(strip=True).lower()
            break

    return {
        "slug": slug,
        "source_page": f"{BASE}{ELECTION}/{slug}",
        "title": title,
        "manifesto_text": manifesto_text,
        "assessment": assessment,
        "manifesto_status": manifesto_status,
        "status_raw": status_raw,
        "category": category,
        "category_raw": category_raw,
        "party": "TDP",
        "government": "NDA (TDP + JSP + BJP)",
        "confidence": confidence,
        "last_updated": last_updated,
        "source_url": source_url,
        "source_doc": source_doc,
        # LeaderLedger achievements schema fields
        "action_type": "positive",
        "source_tier": "official",
        "submitted_by": "admin",
        "status": "live",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume", action="store_true", help="Skip slugs already in output file")
    parser.add_argument("--delay", type=float, default=1.0, help="Seconds between requests")
    args = parser.parse_args()

    existing = {}
    if args.resume and OUTPUT.exists():
        for row in json.loads(OUTPUT.read_text()):
            existing[row["slug"]] = row
        print(f"Resuming — {len(existing)} already fetched")

    results = dict(existing)
    todo = [s for s in SLUGS if s not in results]
    print(f"Fetching {len(todo)} of {len(SLUGS)} promises …")

    session = requests.Session()
    session.headers.update(HEADERS)

    for i, slug in enumerate(todo, 1):
        url = f"{BASE}{ELECTION}/{slug}"
        try:
            r = session.get(url, timeout=15)
            r.raise_for_status()
            row = parse_promise(slug, r.text)
            results[slug] = row
            status_display = row["status_raw"] or "?"
            print(f"  [{i:3}/{len(todo)}] {slug[:55]:<55} {status_display}")
        except Exception as exc:
            print(f"  [{i:3}/{len(todo)}] ERROR {slug}: {exc}")
            results[slug] = {"slug": slug, "error": str(exc)}

        if i < len(todo):
            time.sleep(args.delay)

    ordered = [results[s] for s in SLUGS if s in results]
    OUTPUT.write_text(json.dumps(ordered, indent=2, ensure_ascii=False))
    print(f"\nSaved {len(ordered)} promises → {OUTPUT}")

    # Summary
    from collections import Counter
    statuses = Counter(r.get("manifesto_status", "?") for r in ordered if "error" not in r)
    print("Status breakdown:", dict(statuses))


if __name__ == "__main__":
    main()
