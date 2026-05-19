"""Fetch Google News RSS for each AP-2024 candidate → public/data/news.json.

Source: Google News RSS search (no API key required). URL template:
    https://news.google.com/rss/search?q=<query>&hl=en-IN&gl=IN&ceid=IN:en

Telugu variant (kept intact for future use; opt-in via --include-telugu):
    https://news.google.com/rss/search?q=<query>&hl=te-IN&gl=IN&ceid=IN:te

Per candidate we run 1-2 queries (the earlier "<name> + <constituency>"
exact-phrase pairing was dropped — Google News returns 0 hits for nearly
every AP candidate with both phrases quoted):
    1. "<candidate name>"
    2. The constituency-scoped query produced by --query3-template (default
       `"{constituency}" Andhra` — see CLAUDE.md for rationale). Pass
       --query3-template "" to skip it entirely.

For each item we keep: title, url, source, published_at (ISO 8601 UTC),
snippet, lang ("en"|"te"), matched_query. Items older than 90 days are
dropped; per-candidate items are deduped across queries by canonical URL +
normalized-title hash and capped at 25 (most recent first).

Output shape (public/data/news.json):
    {
      "generated_at": "<iso UTC>",
      "by_candidate": {
        "<candidate_id>": [
          {title, url, source, published_at, snippet, lang, matched_query},
          ...
        ]
      }
    }

Backup: public/data/news.json.bak_pre_fetch_<ts> before overwriting.

Bucket rotation (used by .github/workflows/news-refresh.yml so each cron run
only touches ~1/M of the catalog and stays well under any soft rate-limit):
    --bucket N/M     only candidates where (id-1) % M == N are refreshed
    --merge-into P   load existing news.json from P first; replace ONLY this
                     run's bucket entries; preserve all other candidates'
                     entries verbatim.

Google News RSS gotchas observed:
  * <link> points to news.google.com/rss/articles/... — that page uses a JS
    meta-refresh, NOT an HTTP redirect. We resolve it to the publisher URL
    via the `googlenewsdecoder` library (which decodes Google's protobuf
    blob). On decode failure or rate-limit we keep the original Google News
    URL and bump decode_fail — clicking still lands on the publisher, just
    via Google's intermediate page. --no-decode skips this step for fast
    local debugging.
  * Source is exposed by feedparser as entry.source.title.
  * pubDate is RFC822 → feedparser parses it into entry.published_parsed
    (UTC time.struct_time). We round-trip to ISO 8601.
  * The Telugu (te-IN) feed also returns some English-script transliterations
    — we tag entries by the feed they came from, not by detected script.
  * No documented rate limit; 1.5s spacing between requests has been fine.

Run:
    .venv/bin/python scraper_lab/fetch_news.py --only 175
    .venv/bin/python scraper_lab/fetch_news.py --only 175 --log-raw
    .venv/bin/python scraper_lab/fetch_news.py --bucket 0/3 \\
        --merge-into public/data/news.json
    .venv/bin/python scraper_lab/fetch_news.py               # full 175 run

Deps (not in any requirements.txt; install once locally):
    pip install feedparser requests googlenewsdecoder
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser  # type: ignore[import-untyped]
import requests

try:
    from googlenewsdecoder import gnewsdecoder  # type: ignore[import-untyped]
except ImportError:  # pragma: no cover
    gnewsdecoder = None  # decoding becomes a no-op; counter tracks failures


HERE = Path(__file__).parent
REPO_ROOT = HERE.parent
CANDIDATES_PATH = REPO_ROOT / "src" / "data" / "candidates.json"
OUT_DIR = REPO_ROOT / "public" / "data"
OUT_PATH = OUT_DIR / "news.json"

USER_AGENT = "Mozilla/5.0 (research; leaderledger.in news-aggregator)"
RSS_TMPL = (
    "https://news.google.com/rss/search"
    "?q={q}&hl={hl}&gl={gl}&ceid={ceid}"
)
LANG_VARIANTS = {
    "en": {"hl": "en-IN", "gl": "IN", "ceid": "IN:en"},
    "te": {"hl": "te-IN", "gl": "IN", "ceid": "IN:te"},
}

MAX_AGE_DAYS = 90
PER_CANDIDATE_CAP = 25
DECODE_SLEEP_SEC = 0.3   # polite gap between decoder calls
DECODE_TIMEOUT_HINT = 5  # passed as `interval` to gnewsdecoder

# Constituency-scoped query template. {constituency} is the only placeholder.
# Default chosen via the R3 mini-experiment — see CLAUDE.md "News pipeline".
DEFAULT_QUERY3_TEMPLATE = '"{constituency}" Andhra'

# Counters used in the per-run summary.
_decode_stats = {"success": 0, "fail": 0, "skipped": 0}

# utm_* and gclid / fbclid tracking params — strip from canonical URL so two
# articles with the same path but different campaign params dedupe to one.
TRACK_PARAM_RE = re.compile(r"^(utm_|gclid$|fbclid$|mc_|ref$|src$)", re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
NONALNUM_RE = re.compile(r"[^a-z0-9]+")


# ---------- helpers ----------

def load_candidates() -> list[dict]:
    with CANDIDATES_PATH.open() as fh:
        return json.load(fh)


def load_existing(path: Path) -> dict:
    """Read an existing news.json (or return a clean bootstrap if missing)."""
    if not path.exists():
        return {"generated_at": "", "by_candidate": {}}
    try:
        data = json.loads(path.read_text())
        if not isinstance(data, dict) or "by_candidate" not in data:
            return {"generated_at": "", "by_candidate": {}}
        data.setdefault("by_candidate", {})
        return data
    except json.JSONDecodeError:
        return {"generated_at": "", "by_candidate": {}}


def strip_html(s: str) -> str:
    if not s:
        return ""
    text = TAG_RE.sub(" ", s)
    text = html.unescape(text)
    return WS_RE.sub(" ", text).strip()


def canonical_url(raw: str) -> str:
    """Lower-case host, drop tracking params, drop fragment."""
    try:
        u = urllib.parse.urlsplit(raw)
    except ValueError:
        return raw
    kept = [(k, v) for k, v in urllib.parse.parse_qsl(u.query, keep_blank_values=True)
            if not TRACK_PARAM_RE.match(k)]
    kept.sort()
    return urllib.parse.urlunsplit((
        u.scheme.lower(),
        u.netloc.lower(),
        u.path,
        urllib.parse.urlencode(kept),
        "",
    ))


def title_key(title: str) -> str:
    return NONALNUM_RE.sub("", (title or "").lower())


def dedupe_key(url: str, title: str) -> str:
    base = f"{canonical_url(url)}|{title_key(title)}"
    return hashlib.sha1(base.encode("utf-8")).hexdigest()


def to_iso_utc(struct_t) -> str | None:
    if not struct_t:
        return None
    try:
        # feedparser gives time.struct_time in UTC for RFC822 pubDate.
        # Format with explicit Z suffix (ISO 8601 UTC shorthand).
        dt = datetime(*struct_t[:6], tzinfo=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except (TypeError, ValueError):
        return None


def resolve_publisher_url(url: str, no_decode: bool) -> str:
    """Decode a news.google.com/rss/articles/... URL to its publisher target.

    Never raises. On any failure (rate-limit, transient error, lib missing,
    unchanged result) returns the input URL unchanged and bumps decode_fail
    so we can see in the run summary whether Google rotated the encoding.
    """
    if no_decode or not url.startswith("https://news.google.com/"):
        _decode_stats["skipped"] += 1
        return url
    if gnewsdecoder is None:
        _decode_stats["fail"] += 1
        return url
    try:
        r = gnewsdecoder(url, interval=DECODE_TIMEOUT_HINT)
    except Exception:
        _decode_stats["fail"] += 1
        return url
    decoded = r.get("decoded_url") if isinstance(r, dict) else None
    if not r or not r.get("status") or not decoded or decoded == url:
        _decode_stats["fail"] += 1
        return url
    _decode_stats["success"] += 1
    return decoded


def is_recent(iso_ts: str | None, cutoff: datetime) -> bool:
    if not iso_ts:
        return False
    # Python 3.10's fromisoformat() doesn't accept the "Z" UTC shorthand;
    # 3.11+ does. Normalize so this works on either.
    norm = iso_ts[:-1] + "+00:00" if iso_ts.endswith("Z") else iso_ts
    try:
        dt = datetime.fromisoformat(norm)
    except ValueError:
        return False
    return dt >= cutoff


def fetch_rss(session: requests.Session, query: str, lang: str,
              timeout: int = 30, log_raw: bool = False) -> str:
    variant = LANG_VARIANTS[lang]
    url = RSS_TMPL.format(
        q=urllib.parse.quote(query),
        hl=variant["hl"],
        gl=variant["gl"],
        ceid=variant["ceid"],
    )
    r = session.get(url, timeout=timeout)
    r.raise_for_status()
    if log_raw:
        print("\n----- RAW RSS BODY (first query) -----")
        print(r.text[:4000])
        print("----- END RAW RSS BODY -----\n")
    return r.text


def parse_items(xml_text: str, lang: str, matched_query: str,
                cutoff: datetime) -> list[dict]:
    """feedparser → list of normalized items, age-filtered."""
    feed = feedparser.parse(xml_text)
    out: list[dict] = []
    for e in feed.entries:
        title = strip_html(getattr(e, "title", "") or "")
        link = (getattr(e, "link", "") or "").strip()
        if not title or not link:
            continue
        source = ""
        src = getattr(e, "source", None)
        if src is not None:
            # feedparser exposes <source> as a FeedParserDict with .title
            source = strip_html(getattr(src, "title", "") or src.get("title", "") if isinstance(src, dict) else "") or ""
            if not source:
                # fallback for older versions
                try:
                    source = strip_html(src.title)  # type: ignore[union-attr]
                except Exception:
                    source = ""
        snippet = strip_html(getattr(e, "summary", "") or "")
        published_at = to_iso_utc(getattr(e, "published_parsed", None))
        if not is_recent(published_at, cutoff):
            continue
        out.append({
            "title": title,
            "url": link,
            "source": source,
            "published_at": published_at,
            "snippet": snippet,
            "lang": lang,
            "matched_query": matched_query,
        })
    return out


def queries_for(candidate: dict, query3_template: str) -> list[str]:
    """Two query strings (or one, if --query3-template is empty)."""
    name = (candidate.get("name") or "").strip()
    constituency = (candidate.get("constituency") or "").strip()
    queries: list[str] = []
    if name:
        queries.append(f'"{name}"')
    if query3_template and constituency:
        queries.append(query3_template.format(constituency=constituency))
    # de-duplicate while preserving order
    seen: set[str] = set()
    return [q for q in queries if not (q in seen or seen.add(q))]


def fetch_for_candidate(session: requests.Session, candidate: dict,
                        cutoff: datetime, include_telugu: bool,
                        delay: float, log_raw: bool,
                        query3_template: str, no_decode: bool) -> list[dict]:
    queries = queries_for(candidate, query3_template)
    langs = ["en"] + (["te"] if include_telugu else [])
    by_key: dict[str, dict] = {}
    raw_logged = False

    for q in queries:
        for lang in langs:
            try:
                xml = fetch_rss(session, q, lang,
                                log_raw=(log_raw and not raw_logged))
                raw_logged = raw_logged or log_raw
            except Exception as ex:
                print(f"      query={q!r} lang={lang}  ERROR: {ex}")
                continue
            items = parse_items(xml, lang, matched_query=q, cutoff=cutoff)
            # Only items not yet captured count as "+new" — cross-query dedup.
            new_items = 0
            for it in items:
                k = dedupe_key(it["url"], it["title"])
                if k in by_key:
                    continue
                by_key[k] = it
                new_items += 1
            print(f"      query={q!r} lang={lang}  +{new_items} new "
                  f"(of {len(items)} in feed)")
            time.sleep(delay)

    # Sort newest-first, cap.
    ordered = sorted(
        by_key.values(),
        key=lambda it: it["published_at"] or "",
        reverse=True,
    )
    capped = ordered[:PER_CANDIDATE_CAP]

    # Resolve publisher URLs only for the items we're actually keeping.
    for it in capped:
        decoded = resolve_publisher_url(it["url"], no_decode=no_decode)
        if decoded != it["url"]:
            it["url"] = decoded
        if not no_decode:
            time.sleep(DECODE_SLEEP_SEC)
    return capped


def select_targets(candidates: list[dict], only: str, bucket: str) -> list[dict]:
    if only:
        ids = {int(x) for x in only.split(",") if x.strip()}
        out = [c for c in candidates if c.get("id") in ids]
    else:
        out = list(candidates)
    if bucket:
        try:
            n_str, m_str = bucket.split("/")
            n, m = int(n_str), int(m_str)
        except ValueError:
            raise SystemExit(f"--bucket must look like N/M (got {bucket!r})")
        if not (0 <= n < m and m > 0):
            raise SystemExit(f"--bucket N must satisfy 0 <= N < M (got {bucket!r})")
        out = [c for c in out if ((int(c["id"]) - 1) % m) == n]
    return out


def backup_existing(path: Path) -> Path | None:
    if not path.exists():
        return None
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    bak = path.with_name(path.name + f".bak_pre_fetch_{ts}")
    bak.write_bytes(path.read_bytes())
    return bak


def prune_old_backups(directory: Path, keep: int = 2) -> int:
    """Keep only the `keep` most recent news.json.bak_pre_fetch_* files."""
    backups = sorted(
        directory.glob("news.json.bak_pre_fetch_*"),
        key=lambda p: p.stat().st_mtime,
    )
    removed = 0
    for old in backups[:-keep]:
        try:
            old.unlink()
            removed += 1
        except OSError:
            pass
    return removed


def fmt_duration(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    return f"{m}m {s:02d}s"


def write_output(out: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")


# ---------- main ----------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--only", default="",
                    help="Comma-separated candidate IDs to fetch (skip others).")
    ap.add_argument("--bucket", default="",
                    help="N/M — only fetch candidates where (id-1)%%M == N.")
    ap.add_argument("--merge-into", default="",
                    help="Path to existing news.json to merge new bucket "
                         "entries into; other candidates kept verbatim.")
    ap.add_argument("--resume", action="store_true",
                    help="Skip candidates already present in existing output.")
    ap.add_argument("--delay", type=float, default=1.5,
                    help="Seconds between requests (default 1.5).")
    ap.add_argument("--include-telugu", action="store_true",
                    help="Also fetch the te-IN feed for each query.")
    ap.add_argument("--log-raw", action="store_true",
                    help="Print the first query's raw RSS body to stdout "
                         "(sanity check; truncated to 4 KB).")
    ap.add_argument("--query3-template", default=DEFAULT_QUERY3_TEMPLATE,
                    help="Constituency-scoped query template with a "
                         "{constituency} placeholder. Empty string disables "
                         "the second query entirely. "
                         f"Default: {DEFAULT_QUERY3_TEMPLATE!r}")
    ap.add_argument("--no-decode", action="store_true",
                    help="Skip the publisher-URL decode step (faster; for "
                         "local debugging). URLs stay as news.google.com/...")
    args = ap.parse_args()

    candidates = load_candidates()
    targets = select_targets(candidates, args.only, args.bucket)
    if not targets:
        print("nothing to do (no candidates match --only/--bucket)")
        return 0

    # Load merge-target if given; otherwise existing OUT_PATH if present.
    merge_src = Path(args.merge_into) if args.merge_into else OUT_PATH
    existing = load_existing(merge_src)
    by_candidate: dict[str, list[dict]] = dict(existing.get("by_candidate", {}))

    if args.resume:
        before = len(targets)
        targets = [c for c in targets if str(c["id"]) not in by_candidate]
        print(f"resume: skipping {before - len(targets)} already-fetched candidates")
        if not targets:
            print("nothing to do")
            return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    print(f"fetching {len(targets)} candidate(s); "
          f"cutoff={cutoff.isoformat()}; bucket={args.bucket or 'all'}; "
          f"telugu={'on' if args.include_telugu else 'off'}; "
          f"query3={args.query3_template!r}; "
          f"decode={'off' if args.no_decode else 'on'}")

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    started = time.time()
    failures: list[tuple[int, str]] = []
    bailed = False

    for i, cand in enumerate(targets, 1):
        cid = cand["id"]
        name = cand.get("name", "?")
        constituency = cand.get("constituency", "?")
        print(f"  [{i}/{len(targets)}] id={cid:<3} {name} ({constituency})")
        try:
            items = fetch_for_candidate(
                session, cand, cutoff,
                include_telugu=args.include_telugu,
                delay=args.delay,
                log_raw=args.log_raw,
                query3_template=args.query3_template,
                no_decode=args.no_decode,
            )
        except Exception as ex:
            print(f"      ERROR fetching candidate {cid}: {ex}")
            failures.append((cid, str(ex)))
            continue

        by_candidate[str(cid)] = items
        elapsed = time.time() - started
        print(f"      kept {len(items)} items  (elapsed {elapsed:.0f}s)")

        # Every-10 progress heartbeat so a long run doesn't look hung.
        if i % 10 == 0:
            avg = elapsed / i
            total_items = sum(len(v) for v in by_candidate.values())
            print(
                f"[{i}/{len(targets)}] processed in {fmt_duration(elapsed)} — "
                f"avg {avg:.1f}s/candidate — "
                f"decode {_decode_stats['success']}✓ {_decode_stats['fail']}✗ — "
                f"running total items {total_items}",
                flush=True,
            )

        # Decode-failure bail-out: after the first 20 candidates, if more than
        # 40% of decode attempts are failing Google probably changed the
        # encoding or rate-limited the decoder. No point grinding through 155
        # more candidates producing news.google.com URLs.
        if i == 20 and not args.no_decode:
            attempted = _decode_stats["success"] + _decode_stats["fail"]
            if attempted > 0:
                fail_ratio = _decode_stats["fail"] / attempted
                if fail_ratio > 0.4:
                    print(
                        f"\nBAIL: decode_fail {_decode_stats['fail']}/{attempted} "
                        f"= {fail_ratio:.1%} > 40% after 20 candidates. "
                        f"Aborting; check whether Google rotated the URL "
                        f"encoding or rate-limited gnewsdecoder."
                    )
                    bailed = True
                    break

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "by_candidate": by_candidate,
    }

    bak = backup_existing(OUT_PATH)
    if bak:
        print(f"backup → {bak.relative_to(REPO_ROOT)}")
    pruned = prune_old_backups(OUT_PATH.parent, keep=2)
    if pruned:
        print(f"pruned {pruned} old backup(s) (kept newest 2)")
    write_output(out, OUT_PATH)
    n_total_items = sum(len(v) for v in by_candidate.values())
    total_elapsed = time.time() - started
    print(f"\nwrote {OUT_PATH.relative_to(REPO_ROOT)}  "
          f"({len(by_candidate)} candidates, {n_total_items} items)  "
          f"in {fmt_duration(total_elapsed)}")
    print(f"decode: success={_decode_stats['success']} "
          f"fail={_decode_stats['fail']} "
          f"skipped={_decode_stats['skipped']}")

    if failures:
        print(f"failures: {len(failures)}")
        for cid, msg in failures:
            print(f"  id={cid}: {msg}")
    if bailed:
        return 3
    if failures:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
