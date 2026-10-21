import { AlertTriangle, Layers, Plus, RotateCcw, Trash2 } from "lucide-react";
import Button from "../../ui/Button";
import { slugKey } from "../../utils/certificateFieldSources";

// Repeating groups on the field-marking screen (plan §7.8, §13.4). A group is
// one sample row whose cells are ordinary fields (character ranges) with
// `groupKey`; this card holds the group's own settings and shows what the
// server detected (shape, footer line, how many rows fit). Nothing here is
// measured in the browser (D11): every number comes from PUT …/fields.

const STR = {
  title: "Repeating groups",
  needsSvg: "A list that grows with the data — ingredients, invoice lines — needs this design converted with its lines as separate shapes. That makes a new draft version of the same design (fields copied) with its own prepare check. Versions without groups are not affected.",
  enable: "Enable repeating groups",
  enabling: "Creating the version…",
  empty: "Mark the text of ONE row (e.g. an ingredient and its amount) as fields, then add a group and pick it under “Row of group” in each field.",
  add: "Add group",
  label: "Label",
  key: "Key",
  source: "Rows come from",
  list: "List",
  mode: "When the list is longer than the design",
  whenEmpty: "When the list is empty",
  required: "Required — flag the certificate if the list is empty",
  footer: "Footer line",
  footerHint: "Everything below this line stays where it is; content between the group and the line moves down as rows are added. Drag the dashed line on the design.",
  footerProposed: (y) => `Proposed by the engine at ${y} px`,
  footerYours: (y, p) => `Yours at ${y} px (proposal ${p} px)`,
  useProposal: "Use the proposal",
  detected: "Detected",
  shape: { cell_list: "a list inside one table cell", table_rows: "full table rows" },
  sampleRows: (n) => `${n} sample row${n === 1 ? "" : "s"}`,
  capacity: (full, min) => (full === min ? `up to ${full} rows fit` : `up to ${full} rows fit, ${min} when rows are packed to 85 %`),
  notDetected: "Can't add rows to this design",
  useFixed: "Use fixed rows instead",
  fixedHelp: "Fixed rows: the designer draws the maximum number of rows; unused rows are hidden and the gap is closed.",
  cells: (n) => `${n} cell${n === 1 ? "" : "s"}`,
  noCells: "No cells yet — pick this group under “Row of group” in the fields that make up the sample row.",
  remove: "Delete group",
  pending: "Checking the design…",
};

const input = "w-full min-h-10 border border-gray-300 rounded-lg px-3 bg-white text-sm font-normal text-gray-900";
const lbl = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600";

const uniqueGroupKey = (base, taken) => {
  let k = base;
  for (let n = 2; taken.has(k); n++) k = `${base}_${n}`;
  return k;
};

function newGroup(groups, fieldKeys, templateScope) {
  const taken = new Set([...groups.map((g) => g.key), ...fieldKeys]);
  const n = groups.length + 1;
  return {
    key: uniqueGroupKey(n === 1 ? "rows" : `rows_${n}`, taken),
    label: n === 1 ? "Rows" : `Rows ${n}`,
    mode: "repeat",
    source: templateScope === "per_invoice" ? { kind: "invoice_lines" } : { kind: "manual" },
    whenEmpty: "dash",
    required: true,
    footerY: null,
    keyEdited: false,
  };
}

function Detection({ d, onUseFixed, readOnly }) {
  if (!d) return <p className="text-xs text-gray-500">{STR.pending}</p>;
  if (!d.ok) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 space-y-1.5" data-testid="group-not-detected">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-800">
          <AlertTriangle className="w-3.5 h-3.5" /> {STR.notDetected}
        </p>
        <p className="text-xs text-red-900">{d.message || d.error}</p>
        {!readOnly && onUseFixed && (
          <button type="button" onClick={onUseFixed} className="text-xs font-semibold text-red-800 underline">
            {STR.useFixed}
          </button>
        )}
      </div>
    );
  }
  return (
    <p className="text-xs text-gray-600" data-testid="group-detected">
      <b className="text-gray-800">{STR.detected}:</b> {STR.shape[d.shape] || d.shape} · {STR.sampleRows(d.sampleRowCount)}
      {d.capacity && <> · {STR.capacity(d.capacity.full, d.capacity.min)}</>}
    </p>
  );
}

