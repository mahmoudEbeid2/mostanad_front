// Certificate numbering per type (UI plan, Phase F — /certificates/numbering). One row per type: the pattern
// with a live preview of the next number, the next number itself, "Restart every month", where the numbering
// came from. GET /companies/:id/numbering, PUT /companies/:id/numbering/:code { pattern, nextNumber, resetMonthly }.
// Saving marks the row "set by a person": documents read later never move it.
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Hash, Save } from "lucide-react";
import apiClient from "../../services/apiClient";
import Spinner from "../../ui/Spinner";
import { fmtNum, t } from "../../i18n";

const pad = (n, w) => String(n).padStart(w, "0");
// the same as the server's formatNumber (docNumbers.js)
export const formatNumber = (pattern, seq, at = new Date()) =>
  String(pattern || "")
    .replace("{YYYY}", String(at.getFullYear()))
    .replace("{YY}", String(at.getFullYear()).slice(-2))
    .replace("{MM}", pad(at.getMonth() + 1, 2))
    .replace(/\{SEQ(\d+)\}/, (_m, w) => pad(seq, Number(w)));
export const monthlyPossible = (pattern) => /\{MM\}/.test(pattern) && /\{YY(?:YY)?\}/.test(pattern);

const SOURCE_STYLE = { detected: "bg-sky-50 text-sky-800", default: "bg-gray-100 text-gray-700", user: "bg-green-50 text-green-800" };

export default function NumberingTable({ scope, companyId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const r = await apiClient.get(`/companies/${companyId}/numbering`, { params: scope });
      setRows(r.data?.data?.schemes || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setRows([]);
    }
  }, [companyId, scope]);
  useEffect(() => {
    load();
  }, [load]);

  const edit = (code, patch) => setEdits((e) => ({ ...e, [code]: { ...e[code], ...patch } }));
  const save = async (row) => {
    const e = { pattern: row.pattern, nextNumber: row.nextNumber, resetMonthly: row.resetMonthly, ...edits[row.certCode] };
    setSaving(row.certCode);
    try {
      const r = await apiClient.put(`/companies/${companyId}/numbering/${row.certCode}`, { pattern: e.pattern, nextNumber: Number(e.nextNumber), resetMonthly: !!e.resetMonthly }, { params: scope });
      setRows(r.data?.data?.schemes || rows);
      setEdits((x) => ({ ...x, [row.certCode]: undefined }));
      toast.success(t("numberingTable.saved", { code: row.certCode }));
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4" data-testid="numbering-table">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-gray-900">
          <Hash className="h-4 w-4 text-gray-500" aria-hidden="true" /> {t("numberingTable.title")}
        </h2>
        <p className="mt-1 text-xs text-gray-500">{t("numberingTable.hint")}</p>
      </div>
      {rows === null ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>
      ) : !rows.length ? (
        <p className="text-sm text-gray-500">{t("numberingTable.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                {[t("numberingTable.type"), t("numberingTable.pattern"), t("numberingTable.nextNumber"), t("numberingTable.monthly"), t("numberingTable.source"), ""].map((h, i) => (
                  <th key={i} scope="col" className="px-2 py-2 text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const e = { pattern: row.pattern, nextNumber: row.nextNumber, resetMonthly: row.resetMonthly, ...edits[row.certCode] };
                const possible = monthlyPossible(e.pattern);
                const valid = /\{SEQ\d+\}/.test(e.pattern) && Number(e.nextNumber) >= 1;
                const changed = !!edits[row.certCode];
                return (
                  <tr key={row.certCode} className="align-top" data-code={row.certCode}>
                    <td className="px-2 py-2 font-semibold text-gray-900">{row.certCode}</td>
                    <td className="px-2 py-2">
                      <input value={e.pattern} onChange={(ev) => edit(row.certCode, { pattern: ev.target.value })} dir="ltr" aria-label={t("numberingTable.patternFor", { code: row.certCode })} className="w-48 rounded-lg border border-gray-300 px-2 py-1 font-mono text-xs" />
                      <p className="mt-1 text-xs text-gray-600" dir="ltr">
                        {t("numberingTable.preview")} <b className="font-mono">{valid ? formatNumber(e.pattern, Number(e.nextNumber)) : "—"}</b>
                      </p>
                      {!/\{SEQ\d+\}/.test(e.pattern) && <p className="mt-0.5 text-xs text-red-700">{t("numberingTable.needsSeq")}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min={1} value={e.nextNumber ?? ""} onChange={(ev) => edit(row.certCode, { nextNumber: ev.target.value })} aria-label={t("numberingTable.nextFor", { code: row.certCode })} className="w-24 rounded-lg border border-gray-300 px-2 py-1 tabular-nums" />
                      <p className="mt-1 max-w-[14rem] text-[11px] text-gray-500">{row.monthly ? t("numberingTable.nextHintMonthly") : t("numberingTable.nextHint")}</p>
                    </td>
                    <td className="px-2 py-2">
                      <label className={`inline-flex items-center gap-2 text-xs ${possible ? "text-gray-700" : "text-gray-400"}`}>
                        <input type="checkbox" checked={possible && !!e.resetMonthly} disabled={!possible} onChange={(ev) => edit(row.certCode, { resetMonthly: ev.target.checked })} />
                        {t("numberingTable.restartMonthly")}
                      </label>
                      {!possible && <p className="mt-1 max-w-[14rem] text-[11px] text-gray-500">{t("numberingTable.monthlyImpossible")}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_STYLE[row.source] || SOURCE_STYLE.default}`}>{t(`numberingTable.sources.${row.source in SOURCE_STYLE ? row.source : "default"}`)}</span>
                      {row.example && <p className="mt-1 text-[11px] text-gray-500" dir="ltr">{t("numberingTable.example", { example: row.example })}</p>}
                      {row.lastSeq > 0 && <p className="mt-0.5 text-[11px] text-gray-500">{t("numberingTable.lastGiven", { n: fmtNum(row.lastSeq) })}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" disabled={!changed || !valid || saving === row.certCode} onClick={() => save(row)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
                        <Save className="h-3.5 w-3.5" aria-hidden="true" /> {t("numberingTable.save")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">{t("numberingTable.historySoon")}</p>
    </section>
  );
}
