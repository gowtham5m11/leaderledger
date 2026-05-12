"""Overnight accuracy-improvement orchestrator for the criminal-cases pipeline.

Committed 2026-05 — previously an untracked local file. Kept rather than deleted
because it's the repeatable "re-extract everything, keep whatever lands closest
to MyNeta, validate" driver used after page-index changes; see scraper_lab/README.md.

Plan:
  0. Wait for any in-progress `detailed_criminal_history.py` run to finish.
  1. Run a `--resume` pass to mop up any candidates not yet at the current
     prompt version (in case the overnight v2 run died mid-way).
  2. Back up candidates.json, run `validate_with_myneta.py`, record baseline.
  3. Improvement loop (a few rounds): for every candidate that is NOT an exact
     MyNeta match and is NOT manually patched, re-extract it with `--only`.
     This is KEEP-BEST-OF-N per candidate: if the re-extraction lands further
     from the MyNeta count than what we already had, that single candidate is
     rolled back. So a candidate can only get closer to ground truth, never
     worse. Up to RETRIES_PER_CANDIDATE attempts each (stop early on exact).
  4. Final validate + write scraper_lab/overnight_report.md.

Run it so the Mac stays awake:
    nohup caffeinate -is .venv/bin/python scraper_lab/overnight_accuracy.py \
        > scraper_lab/overnight.log 2>&1 &
"""
import json
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT    = Path(__file__).parent.parent
PY              = str(PROJECT_ROOT / ".venv" / "bin" / "python")
CANDIDATES_JSON = PROJECT_ROOT / "src" / "data" / "candidates.json"
REPORT_JSON     = PROJECT_ROOT / "src" / "data" / "myneta_validation_report.json"
EXTRACTOR       = PROJECT_ROOT / "scraper_lab" / "detailed_criminal_history.py"
VALIDATOR       = PROJECT_ROOT / "scraper_lab" / "validate_with_myneta.py"
BACKUP          = PROJECT_ROOT / "src" / "data" / "candidates.backup_pre_overnight.json"
REPORT_MD       = PROJECT_ROOT / "scraper_lab" / "overnight_report.md"
MODEL           = "gemma3:4b"

MAX_ROUNDS            = 3
RETRIES_PER_CANDIDATE = 1   # one re-roll per candidate per round; rounds catch stragglers
PER_CAND_TIMEOUT_SECS = 2400  # 40 min hard cap per --only run


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def safe_name(name):
    return "".join(c if c.isalnum() else "_" for c in name).lower()


def load_candidates():
    return json.loads(CANDIDATES_JSON.read_text(encoding="utf-8"))


def write_candidates(cands):
    # match detailed_criminal_history.py's _atomic_write_json (indent=2, ensure_ascii default)
    tmp = CANDIDATES_JSON.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cands, indent=2), encoding="utf-8")
    tmp.replace(CANDIDATES_JSON)


def cand_count(cand):
    return (cand.get("criminal_summary") or {}).get("num_criminal_cases", 0)


def run(cmd, timeout=None):
    log("$ " + " ".join(str(c) for c in cmd))
    try:
        r = subprocess.run(cmd, cwd=PROJECT_ROOT, timeout=timeout,
                           capture_output=True, text=True)
        if r.stdout:
            tail = "\n".join(r.stdout.strip().splitlines()[-12:])
            print(tail, flush=True)
        if r.returncode != 0:
            log(f"  (exit {r.returncode}) stderr tail:\n" +
                "\n".join((r.stderr or "").strip().splitlines()[-8:]))
        return r.returncode == 0
    except subprocess.TimeoutExpired:
        log(f"  !! timed out after {timeout}s")
        return False


def wait_for_extractor_to_idle():
    """Block until no detailed_criminal_history.py process is running."""
    waited = 0
    while True:
        r = subprocess.run(["pgrep", "-f", "detailed_criminal_history.py"],
                           capture_output=True, text=True)
        pids = [p for p in r.stdout.split() if p.strip()]
        if not pids:
            if waited:
                log(f"extractor idle after waiting {waited//60} min")
            return
        if waited % 600 == 0:
            log(f"waiting for in-progress extractor (pids {pids}) ... {waited//60} min")
        time.sleep(60)
        waited += 60


def validate_and_load():
    run([PY, str(VALIDATOR)])
    return json.loads(REPORT_JSON.read_text())


def summary_line(s):
    return (f"exact={s['exact_matches']} within_2={s['within_2']} "
            f"discrepancies={s['discrepancies']} over={s['overcounts']} "
            f"under={s['undercounts']} unmatched={s['unmatched']}")


