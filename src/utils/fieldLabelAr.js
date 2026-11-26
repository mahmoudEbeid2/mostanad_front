// A certificate field's label in the interface language (27 Nov QA: "Ingredient 13", "pH result" on an
// Arabic screen). The same known labels the server translates for the chat (batchAnswer.fieldLabelAr);
// anything else keeps its own label — a company's own wording is never guessed at.
import { isAr } from "../i18n/lang";

const LABEL_AR = [
  [/^Ingredient (\d+) amount$/i, (m) => `كمية المكوّن ${m[1]}`],
  [/^Ingredient (\d+) unit$/i, (m) => `وحدة المكوّن ${m[1]}`],
  [/^Ingredient (\d+)$/i, (m) => `المكوّن ${m[1]}`],
  [/^Composition basis$/i, () => "أساس التركيبة"],
  [/^Batch (?:number|no\.?)$/i, () => "رقم التشغيلة"],
  [/^Batch size$/i, () => "حجم التشغيلة"],
  [/^(?:Manufacturing|Production) date$/i, () => "تاريخ الإنتاج"],
  [/^Expiry date$/i, () => "تاريخ الانتهاء"],
  [/^Document number$/i, () => "رقم الشهادة"],
  [/^Issue date$/i, () => "تاريخ الإصدار"],
  [/^Product name$/i, () => "اسم المنتج"],
  [/^Product form$/i, () => "شكل المنتج (زي الشهادة)"],
  [/^Form$/i, () => "الشكل"],
  [/^Category$/i, () => "الفئة"],
  [/^Packing(?: size)?$/i, () => "العبوة"],
  [/^Validity$/i, () => "الصلاحية"],
  [/^Consignee name$/i, () => "اسم المستلم"],
  [/^Consignee address(?: \(line \d+\))?$/i, () => "عنوان المستلم"],
  [/^Consignee country$/i, () => "دولة المستلم"],
  [/^Consignee phone$/i, () => "تليفون المستلم"],
  [/^Exporter name$/i, () => "اسم المصدّر"],
  [/^Exporter address(?: \(line \d+\))?$/i, () => "عنوان المصدّر"],
  [/^Exporter (?:phone)$/i, () => "تليفون المصدّر"],
  [/^Exporter (?:email)$/i, () => "إيميل المصدّر"],
  [/^(.+) result$/i, (m) => `نتيجة ${m[1]}`],
  [/^(.+) specification$/i, (m) => `مواصفة ${m[1]}`],
];

export function fieldLabelAr(label) {
  const t = String(label || "").trim();
  if (!isAr) return t;
  for (const [re, ar] of LABEL_AR) {
    const m = t.match(re);
    if (m) return ar(m);
  }
  return t;
}
