import { ArrowDown, ArrowUp, Check, Sparkles, Trash2, X } from "lucide-react";
import SourcePicker from "./SourcePicker";
import { DATE_PATTERNS, slugKey, sourceLabel, sourceType } from "../../utils/certificateFieldSources";

// Field list + editor (plan §13.4 step 2): key (auto-slug from the label),
// label, source, format (only options valid for the source type), required,
// align. AI suggestions are chips the user accepts or rejects one by one; an
// accepted one stays "unconfirmed" until confirmed (D10). A field can be a
// cell of a repeating group's sample row (plan §7.8): its value then comes
// from each row (or fixed text / typed), not from the catalogue.

const STR = {
  title: "Fields",
  empty: "Select the text that changes from one certificate to the next (batch number, dates, product name…) in the design, then press “Make field” or Enter. Ctrl/⌘-select several values to make them at once.",
  label: "Label",
  key: "Key",
  source: "Value comes from",
  format: "Format",
  date: "Date format",
  dateAsIs: "As is",
  case: "Letter case",
  caseAsIs: "As is",
  upper: "UPPER",
  lower: "lower",
  titleCase: "Title",
  decimals: "Decimals",
  thousands: "Thousands separator",
  prefix: "Prefix",
  suffix: "Suffix",
  required: "Required — flag the certificate if empty",
  align: "Align",
  alignHint: "Where the value stays fixed when it is longer or shorter than the sample.",
  left: "Left",
  center: "Center",
  right: "Right",
  sample: "Sample",
  suggestAlign: (a) => `Suggested: ${a}`,
  apply: "Apply",
  unconfirmed: "Unconfirmed",
  confirm: "Confirm",
  suggest: "Suggest fields (AI)",
  suggesting: "Asking AI…",
  aiChipsTitle: "AI suggestions — accept or reject each",
  accept: "Accept",
  reject: "Reject",
  readOnly: "This version is not a draft, so its fields are read-only.",
  group: "Row of group",
  noGroup: "— not part of a group —",
  groupHint: "A cell of the group's sample row: it is repeated once per row.",
};

const input = "w-full min-h-10 border border-gray-300 rounded-lg px-3 bg-white text-sm font-normal text-gray-900";
const lbl = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600";
const ALIGN_SHORT = { left: "L", center: "C", right: "R" };

function FormatEditor({ field, type, onChange }) {
  const fmt = field.format || {};
  const set = (patch) => {
    const next = { ...fmt, ...patch };
    for (const k of Object.keys(next)) if (next[k] === "" || next[k] === null || next[k] === undefined) delete next[k];
    onChange(Object.keys(next).length ? next : null);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {type === "date" && (
        <label className="text-xs font-normal text-gray-600 col-span-2">
          {STR.date}
          <select value={fmt.date || ""} onChange={(e) => set({ date: e.target.value })} className={`${input} mt-1 bg-white`}>
            <option value="">{STR.dateAsIs}</option>
            {DATE_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}
      {type === "number" && (
        <>
          <label className="text-xs font-normal text-gray-600">
            {STR.decimals}
            <input type="number" min={0} max={6} value={fmt.number?.decimals ?? ""} onChange={(e) => set({ number: { ...fmt.number, decimals: e.target.value === "" ? undefined : Number(e.target.value) } })} className={`${input} mt-1`} />
          </label>
          <label className="text-xs font-normal text-gray-600">
            {STR.thousands}
            <input maxLength={1} value={fmt.number?.thousands ?? ""} onChange={(e) => set({ number: { ...fmt.number, thousands: e.target.value || undefined } })} className={`${input} mt-1`} />
          </label>
        </>
      )}
      <label className="text-xs font-normal text-gray-600 col-span-2">
        {STR.case}
        <select value={fmt.case || ""} onChange={(e) => set({ case: e.target.value })} className={`${input} mt-1 bg-white`}>
          <option value="">{STR.caseAsIs}</option>
          <option value="upper">{STR.upper}</option>
          <option value="lower">{STR.lower}</option>
          <option value="title">{STR.titleCase}</option>
        </select>
      </label>
      <label className="text-xs font-normal text-gray-600">
        {STR.prefix}
        <input value={fmt.prefix || ""} onChange={(e) => set({ prefix: e.target.value })} className={`${input} mt-1`} />
      </label>
      <label className="text-xs font-normal text-gray-600">
        {STR.suffix}
        <input value={fmt.suffix || ""} onChange={(e) => set({ suffix: e.target.value })} className={`${input} mt-1`} />
      </label>
    </div>
  );
}

function FieldEditor({ field, options, groups, cellOptionsFor, suggestion, onChange }) {
  const opts = field.groupKey ? cellOptionsFor(field.groupKey) : options;
  const type = sourceType(opts, field.source);
  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className={lbl}>
          {STR.label}
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value, ...(field.keyEdited ? {} : { key: slugKey(e.target.value) }) })}
            className={input}
            onFocus={(e) => e.target.select()}
            data-testid="field-label"
          />
        </label>
        <label className={lbl}>
          {STR.key}
          <input value={field.key} onChange={(e) => onChange({ key: e.target.value, keyEdited: true })} className={`${input} font-mono`} />
        </label>
      </div>
      {groups.length > 0 && (
        <label className={lbl} title={STR.groupHint}>
          {STR.group}
          <select
            value={field.groupKey || ""}
            onChange={(e) => onChange({ groupKey: e.target.value || null, source: { kind: "manual" }, format: null })}
            className={input}
            data-testid="field-group"
          >
            <option value="">{STR.noGroup}</option>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label} ({g.key})
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={lbl}>
        {STR.source}
        <SourcePicker
          ariaLabel={STR.source}
          options={opts}
          value={field.source}
          onChange={(source) => {
            // drop formats the new source type can't use
            const t = sourceType(opts, source);
            const f = { ...(field.format || {}) };
            if (t !== "date") delete f.date;
            if (t !== "number") delete f.number;
            onChange({ source, format: Object.keys(f).length ? f : null });
          }}
        />
      </div>
      <div className={lbl}>
        {STR.format}
        <FormatEditor field={field} type={type} onChange={(format) => onChange({ format })} />
      </div>
      <div className={lbl} title={STR.alignHint}>
        {STR.align}
        <div role="group" aria-label={STR.align} className="flex min-h-10 border border-gray-300 rounded-lg overflow-hidden">
          {["left", "center", "right"].map((a, i) => (
            <button
              key={a}
              type="button"
              aria-pressed={field.align === a}
              onClick={() => onChange({ align: a })}
              className={`flex-1 text-[13px] ${i ? "border-l border-gray-300" : ""} ${field.align === a ? "bg-blue-600 text-white font-semibold" : "bg-white text-gray-700 font-medium hover:bg-gray-50"}`}
            >
              {STR[a]}
            </button>
          ))}
        </div>
        {suggestion?.align && suggestion.align !== field.align && (
          <button type="button" onClick={() => onChange({ align: suggestion.align })} className="self-start text-xs font-normal px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200">
            {STR.suggestAlign(suggestion.align)} · {STR.apply}
          </button>
        )}
      </div>
      <label className="flex items-center gap-2 text-[13px] text-gray-800">
        <input type="checkbox" className="w-4 h-4" checked={field.required !== false} onChange={(e) => onChange({ required: e.target.checked })} />
        {STR.required}
      </label>
    </div>
  );
}

