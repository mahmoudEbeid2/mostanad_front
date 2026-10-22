import { useRef, useState } from "react";
import { AlertTriangle, EyeOff, Pencil, Sparkles, Trash2, Undo2 } from "lucide-react";
import ProductMatchSelect from "./ProductMatchSelect";

// The invoice lines (plan §13.5; mockup B3). Every cell is editable in place
// (it reads as text until hovered/focused); a dot marks a value that differs
// from what was read from the invoice. The match column shows how the line was
// matched (✓ code / ✓ name / ✓ you), or "needs match" with the suggestions.
const STR = {
  title: "Lines",
  add: "+ Add line",
  line: "#",
  edited: "Edited — read from the invoice as",
  noIso: "Ambiguous date — write it unambiguously (e.g. 2025-04-03 or 04/2025)",
  ambiguousQty: "Ambiguous quantity — thousands or decimal? Write it without the separator (1250) or with a decimal part (1.25)",
  match: "Product match",
  matchedBy: { exact_code: "code", exact_name: "name", user: "you", alias: "remembered", ai_confirmed: "AI" },
  matchedByHint: { alias: "Matched the way this name was confirmed before", ai_confirmed: "Matched by AI and confirmed" },
  aiSuggests: (name, c) => `AI suggests ${name} (${Math.round((c ?? 0) * 100)}%)`,
  confirmAi: "Confirm",
  needsMatch: "needs match",
  change: "Change product",
  ignored: "ignored",
  ignoredHint: "no certificate for this line",
  ignore: "Ignore this line",
  unignore: "Use this line again",
  remove: "Delete this line",
  confirmRemove: (n) => `Delete line ${n}?`,
  empty: "No lines were read from this invoice. Add them by hand.",
};

// One <td> per group; qty/unit share a column (plan §13.5).
const COLUMNS = [
  { label: "Name on invoice", w: "min-w-40", cols: [{ key: "name" }] },
  { label: "Code", w: "w-28", cols: [{ key: "code", mono: true }] },
  { label: "Batch", w: "w-32", cols: [{ key: "batchNo", mono: true }] },
  { label: "Production", w: "w-28", cols: [{ key: "productionDate", date: true }] },
  { label: "Expiry", w: "w-28", cols: [{ key: "expiryDate", date: true }] },
  { label: "Qty", w: "w-32", cols: [{ key: "quantity", number: true }, { key: "unit" }] },
  { label: "Packing", w: "w-28", cols: [{ key: "packing" }] },
];

/** What the user sees and types for a cell: dates are { raw, iso }, quantity keeps its raw text. */
const cellText = (data, col) => {
  const v = data?.[col.key];
  if (col.date) return v?.raw ?? "";
  if (col.number) return data?.quantityRaw ?? (v ?? "") + "";
  return v ?? "";
};

