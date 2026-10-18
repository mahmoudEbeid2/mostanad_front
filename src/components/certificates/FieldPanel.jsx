import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Sparkles, Trash2, X } from "lucide-react";
import SourcePicker from "./SourcePicker";
import { DATE_PATTERNS, slugKey, sourceLabel, sourceType } from "../../utils/certificateFieldSources";

// Field list + editor (plan §13.4 step 2): key (auto-slug from the label),
// label, source, format (only options valid for the source type), required,
// align. AI suggestions are chips the user accepts or rejects one by one; an
// accepted one stays "unconfirmed" until confirmed (D10).

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
  required: "Required",
  align: "Anchor",
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
};

const input = "w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm";

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
        <label className="text-xs text-gray-600 col-span-2">
          {STR.date}
          <select value={fmt.date || ""} onChange={(e) => set({ date: e.target.value })} className={`${input} mt-0.5 bg-white`}>
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
          <label className="text-xs text-gray-600">
            {STR.decimals}
            <input type="number" min={0} max={6} value={fmt.number?.decimals ?? ""} onChange={(e) => set({ number: { ...fmt.number, decimals: e.target.value === "" ? undefined : Number(e.target.value) } })} className={`${input} mt-0.5`} />
          </label>
          <label className="text-xs text-gray-600">
            {STR.thousands}
            <input maxLength={1} value={fmt.number?.thousands ?? ""} onChange={(e) => set({ number: { ...fmt.number, thousands: e.target.value || undefined } })} className={`${input} mt-0.5`} />
          </label>
        </>
      )}
      <label className="text-xs text-gray-600 col-span-2">
        {STR.case}
        <select value={fmt.case || ""} onChange={(e) => set({ case: e.target.value })} className={`${input} mt-0.5 bg-white`}>
          <option value="">{STR.caseAsIs}</option>
          <option value="upper">{STR.upper}</option>
          <option value="lower">{STR.lower}</option>
          <option value="title">{STR.titleCase}</option>
        </select>
      </label>
      <label className="text-xs text-gray-600">
        {STR.prefix}
        <input value={fmt.prefix || ""} onChange={(e) => set({ prefix: e.target.value })} className={`${input} mt-0.5`} />
      </label>
      <label className="text-xs text-gray-600">
        {STR.suffix}
        <input value={fmt.suffix || ""} onChange={(e) => set({ suffix: e.target.value })} className={`${input} mt-0.5`} />
      </label>
    </div>
  );
}

function FieldEditor({ field, options, suggestion, onChange }) {
  const type = sourceType(options, field.source);
  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-600">
          {STR.label}
          <input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value, ...(field.keyEdited ? {} : { key: slugKey(e.target.value) }) })}
            className={`${input} mt-0.5`}
            onFocus={(e) => e.target.select()}
            data-testid="field-label"
          />
        </label>
        <label className="text-xs text-gray-600">
          {STR.key}
          <input value={field.key} onChange={(e) => onChange({ key: e.target.value, keyEdited: true })} className={`${input} mt-0.5 font-mono`} />
        </label>
      </div>
      <div className="text-xs text-gray-600">
        {STR.source}
        <div className="mt-0.5">
          <SourcePicker
            options={options}
            value={field.source}
            onChange={(source) => {
              // drop formats the new source type can't use
              const t = sourceType(options, source);
              const f = { ...(field.format || {}) };
              if (t !== "date") delete f.date;
              if (t !== "number") delete f.number;
              onChange({ source, format: Object.keys(f).length ? f : null });
            }}
          />
        </div>
      </div>
      <div className="text-xs text-gray-600">
        {STR.format}
        <div className="mt-0.5">
          <FormatEditor field={field} type={type} onChange={(format) => onChange({ format })} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={field.required !== false} onChange={(e) => onChange({ required: e.target.checked })} />
          {STR.required}
        </label>
        <div className="flex items-center gap-1 text-sm" title={STR.alignHint}>
          <span className="text-xs text-gray-600 mr-1">{STR.align}</span>
          {["left", "center", "right"].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ align: a })}
              className={`px-2 py-1 rounded-md border text-xs ${field.align === a ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}
            >
              {STR[a]}
            </button>
          ))}
        </div>
        {suggestion?.align && suggestion.align !== field.align && (
          <button type="button" onClick={() => onChange({ align: suggestion.align })} className="text-xs px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200">
            {STR.suggestAlign(suggestion.align)} · {STR.apply}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FieldPanel({
  fields,
  options,
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
  header,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div className="font-semibold text-gray-800">
          {STR.title} <span className="text-gray-400 font-normal">({fields.length})</span>
        </div>
        {header}
      </div>
      <div className="p-3 space-y-2 overflow-auto">
        {readOnly && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{STR.readOnly}</p>}
        {!readOnly && aiEnabled && (
          <button type="button" onClick={onSuggest} disabled={aiBusy} className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-60">
            <Sparkles className="w-4 h-4" /> {aiBusy ? STR.suggesting : STR.suggest}
          </button>
        )}
        {aiChips.length > 0 && (
          <div className="rounded-lg border border-violet-200 p-2 space-y-1.5">
            <p className="text-xs font-medium text-violet-800">{STR.aiChipsTitle}</p>
            {aiChips.map((c) => (
              <div key={`${c.lineId}:${c.charStart}`} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate">
                  <span className="font-medium">{c.label}</span> · <span className="font-mono">{c.sampleValue}</span> · <span className="text-gray-500">{sourceLabel(options, c.source)}</span>
                </span>
                <button type="button" onClick={() => onAcceptChip(c)} className="p-1 rounded bg-emerald-50 text-emerald-700" title={STR.accept}>
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => onRejectChip(c)} className="p-1 rounded bg-gray-100 text-gray-600" title={STR.reject}>
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
            <div key={f.uid} data-testid={`field-${f.key}`} className={`rounded-lg border ${open ? "border-blue-300 bg-blue-50/30" : "border-gray-200"} p-2`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onActivate(open ? null : f.uid)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800 truncate">{f.label || f.key}</span>
                    <span className="block text-xs text-gray-500 truncate">
                      <span className="font-mono">{f.sampleValue}</span> · {sourceLabel(options, f.source)}
                    </span>
                  </span>
                </button>
                {!f.confirmed && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">{STR.unconfirmed}</span>
                )}
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
              {open && !readOnly && <FieldEditor field={f} options={options} suggestion={suggestions[f.key]} onChange={(patch) => onChange(f.uid, patch)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
