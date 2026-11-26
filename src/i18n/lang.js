// The interface language (26 Nov: certificate screens in Arabic, with an English switch).
// Arabic by default; the choice is kept per browser and applied on reload, so every screen's
// string table is picked once, at load: const STR = pick({ en: {…}, ar: {…} }).
// A key with no Arabic yet falls back to its English text — never a blank or a raw key.

const read = () => {
  try {
    return localStorage.getItem("lang") === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
};
export const LANG = read();
export const isAr = LANG === "ar";

const merge = (base, over) => {
  if (!over || typeof over !== "object" || Array.isArray(over) || typeof base !== "object" || base === null) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === "object" && !Array.isArray(v) && typeof base[k] === "object" ? merge(base[k], v) : v;
  return out;
};
/** { en, ar } → the table of the current language (Arabic over English) */
export const pick = ({ en, ar }) => (LANG === "en" ? en : merge(en, ar));
/** one string: tr("نوع الشهادة", "Certificate type") */
export const tr = (ar, en) => (LANG === "en" ? en : ar);

export function setLang(lang) {
  try {
    localStorage.setItem("lang", lang === "en" ? "en" : "ar");
  } catch {
    /* private window: stays Arabic */
  }
  window.location.reload();
}
