import DateInput from "../ui/DateInput";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ClipboardList, Download, Files, Loader2, Palette, Play, Sparkles } from "lucide-react";
import Button from "../ui/Button";
import { createCertificateRequest, getCertificateRequest, resolveRequestLine, generateRequest, acceptAllEstimates, setRequestIssueDate, addPackVariant } from "../services/apiWorkflow";
import { waitForTask, exportBatchZip, downloadBatchZip, downloadBatchPdf } from "../services/apiCertificatesV2";
import { getCompanies } from "../services/apiCompanies";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser } from "../utils/permissions";
import DesignerPanel from "../components/certificates/DesignerPanel";
import useFollowEntityCompany from "../hooks/useFollowEntityCompany";
import useCompanyScope from "../hooks/useCompanyScope";
import { pickText, t } from "../i18n";

// The client's workflow (Dossira_Certificate_Workflow_EN): a request from pasted names / chosen
// products (no invoice needed), then one row per product × pack (lot) and one cell per certificate:
// بانتظار بيانات → مسودة → في المراجعة → بانتظار الاعتماد → معتمدة → اتسلّمت, with what each needs.

export const STATUS = {
  awaiting_inputs: [t("certificateRequest.waitingForData"), "bg-amber-50 text-amber-900 border-amber-200"],
  draft: [t("certificateRequest.draft"), "bg-gray-50 text-gray-800 border-gray-200"],
  in_review: [t("certificateRequest.inReview"), "bg-blue-50 text-blue-900 border-blue-200"],
  awaiting_authorization: [t("certificateRequest.waitingForApproval"), "bg-violet-50 text-violet-900 border-violet-200"],
  approved: [t("certificateRequest.approved"), "bg-green-50 text-green-900 border-green-200"],
  exported: [t("certificateRequest.delivered"), "bg-emerald-100 text-emerald-900 border-emerald-300"],
};
const CODES = ["COA", "COC", "HC", "FSC"];
const err = (e) => toast.error(e?.response?.data?.message || e.message);

