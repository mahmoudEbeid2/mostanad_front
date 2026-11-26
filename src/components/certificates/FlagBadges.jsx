// Field flags with the plan's fixed colours and copy (plan §13.7), shown as in
// mockup B5: a short code pill ("missing") followed by the sentence — the words
// carry the meaning, the colour only repeats it.
import { tr } from "../../i18n/lang";

const FLAGS = {
  missing: { tone: "red", text: tr("قيمة مطلوبة ناقصة", "Required value missing") },
  // 26 Nov: a batch / date / result that equalled the template's own sample was removed, never printed
  sample_value: { tone: "red", text: tr("دي كانت قيمة مثال القالب — اتشالت، اكتب القيمة الصح", "This was the template's sample value — removed; type the real one") },
  overflow: { tone: "red", text: tr("مش واخدة مكانها — قصّرها أو غيّرها", "Doesn't fit — shorten or change") },
  shrunk: { tone: "amber", text: tr("اتصغّرت عشان تاخد مكانها", "Shrunk to fit") },
  format: { tone: "amber", text: tr("معرفناش نكتبها كتاريخ", "Couldn't format as date") },
  missing_span: { tone: "red", text: tr("الحقل مش موجود في التصميم", "Field not found in the design") },
  // 28 Nov: a descriptive value the AI estimated — printed, never blocking (the «مستنتج» chip says why)
  estimated: { tone: "violet", text: tr("مستنتج — راجعه أو اعتمد كل المستنتج", "Estimated — check it, or accept all estimates") },
  unconfirmed: { tone: "amber", text: tr("تقدير — أكّده في مراجعة البيانات قبل الاعتماد", "Estimated — confirm it in the data check before finalizing") },
  // 27 Nov QA: a lab result outside its specification — finalize needs a comment saying why
  out_of_spec: { tone: "red", text: tr("النتيجة برّا المواصفة — الاعتماد محتاج تعليق يشرح السبب", "Outside its specification — finalizing needs a comment") },
  // informational, never blocks finalize: an optional value nothing could fill
  empty_optional: { tone: "gray", text: tr("قيمة اختيارية فاضية", "Optional value is empty") },
  // informational, never blocks finalize: the design's font couldn't be read, so a missing character can't be detected
  glyph_unknown: { tone: "gray", text: tr("الخط ماتراجعش — بص على المعاينة لو فيه حروف ناقصة", "Font couldn't be checked — look at the preview for missing characters") },
};
const TONES = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
  gray: "bg-gray-100 text-gray-700",
  violet: "bg-violet-50 text-violet-700",
};

const GLYPH_FALLBACK = "glyph_fallback:";

// informational, never blocks finalize. fonts: { "+": "Noto Sans" }, from the API
function describeFallback(flag, fonts) {
  const chars = Array.from(flag.slice(GLYPH_FALLBACK.length));
  const names = [...new Set(chars.map((ch) => fonts?.[ch]).filter(Boolean))].join(", ");
  return { tone: "gray", code: "fallback", text: `${chars.join(", ")}: drawn in ${names || "a close font"} — close match` };
}

function describeFlag(flag, fonts) {
  if (flag.startsWith(GLYPH_FALLBACK)) return describeFallback(flag, fonts);
  // the product has more ingredients than the design has rows — never cut silently
  if (flag.startsWith("rows_overflow")) {
    const [have, rows] = flag.split(":")[1]?.split("/") || [];
    return { tone: "red", code: "rows", text: have ? tr(`المنتج فيه ${have} مكوّن والقالب فيه ${rows} سطر — كبّر الجدول في القالب`, `The product has ${have} ingredients and the template ${rows} rows — enlarge the table`) : tr("مكونات أكتر من سطور القالب", "More ingredients than the template's rows") };
  }
  if (flag.startsWith("glyph:")) return { tone: "red", code: "glyph", text: `Character not in any available font: ${Array.from(flag.slice(6)).join(", ")}` };
  return FLAGS[flag] || { tone: "amber", text: flag };
}

export default function FlagBadges({ flags, fonts, className = "" }) {
  if (!flags?.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {flags.map((f) => {
        const { tone, text, code } = describeFlag(f, fonts);
        return (
          <span key={f} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${TONES[tone]}`}>{code || f.replace("_", " ")}</span>
            {text}
          </span>
        );
      })}
    </span>
  );
}
