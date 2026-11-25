// The resize report (backend designResizeService.fitOf) in plain Arabic — no
// technical words. Same wording as the backend's fitLinesAr (the assistant's card).

const ROLE_AR = { product_name: "اسم المنتج", heading: "عنوان", paragraph: "فقرة", table: "جدول التركيب", rotated_text: "نص عمودي", barcode_digits: "أرقام الباركود", logo_or_image: "شعار / صورة", artwork: "رسم" };
export const roleAr = (r) => ROLE_AR[r] || "جزء";
export const cm = (mm) => String(Math.round(mm) / 10).replace(/\.0$/, "");
export const sizeAr = (w, h) => `${cm(w)} × ${cm(h)} سم`;

/** → [{ kind: "ok" | "info" | "warn" | "bad", text }] */
export function fitLinesAr(fit = {}) {
  const out = [];
  if (fit.fits === false) out.push({ kind: "bad", text: "لا يتّسع بهذا المقاس — لن يُعمل ملف PDF، ولم يُقصّ أي نص." });
  else out.push({ kind: "ok", text: fit.engineMode === "scale" ? `نفس التصميم بنفس النسب (${fit.scalePct}%)` : "نفس التصميم، أُعيد ترتيبه على المقاس الجديد" });
  if (fit.boxNet) out.push({ kind: "warn", text: "هذا تصميم علبة (وجوه وألسنة وخطوط قص وطي): يتغيّر مقاسه بنفس النسب فقط، لأن تغيير النسب يعني علبة أخرى." });
  if (fit.smallestTextPt != null) out.push({ kind: "info", text: `أصغر نص: ${fit.smallestTextPt} نقطة (الحد الأدنى ${fit.minFontPt} نقطة)` });
  for (const w of fit.warnings || []) {
    if (w.code === "below_min") out.push({ kind: "warn", text: `بعض النص صار ${w.fontPt} نقطة — أقل من الحد الأدنى ${w.minFontPt}. مقاس أكبر يبقيه مقروءًا.` });
    else if (w.code === "original_below_min") out.push({ kind: "info", text: `في التصميم الأصلي نص بحجم ${w.fontPt} نقطة (أقل من ${w.minFontPt}) — تُرك بنفس نسبة التصميم.` });
    else if (w.code === "font_raised_to_min") out.push({ kind: "info", text: `حجم الخط المختار أقل من المسموح، فرُفع إلى ${w.minFontPt} نقطة.` });
  }
  for (const o of (fit.overflow || []).filter((x) => x.code !== "box_net")) {
    const what = `${roleAr(o.role)}${o.text ? ` «${o.text.slice(0, 40)}»` : ""}`;
    if (o.code === "text_too_small") out.push({ kind: "bad", text: `${what}: نصه يصغر عن الحد الأدنى بهذا المقاس.` });
    else if (o.over === "panel") out.push({ kind: "bad", text: `${what} يخرج عن خلفيته بـ ${o.overflowMm} مم.` });
    else if (o.over === "artwork") out.push({ kind: "bad", text: `${what} يغطي رسمًا بـ ${o.overflowMm} مم.` });
    else out.push({ kind: "bad", text: `${what} ينقصه ${o.overflowMm} مم ${o.axis === "x" ? "في العرض" : "في الطول"}.` });
  }
  const rewrapped = (fit.blocks || []).filter((b) => b.rewrapped).length;
  const raised = (fit.blocks || []).filter((b) => b.raisedToMin).length;
  if (rewrapped) out.push({ kind: "info", text: `أُعيد توزيع أسطر ${rewrapped} ${rewrapped === 1 ? "فقرة" : "فقرات"} بنفس كلماتها.` });
  if (raised) out.push({ kind: "info", text: `كُبّر خط ${raised} ${raised === 1 ? "جزء" : "أجزاء"} إلى الحد الأدنى.` });
  if (fit.bleedMm) out.push({ kind: "info", text: `هامش قص ${fit.bleedMm} مم${fit.cropMarks ? " مع علامات القص" : ""}.` });
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
