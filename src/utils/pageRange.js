// "4–15, 17–20" ⇄ [4, 5, …, 15, 17, …, 20] for the catalogue "choose pages" step.
// Accepts "-" and "–" (and "—"), commas, spaces or semicolons between parts.

/** text → { pages, invalid } — pages sorted, without repeats, within 1..max; invalid = the parts that weren't */
export function parseRange(text, max) {
  const pages = new Set();
  const invalid = [];
  for (const part of String(text || "").replace(/\s*[-–—]\s*/g, "-").split(/[,;\s]+/)) {
    if (!part) continue;
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) {
      invalid.push(part.trim());
      continue;
    }
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    if (lo < 1 || hi > max) {
      invalid.push(part.trim());
      continue;
    }
    for (let n = lo; n <= hi; n++) pages.add(n);
  }
  return { pages: [...pages].sort((x, y) => x - y), invalid };
}

/** [4, 5, 6, 9] → "4–6, 9" */
export function formatRange(pages) {
  const list = [...new Set(pages)].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    out.push(j > i ? `${list[i]}–${list[j]}` : `${list[i]}`);
    i = j;
  }
  return out.join(", ");
}
