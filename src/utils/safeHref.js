// Returns the input URL only if its scheme is http(s) or mailto.
// Used to guard external <a href={...}> values against javascript:/data: URLs
// that would otherwise execute on click — React 18 does not auto-block these.
// When the URL is unsafe or falsy, returns undefined so React omits the href
// attribute entirely and the anchor becomes inert.

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export const safeHref = (raw) => {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed, window.location.origin);
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmed : undefined;
  } catch {
    return undefined;
  }
};

export default safeHref;
