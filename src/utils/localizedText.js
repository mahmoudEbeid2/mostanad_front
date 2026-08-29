// Best-effort plain string out of a LocalizedText value ({ translations, primary })
// or a raw string, for contexts (headlines, download files) that can't show
// bilingual text side by side.
export function localizedText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.translations) {
    return value.translations[value.primary] || value.translations.en || Object.values(value.translations)[0] || "";
  }
  return String(value);
}
