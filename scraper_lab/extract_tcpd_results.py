"""
Extract per-election MLA results from TCPD CSV.

─── Input sources ────────────────────────────────────────────────────────────

  scraper_lab/tcpd_ap_ae.csv.gz
    TCPD AP Assembly Elections dataset (Trivedi Centre for Political Data,
    Ashoka University).  Download / update from:
      https://lokdhaba.ashoka.edu.in/  →  State Assembly Elections → Andhra Pradesh
    Contains every candidate in every AP assembly election from 1962 onward.
    Used here for years 1983, 1985, 1989, 1994, 1999, 2004, 2009, 2014, 2019.
    Key columns: Year, Election_Type, Constituency_No, Constituency_Name,
                 Position (1=winner, 2=runner-up, 3+=others), Candidate, Party,
                 Votes, Vote_Share_Percentage, Margin, Valid_Votes, Electors,
                 Turnout_Percentage, N_Cand, Constituency_Type, Deposit_Lost,
                 Age, Sex, Incumbent, No_Terms, Turncoat.

─── Outputs ──────────────────────────────────────────────────────────────────

  public/data/eci_results_YEAR.json  for 1983, 1985, 1989, 1994, 1999, 2004, 2009, 2014, 2019
  (2024 is served directly from candidates.json in the frontend — not generated here)

  Format per file:
    [{
      "constituency_no": int,
      "constituency_name": str,
      "constituency_type": str,       # "GEN", "SC", or "ST"
      "total_candidates": int,
      "electors": int | null,
      "valid_votes": int | null,
      "turnout_percent": float | null,
      "winner":   {"name", "party", "votes", "vote_share"},
      "runner_up":{"name", "party", "votes"} | null,
      "margin": int,
      "margin_percent": float | null,
      "all_candidates": [
        {"position", "name", "party", "votes", "vote_share",
         "deposit_lost", "age", "sex", "incumbent", "no_terms"},
        ...
      ]
    }]
"""

import csv, gzip, json, pathlib

ROOT = pathlib.Path(__file__).parent.parent
OUT = ROOT / "public" / "data"
TCPD = ROOT / "scraper_lab" / "tcpd_ap_ae.csv.gz"

TCPD_YEARS = [1983, 1985, 1989, 1994, 1999, 2004, 2009, 2014, 2019]

# Party normalisation: TCPD short codes are already good for most;
# a handful of older / alternate names need mapping.
PARTY_NORM = {
    "Y.S.R. (CP)": "YSRCP",
    "JNP":         "JSP",   # Jana Sena used "JNP" in TCPD occasionally
    "JnP":         "JSP",
}


def norm_party(p: str) -> str:
    return PARTY_NORM.get(p.strip(), p.strip())


def _int(s: str) -> int | None:
    s = (s or "").strip()
    return int(s) if s.lstrip("-").isdigit() else None


def _float(s: str) -> float | None:
    s = (s or "").strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def extract_tcpd(year: int) -> list[dict]:
    """Return sorted list of constituency results for a single TCPD election year."""
    by_constituency: dict[int, list[dict]] = {}

    with gzip.open(TCPD, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Year"] != str(year):
                continue
            if row["Election_Type"] != "State Assembly Election (AE)":
                continue
            cno = int(row["Constituency_No"])
            if cno not in by_constituency:
                by_constituency[cno] = []
            by_constituency[cno].append(row)

    results = []
    for cno in sorted(by_constituency.keys()):
        rows = sorted(by_constituency[cno], key=lambda r: int(r["Position"]))
        w = rows[0]   # position 1 = winner
        r = rows[1] if len(rows) > 1 else None  # position 2 = runner-up

        # Constituency-level stats (same across all rows for this constituency)
        valid = _float(w["Valid_Votes"])
        electors = _int(w["Electors"])
        turnout = _float(w["Turnout_Percentage"])
        margin_val = _float(w["Margin"]) or 0
        margin_pct = round(margin_val / valid * 100, 2) if valid else None
        n_cand_str = w["N_Cand"]
        total_candidates = _int(n_cand_str) if n_cand_str else len(rows)

        # Separate NOTA from real candidates for clean all_candidates list
        nota_rows = [cr for cr in rows if norm_party(cr["Party"]) == "NOTA" or cr["Candidate"].strip().upper() == "NOTA"]
        real_rows = [cr for cr in rows if cr not in nota_rows]
        nota_votes = sum(int(cr["Votes"]) for cr in nota_rows if cr["Votes"])

        entry = {
            "constituency_no":   cno,
            "constituency_name": w["Constituency_Name"].upper(),
            "constituency_type": w["Constituency_Type"].strip() or "GEN",
            "total_candidates":  total_candidates,
            "electors":          electors,
            "valid_votes":       int(valid) if valid else None,
            "turnout_percent":   round(turnout, 2) if turnout is not None else None,
            "nota_votes":        nota_votes if nota_votes else None,
            "winner": {
                "name":       w["Candidate"].title(),
                "party":      norm_party(w["Party"]),
                "votes":      int(w["Votes"]) if w["Votes"] else 0,
                "vote_share": round(_float(w["Vote_Share_Percentage"]), 2) if _float(w["Vote_Share_Percentage"]) is not None else None,
            },
            "runner_up": {
                "name":  r["Candidate"].title() if r else None,
                "party": norm_party(r["Party"]) if r else None,
                "votes": int(r["Votes"]) if r and r["Votes"] else None,
            } if r else None,
            "margin":         int(margin_val),
            "margin_percent": margin_pct,
            "all_candidates": [
                {
                    "position":     pos + 1,
                    "name":         cr["Candidate"].title(),
                    "party":        norm_party(cr["Party"]),
                    "votes":        int(cr["Votes"]) if cr["Votes"] else 0,
                    "vote_share":   round(_float(cr["Vote_Share_Percentage"]), 2) if _float(cr["Vote_Share_Percentage"]) is not None else None,
                    "deposit_lost": (cr["Deposit_Lost"].strip().lower() == "yes") if cr.get("Deposit_Lost") else None,
                    "age":          _int(cr.get("Age", "")),
                    "sex":          cr.get("Sex", "").strip() or None,
                    "incumbent":    (cr.get("Incumbent", "").strip().upper() == "TRUE") if cr.get("Incumbent") else None,
                    "no_terms":     _int(cr.get("No_Terms", "")),
                }
                for pos, cr in enumerate(real_rows)
            ],
        }
        results.append(entry)

    return results


if __name__ == "__main__":
    for year in TCPD_YEARS:
        data = extract_tcpd(year)
        out = OUT / f"eci_results_{year}.json"
        out.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        total_cands = sum(len(e["all_candidates"]) for e in data)
        print(f"{year}: {len(data)} constituencies, {total_cands} candidates → {out.name}")

    print("Done.")