function CellInput({ item, col, label, editable, onSave }) {
  const shown = cellText(item.data, col);
  const [draft, setDraft] = useState(null); // null = not editing
  const cancelled = useRef(false);
  const extracted = cellText(item.dataExtracted, col);
  const edited = Object.keys(item.dataExtracted || {}).length > 0 && shown !== extracted;
  const ambiguousQty = col.number && item.data?.quantityAmbiguous === true;
  const ambiguous = (col.date && shown && !item.data?.[col.key]?.iso) || ambiguousQty;

  const commit = () => {
    const next = (draft ?? shown).trim();
    setDraft(null);
    if (cancelled.current) {
      cancelled.current = false; // Esc reverts
      return;
    }
    if (next !== shown) onSave(col.key, next === "" ? null : next);
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        value={draft ?? shown}
        placeholder={editable ? "—" : ""}
        disabled={!editable}
        data-key={col.key}
        aria-label={`Line ${item.lineNo} · ${label}`}
        onFocus={(e) => {
          setDraft(shown);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        title={edited ? `${STR.edited} "${extracted}"` : ambiguous ? (ambiguousQty ? STR.ambiguousQty : STR.noIso) : undefined}
        className={`w-full px-1.5 py-1 rounded border bg-transparent text-sm text-gray-900 placeholder:text-gray-300 disabled:text-gray-700 ${col.mono ? "font-mono text-xs" : ""} ${
          ambiguous ? "border-amber-400 bg-amber-50" : "border-transparent hover:border-gray-300 focus:border-blue-400 focus:bg-white"
        }`}
      />
      {edited && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" aria-label={STR.edited} />}
    </div>
  );
}

function MatchCell({ scope, item, editable, onMatch, onIgnore }) {
  const [changing, setChanging] = useState(false);
  if (item.matchStatus === "ignored") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold">{STR.ignored}</span>
        <span>{STR.ignoredHint}</span>
        {editable && (
          <button type="button" onClick={() => onIgnore(false)} className="text-blue-600 hover:underline flex items-center gap-1">
            <Undo2 className="w-3.5 h-3.5" /> {STR.unignore}
          </button>
        )}
      </div>
    );
  }
  const matched = item.matchStatus === "matched" && item.product;
  const aiPick = !matched ? (item.matchCandidates || []).find((c) => c.ai) : null;
  const warned = aiPick?.ai?.reasons?.some((r) => r.startsWith("⚠"));
  const select = (
    <div className="flex-1 min-w-52">
      <ProductMatchSelect
        scope={scope}
        item={item}
        disabled={!editable}
        onChange={(id, _opt, extra) => {
          setChanging(false);
          onMatch(id, extra);
        }}
      />
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      {matched ? (
        <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-semibold whitespace-nowrap" title={STR.matchedByHint[item.matchMethod]}>
          ✓ {STR.matchedBy[item.matchMethod] || item.matchMethod}
        </span>
      ) : (
        <span className="rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">{STR.needsMatch}</span>
      )}
      {aiPick && editable && !changing && (
        <span className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${warned ? "bg-amber-50 text-amber-900" : "bg-violet-50 text-violet-900"}`} title={(aiPick.ai.reasons || []).join(" · ")} data-testid="ai-match">
          {warned ? <AlertTriangle className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {STR.aiSuggests(aiPick.name, aiPick.ai.confidence)}
          <button type="button" onClick={() => onMatch(aiPick.productId, { aiSuggestionId: aiPick.ai.suggestionId })} className="ml-1 rounded bg-violet-600 text-white px-2 py-0.5 font-semibold hover:bg-violet-700">
            {STR.confirmAi}
          </button>
        </span>
      )}
      {matched && !changing ? (
        <>
          <span className="text-gray-900" data-testid="matched-product">
            {item.product.name}
          </span>
          {editable && (
            <button type="button" title={STR.change} aria-label={STR.change} onClick={() => setChanging(true)} className="text-gray-400 hover:text-blue-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </>
      ) : (
        select
      )}
      {editable && (
        <button type="button" title={STR.ignore} aria-label={STR.ignore} onClick={() => onIgnore(true)} className="ml-auto text-gray-400 hover:text-gray-700">
          <EyeOff className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function InvoiceItemsTable({ scope, items, editable, onSaveCell, onMatch, onIgnore, onDelete, onAdd }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">
          {STR.title} <span className="text-gray-400 font-normal">· {items.length}</span>
        </h2>
        {editable && (
          <button type="button" onClick={onAdd} className="text-sm font-medium border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            {STR.add}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="invoice-items">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold w-10">{STR.line}</th>
              {COLUMNS.map((c) => (
                <th key={c.label} className="px-2 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="px-2 py-2 font-semibold min-w-80">{STR.match}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="px-4 py-6 text-center text-gray-500">
                  {STR.empty}
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} data-line={item.lineNo} className={item.matchStatus === "needs_match" ? "bg-amber-50/50" : item.matchStatus === "ignored" ? "opacity-60" : ""}>
                <td className="px-3 py-2 text-gray-500 align-middle">{item.lineNo}</td>
                {COLUMNS.map((group) => (
                  <td key={group.label} className={`px-1 py-1.5 align-middle ${group.w}`}>
                    <div className="flex gap-1">
                      {group.cols.map((col) => (
                        <CellInput key={col.key} item={item} col={col} label={col.key === "unit" ? "Unit" : group.label} editable={editable} onSave={(key, value) => onSaveCell(item, key, value)} />
                      ))}
                    </div>
                  </td>
                ))}
                <td className="px-2 py-1.5 align-middle">
                  <MatchCell scope={scope} item={item} editable={editable} onMatch={(productId, extra) => onMatch(item, productId, extra)} onIgnore={(v) => onIgnore(item, v)} />
                </td>
                <td className="px-2 py-1.5 align-middle">
                  {editable && (
                    <button type="button" title={STR.remove} aria-label={`${STR.remove} (line ${item.lineNo})`} onClick={() => window.confirm(STR.confirmRemove(item.lineNo)) && onDelete(item)} className="text-gray-300 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
