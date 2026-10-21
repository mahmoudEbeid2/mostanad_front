import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import FlagBadges from "./FlagBadges";

// A repeating group's rows in the certificate editor (plan §7.8, §11): add,
// remove, reorder, edit. The whole list is the value — the page saves it like
// any other field (PATCH …/values sends every row), so each change is a new
// version and the server re-renders the layout (rows, pitch, what moves).

const STR = {
  rows: (n) => `${n} row${n === 1 ? "" : "s"}`,
  add: "Add row",
  up: "Move row up",
  down: "Move row down",
  remove: "Delete row",
  reset: "Reset the rows to their source",
  source: { product_list: "From the product", invoice_lines: "From the invoice lines", manual: "Typed here" },
  edited: "edited",
  unsaved: "unsaved",
  empty: "No rows.",
  fit: (n) => `Only ${n} row${n === 1 ? "" : "s"} fit above the footer — remove rows or shorten the list. A longer list needs a design with more room (continuation pages aren't supported yet).`,
  capacity: (n) => `Fits up to ${n} rows`,
  cell: (row, label) => `Row ${row} · ${label}`,
};

export default function GroupRowsEditor({ group, value, draftRows, editable, onChange, onRevert, onReset }) {
  const dirty = draftRows !== undefined;
  const rows = dirty ? draftRows : value?.rows || [];
  const flags = dirty ? [] : value?.flags || [];
  const red = flags.some((x) => x === "missing" || x === "overflow");
  const set = (next) => onChange(group.key, next);
  const blank = () => Object.fromEntries(group.cells.map((c) => [c.key, ""]));
  const move = (i, d) => {
    const next = rows.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(next);
  };

  return (
    <div className={`px-4 py-3 space-y-2 ${red ? "bg-red-50/40" : ""}`} data-group-rows={group.key}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          {group.label}
          <span className="text-xs font-medium text-gray-500">· {STR.rows(rows.length)}</span>
          {dirty ? <span className="text-[11px] font-medium text-blue-600">{STR.unsaved}</span> : value?.origin === "manual" ? <span className="text-[11px] font-medium text-gray-500">{STR.edited}</span> : null}
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-800">{STR.source[group.source?.kind] || group.source?.kind}</span>
          {editable && group.source?.kind !== "manual" && (
            <button type="button" title={STR.reset} aria-label={`${STR.reset}: ${group.label}`} onClick={() => onReset(group.key)} className="text-gray-400 hover:text-blue-600" data-reset={group.key}>
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="w-6 font-medium">#</th>
              {group.cells.map((c) => (
                <th key={c.key} className="font-medium px-1">
                  {c.label}
                </th>
              ))}
              {editable && <th className="w-20" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={value?.rowsFit != null && !dirty && i >= value.rowsFit ? "bg-red-50" : ""}>
                <td className="text-xs text-gray-400 tabular-nums">{i + 1}</td>
                {group.cells.map((c) => (
                  <td key={c.key} className="px-1 py-0.5">
                    <input
                      value={row[c.key] ?? ""}
                      disabled={!editable}
                      aria-label={STR.cell(i + 1, c.label)}
                      onChange={(e) => set(rows.map((r, j) => (j === i ? { ...r, [c.key]: e.target.value } : r)))}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          onRevert(group.key);
                        }
                      }}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-700"
                    />
                  </td>
                ))}
                {editable && (
                  <td className="whitespace-nowrap text-right">
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label={`${STR.up} ${i + 1}`}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label={`${STR.down} ${i + 1}`}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => set(rows.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-600" aria-label={`${STR.remove} ${i + 1}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="text-xs text-gray-500 py-1">{STR.empty}</p>}
      </div>
      {editable && (
        <button type="button" onClick={() => set([...rows, blank()])} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline" data-testid={`add-row-${group.key}`}>
          <Plus className="w-3.5 h-3.5" /> {STR.add}
        </button>
      )}
      <FlagBadges flags={flags} />
      {!dirty && flags.includes("overflow") && value?.rowsFit != null && <p className="text-xs text-red-700">{STR.fit(value.rowsFit)}</p>}
      {group.capacity?.min != null && !flags.includes("overflow") && <p className="text-[11px] text-gray-500">{STR.capacity(group.capacity.min)}</p>}
    </div>
  );
}
