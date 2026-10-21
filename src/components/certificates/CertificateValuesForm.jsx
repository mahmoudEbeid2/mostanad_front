import { RotateCcw } from "lucide-react";
import FlagBadges from "./FlagBadges";
import GroupRowsEditor from "./GroupRowsEditor";
import { sourceLabel } from "../../utils/certificateFieldSources";

// The editor's right panel (plan §13.6; mockup B5): one row per field — label,
// source chip, value, flags and "reset to source". Typing only updates drafts;
// the page saves them and the server re-renders. A repeating group's cells are
// not fields of their own here: the group is edited as a list of rows (§7.8).
const STR = {
  title: "Values",
  keys: "Tab · Ctrl+S saves · Esc reverts",
  reset: "Reset to the value from its source",
  edited: "edited",
  restored: "restored",
  unsaved: "unsaved",
  history: "History",
  generated: "generated",
  sources: { generation: "generated", user_edit: "edited", restore: "restored", regenerate_field: "reset", duplicate: "duplicated" },
};
const NO_RESET = new Set(["manual", "static"]);

export default function CertificateValuesForm({ fields, groups = [], values, drafts, catalogueOptions, editable, onChange, onRevert, onReset, versions = [] }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="values-form">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{STR.title}</h2>
        {editable && <span className="text-xs text-gray-500">{STR.keys}</span>}
      </div>
      <div className="divide-y divide-gray-100">
        {fields.filter((f) => !f.groupKey).map((f) => {
          const v = values[f.key] || { value: "", flags: [] };
          const dirty = Object.prototype.hasOwnProperty.call(drafts, f.key);
          const shown = dirty ? drafts[f.key] : v.value;
          const flags = dirty ? [] : v.flags || [];
          const red = flags.some((x) => x === "missing" || x === "overflow" || x === "missing_span");
          return (
            <div key={f.key} className="px-4 py-3 space-y-1.5" data-field-row={f.key}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`cv-${f.key}`} className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  {f.label}
                  {dirty ? (
                    <span className="text-[11px] font-medium text-blue-600">{STR.unsaved}</span>
                  ) : v.origin === "manual" ? (
                    <span className="text-[11px] font-medium text-gray-500">{STR.edited}</span>
                  ) : v.origin === "restored" ? (
                    <span className="text-[11px] font-medium text-gray-500">{STR.restored}</span>
                  ) : null}
                </label>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 truncate max-w-[55%]" title={sourceLabel(catalogueOptions, f.source)}>
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
                  <button type="button" title={STR.reset} aria-label={`${STR.reset}: ${f.label}`} onClick={() => onReset(f.key)} className="text-gray-400 hover:text-blue-600" data-reset={f.key}>
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <FlagBadges flags={flags} />
            </div>
          );
        })}
        {groups.map((g) => (
          <GroupRowsEditor
            key={g.key}
            group={g}
            value={values[g.key]}
            draftRows={Object.prototype.hasOwnProperty.call(drafts, g.key) ? drafts[g.key] : undefined}
            editable={editable}
            onChange={onChange}
            onRevert={onRevert}
            onReset={onReset}
          />
        ))}
      </div>
      {versions.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 space-y-1">
          <h3 className="text-sm font-semibold text-gray-800">{STR.history}</h3>
          {versions.slice(0, 3).map((v) => (
            <p key={v.versionNumber} className="text-xs text-gray-600 truncate" title={v.changeSummary || ""}>
              <b>v{v.versionNumber}</b> · {v.changedBy || STR.sources[v.changeSource] || v.changeSource}
              {v.changeSummary ? ` · ${v.changeSummary}` : v.changeSource === "generation" ? ` · ${STR.generated}` : ""}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
