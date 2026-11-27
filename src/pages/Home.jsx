// Home (UI plan, Phase E): what a company's day is about — shortcuts, what's waiting for the person
// (grouped by request, one action each), requests in progress with their 4-type progress, and what finished
// recently with its ZIP / combined PDF. The admin's numbers live on Admin → Overview.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ClipboardList, Download, FilePlus2, Files, MessageSquareText, UploadCloud, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import TypeProgress from "../components/requests/TypeProgress";
import useCompanyScope from "../hooks/useCompanyScope";
import { useAuth } from "../context/AuthContext";
import { useAssistantStatus } from "../context/AssistantStatusContext";
import { listCertificateRequests, getCertificateRequest } from "../services/apiWorkflow";
import { downloadBatchZip, downloadBatchPdf } from "../services/apiCertificatesV2";
import { waitingFor } from "../utils/requestNeeds";
import { fmtDate, fmtRelative, t } from "../i18n";

const DETAILS = 8; // requests looked into for "waiting for you" (one call each)
const products = (r) => r.products.slice(0, 3).map((p) => (p.pack ? `${p.name} · ${p.pack}` : p.name)).join(t("common.listSep")) + (r.products.length > 3 ? ` ${t("certificateRequests.more", { n: r.products.length - 3 })}` : "");

