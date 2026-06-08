// Source-domain whitelist for community-submitted achievements.
// -------------------------------------------------------------
// A submission is only accepted when its citation points at one of these
// hosts: official government portals, statutory bodies, or established news
// outlets. The check is host-suffix based, so `articles.thehindu.com` matches
// `thehindu.com`. Keep this in sync with the user-facing copy in
// SubmitAchievementModal.jsx ("Please use a news article or official
// government website").
//
// NOTE — a few entries below are kept verbatim from the original spec but will
// never match a real article hostname; flagged here so they can be corrected:
//   • "hans india.com"     — contains a space; real host is `hansindia.com`.
//   • "wire.in"            — The Wire publishes on `thewire.in`.
//   • "timesofindia.com"   — TOI articles live on `timesofindia.indiatimes.com`.
// They are harmless (they just won't ever match) but worth fixing before this
// list is treated as authoritative.
export const ALLOWED_DOMAINS = [
  'ap.gov.in', 'cag.gov.in', 'eci.gov.in',
  'thehindu.com', 'deccanchronicle.com', 'ndtv.com',
  'timesofindia.com', 'indianexpress.com', 'theprint.in',
  'scroll.in', 'wire.in', 'sakshi.com', 'eenadu.net',
  'andhrajyothy.com', 'hans india.com', 'newindianexpress.com',
];

// Pull the bare hostname out of a URL, lower-cased and without a leading
// `www.`. Returns '' if the string isn't a parseable absolute URL.
export function extractDomain(url) {
  if (!url || typeof url !== 'string') return '';
  let value = url.trim();
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// True when the URL's host is, or is a subdomain of, a whitelisted domain.
export function isAllowedSource(url) {
  const host = extractDomain(url);
  if (!host) return false;
  return ALLOWED_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}
