// Stable, collision-resistant id for a news article, derived from its URL.
// news.json carries no id field, and the article URL (a ~600-char Google News
// RSS link, slashes and all) can't be a Firestore doc id directly. cyrb53 is a
// fast non-cryptographic 53-bit hash — for the ~1.5k articles in rotation
// (tens of thousands over a 90-day window) collision odds are vanishingly
// small, and it needs no async crypto API.

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// `nr_` prefix keeps the id legible in the Firestore console and satisfies the
// rules path pattern [A-Za-z0-9_-]+.
export function newsReactionId(url) {
  if (!url) return null;
  return `nr_${cyrb53(String(url)).toString(16)}`;
}
