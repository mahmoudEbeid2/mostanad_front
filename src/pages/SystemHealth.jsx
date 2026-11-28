// Admin → System health (UI plan, Phase F): every queue with its workers and jobs (GET /health/workers,
// the same check deploy.sh runs) and the design converter (GET /health). The failed tasks' list with
// reasons and a retry needs an endpoint (BACKEND_API_TODO.md).
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import Spinner from "../ui/Spinner";
import ComingSoon from "../ui/ComingSoon";
import apiClient from "../services/apiClient";
import { fmtNum, fmtTime, t } from "../i18n";

export default function SystemHealth() {
  const [state, setState] = useState({ loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const get = (p) => apiClient.get(p).then((r) => r.data).catch((e) => e.response?.data || { status: "error", error: e.message });
    const [workers, api] = await Promise.all([get("/health/workers"), get("/health")]);
    setState({ loading: false, workers, api, at: new Date() });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const queues = Object.entries(state.workers?.queues || {});
  const broken = new Set(state.workers?.broken || []);
  return (
    <ComingSoon title={t("placeholders.health")} subtitle={t("placeholders.healthHint")} what={t("systemHealth.failedSoon")}>
      <div className="flex items-center gap-3">
        {state.loading ? (
          <Spinner />
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${state.workers?.status === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`} data-testid="health-status">
            {state.workers?.status === "ok" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
            {state.workers?.status === "ok" ? t("systemHealth.allGood") : t("systemHealth.degraded", { count: broken.size })}
          </span>
        )}
        {state.api && <span className="text-xs text-gray-600">{state.api.converter?.reachable ? t("systemHealth.converterOk", { ms: fmtNum(state.api.converter.ms) }) : t("systemHealth.converterDown")}</span>}
        <button type="button" onClick={load} className="ms-auto inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("systemHealth.refresh")}
          {state.at && <span className="text-xs text-gray-500">· {fmtTime(state.at)}</span>}
        </button>
      </div>
      {!state.loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm" data-testid="health-queues">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                {[t("systemHealth.queue"), t("systemHealth.workers"), t("systemHealth.waiting"), t("systemHealth.active"), t("systemHealth.failed"), t("systemHealth.delayed")].map((h, i) => (
                  <th key={i} scope="col" className={`px-4 py-2.5 ${i ? "text-end" : "text-start"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queues.map(([key, q]) => (
                <tr key={key} className={broken.has(key) ? "bg-red-50/60" : ""}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-800">{q.queue || key}{q.error && <p className="font-sans text-red-700">{q.error}</p>}</td>
                  {["workers", "waiting", "active", "failed", "delayed"].map((k) => (
                    <td key={k} className={`px-4 py-2 text-end tabular-nums ${k === "workers" && q.workers === 0 ? "font-bold text-red-700" : k === "failed" && q.failed ? "text-red-700" : ""}`}>{q[k] == null ? "—" : fmtNum(q[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ComingSoon>
  );
}