function Section({ title, count, children, action, testId }) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">
          {title}
          {count > 0 && <span className="ms-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }) => <p className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-6 text-center text-sm text-gray-500">{children}</p>;

export default function Home() {
  const { user } = useAuth();
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const { status: assistant } = useAssistantStatus();
  const [state, setState] = useState({ loading: true, error: null, requests: [], details: {} });

  const load = useCallback(async () => {
    if (!scope) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const list = await listCertificateRequests(scope, { page: 1, pageSize: 50 });
      const requests = list.items || [];
      // the open ones, and the most recent finished ones, are looked into (what's missing; the batch's files)
      const open = requests.filter((r) => r.status !== "ready").slice(0, DETAILS);
      const done = requests.filter((r) => r.status === "ready").slice(0, 5);
      const pairs = await Promise.all([...open, ...done].map((r) => getCertificateRequest(scope, r.id).then((d) => [r.id, d]).catch(() => [r.id, null])));
      setState({ loading: false, error: null, requests, details: Object.fromEntries(pairs) });
    } catch (err) {
      setState({ loading: false, error: err.message, requests: [], details: {} });
    }
  }, [scope]);
  useEffect(() => {
    load();
  }, [load]);

  const dl = async (p) => {
    try {
      await p;
    } catch (e) {
      toast.error(e.message);
    }
  };

  const { requests, details } = state;
  const waiting = requests
    .filter((r) => r.status !== "ready" && details[r.id])
    .map((r) => ({ r, needs: waitingFor(details[r.id]) }))
    .filter((x) => x.needs.length);
  const inProgress = requests.filter((r) => r.status === "in_progress");
  const finished = requests.filter((r) => r.status === "ready").slice(0, 5);

  const shortcuts = [
    { to: `/certificates/requests/new${scopeState.companyId && !scopeState.isCompany ? `?companyId=${scopeState.companyId}` : ""}`, icon: FilePlus2, label: t("home.newRequest"), hint: t("home.newRequestHint"), tone: "bg-teal-600 text-white hover:bg-teal-700" },
    ...(assistant?.enabled ? [{ to: "/assistant", icon: MessageSquareText, label: t("home.askAssistant"), hint: t("home.askAssistantHint"), tone: "bg-white text-gray-900 ring-1 ring-gray-200 hover:bg-gray-50" }] : []),
    { to: "/uploads", icon: UploadCloud, label: t("home.uploadFiles"), hint: t("home.uploadFilesHint"), tone: "bg-white text-gray-900 ring-1 ring-gray-200 hover:bg-gray-50" },
  ];

  return (
    <div className="space-y-8 pb-12" data-testid="home">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("home.title", { name: user?.name || "" })}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("home.subtitle")}</p>
        </div>
        <CompanyPicker scope={scopeState} />
      </div>

      <nav aria-label={t("home.shortcuts")} className="grid gap-3 sm:grid-cols-3" data-testid="home-shortcuts">
        {shortcuts.map((s) => (
          <Link key={s.to} to={s.to} className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-sm transition-colors ${s.tone}`}>
            <s.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-semibold">{s.label}</span>
              <span className="block truncate text-xs opacity-80">{s.hint}</span>
            </span>
          </Link>
        ))}
      </nav>

      {!scope ? (
        <Empty>{t("home.pickCompany")}</Empty>
      ) : state.loading ? (
        <div className="flex justify-center py-12" role="status" aria-label={t("home.loading")}>
          <Spinner />
        </div>
      ) : state.error ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {t("home.loadFailed", { message: state.error })}
          <button type="button" onClick={load} className="ms-auto inline-flex items-center gap-1 font-semibold underline">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("home.retry")}
          </button>
        </div>
      ) : (
        <>
          <Section title={t("home.waiting")} count={waiting.length} testId="home-waiting">
            {waiting.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {waiting.map(({ r, needs }) => (
                  <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm" data-testid="waiting-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900" dir="auto">{r.company?.name || "—"}</p>
                        <p className="truncate text-xs text-gray-500" dir="auto">{products(r)}</p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">{fmtRelative(r.updatedAt)}</span>
                    </div>
                    <ul className="space-y-1 text-sm text-amber-900">
                      {needs.slice(0, 4).map((n, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          {n.text}
                        </li>
                      ))}
                      {needs.length > 4 && <li className="text-xs text-gray-500">{t("certificateRequests.more", { n: needs.length - 4 })}</li>}
                    </ul>
                    <Link to={`/certificates/requests/${r.id}`} className="mt-auto self-start rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">
                      {t(`home.action.${needs[0].kind}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-green-600" aria-hidden="true" />
                {t("home.nothingWaiting")}
              </Empty>
            )}
          </Section>

          <Section title={t("home.inProgress")} count={inProgress.length} testId="home-in-progress" action={<Link to="/certificates/requests" className="text-sm font-medium text-blue-700 hover:underline">{t("home.allRequests")}</Link>}>
            {inProgress.length ? (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      {[t("certificateRequests.company"), t("certificateRequests.products"), t("certificateRequests.progress"), t("home.lastUpdate")].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 text-start">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inProgress.slice(0, 10).map((r) => (
                      <tr key={r.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3" dir="auto">
                          <Link to={`/certificates/requests/${r.id}`} className="font-semibold text-blue-700 hover:underline">{r.company?.name || "—"}</Link>
                          <div className="text-xs text-gray-500">{fmtDate(r.createdAt)}</div>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-gray-700" dir="auto">{products(r)}</td>
                        <td className="px-4 py-3"><TypeProgress codes={r.codes} types={r.types} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{fmtRelative(r.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>
                <ClipboardList className="mx-auto mb-1 h-6 w-6 text-gray-400" aria-hidden="true" />
                {t("home.noneInProgress")}
              </Empty>
            )}
          </Section>

          <Section title={t("home.finished")} count={finished.length} testId="home-finished">
            {finished.length ? (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {finished.map((r) => {
                  const batch = details[r.id]?.batch;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="finished-row">
                      <div className="min-w-0 flex-1">
                        <Link to={`/certificates/requests/${r.id}`} className="font-semibold text-gray-900 hover:underline" dir="auto">{r.company?.name || "—"}</Link>
                        <p className="truncate text-xs text-gray-500" dir="auto">{products(r)} · {fmtDate(r.updatedAt)}</p>
                      </div>
                      {batch?.zip && (
                        <button type="button" onClick={() => dl(downloadBatchZip(scope, batch.id))} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50">
                          <Download className="h-3.5 w-3.5" aria-hidden="true" /> ZIP
                        </button>
                      )}
                      {batch?.combinedPdf && (
                        <button type="button" onClick={() => dl(downloadBatchPdf(scope, batch.id))} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800">
                          <Files className="h-3.5 w-3.5" aria-hidden="true" /> {t("home.combinedPdf")}
                        </button>
                      )}
                      {!batch?.zip && !batch?.combinedPdf && <Link to={`/certificates/requests/${r.id}`} className="text-xs font-semibold text-blue-700 hover:underline">{t("home.open")}</Link>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>{t("home.noneFinished")}</Empty>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
