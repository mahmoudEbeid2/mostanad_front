// Uploads (UI plan, Phase F): the history of file drops — each with its company, the kinds of files in it,
// what came out, and the request it made. The drop zone itself is /intake (and the chat).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UploadCloud, AlertTriangle, RefreshCw, Inbox } from "lucide-react";
import Spinner from "../ui/Spinner";
import { listIntakes, getIntake } from "../services/apiIntake";
import { DOC_TYPES } from "../components/intake/IntakeReview";
import { fmtDateTime, fmtNum, has, pickText, t } from "../i18n";

const DETAILS = 15; // the newest drops are opened for their company / file kinds / request
const STATUS_STYLE = { done: "bg-green-50 text-green-800", review: "bg-amber-50 text-amber-800", failed: "bg-red-50 text-red-700" };

function describe(view) {
  const items = view?.items || [];
  const companies = [...new Set(items.map((i) => i.company?.name).filter(Boolean))];
  const kinds = {};
  for (const i of items) if (i.docType) kinds[i.docType] = (kinds[i.docType] || 0) + 1;
  const request = view?.express?.request?.link || null;
  return { companies, kinds, request, failed: items.filter((i) => i.error).length };
}

export default function Uploads() {
  const [state, setState] = useState({ loading: true, error: null, rows: [], details: {} });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const rows = await listIntakes();
      const pairs = await Promise.all(rows.slice(0, DETAILS).map((b) => getIntake(b.id).then((v) => [b.id, describe(v)]).catch(() => [b.id, null])));
      setState({ loading: false, error: null, rows, details: Object.fromEntries(pairs) });
    } catch (e) {
      setState({ loading: false, error: e.message, rows: [], details: {} });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6" data-testid="uploads-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("uploads.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("uploads.subtitle")}</p>
        </div>
        <Link to="/intake" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700" data-testid="uploads-new">
          <UploadCloud className="h-4 w-4" aria-hidden="true" /> {t("uploads.upload")}
        </Link>
      </div>

      {state.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : state.error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {state.error}
          <button type="button" onClick={load} className="ms-auto inline-flex items-center gap-1 font-semibold underline">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("home.retry")}
          </button>
        </div>
      ) : !state.rows.length ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <Inbox className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
          <p className="mt-2 font-semibold text-gray-800">{t("uploads.empty")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("uploads.emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm" data-testid="uploads-table">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                {[t("uploads.when"), t("uploads.company"), t("uploads.files"), t("uploads.outcome"), ""].map((h, i) => (
                  <th key={i} scope="col" className="px-4 py-3 text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state.rows.map((b) => {
                const d = state.details[b.id];
                const status = has(`uploads.status.${b.status}`) ? t(`uploads.status.${b.status}`) : b.status;
                return (
                  <tr key={b.id} className="align-top hover:bg-gray-50" data-testid="upload-row">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {fmtDateTime(b.createdAt)}
                      <div className="mt-1"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[b.status] || "bg-gray-100 text-gray-700"}`}>{status}</span></div>
                    </td>
                    <td className="px-4 py-3 text-gray-800" dir="auto">{d ? d.companies.join(t("common.listSep")) || "—" : "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{t("uploads.fileCount", { count: b.files })}</p>
                      {d && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(d.kinds).map(([k, n]) => (
                            <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                              {DOC_TYPES[k] || k} · {fmtNum(n)}
                            </span>
                          ))}
                          {d.failed > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700">{t("uploads.failedFiles", { count: d.failed })}</span>}
                        </div>
                      )}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-gray-700">{pickText(b.summary?.text) || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Link to={`/intake/${b.id}`} className="text-sm font-semibold text-blue-700 hover:underline">{t("uploads.open")}</Link>
                        {d?.request && <Link to={d.request} className="text-xs font-medium text-teal-700 hover:underline">{t("uploads.openRequest")}</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
