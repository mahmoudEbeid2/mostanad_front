// A certificate file's type from its name ("ADDVET OMAN COA 10-26.pdf" → COA). COC is the Certificate of
// Composition and COO the Certificate of Origin — two different types.

export const KNOWN = [
  ["COA", "Certificate of Analysis", "شهادة تحليل"],
  ["COC", "Certificate of Composition", "شهادة تركيب"],
  ["HC", "Health Certificate", "شهادة صحية"],
  ["FSC", "Free Sale Certificate", "شهادة بيع حر"],
  ["COO", "Certificate of Origin", "شهادة منشأ"],
];
/** "ADDVET OMAN COA 10-26.pdf" → "COA"; a name that says two types or none → null */
export function codeFromFileName(name) {
  const words = String(name || "").toUpperCase().replace(/\.[A-Z0-9]+$/, "").split(/[^A-Z]+/);
  const hits = KNOWN.map(([c]) => c).filter((c) => words.includes(c));
  if (/FREE\s*SALE/i.test(name)) hits.push("FSC");
  if (/HEALTH/i.test(name)) hits.push("HC");
  if (/ANALYSIS/i.test(name)) hits.push("COA");
  if (/COMPOSITION/i.test(name)) hits.push("COC");
  if (/ORIGIN/i.test(name)) hits.push("COO");
  const u = [...new Set(hits)];
  return u.length === 1 ? u[0] : null;
}
