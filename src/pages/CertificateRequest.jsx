import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ClipboardList, Download, Files, Loader2, Palette, Play, Sparkles } from "lucide-react";
import Button from "../ui/Button";
import { createCertificateRequest, getCertificateRequest, resolveRequestLine, generateRequest, acceptAllEstimates } from "../services/apiWorkflow";
import { waitForTask, exportBatchZip, downloadBatchZip, downloadBatchPdf } from "../services/apiCertificatesV2";
import { getCompanies } from "../services/apiCompanies";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser } from "../utils/permissions";
import DesignerPanel from "../components/certificates/DesignerPanel";

// The client's workflow (Dossira_Certificate_Workflow_EN): a request from pasted names / chosen
// products (no invoice needed), then one row per product × pack (lot) and one cell per certificate:
// بانتظار بيانات → مسودة → في المراجعة → بانتظار الاعتماد → معتمدة → اتسلّمت, with what each needs.

export const STATUS = {
  awaiting_inputs: ["بانتظار بيانات", "bg-amber-50 text-amber-900 border-amber-200"],
  draft: ["مسودة", "bg-gray-50 text-gray-800 border-gray-200"],
  in_review: ["في المراجعة", "bg-blue-50 text-blue-900 border-blue-200"],
  awaiting_authorization: ["بانتظار الاعتماد", "bg-violet-50 text-violet-900 border-violet-200"],
  approved: ["معتمدة", "bg-green-50 text-green-900 border-green-200"],
  exported: ["اتسلّمت", "bg-emerald-100 text-emerald-900 border-emerald-300"],
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
    <div dir="rtl" className="mx-auto max-w-2xl space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <ClipboardList className="h-6 w-6 text-teal-600" /> طلب شهادات جديد
      </h1>
      <p className="text-sm text-gray-600">من غير فاتورة: الصق أسماء المنتجات (سطر لكل منتج، بالترتيب اللي العميل طلبه). اللي مش واضح هنسألك عليه.</p>
      {isSystem && (
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label="الشركة">
          <option value="">اختار الشركة…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} dir="ltr" placeholder={"LIVATOMIC\nHEMOZEX 50 mL"} className="w-full rounded-lg border border-gray-300 p-3 font-mono text-sm" aria-label="أسماء المنتجات" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-700">الشهادات:</span>
        {CODES.map((c) => (
          <button key={c} type="button" aria-pressed={codes.includes(c)} onClick={() => setCodes(codes.includes(c) ? codes.filter((x) => x !== c) : [...codes, c])} className={`rounded-lg border px-3 py-1 ${codes.includes(c) ? "border-teal-600 bg-teal-50 text-teal-800" : "border-gray-300 text-gray-600"}`}>
            {c}
          </button>
        ))}
      </div>
      <Button onClick={create} isLoading={busy} disabled={!text.trim() || !codes.length || (isSystem && !companyId)}>
        افتح الطلب
      </Button>
    </div>
  );
}

function RequestMatrix({ id }) {
  const [params] = useSearchParams();
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
    toast.success("اتعملت المسودات");
  });
  // «اعتمد كل المستنتج»: every draft of the request — its estimated descriptive values accepted, marks cleared
  const certIds = [...new Set((data?.rows || []).flatMap((r) => Object.values(r.cells || {}).map((c) => c.certificateId).filter(Boolean)))];
  const acceptEstimates = () => run("est", async () => {
    const r = await acceptAllEstimates(scope, { certificateIds: certIds });
    toast.success(r.marksCleared ? `اتعمد ${r.marksCleared} قيمة مستنتجة` : "مفيش قيم مستنتجة مستنية اعتماد");
  });
  const exportAnd = (download) => run(download === downloadBatchZip ? "zip" : "pdf", async () => {
    const { taskId } = await exportBatchZip(scope, data.batch.id);
    await waitForTask(taskId, { timeoutMs: 300_000 });
    await download(scope, data.batch.id);
  });
  return (
    <div dir="rtl" className="space-y-4" data-testid="request-matrix">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ClipboardList className="h-6 w-6 text-teal-600" /> طلب شهادات · {data.rows.length} منتج
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} isLoading={busy === "gen"} disabled={!!busy || unclear.length > 0} data-testid="request-generate">
            <Play className="h-4 w-4" /> طلّع الشهادات
          </Button>
          {certIds.length > 0 && (
            <Button variant="secondary" onClick={acceptEstimates} isLoading={busy === "est"} disabled={!!busy} data-testid="request-accept-estimates">
              <Sparkles className="h-4 w-4" /> اعتمد كل المستنتج
            </Button>
          )}
          {data.batch && (
            <>
              <Button variant="secondary" onClick={() => exportAnd(downloadBatchPdf)} isLoading={busy === "pdf"} disabled={!!busy}>
                <Files className="h-4 w-4" /> PDF واحد بترتيب العميل
              </Button>
              <Button variant="secondary" onClick={() => exportAnd(downloadBatchZip)} isLoading={busy === "zip"} disabled={!!busy}>
                <Download className="h-4 w-4" /> ZIP حسب النوع + المانيفست
              </Button>
            </>
          )}
        </div>
      </div>
      {unclear.length > 0 && <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{unclear.length} سطر محتاج تختار المنتج بتاعه قبل ما نطلّع الشهادات.</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[56rem] text-right text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">المنتج</th>
              <th className="p-2">العبوة</th>
              <th className="p-2">التشغيلة</th>
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
                  {r.match === "matched" ? (
                    r.product
                  ) : (
                    <select defaultValue="" onChange={(e) => e.target.value && run(r.lineId, () => resolveRequestLine(scope, id, r.lineId, e.target.value))} className="rounded border border-amber-400 bg-amber-50 px-1 py-0.5" aria-label={`المنتج لـ ${r.asked}`}>
                      <option value="">«{r.asked}» — اختار…</option>
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
                            {cell.revision > 1 ? ` · نسخة ${cell.revision}` : ""}
                            {cell.shared ? " · مشتركة" : ""}
                          </Link>
                        ) : (
                          <span className="font-semibold">{label}</span>
                        )}
                        {(cell.missing || []).map((m, i) => (
                          <p key={i} className="mt-0.5 text-[11px]">
                            {m.link ? <Link to={m.link} className="underline">{m.ar}</Link> : m.ar}
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
                      <Palette className="h-3.5 w-3.5" /> بيانات المصمم
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.outstanding.length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white p-2 text-xs">
          <summary className="cursor-pointer font-semibold text-gray-800">لسه ناقص {data.outstanding.length} (للتسليم الجزئي)</summary>
          <ul className="mt-1 space-y-0.5">
            {data.outstanding.map((o, i) => (
              <li key={i}>
                {o.lineNo}. {o.product} — {o.code}: {STATUS[o.status]?.[0] || o.status}
                {o.needs.length ? ` (${o.needs.join("؛ ")})` : ""}
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