export default function GroupPanel({ version, templateScope, groups, detection = {}, catalogue, fields, onChange, onEnable, enabling, readOnly }) {
  const svg = version.backgroundFormat === "svg";
  const kinds = (catalogue?.groups?.kinds || []).filter((k) => k.kind !== "invoice_lines" || templateScope === "per_invoice").filter((k) => k.kind !== "product_list" || templateScope !== "per_invoice");
  const lists = catalogue?.groups?.kinds?.find((k) => k.kind === "product_list")?.lists || [];
  const set = (i, patch) => onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  return (
    <section aria-label={STR.title} className="bg-white border border-gray-200 rounded-xl" data-testid="group-panel">
      <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-gray-200">
        <h2 className="text-[15px] font-semibold text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-500" /> {STR.title} <span className="text-gray-500 font-medium">· {groups.length}</span>
        </h2>
        {svg && !readOnly && (
          <button
            type="button"
            onClick={() => onChange([...groups, newGroup(groups, fields.map((f) => f.key), templateScope)])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 bg-white text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
            data-testid="add-group"
          >
            <Plus className="w-4 h-4" /> {STR.add}
          </button>
        )}
      </div>
      <div className="p-3 flex flex-col gap-3">
        {!svg && (
          <div className="space-y-2.5">
            <p className="text-[13px] text-gray-600">{STR.needsSvg}</p>
            {!readOnly && version.sourceFormat !== "html" && (
              <Button variant="secondary" onClick={onEnable} isLoading={enabling} data-testid="enable-groups">
                {enabling ? STR.enabling : STR.enable}
              </Button>
            )}
          </div>
        )}
        {svg && !groups.length && <p className="text-sm text-gray-500 p-1">{STR.empty}</p>}
        {groups.map((g, i) => {
          const cells = fields.filter((f) => f.groupKey === g.key);
          const d = detection[g.key];
          const proposal = d?.footerProposal ?? null;
          return (
            <div key={i} className="rounded-[10px] border-2 border-violet-500/70 bg-violet-50/30 p-3.5 space-y-3" data-testid={`group-${g.key}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[13px] font-semibold text-gray-900">{g.key}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">{STR.cells(cells.length)}</span>
                  {!readOnly && (
                    <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-600" aria-label={`${STR.remove}: ${g.label}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              </div>
              {!cells.length && <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">{STR.noCells}</p>}
              <div className="grid grid-cols-2 gap-2.5">
                <label className={lbl}>
                  {STR.label}
                  <input value={g.label} disabled={readOnly} onChange={(e) => set(i, { label: e.target.value, ...(g.keyEdited ? {} : { key: slugKey(e.target.value) }) })} className={input} />
                </label>
                <label className={lbl}>
                  {STR.key}
                  <input value={g.key} disabled={readOnly} onChange={(e) => set(i, { key: e.target.value, keyEdited: true })} className={`${input} font-mono`} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className={lbl}>
                  {STR.source}
                  <select
                    value={g.source?.kind || "manual"}
                    disabled={readOnly}
                    onChange={(e) => set(i, { source: e.target.value === "product_list" ? { kind: "product_list", path: lists[0]?.path } : { kind: e.target.value } })}
                    className={input}
                    data-testid="group-source"
                  >
                    {kinds.map((k) => (
                      <option key={k.kind} value={k.kind}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                {g.source?.kind === "product_list" && (
                  <label className={lbl}>
                    {STR.list}
                    <select value={g.source.path || ""} disabled={readOnly} onChange={(e) => set(i, { source: { kind: "product_list", path: e.target.value } })} className={input} data-testid="group-list">
                      {lists.map((l) => (
                        <option key={l.path} value={l.path}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className={lbl}>
                  {STR.mode}
                  <select value={g.mode} disabled={readOnly} onChange={(e) => set(i, { mode: e.target.value })} className={input} title={STR.fixedHelp}>
                    {(catalogue?.groups?.modes || []).map((m) => (
                      <option key={m.mode} value={m.mode}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={lbl}>
                  {STR.whenEmpty}
                  <select value={g.whenEmpty} disabled={readOnly} onChange={(e) => set(i, { whenEmpty: e.target.value })} className={input} data-testid="group-when-empty">
                    {(catalogue?.groups?.whenEmpty || []).map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-gray-800">
                <input type="checkbox" className="w-4 h-4" disabled={readOnly} checked={g.required !== false} onChange={(e) => set(i, { required: e.target.checked })} />
                {STR.required}
              </label>
              {cells.length > 0 && <Detection d={d} readOnly={readOnly} onUseFixed={g.mode !== "fixed_rows" ? () => set(i, { mode: "fixed_rows" }) : null} />}
              {d?.ok && g.mode !== "fixed_rows" && (
                <div className="space-y-1" data-testid="footer-line">
                  <p className="text-xs font-semibold text-gray-600">{STR.footer}</p>
                  <p className="text-xs text-gray-700">{g.footerY === null || g.footerY === undefined ? STR.footerProposed(proposal) : STR.footerYours(g.footerY, proposal)}</p>
                  <p className="text-[11px] text-gray-500">{STR.footerHint}</p>
                  {!readOnly && g.footerY !== null && g.footerY !== undefined && (
                    <button type="button" onClick={() => set(i, { footerY: null })} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                      <RotateCcw className="w-3 h-3" /> {STR.useProposal}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
