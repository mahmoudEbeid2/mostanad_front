import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, FileUp, FlaskConical, Trash2 } from "lucide-react";
import Spinner from "../../ui/Spinner";
import AiAction from "../../ui/AiAction";
import useTaskProgress from "../../hooks/useTaskProgress";
import { deleteSupplierCoa, getLabResults, saveLabResults, uploadSupplierCoas } from "../../services/apiInvoices";
import { inSpec } from "../../utils/specCheck";

// The results grid (backend item 4): ONE grid per invoice. Rows = batches (every
// line of the same product + batch number) or a line without a batch number;
// columns = the lab results its certificates need. The specification sits next
// to each cell and a value outside it is highlighted. Arrow keys / Enter move
// between cells; a block pasted from Excel fills the cells from the one in focus.
// One save fills every certificate of those batches (the server rechecks by code).
// Supplier COAs / lab reports are read in the background; the server keeps only
// values it found verbatim in the document for the line's batch.
const STR = {
  title: "Lab results",
  hint: "One row per batch. A result typed once is used on every line and every later invoice of the same product and batch.",
  batch: "Batch",
  lines: (r) => `line${r.lines.length > 1 ? "s" : ""} ${r.lines.map((l) => l.lineNo).join(", ")}`,
  askBatch: "Batch number",
  askBatchHint: "Type the line's batch number first, so its results can be reused.",
  noBatch: "This line has no batch number",
  noBatchWarn: "No batch number — results can't be reused",
  spec: "Spec",
  outOfSpec: "Outside the specification",
  save: (n) => `Save ${n} change${n === 1 ? "" : "s"}`,
  saved: "Saved — every certificate of those batches is filled.",
  nothing: "No certificate of this invoice asks for a lab result.",
  upload: "Upload supplier COA / lab report",
  uploadHint: "PDF or images, several at once. Only values printed in the document for the line's batch number are taken.",
  reading: "Reading the supplier COAs…",
  coa: (c) => `${c.fileName || "Supplier COA"} — ${c.status === "done" ? `${c.accepted.length} taken, ${c.rejected.length} refused` : c.status === "failed" ? "couldn't be read" : "reading…"}`,
  scan: "a scan: confirm its values in the data check",
  removeCoa: "Delete this file",
  status: { missing: "missing", needs_confirmation: "confirm", provided: "typed", reused: "reused" },
};

const cellId = (r, c) => `rg-${r}-${c}`;

