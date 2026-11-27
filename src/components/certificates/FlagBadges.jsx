import { t } from "../../i18n";
// Field flags with the plan's fixed colours and copy (plan §13.7), shown as in
// mockup B5: a short code pill ("missing") followed by the sentence — the words
// carry the meaning, the colour only repeats it.

const FLAGS = {
  missing: { tone: "red", text: t("flagBadges.requiredValueMissing") },
  // 26 Nov: a batch / date / result that equalled the template's own sample was removed, never printed
  sample_value: { tone: "red", text: t("flagBadges.thisWasTheTemplatesSample") },
  overflow: { tone: "red", text: t("flagBadges.doesntFitShortenOrChange") },
  shrunk: { tone: "amber", text: t("flagBadges.shrunkToFit") },
  format: { tone: "amber", text: t("flagBadges.couldntFormatAsDate") },
  missing_span: { tone: "red", text: t("flagBadges.fieldNotFoundInThe") },
  // 28 Nov: a descriptive value the AI estimated — printed, never blocking (the «مستنتج» chip says why)
  estimated: { tone: "violet", text: t("flagBadges.estimatedCheckItOrAccept") },
  unconfirmed: { tone: "amber", text: t("flagBadges.estimatedConfirmItInThe") },
  // 27 Nov QA: a lab result outside its specification — finalize needs a comment saying why
  out_of_spec: { tone: "red", text: t("flagBadges.outsideItsSpecificationFinalizingNeeds") },
  // QA 27 Nov (re-test): a draft holds no certificate number — it is given when the certificate is finalized
  number_on_finalize: { tone: "gray", code: "number", text: t("flagBadges.givenOnFinalize") },
  // 28 Nov (owner), COA: a result / batch size nobody gave — its cell is printed empty; never blocks finalize
  no_result: { tone: "amber", code: "empty", text: t("flagBadges.noResult") },
  // informational, never blocks finalize: an optional value nothing could fill
  empty_optional: { tone: "gray", text: t("flagBadges.optionalValueIsEmpty") },
  // informational, never blocks finalize: the design's font couldn't be read, so a missing character can't be detected
  glyph_unknown: { tone: "gray", text: t("flagBadges.fontCouldntBeCheckedLook") },
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
  return { tone: "gray", code: "fallback", text: t("flagBadges.drawnIn", { chars: chars.join(t("common.listSep")), font: names || t("flagBadges.aCloseFont") }) };
}

function describeFlag(flag, fonts) {
  if (flag.startsWith(GLYPH_FALLBACK)) return describeFallback(flag, fonts);
  // the product has more ingredients than the design has rows — never cut silently
  if (flag.startsWith("rows_overflow")) {
    const [have, rows] = flag.split(":")[1]?.split("/") || [];
    return { tone: "red", code: "rows", text: have ? t("flagBadges.theProductHasIngredientsAnd", { have, rows }) : t("flagBadges.moreIngredientsThanTheTemplates") };
  }
  // 28 Nov: more rows than the design’s table, and growing it would break the page below (blocked)
  if (flag.startsWith("table_full")) {
    const [have, rows] = flag.split(":")[1]?.split("/") || [];
    return { tone: "red", code: "table", text: have ? t("flagBadges.tableFull", { have, rows }) : t("flagBadges.tableFullShort") };
  }
  if (flag.startsWith("glyph:")) return { tone: "red", code: "glyph", text: t("flagBadges.characterNotInAnyAvailable", { join: Array.from(flag.slice(6)).join(", ") }) };
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
