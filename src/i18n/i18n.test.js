import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map();
const memoryStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });

const load = async (lang) => {
  vi.resetModules();
  if (lang) localStorage.setItem("lang", lang);
  else localStorage.removeItem("lang");
  return import("./index.js");
};

describe("i18n core", () => {
  beforeEach(() => store.clear());

  it("defaults to English, left to right", async () => {
    const i = await load();
    expect(i.LANG).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("Arabic sets lang and dir on <html>", async () => {
    const i = await load("ar");
    expect(i.LANG).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("plural forms and params", async () => {
    const en = await load("en");
    expect(en.t("certificateCard.issues", { count: 1 })).toBe("1 issue");
    expect(en.t("certificateCard.issues", { count: 3 })).toBe("3 issues");
    const ar = await load("ar");
    expect(ar.t("certificateCard.issues", { count: 3 })).toBe("3 مشكلة");
  });

  it("a key with no Arabic falls back to English, never a raw key", async () => {
    const ar = await load("ar");
    const en = (await import("./locales/en.json")).default;
    const arJson = (await import("./locales/ar.json")).default;
    // a key only English has (technical tokens have no Arabic entry)
    const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
    const arKeys = new Set(flat(arJson).map(([k]) => k));
    const [key, value] = flat(en).find(([k, v]) => !arKeys.has(k) && !/_(one|other|zero|two|few|many)$/.test(k) && !/\{/.test(v)) || [];
    if (key) expect(ar.t(key)).toBe(value);
    expect(ar.t("no.such.key")).toBe("no.such.key");
  });

  it("Western digits and DD/MM/YYYY in both languages", async () => {
    for (const lang of ["en", "ar"]) {
      const i = await load(lang);
      expect(i.fmtDate("2026-11-27T10:05:00")).toBe("27/11/2026");
      expect(i.fmtNum(1234567)).toMatch(/^1.234.567$/);
      expect(i.fmtNum(1234567)).not.toMatch(/[٠-٩]/);
    }
  });

  it("backend text in both languages is picked by the UI language", async () => {
    const en = await load("en");
    expect(en.pickText({ ar: "مرحبا", en: "Hello" })).toBe("Hello");
    expect(en.pickField({ title: "Title", titleAr: "عنوان" }, "title")).toBe("Title");
    const ar = await load("ar");
    expect(ar.pickText({ ar: "مرحبا", en: "Hello" })).toBe("مرحبا");
    expect(ar.pickText({ en: "Only English" })).toBe("Only English");
    expect(ar.pickField({ title: "Title", titleAr: "عنوان" }, "title")).toBe("عنوان");
  });
});
