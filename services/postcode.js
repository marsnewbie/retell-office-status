// 规范化 UK Postcode：去空格转大写，再在最后3位前加空格（WF94PY → WF9 4PY）
function normalizeUKPostcode(raw) {
  if (!raw) return "";
  const s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length > 3) return s.slice(0, s.length - 3) + " " + s.slice(s.length - 3);
  return s;
}

// 在一组 pattern（WF9 / WF9 4 / WF9 4P）里选"最长命中"的那个
function pickBestPatternMatch(patterns, candidate) {
  const cand = String(candidate).toUpperCase().replace(/\s+/g, "");
  let best = null, bestLen = -1;
  for (const p of patterns) {
    const pat = String(p).toUpperCase().replace(/\s+/g, "");
    if (cand.startsWith(pat) && pat.length > bestLen) {
      best = p;
      bestLen = pat.length;
    }
  }
  return best;
}

module.exports = { normalizeUKPostcode, pickBestPatternMatch };
