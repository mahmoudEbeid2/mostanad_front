import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { entityRoute, isArabic } from "../../utils/assistantContext";
import { loadMoreRows } from "../../services/apiAssistant";

// A list the assistant got from a tool (design E1 table): the rows come from the
// system, never from the model's text. "Load more" asks the same tool for the
// next page directly — no AI call.

const asText = (v) => (v === null || v === undefined ? "" : String(v));
const csvOf = (block) =>
  [block.columns.map((c) => c.label), ...block.rows.map((r) => block.columns.map((c) => asText(r.cells[c.key])))]
    .map((row) => row.map((v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
    .join("\r\n");
const tsvOf = (block) => [block.columns.map((c) => c.label), ...block.rows.map((r) => block.columns.map((c) => asText(r.cells[c.key]).replace(/[\t\n]/g, " ")))].map((r) => r.join("\t")).join("\n");
/** The last day of an exclusive [from, to) range. */
const dayBefore = (d) => (d ? new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : "…");
const numeric = (block, key) => block.rows.length > 0 && block.rows.every((r) => r.cells[key] === null || /^-?\d+(\.\d+)?$/.test(asText(r.cells[key])));

export default function TableBlock({ block: initial, conversationId, messageId }) {
  const [block, setBlock] = useState(initial);
  const [loading, setLoading] = useState(false);
  const shown = block.rows.length;
  const more = block.nextPage ? Math.max(0, (block.total ?? shown) - shown) : 0;

  const loadMore = async () => {
    setLoading(true);
    try {
      setBlock((await loadMoreRows(conversationId, messageId, block.id)).block);
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tsvOf(block));
      toast.success("Table copied");
    } catch (e) {
      toast.error(`Couldn't copy: ${e.message}`);
    }
  };
  const download = () => {
    const blob = new Blob(["﻿" + csvOf(block)], { type: "text/csv;charset=utf-8" }); // BOM: Excel reads Arabic as UTF-8
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${block.tool || "assistant"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="self-stretch" data-testid="table-block">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {block.columns.map((c) => (
                <th key={c.key} className={`whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-600 ${numeric(block, c.key) ? "text-right" : "text-left"}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>
                {block.columns.map((c, j) => {
                  const v = asText(r.cells[c.key]);
                  const to = j === 0 && r.ref ? entityRoute(r.ref.type, r.ref.id) : null;
                  return (
                    <td key={c.key} dir={isArabic(v) ? "rtl" : undefined} className={`border-b border-gray-100 px-3.5 py-3 ${numeric(block, c.key) ? "text-right tabular-nums" : ""} ${isArabic(v) ? "font-arabic" : ""}`}>
                      {to ? <Link to={to} className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">{v}</Link> : v || <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-gray-500" data-testid="table-count">
          {shown} of {block.total ?? shown}
          {block.timezone && block.from ? ` · ${block.from} – ${dayBefore(block.to)} (${block.timezone})` : ""}
        </span>
        {more > 0 && (
          <button type="button" onClick={loadMore} disabled={loading} data-testid="load-more" className="min-h-8 rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {loading ? "Loading…" : `Load more (${more})`}
          </button>
        )}
        <button type="button" onClick={copy} data-testid="copy-table" className="min-h-8 rounded-xl border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Copy table</button>
        <button type="button" onClick={download} data-testid="download-csv" className="min-h-8 rounded-xl border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Download CSV</button>
      </div>
    </div>
  );
}