function CoaList({ coas, editable, onDelete }) {
  if (!coas?.length) return null;
  return (
    <ul className="space-y-1.5" data-testid="coa-list">
      {coas.map((c) => (
        <li key={c.id} className="text-xs rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${c.status === "failed" ? "text-red-700" : "text-gray-800"}`}>{STR.coa(c)}</span>
            {c.textSource === "transcription" && c.accepted.length > 0 && <span className="text-amber-700">· {STR.scan}</span>}
            {editable && c.status !== "extracting" && (
              <button type="button" onClick={() => onDelete(c)} className="ml-auto p-1 text-gray-400 hover:text-red-600" aria-label={STR.removeCoa} title={STR.removeCoa}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {c.error && <p className="mt-1 text-red-700">{c.error}</p>}
          {c.rejected.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-gray-600">Refused</summary>
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-gray-600">
                {c.rejected.map((x, i) => (
                  <li key={i}>
                    {[x.batchNo && `batch ${x.batchNo}`, x.label || x.labelKey, x.value && `“${x.value}”`].filter(Boolean).join(" · ")}: {x.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

/** props: scope, invoiceId, editable, refreshKey (reload when the data check changed), onSaved() */
export default function ResultsGrid({ scope, invoiceId, editable, refreshKey, onSaved }) {
  const [grid, setGrid] = useState(null);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState({}); // rowKey → { labelKey → text }
  const [batches, setBatches] = useState({}); // rowKey → batch number typed for a line without one
  const [noBatchOk, setNoBatchOk] = useState({}); // rowKey → true: "this line has no batch number"
  const [saving, setSaving] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setGrid(await getLabResults(scope, invoiceId));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [scope, invoiceId]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const task = useTaskProgress(taskId, {
    onDone: async (t) => {
      setTaskId(null);
      if (t.status === "failed") toast.error(t.error || "The supplier COA couldn't be read");
      await load();
      onSaved?.();
    },
  });

  const cols = grid?.columns || [];
  const rows = useMemo(() => grid?.rows || [], [grid]);
  const valueOf = (row, c) => drafts[row.rowKey]?.[c.labelKey] ?? row.cells[c.labelKey]?.value ?? "";
  const locked = (row) => row.noBatch && !String(batches[row.rowKey] || "").trim() && !noBatchOk[row.rowKey];
  const changes = useMemo(() => {
    const out = [];
    for (const row of rows) {
      const values = {};
      for (const [k, v] of Object.entries(drafts[row.rowKey] || {})) {
        const was = row.cells[k]?.value ?? "";
        if (v.trim() !== String(was).trim()) values[k] = v.trim() ? v.trim() : null;
      }
      const batchNo = row.noBatch ? String(batches[row.rowKey] || "").trim() : "";
      if (Object.keys(values).length || batchNo) out.push({ rowKey: row.rowKey, ...(batchNo ? { batchNo } : {}), values });
    }
    return out;
  }, [rows, drafts, batches]);
  const changeCount = changes.reduce((a, r) => a + Object.keys(r.values).length + (r.batchNo ? 1 : 0), 0);

  const setCell = (row, c, v) => setDrafts((d) => ({ ...d, [row.rowKey]: { ...(d[row.rowKey] || {}), [c.labelKey]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const g = await saveLabResults(scope, invoiceId, changes);
      setGrid(g);
      setDrafts({});
      setBatches({});
      toast.success(STR.saved);
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const focus = (r, c) => document.getElementById(cellId(r, c))?.focus();
  const onKeyDown = (e, r, c) => {
    const el = e.currentTarget;
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      focus(r + 1, c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focus(r - 1, c);
    } else if (e.key === "ArrowRight" && el.selectionStart === el.value.length) {
      e.preventDefault();
      focus(r, c + 1);
    } else if (e.key === "ArrowLeft" && el.selectionStart === 0) {
      e.preventDefault();
      focus(r, c - 1);
    }
  };
  // a block copied from Excel: tab-separated cells, one line per row, filled from this cell
  const onPaste = (e, r, c) => {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.replace(/\r?\n$/, ""))) return;
    e.preventDefault();
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t"));
    setDrafts((d) => {
      const next = { ...d };
      block.forEach((line, i) => {
        const row = rows[r + i];
        if (!row || locked(row)) return;
        line.forEach((v, j) => {
          const col = cols[c + j];
          if (!col || !row.cells[col.labelKey]) return;
          next[row.rowKey] = { ...(next[row.rowKey] || {}), [col.labelKey]: v.trim() };
        });
      });
      return next;
    });
  };

  const upload = async (files) => {
    if (!files?.length) return;
    try {
      const { taskId: id } = await uploadSupplierCoas(scope, invoiceId, [...files]);
      setTaskId(id);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeCoa = async (c) => {
    try {
      await deleteSupplierCoa(scope, invoiceId, c.id);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (error) {
    return (
      <p className="text-sm text-red-700 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {error}
      </p>
    );
  }
  if (!grid) return null;
  if (!rows.length && !grid.supplierCoas?.length) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-3" data-testid="results-grid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-blue-600" /> {STR.title}
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">{rows.length ? STR.hint : STR.nothing}</p>
        </div>
        {editable && (
          <div className="flex flex-col items-end gap-1">
            <AiAction>
              <label className={`flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 ${taskId ? "opacity-50 pointer-events-none" : "cursor-pointer hover:bg-blue-50"}`} data-testid="coa-upload">
                <FileUp className="w-3.5 h-3.5" /> {STR.upload}
                <input ref={fileRef} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files)} />
              </label>
            </AiAction>
            <span className="text-[11px] text-gray-500 max-w-xs text-right">{STR.uploadHint}</span>
          </div>
        )}
      </div>
      {taskId && (
        <p className="text-xs text-gray-600 flex items-center gap-2">
          <Spinner size="sm" /> {task.message || STR.reading}
        </p>
      )}
      <CoaList coas={grid.supplierCoas} editable={editable} onDelete={removeCoa} />
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-xs text-gray-600">
                <th className="sticky left-0 bg-white px-2 py-2 border-b border-gray-200 min-w-48">{STR.batch}</th>
                {cols.map((c) => (
                  <th key={c.labelKey} className="px-2 py-2 border-b border-gray-200 min-w-36">
                    {c.label}
                    {c.required && <span className="text-red-500"> *</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={row.rowKey} className="align-top" data-testid="results-row">
                  <td className="sticky left-0 bg-white px-2 py-2 border-b border-gray-100">
                    <div className="font-medium text-gray-900">{row.productName || "—"}</div>
                    <div className="text-xs text-gray-500">{STR.lines(row)}</div>
                    {row.noBatch ? (
                      <div className="mt-1 space-y-1">
                        <input
                          value={batches[row.rowKey] || ""}
                          disabled={!editable || noBatchOk[row.rowKey]}
                          onChange={(e) => setBatches((b) => ({ ...b, [row.rowKey]: e.target.value }))}
                          placeholder={STR.askBatch}
                          title={STR.askBatchHint}
                          className="w-full border border-amber-300 rounded-md px-2 py-1 text-xs bg-white disabled:bg-gray-50"
                          data-testid="batch-input"
                        />
                        <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <input type="checkbox" checked={!!noBatchOk[row.rowKey]} disabled={!editable} onChange={(e) => setNoBatchOk((o) => ({ ...o, [row.rowKey]: e.target.checked }))} /> {STR.noBatch}
                        </label>
                        {noBatchOk[row.rowKey] && <p className="text-[11px] text-amber-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {STR.noBatchWarn}</p>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-700">{row.batchNo}</div>
                    )}
                  </td>
                  {cols.map((c, ci) => {
                    const cell = row.cells[c.labelKey];
                    if (!cell) return <td key={c.labelKey} className="px-2 py-2 border-b border-gray-100 text-xs text-gray-300">—</td>;
                    const v = valueOf(row, c);
                    const judged = v ? inSpec(v, cell.spec) : null;
                    const dirty = drafts[row.rowKey]?.[c.labelKey] !== undefined && v !== (cell.value ?? "");
                    return (
                      <td key={c.labelKey} className="px-2 py-2 border-b border-gray-100">
                        <input
                          id={cellId(r, ci)}
                          value={v}
                          disabled={!editable || locked(row)}
                          onChange={(e) => setCell(row, c, e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, r, ci)}
                          onPaste={(e) => onPaste(e, r, ci)}
                          className={`w-full rounded-md px-2 py-1 text-sm border ${judged === false ? "border-red-400 bg-red-50 text-red-800" : cell.status === "missing" && !v ? "border-amber-300 bg-white" : "border-gray-300 bg-white"} ${dirty ? "ring-1 ring-blue-300" : ""} disabled:bg-gray-50`}
                          title={judged === false ? STR.outOfSpec : undefined}
                          data-testid="result-cell"
                        />
                        {cell.spec && <div className={`mt-0.5 text-[11px] ${judged === false ? "text-red-700 font-semibold" : "text-gray-500"}`}>{STR.spec}: {cell.spec}{judged === false ? ` — ${STR.outOfSpec.toLowerCase()}` : ""}</div>}
                        {!dirty && cell.source && <div className="text-[11px] text-emerald-700">{cell.source.text}</div>}
                        {!dirty && cell.status === "needs_confirmation" && <div className="text-[11px] text-orange-700">{STR.status.needs_confirmation}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editable && changeCount > 0 && (
        <div className="flex justify-end">
          <button type="button" disabled={saving} onClick={save} className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 disabled:opacity-50" data-testid="results-save">
            {saving && <Spinner size="sm" />} {STR.save(changeCount)}
          </button>
        </div>
      )}
    </div>
  );
}
