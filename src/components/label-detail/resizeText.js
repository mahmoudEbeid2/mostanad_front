import { t } from "../../i18n";
// The resize report (backend designResizeService.fitOf) in plain Arabic — no
// technical words. Same wording as the backend's fitLinesAr (the assistant's card).

const ROLE_AR = { product_name: t("resizeText.productName"), heading: t("resizeText.title"), paragraph: t("resizeText.paragraph"), table: t("resizeText.compositionTable"), rotated_text: t("resizeText.verticalText"), barcode_digits: t("resizeText.barcodeDigits"), logo_or_image: t("resizeText.logoImage"), artwork: t("resizeText.graphic") };
export const roleAr = (r) => ROLE_AR[r] || t("resizeText.part");
export const cm = (mm) => String(Math.round(mm) / 10).replace(/\.0$/, "");
export const sizeAr = (w, h) => t("resizeText.cm", { cm: cm(w), cm2: cm(h) });

/** → [{ kind: "ok" | "info" | "warn" | "bad", text }] */
export function fitLinesAr(fit = {}) {
  const out = [];
  if (fit.fits === false) out.push({ kind: "bad", text: t("resizeText.doesntFitAtThisSize") });
  else out.push({ kind: "ok", text: fit.engineMode === "scale" ? t("resizeText.theSameDesignInThe", { scalePct: fit.scalePct }) : t("resizeText.theSameDesignReArranged") });
  if (fit.boxNet) out.push({ kind: "warn", text: t("resizeText.thisIsABoxDesign") });
  if (fit.smallestTextPt != null) out.push({ kind: "info", text: t("resizeText.smallestTextPtMinimumPt", { smallestTextPt: fit.smallestTextPt, minFontPt: fit.minFontPt }) });
  for (const w of fit.warnings || []) {
    if (w.code === "below_min") out.push({ kind: "warn", text: t("resizeText.someTextBecamePtBelow", { fontPt: w.fontPt, minFontPt: w.minFontPt }) });
    else if (w.code === "original_below_min") out.push({ kind: "info", text: t("resizeText.theOriginalDesignHasText", { fontPt: w.fontPt, minFontPt: w.minFontPt }) });
    else if (w.code === "font_raised_to_min") out.push({ kind: "info", text: t("resizeText.theChosenFontSizeIs", { minFontPt: w.minFontPt }) });
  }
  for (const o of (fit.overflow || []).filter((x) => x.code !== "box_net")) {
    const what = `${roleAr(o.role)}${o.text ? ` «${o.text.slice(0, 40)}»` : ""}`;
    if (o.code === "text_too_small") out.push({ kind: "bad", text: t("resizeText.itsTextGetsSmallerThan", { what }) });
    else if (o.over === "panel") out.push({ kind: "bad", text: t("resizeText.goesMmOutsideItsBackground", { what, overflowMm: o.overflowMm }) });
    else if (o.over === "artwork") out.push({ kind: "bad", text: t("resizeText.coversAGraphicByMm", { what, overflowMm: o.overflowMm }) });
    else out.push({ kind: "bad", text: t(o.axis === "x" ? "resizeText.shortWidth" : "resizeText.shortHeight", { what, mm: o.overflowMm }) });
  }
  const rewrapped = (fit.blocks || []).filter((b) => b.rewrapped).length;
  const raised = (fit.blocks || []).filter((b) => b.raisedToMin).length;
  if (rewrapped) out.push({ kind: "info", text: t("resizeText.rewrapped", { count: rewrapped }) });
  if (raised) out.push({ kind: "info", text: t("resizeText.raised", { count: raised }) });
  if (fit.bleedMm) out.push({ kind: "info", text: `${t("resizeText.bleed", { mm: fit.bleedMm })}${fit.cropMarks ? t("resizeText.withCropMarks") : ""}.` });
  return out;
}

/** The size suggestions of a report: [{ widthMm, heightMm, sameRatio }] and whether two columns were suggested. */
export const suggestionsOf = (fit = {}) => ({ sizes: (fit.suggestions || []).filter((s) => s.widthMm && s.heightMm), columns: (fit.suggestions || []).some((s) => s.columns) });

/** The text-layout form, set to a saved size (so the header and the chosen size always agree). */
export function formFrom(saved, presets = []) {
  const base = { preset: "100x120", widthMm: 100, heightMm: 120, margin: 4, minFontPt: 6, maxColumns: 2 };
  if (!saved) return base;
  const p = presets.find((x) => Math.abs(x.widthMm - saved.widthMm) < 0.05 && Math.abs(x.heightMm - saved.heightMm) < 0.05);
  const s = saved.settings || {};
  return {
    preset: p ? p.key : "custom",
    widthMm: saved.widthMm,
    heightMm: saved.heightMm,
    margin: s.marginsMm?.top ?? base.margin,
    minFontPt: s.minFontPt ?? base.minFontPt,
    maxColumns: s.maxColumns ?? base.maxColumns,
  };
}
