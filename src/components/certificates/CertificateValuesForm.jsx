import { RotateCcw } from "lucide-react";
import FlagBadges from "./FlagBadges";
import ValueOriginChip from "./ValueOriginChip";
import GroupRowsEditor from "./GroupRowsEditor";
import { sourceLabel } from "../../utils/certificateFieldSources";
import { fieldLabelAr } from "../../utils/fieldLabelAr";
import { strings, t } from "../../i18n";

// The editor's right panel (plan §13.6; mockup B5): one row per field — label,
// source chip, value, flags and "reset to source". Typing only updates drafts;
// the page saves them and the server re-renders. A repeating group's cells are
// not fields of their own here: the group is edited as a list of rows (§7.8).

const STR = strings("certificateValuesForm");
const NO_RESET = new Set(["manual", "static"]);

// UI plan, Phase G: the fields in sections — Product · Composition · Batch · Lab results · Document — read from
// each field's source (and its label/key when the source alone doesn't tell).
export const SECTIONS = ["product", "composition", "batch", "lab", "document"];
const COMPOSITION =
  /ingredient|composition|component|active|comp|comp_|مكون|تركيب/i;
const LAB =
  /result|found|assay|ph|moisture|analysis|test|spec|limit|observ|نتيج|تحليل/i;
const BATCH =
  /batch|lot|mfg|manufactur|production|expir|exp|تشغيل|باتش|انتاج|إنتاج|صلاحي/i;
export function sectionOf(f) {
  const kind = f.source?.kind || f.sourceKind;
  const text = `${f.key || ""} ${f.label || ""} ${f.source?.path || ""}`;
  if (f.category === "batch_data") return "lab";
  if (COMPOSITION.test(text)) return "composition";
  if (kind === "manual" && LAB.test(text)) return "lab";
  if (kind === "item" || BATCH.test(text)) return "batch";
  if (["product", "brand", "product_text", "product_list"].includes(kind))
    return "product";
  return LAB.test(text) ? "lab" : "document";
}

export default function CertificateValuesForm({
  fields,
  groups = [],
  values,
  drafts,
  catalogueOptions,
  fallbackFonts,
  editable,
  onChange,
  onRevert,
  onReset,
  versions = [],
}) {
  return (
    <section
      className="bg-white border border-gray-200 rounded-xl overflow-hidden"
      data-testid="values-form"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{STR.title}</h2>
        {editable && <span className="text-xs text-gray-500">{STR.keys}</span>}
      </div>
      {SECTIONS.map((sec) => {
        const own = fields.filter((f) => !f.groupKey && sectionOf(f) === sec);
        const ownGroups = groups.filter(
          (g) => sectionOf({ ...g, source: g.source }) === sec,
        );
        if (!own.length && !ownGroups.length) return null;
        return (
          <div key={sec} data-section={sec}>
            <h3 className="border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
              {t(`certificateValuesForm.section.${sec}`)}
            </h3>
            <div className="divide-y divide-gray-100">
              {own.map((f) => {
                const v = values[f.key] || { value: "", flags: [] };
                const dirty = Object.prototype.hasOwnProperty.call(
                  drafts,
                  f.key,
                );
                const shown = dirty ? drafts[f.key] : v.value;
                const flags = dirty ? [] : v.flags || [];
                const red = flags.some(
                  (x) =>
                    x === "missing" || x === "overflow" || x === "missing_span",
                );
                return (
                  <div
                    key={f.key}
                    className="px-4 py-3 space-y-1.5"
                    data-field-row={f.key}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor={`cv-${f.key}`}
                        className="text-sm font-semibold text-gray-800 flex items-center gap-2"
                      >
                        {fieldLabelAr(f.label)}
                        {dirty ? (
                          <span className="text-[11px] font-medium text-blue-600">
                            {STR.unsaved}
                          </span>
                        ) : v.origin === "manual" ? (
                          <span className="text-[11px] font-medium text-gray-500">
                            {STR.edited}
                          </span>
                        ) : v.origin === "restored" ? (
                          <span className="text-[11px] font-medium text-gray-500">
                            {STR.restored}
                          </span>
                        ) : v.origin === "data_check" ? (
                          <span
                            className="text-[11px] font-medium text-violet-700"
                            title={
                              v.provenance?.quote
                                ? `“${v.provenance.quote}”`
                                : undefined
                            }
                          >
                            {v.provenance?.kind === "manual"
                              ? STR.fromCheckTyped
                              : STR.fromCheck}
                          </span>
                        ) : null}
                        {!dirty &&
                          (v.origin !== "manual" ||
                            v.provenance?.kind === "computed") && (
                            <ValueOriginChip
                              provenance={v.provenance}
                              flags={v.flags || []}
                            />
                          )}
                      </label>
                      <span
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 truncate max-w-[55%]"
                        title={sourceLabel(catalogueOptions, f.source)}
                      >
                        {sourceLabel(catalogueOptions, f.source)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id={`cv-${f.key}`}
                        data-key={f.key}
                        value={shown}
                        disabled={!editable}
                        placeholder={f.format?.date || ""}
                        onChange={(e) => onChange(f.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            onRevert(f.key);
                          }
                        }}
                        className={`flex-1 border rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-700 ${red ? "border-red-400" : flags.length ? "border-amber-400" : "border-gray-300"}`}
                      />
                      {editable && !NO_RESET.has(f.source?.kind) && (
                        <button
                          type="button"
                          title={STR.reset}
                          aria-label={`${STR.reset}: ${fieldLabelAr(f.label)}`}
                          onClick={() => onReset(f.key)}
                          className="text-gray-400 hover:text-blue-600"
                          data-reset={f.key}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <FlagBadges flags={flags} fonts={fallbackFonts?.[f.key]} />
                  </div>
                );
              })}
              {ownGroups.map((g) => (
                <GroupRowsEditor
                  key={g.key}
                  group={g}
                  value={values[g.key]}
                  fonts={fallbackFonts?.[g.key]}
                  draftRows={
                    Object.prototype.hasOwnProperty.call(drafts, g.key)
                      ? drafts[g.key]
                      : undefined
                  }
                  editable={editable}
                  onChange={onChange}
                  onRevert={onRevert}
                  onReset={onReset}
                />
              ))}
            </div>
          </div>
        );
      })}
      {versions.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-1">
          <h3 className="text-sm font-semibold text-gray-800">{STR.history}</h3>
          {versions.slice(0, 3).map((v) => (
            <p
              key={v.versionNumber}
              className="text-xs text-gray-600 truncate"
              title={v.changeSummary || ""}
            >
              <b>v{v.versionNumber}</b> ·{" "}
              {v.changedBy || STR.sources[v.changeSource] || v.changeSource}
              {v.changeSummary
                ? ` · ${v.changeSummary}`
                : v.changeSource === "generation"
                  ? ` · ${STR.generated}`
                  : ""}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