def main():
    t0 = datetime.now(timezone.utc)
    log("=== overnight accuracy run starting ===")

    # 0. let any running extractor finish
    wait_for_extractor_to_idle()

    PATCHES = json.loads((PROJECT_ROOT / "src" / "data" / "criminal_patches.json").read_text())
    V2_STAMP = "VLM:gemma3:4b/ocr_text_v2"

    # 1a. resume-mop-up: re-extract every candidate not yet at the current prompt
    #     version. These get the new (wider) page index for free.
    pre = load_candidates()
    already_v2 = {safe_name(c["name"]) for c in pre
                  if (c.get("criminal_summary") or {}).get("source") == V2_STAMP}
    run([PY, str(EXTRACTOR), "--model", MODEL, "--workers", "1", "--resume"],
        timeout=8 * 3600)
    wait_for_extractor_to_idle()

    # 1b. force re-extract candidates whose page index changed but were ALREADY at
    #     the current stamp (so --resume skipped them) — they had the OLD pages.
    cp = PROJECT_ROOT / "scraper_lab" / "changed_page_candidates.json"
    changed = json.loads(cp.read_text()) if cp.exists() else []
    redo = [sn for sn in changed if sn in already_v2 and sn not in PATCHES]
    if redo:
        log(f"1b. force re-extracting {len(redo)} changed-page candidates")
        for sn in redo:
            run([PY, str(EXTRACTOR), "--only", sn, "--model", MODEL, "--workers", "1"],
                timeout=PER_CAND_TIMEOUT_SECS)
        wait_for_extractor_to_idle()

    # 2. backup + baseline
    shutil.copy2(CANDIDATES_JSON, BACKUP)
    log(f"backed up candidates.json -> {BACKUP.name}")
    report = validate_and_load()
    baseline = report["summary"]
    log("baseline: " + summary_line(baseline))

    history = [("baseline", dict(baseline))]

    # 3. improvement loop
    for rnd in range(1, MAX_ROUNDS + 1):
        results = report["results"]
        bad = [r for r in results
               if not r["match"] and not r["patched"]
               and str(r.get("source", "")).startswith("VLM")]
        # biggest gaps first
        bad.sort(key=lambda r: -abs(r["diff"]))
        if not bad:
            log(f"round {rnd}: nothing left to improve")
            break
        log(f"round {rnd}: {len(bad)} candidates to re-extract "
            f"(worst: {bad[0]['candidate_name']} diff={bad[0]['diff']:+})")

        improved = 0
        for r in bad:
            cid     = r["candidate_id"]
            target  = r["myneta_count"]
            sname   = safe_name(r["candidate_name"])

            for attempt in range(1, RETRIES_PER_CANDIDATE + 1):
                cands = load_candidates()
                cur   = next((c for c in cands if c.get("id") == cid), None)
                if cur is None:
                    break
                prev_diff = abs(cand_count(cur) - target)
                if prev_diff == 0:
                    break
                # snapshot this one candidate's criminal fields
                snap = {k: cur.get(k) for k in
                        ("criminal_summary", "criminal_details_pending",
                         "criminal_details_convictions")}

                ok = run([PY, str(EXTRACTOR), "--only", sname, "--model", MODEL,
                          "--workers", "1"], timeout=PER_CAND_TIMEOUT_SECS)

                cands2 = load_candidates()
                cur2   = next((c for c in cands2 if c.get("id") == cid), None)
                new_diff = abs(cand_count(cur2) - target) if cur2 else prev_diff

                if (not ok) or cur2 is None or new_diff >= prev_diff:
                    # roll this candidate back
                    for c in cands2:
                        if c.get("id") == cid:
                            c.update(snap)
                            break
                    write_candidates(cands2)
                    log(f"  {r['candidate_name']}: attempt {attempt} kept old "
                        f"(was off by {prev_diff}, new off by {new_diff}) -> rolled back")
                else:
                    log(f"  {r['candidate_name']}: attempt {attempt} IMPROVED "
                        f"off-by {prev_diff} -> {new_diff}")
                    improved += 1
                    if new_diff == 0:
                        break

        report = validate_and_load()
        log(f"round {rnd} done. improved {improved} candidate-extractions. " +
            summary_line(report["summary"]))
        history.append((f"round {rnd}", dict(report["summary"])))
        if improved == 0:
            log("no candidate improved this round; stopping")
            break

    # 4. final report
    final = report["summary"]
    lines = [
        "# Overnight accuracy run",
        "",
        f"- started: {t0.isoformat()}",
        f"- finished: {datetime.now(timezone.utc).isoformat()}",
        f"- backup of pre-run candidates.json: `src/data/{BACKUP.name}`",
        "",
        "## Metric progression",
        "",
        "| stage | exact | within_2 | discrepancies | overcounts | undercounts | unmatched |",
        "|---|---|---|---|---|---|---|",
    ]
    for label, s in history:
        lines.append(f"| {label} | {s['exact_matches']} | {s['within_2']} | "
                     f"{s['discrepancies']} | {s['overcounts']} | {s['undercounts']} | "
                     f"{s['unmatched']} |")
    lines += ["", f"| **final** | **{final['exact_matches']}** | **{final['within_2']}** | "
              f"**{final['discrepancies']}** | **{final['overcounts']}** | "
              f"**{final['undercounts']}** | **{final['unmatched']}** |", ""]

    # remaining discrepancies
    rem = [r for r in report["results"] if not r["match"]]
    rem.sort(key=lambda r: -abs(r["diff"]))
    lines += ["## Remaining discrepancies (AI count vs MyNeta)", "",
              "| candidate | AI | MyNeta | diff | patched | source |",
              "|---|---|---|---|---|---|"]
    for r in rem:
        lines.append(f"| {r['candidate_name']} | {r['ai_count']} | {r['myneta_count']} | "
                     f"{r['diff']:+} | {'yes' if r['patched'] else ''} | {r.get('source','')} |")
    if report["unmatched"]:
        lines += ["", "## Unmatched (no MyNeta name/constituency match found)", "",
                  "| candidate | constituency | AI |", "|---|---|---|"]
        for u in report["unmatched"]:
            lines.append(f"| {u['candidate_name']} | {u['constituency']} | {u['ai_count']} |")

    REPORT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    log(f"wrote {REPORT_MD}")
    log("=== overnight accuracy run finished. " + summary_line(final) + " ===")


if __name__ == "__main__":
    sys.exit(main())
