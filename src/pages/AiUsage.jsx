// Admin → AI usage & cost (UI plan, Phase F): calls and cost over a period, per company, feature and model,
// and the costliest operations. GET /ai-costs/summary, /ai-costs/top (the cost ledger).
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Spinner from "../ui/Spinner";
import apiClient from "../services/apiClient";
import { fmtDate, fmtNum, t } from "../i18n";

const usd = (n) => `$${fmtNum(n || 0, { minimumFractionDigits: 2, maximumFractionDigits: n && n < 0.1 ? 4 : 2 })}`;
const firstOfMonth = (back = 0) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - back, 1).toISOString().slice(0, 10);
};
const PERIODS = { month: () => ({ from: firstOfMonth(0) }), last: () => ({ from: firstOfMonth(1), to: firstOfMonth(0) }), d90: () => ({ from: new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10) }) };

function Table({ title, head, rows, testId }) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {!rows.length ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-4 text-sm text-gray-500">{t("aiUsage.none")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>{head.map((h, i) => <th key={i} scope="col" className={`px-4 py-2.5 ${i ? "text-end" : "text-start"}`}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={`px-4 py-2 ${j ? "text-end tabular-nums" : ""}`} dir={j ? undefined : "auto"}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AiUsage() {
  const [period, setPeriod] = useState("month");
  const [state, setState] = useState({ loading: true });
  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      const params = PERIODS[period]();
      const [s, top] = await Promise.all([apiClient.get("/ai-costs/summary", { params }), apiClient.get("/ai-costs/top", { params: { ...params, limit: 15 } })]);
      setState({ loading: false, summary: s.data?.data?.summary, top: top.data?.data?.operations || [] });
    } catch (e) {
      setState({ loading: false, error: e.response?.data?.message || e.message });
    }
  }, [period]);
  useEffect(() => {
    load();
  }, [load]);

  const s = state.summary;
  const cols = [t("aiUsage.calls"), t("aiUsage.tokens"), t("aiUsage.cost")];
  const line = (name, g) => [name || "—", fmtNum(g.attempts), fmtNum((g.inputTokens || 0) + (g.outputTokens || 0) + (g.thinkingTokens || 0)), usd(g.costUsd)];

  return (
    <div className="space-y-6" data-testid="ai-usage-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("placeholders.aiUsage")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("placeholders.aiUsageHint")}</p>
        </div>
        <div className="flex gap-2" role="group" aria-label={t("aiUsage.period")}>
          {Object.keys(PERIODS).map((p) => (
            <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${period === p ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>
              {t(`aiUsage.periods.${p}`)}
            </button>
          ))}
        </div>
      </div>
      {state.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : state.error ? (
        <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> {state.error}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4" data-testid="ai-usage-totals">
            {[
              [t("aiUsage.cost"), usd(s?.totals?.costUsd)],
              [t("aiUsage.calls"), fmtNum(s?.totals?.attempts || 0)],
              [t("aiUsage.failed"), fmtNum(s?.totals?.failedAttempts || 0)],
              [t("aiUsage.unpriced"), fmtNum(s?.totals?.unpricedAttempts || 0)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-medium text-gray-500">{k}</p>
                <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">{t("aiUsage.range", { from: fmtDate(s?.from), to: fmtDate(new Date(new Date(s?.to).getTime() - 1)) })}</p>
          <Table testId="ai-by-company" title={t("aiUsage.byCompany")} head={[t("aiUsage.company"), ...cols]} rows={(s?.byCompany || []).map((g) => line(g.companyName || t("aiUsage.noCompany"), g))} />
          <Table testId="ai-by-feature" title={t("aiUsage.byFeature")} head={[t("aiUsage.feature"), ...cols]} rows={(s?.byFeature || []).map((g) => line(g.feature, g))} />
          <Table testId="ai-by-model" title={t("aiUsage.byModel")} head={[t("aiUsage.model"), ...cols]} rows={(s?.byModel || []).map((g) => line(g.modelId, g))} />
          <Table testId="ai-top" title={t("aiUsage.top")} head={[t("aiUsage.operation"), t("aiUsage.company"), t("aiUsage.calls"), t("aiUsage.cost")]} rows={state.top.map((o) => [o.operationId || o.feature || "—", o.companyName || "—", fmtNum(o.attempts || o.calls || 0), usd(o.costUsd)])} />
        </>
      )}
    </div>
  );
}
