// "Which company are these files for?" in All companies: the company the files name — the word the
// file names (or the message) share, like ADDVET in "ADDVET OMAN COA 10-26.pdf" and "ADDVET HC OMAN
// 10-26.pdf". Certificate codes, countries and file words are never a company. → name | null

const NOT_A_COMPANY = new Set(
  "COA COC HC FSC COO GMP ISO MSDS TDS PDF AI PNG JPG JPEG XLSX CSV DOC LABEL LABELS CERTIFICATE CERTIFICATES INVOICE OMAN KSA SA UAE EGYPT JORDAN TURKEY IRAQ KUWAIT QATAR BAHRAIN SAUDI LA ML MG KG GM IU NEW FINAL COPY SCAN DRAFT".split(" ")
);
export const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "");

export function guessCompanyName(fileNames = [], message = "") {
  const words = (s) => String(s || "").replace(/\.[a-z0-9]+$/i, "").split(/[^A-Za-z0-9-]+/).filter((w) => /^[A-Za-z][A-Za-z0-9-]{2,}$/.test(w) && !NOT_A_COMPANY.has(w.toUpperCase()) && !/\d{2,}/.test(w));
  const count = new Map();
  for (const n of fileNames.filter(Boolean)) for (const w of new Set(words(n).map((x) => x.toUpperCase()))) count.set(w, (count.get(w) || 0) + 1);
  const inMessage = new Set(words(message).filter((w) => w === w.toUpperCase()).map((w) => w.toUpperCase()));
  const ranked = [...count.entries()].map(([w, n]) => [w, n + (inMessage.has(w) ? 2 : 0)]).sort((a, b) => b[1] - a[1]);
  if (ranked[0] && ranked[0][1] >= 2) return ranked[0][0];
  const upper = [...inMessage][0];
  return upper || null;
}
