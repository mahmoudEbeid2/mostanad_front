// The interface language (UI plan, Phase A). English is the default and the source; Arabic is a switch.
// Every UI string lives in ./locales/en.json and ./locales/ar.json, keyed by feature. A key with no
// Arabic yet falls back to its English text — never a blank or a raw key.
//
// The choice is kept per browser and applied on reload, so a screen may read its strings once, at load:
//   const STR = strings("certificateRequests");   STR.title, STR.page(2, 5)
//   t("common.save"), t("requests.more", { n: 3 }), t("requests.items", { count: 4 }) (→ items_one / items_other)
// Data (product names, packs, ingredients, units, values) is never translated.
import en from "./locales/en.json";
import ar from "./locales/ar.json";

const read = () => {
  try {
    return localStorage.getItem("lang") === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
};
export const LANG = read();
export const isAr = LANG === "ar";
export const DIR = isAr ? "rtl" : "ltr";

// <html lang dir> follow the language, so the whole layout mirrors (logical CSS: ms/me/ps/pe, start/end)
if (typeof document !== "undefined") {
  document.documentElement.lang = LANG;
  document.documentElement.dir = DIR;
}

export function setLang(lang) {
  try {
    localStorage.setItem("lang", lang === "ar" ? "ar" : "en");
  } catch {
    /* private window: stays English */
  }
  window.location.reload();
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const merge = (base, over) => {
  if (!isObj(base) || !isObj(over)) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : (v ?? base[k]);
  return out;
};
// the current language's table: Arabic over English
const TABLE = isAr ? merge(en, ar) : en;

const lookup = (table, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), table);

/** "{n} of {total}" + { n: 2, total: 5 } → "2 of 5" (numbers in Western digits) */
const fill = (s, params) =>
  params ? s.replace(/\{(\w+)\}/g, (m, name) => (params[name] === undefined || params[name] === null ? "—" : typeof params[name] === "number" ? fmtNum(params[name]) : String(params[name]))) : s;

const plurals = new Intl.PluralRules(LANG);

/**
 * One string by key. `params.count` picks a plural form when the key has them (key_zero, key_one, key_two,
 * key_few, key_many, key_other — Arabic uses all six, English one/other).
 */
export function t(key, params) {
  let s;
  if (params && typeof params.count === "number") {
    const form = params.count === 0 ? "zero" : plurals.select(params.count);
    s = lookup(TABLE, `${key}_${form}`) ?? lookup(TABLE, `${key}_other`);
  }
  s ??= lookup(TABLE, key);
  if (typeof s !== "string") {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return fill(s, params);
}

/** does the key exist (in English, the source)? */
export const has = (key) => typeof lookup(en, key) === "string" || isObj(lookup(en, key));

// A converted string table entry that took arguments: "{0} of {1}" or "{n} of {total}" (the English string's
// placeholder order is the argument order). It is called like the function it replaced: STR.page(2, 5).
const callable = (enStr, s) => {
  const names = [...new Set([...(enStr ?? s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
  return (...args) => {
    if (args.length === 1 && isObj(args[0]) && !names.every((n) => /^\d+$/.test(n))) return fill(s, args[0]);
    const params = {};
    names.forEach((n, i) => {
      params[n] = /^\d+$/.test(n) ? args[Number(n)] : args[i];
    });
    return fill(s, params);
  };
};
const build = (node, enNode) => {
  if (typeof node === "string") return /\{\w+\}/.test(node) ? callable(typeof enNode === "string" ? enNode : node, node) : node;
  if (!isObj(node)) return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = build(v, isObj(enNode) ? enNode[k] : undefined);
  return out;
};

/** A screen's whole table: strings("requests") → { title: "Requests", page: (p, n) => "Page 2 of 5", … } */
export function strings(ns) {
  const node = lookup(TABLE, ns);
  if (!isObj(node)) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing namespace: ${ns}`);
    return {};
  }
  return build(node, lookup(en, ns));
}

// ── Numbers and dates: Western digits (0–9) in both languages; dates DD/MM/YYYY (UI plan, Phase A §6) ──
const LOCALE = `${isAr ? "ar-EG" : "en-GB"}-u-nu-latn`;
const pad = (n) => String(n).padStart(2, "0");
const toDate = (d) => (d instanceof Date ? d : new Date(d));
const valid = (d) => d && !Number.isNaN(d.getTime());

/** 1234.5 → "1,234.5" (Western digits) */
export function fmtNum(n, opts) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "";
  return new Intl.NumberFormat(LOCALE, opts).format(Number(n));
}
/** → "27/11/2026" */
export function fmtDate(d) {
  const x = d ? toDate(d) : null;
  if (!valid(x)) return "";
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
}
/** → "27/11/2026 14:05" */
export function fmtDateTime(d) {
  const x = d ? toDate(d) : null;
  if (!valid(x)) return "";
  return `${fmtDate(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
/** → "14:05" */
export function fmtTime(d) {
  const x = d ? toDate(d) : null;
  if (!valid(x)) return "";
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
/** "November 2026" / "نوفمبر 2026" — month names follow the language, digits stay Western */
export function fmtMonth(d) {
  const x = d ? toDate(d) : null;
  if (!valid(x)) return "";
  return new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" }).format(x);
}
/** "3 minutes ago" — relative, in the UI language with Western digits */
export function fmtRelative(d) {
  const x = d ? toDate(d) : null;
  if (!valid(x)) return "";
  const diff = (x.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const steps = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let v = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(v) < size) return rtf.format(Math.round(v), unit);
    v /= size;
  }
  return fmtDate(x);
}

/**
 * Text the backend sends in both languages: { ar, en }, or a row with `fooAr` beside `foo` / `fooEn`.
 * Picks the UI language, falling back to whichever exists. Data with one version is shown as is.
 */
export function pickText(value, fallback) {
  if (value == null) return fallback ?? "";
  if (typeof value === "string") return value;
  if (isObj(value)) return (isAr ? (value.ar ?? value.en) : (value.en ?? value.ar)) ?? fallback ?? "";
  return String(value);
}
/** row.title / row.titleAr → the one in the UI language */
export function pickField(row, field) {
  if (!row) return "";
  const arV = row[`${field}Ar`] ?? row[`${field}_ar`];
  const enV = row[`${field}En`] ?? row[`${field}_en`] ?? row[field];
  return (isAr ? (arV ?? enV) : (enV ?? arV)) ?? "";
}

// ── Country and language names in the UI language (Intl), codes unchanged ──
let regionNames, languageNames;
try {
  regionNames = new Intl.DisplayNames([LANG], { type: "region" });
  languageNames = new Intl.DisplayNames([LANG], { type: "language" });
} catch {
  /* very old browser: the English names from the lists below stay */
}
/** "EG" → "Egypt" / "مصر" */
export const countryName = (code, fallback) => {
  if (!code) return fallback ?? "";
  try {
    return regionNames?.of(String(code).toUpperCase()) || fallback || code;
  } catch {
    return fallback || code;
  }
};
/** "ar" → "Arabic" / "العربية" */
export const languageName = (code, fallback) => {
  if (!code) return fallback ?? "";
  try {
    return languageNames?.of(code) || fallback || code;
  } catch {
    return fallback || code;
  }
};
/** [{ value: "EG", label }] from a list of { value, label } (react-select-country-list), names in the UI language */
export const localizeCountries = (list) =>
  list.map((c) => ({ ...c, label: countryName(c.value, c.label) })).sort((a, b) => a.label.localeCompare(b.label, LANG));
