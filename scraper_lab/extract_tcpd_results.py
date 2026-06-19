"""
Extract per-election MLA results from TCPD CSV and ECI JSON sources.

─── Input sources ────────────────────────────────────────────────────────────

  scraper_lab/tcpd_ap_ae.csv.gz
    TCPD AP Assembly Elections dataset (Trivedi Centre for Political Data,
    Ashoka University).  Download / update from:
      https://lokdhaba.ashoka.edu.in/  →  State Assembly Elections → Andhra Pradesh
    Contains every candidate in every AP assembly election from 1962 onward.
    Used here for years 1983, 1985, 1989, 1994, 1999, 2004, 2009, 2014.
    Key columns: Year, Election_Type, Constituency_No, Constituency_Name,
                 Position (1=winner, 2=runner-up), Candidate, Party, Votes,
                 Vote_Share_Percentage, Margin.

  scraper_lab/eci_results_2019.json
    ECI 2019 AP Assembly results scraped from the official ECI results portal
    via Wayback Machine snapshots (2019-05-26 to 2019-05-29).
    Produced by: scraper_lab/fetch_eci_results.py (or equivalent fetch script).
    Used here for year 2019 only (the TCPD 2019 data exists but the ECI JSON
    has runner-up detail already structured).

─── Outputs ──────────────────────────────────────────────────────────────────

  public/data/eci_results_YEAR.json  for 1983, 1985, 1989, 1994, 1999, 2004, 2009, 2014, 2019
  (2024 is served directly from candidates.json in the frontend — not generated here)

  Format per file:
    [{"constituency_no": int, "constituency_name": str,
      "winner":   {"name": str, "party": str, "votes": int, "vote_share": float},
      "runner_up":{"name": str, "party": str, "votes": int} | null,
      "margin": int, "margin_percent": float}]
"""

import csv, gzip, json, pathlib

ROOT = pathlib.Path(__file__).parent.parent
OUT = ROOT / "public" / "data"
TCPD = ROOT / "scraper_lab" / "tcpd_ap_ae.csv.gz"
ECI_2019 = ROOT / "scraper_lab" / "eci_results_2019.json"

TCPD_YEARS = [1983, 1985, 1989, 1994, 1999, 2004, 2009, 2014]

# Party normalisation: TCPD short codes are already good for most;
# a handful of older / alternate names need mapping.
PARTY_NORM = {
    "Y.S.R. (CP)": "YSRCP",
    "JNP":         "JSP",   # Jana Sena used "JNP" in TCPD occasionally
}


def norm_party(p: str) -> str:
    return PARTY_NORM.get(p.strip(), p.strip())


def extract_tcpd(year: int) -> list[dict]:
    """Return sorted list of constituency results for a single TCPD election year."""
    winners: dict[int, dict] = {}   # constituency_no → winner row
    runners: dict[int, dict] = {}   # constituency_no → runner-up row

    with gzip.open(TCPD, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Year"] != str(year):
                continue
            if row["Election_Type"] != "State Assembly Election (AE)":
                continue
            pos = row["Position"]
            cno = int(row["Constituency_No"])
            if pos == "1":
                winners[cno] = row
            elif pos == "2":
                runners[cno] = row

    results = []
    for cno, w in sorted(winners.items()):
        r = runners.get(cno)
        margin_val = float(w["Margin"]) if w["Margin"] else 0
        valid = float(w["Valid_Votes"]) if w["Valid_Votes"] else None
        margin_pct = round(margin_val / valid * 100, 2) if valid else None

        entry = {
            "constituency_no":   cno,
            "constituency_name": w["Constituency_Name"].upper(),
            "winner": {
                "name":       w["Candidate"].title(),
                "party":      norm_party(w["Party"]),
                "votes":      int(w["Votes"]) if w["Votes"] else 0,
                "vote_share": round(float(w["Vote_Share_Percentage"]), 2) if w["Vote_Share_Percentage"] else None,
            },
            "runner_up": {
                "name":  r["Candidate"].title() if r else None,
                "party": norm_party(r["Party"]) if r else None,
                "votes": int(r["Votes"]) if r and r["Votes"] else None,
            } if r else None,
            "margin":         int(margin_val),
            "margin_percent": margin_pct,
        }
        results.append(entry)

    return results


def extract_2019() -> list[dict]:
    """Normalise the existing ECI 2019 JSON to the same shape."""
    with open(ECI_2019) as f:
        raw = json.load(f)

    results = []
    for row in raw:
        w = row["winner"]
        r = row.get("runner_up")
        results.append({
            "constituency_no":   row["constituency_no"],
            "constituency_name": row["constituency_name"].upper(),
            "winner": {
                "name":       w["name"].title(),
                "party":      norm_party(w["party"]),
                "votes":      w["total_votes"],
                "vote_share": round(w["percent"], 2),
            },
            "runner_up": {
                "name":  r["name"].title() if r else None,
                "party": norm_party(r["party"]) if r else None,
                "votes": r["total_votes"] if r else None,
            } if r else None,
            "margin":         row["margin"],
            "margin_percent": round(row["margin_percent"], 2),
        })

    return sorted(results, key=lambda x: x["constituency_no"])


if __name__ == "__main__":
    for year in TCPD_YEARS:
        data = extract_tcpd(year)
        out = OUT / f"eci_results_{year}.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        print(f"{year}: {len(data)} constituencies → {out}")

    data = extract_2019()
    out = OUT / "eci_results_2019.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"2019: {len(data)} constituencies → {out}")

    print("Done.")