export default function FieldPanel({
  fields,
  options,
  groups = [],
  cellOptionsFor = () => [],
  activeUid,
  onActivate,
  onChange,
  onRemove,
  onMove,
  onConfirm,
  suggestions = {},
  readOnly,
  aiEnabled = true,
  aiChips = [],
  aiBusy,
  onSuggest,
  onAcceptChip,
  onRejectChip,
  footer,
  className = "",
}) {
  return (
    <aside aria-label={STR.title} className={`bg-white border border-gray-200 rounded-xl flex flex-col min-h-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-gray-200">
        <h2 className="text-[15px] font-semibold text-gray-900">
          {STR.title} <span className="text-gray-500 font-medium">· {fields.length}</span>
        </h2>
        {!readOnly && aiEnabled && (
          <button
            type="button"
            onClick={onSuggest}
            disabled={aiBusy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 bg-white text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" /> {aiBusy ? STR.suggesting : STR.suggest}
          </button>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 overflow-auto">
        {readOnly && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{STR.readOnly}</p>}
        {aiChips.length > 0 && (
          <div className="rounded-lg border border-violet-200 p-2 space-y-1.5">
            <p className="text-xs font-medium text-violet-800">{STR.aiChipsTitle}</p>
            {aiChips.map((c) => (
              <div key={`${c.lineId}:${c.charStart}`} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">
                  <span className="font-medium">{c.label}</span> · <span className="font-mono">{c.sampleValue}</span> · <span className="text-gray-500">{sourceLabel(options, c.source)}</span>
                </span>
                <button type="button" onClick={() => onAcceptChip(c)} className="p-1 rounded bg-emerald-50 text-emerald-700" title={STR.accept} aria-label={`${STR.accept}: ${c.label}`}>
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => onRejectChip(c)} className="p-1 rounded bg-gray-100 text-gray-600" title={STR.reject} aria-label={`${STR.reject}: ${c.label}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {!fields.length && <p className="text-sm text-gray-500 p-2">{STR.empty}</p>}
        {fields.map((f, i) => {
          const open = f.uid === activeUid;
          return (
            <div
              key={f.uid}
              data-testid={`field-${f.key}`}
              className={`rounded-[10px] ${open && !readOnly ? "border-2 border-blue-600 bg-blue-50/40 p-3.5" : "border border-gray-200 px-3 py-2.5"}`}
            >
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={() => onActivate(open ? null : f.uid)} className="flex-1 min-w-0 text-left flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-mono text-[13px] font-semibold text-gray-900 truncate">{f.key}</span>
                    <span className="block text-xs text-gray-500 truncate">“{f.sampleValue}”</span>
                  </span>
                </button>
                {f.groupKey && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 font-mono">{f.groupKey}</span>}
                <span className="hidden sm:inline-flex max-w-40 truncate rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{sourceLabel(f.groupKey ? cellOptionsFor(f.groupKey) : options, f.source)}</span>
                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-600" title={`${STR.align}: ${f.align || "left"}`}>
                  {ALIGN_SHORT[f.align] || "L"}
                </span>
                {!f.confirmed && <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">{STR.unconfirmed}</span>}
                {!f.confirmed && onConfirm && (
                  <button type="button" onClick={() => onConfirm(f.key)} className="text-xs px-2 py-1 rounded-md bg-emerald-600 text-white">
                    {STR.confirm}
                  </button>
                )}
                {!readOnly && (
                  <span className="flex items-center">
                    <button type="button" disabled={i === 0} onClick={() => onMove(i, -1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" disabled={i === fields.length - 1} onClick={() => onMove(i, 1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => onRemove(f.uid)} className="p-1 text-gray-400 hover:text-red-600" aria-label="Delete field">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              {open && !readOnly && <FieldEditor field={f} options={options} groups={groups} cellOptionsFor={cellOptionsFor} suggestion={suggestions[f.key]} onChange={(patch) => onChange(f.uid, patch)} />}
            </div>
          );
        })}
      </div>
      {footer && <div className="mt-auto px-4 py-3.5 border-t border-gray-200 flex items-center justify-between gap-2">{footer}</div>}
    </aside>
  );
}