function NewRequest() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const isSystem = !!user && !(isCompanyUser(user) || user?.isCompany);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(params.get("companyId") || "");
  const [text, setText] = useState("");
  const [codes, setCodes] = useState(CODES);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isSystem) getCompanies({ limit: 1000, sort: "name" }).then((r) => setCompanies(r?.data?.companies || [])).catch(() => {});
  }, [isSystem]);
  const create = async () => {
    setBusy(true);
    try {
      const r = await createCertificateRequest(isSystem ? { companyId } : {}, { text, certificateCodes: codes });
      navigate(`/certificates/requests/${r.request.id}${isSystem ? `?companyId=${companyId}` : ""}`);
    } catch (e) {
      err(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <ClipboardList className="h-6 w-6 text-teal-600" />{" "}{t("certificateRequest.newCertificateRequest")}</h1>
      <p className="text-sm text-gray-600">{t("certificateRequest.noInvoicePasteTheProduct")}</p>
      {isSystem && (
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label={t("certificateRequest.company")}>
          <option value="">{t("certificateRequest.pickTheCompany")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} dir="ltr" placeholder={"LIVATOMIC\nHEMOZEX 50 mL"} className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm" aria-label={t("certificateRequest.productNames")} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-700">{t("certificateRequest.certificates")}</span>
        {CODES.map((c) => (
          <button key={c} type="button" aria-pressed={codes.includes(c)} onClick={() => setCodes(codes.includes(c) ? codes.filter((x) => x !== c) : [...codes, c])} className={`rounded-lg border px-3 py-1 ${codes.includes(c) ? "border-teal-600 bg-teal-50 text-teal-800" : "border-gray-300 text-gray-600"}`}>
            {c}
          </button>
        ))}
      </div>
      <Button onClick={create} isLoading={busy} disabled={!text.trim() || !codes.length || (isSystem && !companyId)}>{t("certificateRequest.openTheRequest")}</Button>
    </div>
  );
}

function RequestMatrix({ id }) {
  const [params] = useSearchParams();
  // the request's company becomes the selected one, so its certificate links open in place (Phase 6)
  useFollowEntityCompany(useCompanyScope(), "request", id);
  const scope = params.get("companyId") ? { companyId: params.get("companyId") } : {};
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [designer, setDesigner] = useState(null);
  const load = useCallback(() => getCertificateRequest(scope, id).then(setData).catch(err), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load]);
  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
  const unclear = data.rows.filter((r) => r.match !== "matched");
  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      err(e);
    } finally {
      setBusy(null);
    }
  };
  const generate = () => run("gen", async () => {
    const r = await generateRequest(scope, id);
    await waitForTask(r.taskId, { timeoutMs: 300_000 });
    toast.success(t("certificateRequest.theDraftsWereMade"));
  });
  // «اعتمد كل المستنتج»: every draft of the request — its estimated descriptive values accepted, marks cleared
  const certIds = [...new Set((data?.rows || []).flatMap((r) => Object.values(r.cells || {}).map((c) => c.certificateId).filter(Boolean)))];
  // an experiment sample's AI values are test data — never accepted (QA 28 Nov)
  const samples = (data?.rows || []).some((r) => Object.values(r.cells || {}).some((c) => c.experiment));
  const acceptEstimates = () => run("est", async () => {
    const r = await acceptAllEstimates(scope, { certificateIds: certIds });
    toast.success(r.marksCleared ? t("certificateRequest.estimatedValuesAccepted", { marksCleared: r.marksCleared }) : t("certificateRequest.noEstimatedValuesWaitingFor"));
  });
  const exportAnd = (download) => run(download === downloadBatchZip ? "zip" : "pdf", async () => {
    const { taskId } = await exportBatchZip(scope, data.batch.id);
    await waitForTask(taskId, { timeoutMs: 300_000 });
    await download(scope, data.batch.id);
  });
  return (
    <div className="space-y-4" data-testid="request-matrix">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardList className="h-6 w-6 text-teal-600" />{" "}{t("certificateRequest.certificateRequestProducts", { length: data.rows.length })}</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} isLoading={busy === "gen"} disabled={!!busy || unclear.length > 0} data-testid="request-generate">
            <Play className="h-4 w-4" />{" "}{t("certificateRequest.makeTheCertificates")}</Button>
          {certIds.length > 0 && !samples && (
            <Button variant="secondary" onClick={acceptEstimates} isLoading={busy === "est"} disabled={!!busy} data-testid="request-accept-estimates">
              <Sparkles className="h-4 w-4" />{" "}{t("certificateRequest.acceptAllEstimates")}</Button>
          )}
          {data.batch && (
            <>
              <Button variant="secondary" onClick={() => exportAnd(downloadBatchPdf)} isLoading={busy === "pdf"} disabled={!!busy}>
                <Files className="h-4 w-4" />{" "}{t("certificateRequest.onePdfInTheCustomers")}</Button>
              <Button variant="secondary" onClick={() => exportAnd(downloadBatchZip)} isLoading={busy === "zip"} disabled={!!busy}>
                <Download className="h-4 w-4" />{" "}{t("certificateRequest.zipByTypeManifest")}</Button>
            </>
          )}
        </div>
      </div>
      {/* Phase 3: one issue date for all the request's certificates (empty = the day each is made) */}
      <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700" data-testid="request-issue-date">{t("certificateRequest.issueDateForAllThe")}<DateInput
          value={(data.request.issueDate || "").slice(0, 10)}
          onChange={(v) => run("date", async () => setData(await setRequestIssueDate(scope, id, v || null)))}
          ariaLabel={t("certificateRequest.issueDateForAllThe")}
          testId="request-issue-date-input"
        />
        <span className="text-xs text-gray-500">{data.request.issueDate ? t("certificateRequest.newCertificatesWillTakeThis") : t("certificateRequest.emptyTodaysDate")}</span>
      </label>
      {unclear.length > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{unclear.length}{" "}{t("certificateRequest.linesNeedTheirProductPicked")}</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[56rem] text-end text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">{t("certificateRequest.product")}</th>
              <th className="p-2">{t("certificateRequest.pack")}</th>
              <th className="p-2">{t("certificateRequest.batch")}</th>
              {data.codes.map((c) => (
                <th key={c} className="p-2">
                  {c}
                </th>
              ))}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.rows.map((r) => (
              <tr key={r.lineId} data-testid="request-row">
                <td className="p-2 text-gray-500">{r.lineNo}</td>
                <td className="p-2 font-medium text-gray-900">
                  {/* Phase 4: the asked pack is never lost — a new pack of the same product in one click */}
                  {r.match === "new_pack" && r.candidates.length > 0 && (
                    <div className="mb-1 flex flex-wrap items-center gap-1" data-testid="new-pack">
                      {r.candidates.slice(0, 3).map((c) => (
                        <button key={c.id} type="button" onClick={() => run(r.lineId, () => addPackVariant(scope, id, r.lineId, c.id))} className="rounded-full border border-emerald-400 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100">{t("certificateRequest.addANewPackTo", { packing: r.packing })}{" "}{c.name}{c.packaging ? t("certificateRequest.like", { packaging: c.packaging }) : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {r.match === "matched" ? (
                    r.product
                  ) : (
                    <select defaultValue="" onChange={(e) => e.target.value && run(r.lineId, () => resolveRequestLine(scope, id, r.lineId, e.target.value))} className="rounded border border-amber-400 bg-amber-50 px-1 py-0.5" aria-label={t("certificateRequest.productFor", { asked: r.asked })}>
                      <option value="">«{r.asked}» — {r.match === "new_pack" ? t("certificateRequest.noPackOfItPick", { packing: r.packing }) : t("certificateRequest.pick")}</option>
                      {r.candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.packaging ? ` · ${c.packaging}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="p-2">{r.packing || "—"}</td>
                <td className="p-2" dir="ltr">
                  {r.lot || "—"}
                  {r.lotSize ? ` · ${r.lotSize} ${r.lotUnit || ""}` : ""}
                </td>
                {data.codes.map((c) => {
                  const cell = r.cells[c];
                  const [label, cls] = STATUS[cell.status];
                  return (
                    <td key={c} className="p-1.5 align-top">
                      <div className={`rounded-md border px-1.5 py-1 ${cls}`} data-status={cell.status}>
                        {cell.certificateId ? (
                          <Link to={`/certificates/${cell.certificateId}${scope.companyId ? `?companyId=${scope.companyId}` : ""}`} className="font-semibold hover:underline">
                            {label}
                            {cell.revision > 1 ? t("certificateRequest.revision", { revision: cell.revision }) : ""}
                            {cell.shared ? t("certificateRequest.oneCertificateForProducts", { v: cell.covers || "" }) : ""}
                          </Link>
                        ) : (
                          <span className="font-semibold">{label}</span>
                        )}
                        {(cell.missing || []).map((m, i) => (
                          <p key={i} className="mt-0.5 text-[11px]">
                            {m.link ? <Link to={m.link} className="underline">{pickText(m)}</Link> : pickText(m)}
                          </p>
                        ))}
                        {(cell.comments || []).map((cm, i) => (
                          <p key={`c${i}`} className="mt-0.5 text-[11px] text-red-800">
                            «{cm.field}»: {cm.comment}
                          </p>
                        ))}
                      </div>
                    </td>
                  );
                })}
                <td className="p-2">
                  {r.productId && (
                    <button type="button" onClick={() => setDesigner(r.productId)} className="inline-flex items-center gap-1 text-blue-700 hover:underline" data-testid="open-designer">
                      <Palette className="h-3.5 w-3.5" />{" "}{t("certificateRequest.designerData")}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.outstanding.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-gray-800">{t("certificateRequest.stillMissingForAPartial", { length: data.outstanding.length })}</summary>
          <ul className="mt-1 space-y-0.5">
            {data.outstanding.map((o, i) => (
              <li key={i}>
                {o.lineNo}. {o.product} — {o.code}: {STATUS[o.status]?.[0] || o.status}
                {o.needs.length ? ` (${o.needs.join(t("common.semiSep"))})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      {designer && <DesignerPanel scope={scope} productId={designer} requestId={id} onClose={() => setDesigner(null)} />}
    </div>
  );
}

export default function CertificateRequest() {
  const { id } = useParams();
  return id ? <RequestMatrix id={id} /> : <NewRequest />;
}
