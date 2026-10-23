import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FileText, UploadCloud } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import StatusBadge from "../components/certificates/StatusBadge";
import useCompanyScope from "../hooks/useCompanyScope";
import useTaskProgress from "../hooks/useTaskProgress";
import { useAuth } from "../context/AuthContext";
import { useAiStatus } from "../context/AiStatusContext";
import { hasPermission } from "../utils/permissions";
import { getBrands } from "../services/apiBrands";
import { listCatalogues, uploadCatalogue } from "../services/apiCatalogues";

// /catalogues (backend plan.md §15.2): a company's manufacturer catalogues, kept
// as source documents. A system user with manage_catalogues uploads one FOR a
// company; code splits it into product blocks. The legacy "Catalog Upload" page
// keeps working until this flow replaces it (§15.8).
const STR = {
  title: "Catalogues",
  subtitle: "Manufacturer catalogues kept as source documents — every product value can be traced to its page.",
  upload: "Upload a catalogue",
  uploadHint: "PDF with live text, up to 60 MB. The file is kept; nothing changes in your products until you review and apply it.",
  manufacturer: "Manufacturer",
  manufacturerHint: "defaults to the brand, else the file name",
  brand: "Brand",
  noBrand: "No brand",
  label: "Edition",
  labelHint: "e.g. 2025–2026",
  file: "Catalogue PDF",
  send: "Upload",
  pickCompany: "Pick a company to see its catalogues.",
  empty: "No catalogue yet for this company.",
  cols: ["Edition", "Uploaded", "Pages", "Blocks", "Status", ""],
  open: "Open",
  segmenting: "Finding product blocks…",
  done: (r) => `${r?.productBlocks ?? 0} product blocks found on ${r?.pages ?? 0} pages`,
  noAiHint: "AI is unavailable: the catalogue is split into product blocks only — you type each product's values from its page in the review.",
};

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function UploadPanel({ scopeState, onUploaded }) {
  const { companyId } = scopeState;
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState({ manufacturer: "", brandId: "", label: "" });
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState(null);
  const task = useTaskProgress(jobId, { onDone: () => onUploaded() });
  const { available: aiAvailable } = useAiStatus();

  useEffect(() => {
    if (!companyId) return;
    getBrands(companyId)
      .then((res) => setBrands(res?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!file || !companyId) return;
    setSending(true);
    try {
      const res = await uploadCatalogue({ companyId, file, ...form, extract: aiAvailable });
      setJobId(res.jobId);
      setFile(null);
      onUploaded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const field = "border border-gray-300 rounded-lg px-3 min-h-11 bg-white text-sm w-full";
  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4" data-testid="catalogue-upload">
      <div>
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-gray-500" /> {STR.upload}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{STR.uploadHint}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CompanyPicker scope={scopeState} variant="field" yours={false} labelClassName="text-sm font-semibold text-gray-800" />
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800">
          <span>{STR.brand}</span>
          <select className={field} value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
            <option value="">{STR.noBrand}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800">
          <span>
            {STR.manufacturer} <span className="font-normal text-gray-500">· {STR.manufacturerHint}</span>
          </span>
          <input className={field} value={form.manufacturer} maxLength={120} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800">
          <span>
            {STR.label} <span className="font-normal text-gray-500">· {STR.labelHint}</span>
          </span>
          <input className={field} value={form.label} maxLength={80} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-800 md:col-span-2">
          <span>{STR.file}</span>
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm font-normal" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={!file || !companyId} isLoading={sending}>
          {STR.send}
        </Button>
        {jobId && !task.done && (
          <span className="text-sm text-gray-600 flex items-center gap-2">
            <Spinner /> {task.message || STR.segmenting}
          </span>
        )}
        {jobId && task.status === "completed" && <span className="text-sm text-emerald-700">{STR.done(task.result)}</span>}
        {jobId && task.status === "failed" && <span className="text-sm text-red-700">{task.error}</span>}
      </div>
      {!aiAvailable && <p className="text-xs text-amber-800" data-testid="catalogue-no-ai">{STR.noAiHint}</p>}
    </form>
  );
}

export default function Catalogues() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const { user } = useAuth();
  const canManage = hasPermission(user, "manage_catalogues");
  const [catalogues, setCatalogues] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      setCatalogues(await listCatalogues(scope));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{STR.subtitle}</p>
        </div>
        {!(scope && canManage) && <CompanyPicker scope={scopeState} />}
      </div>

      {!scope ? (
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      ) : (
        <>
          {canManage && <UploadPanel scopeState={scopeState} onUploaded={load} />}
          {loading ? (
            <div className="p-10 flex justify-center">
              <Spinner />
            </div>
          ) : catalogues.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-600 bg-white border border-gray-200 rounded-xl">{STR.empty}</p>
          ) : (
            catalogues.map((c) => (
              <section key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="catalogue">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <h2 className="font-semibold text-gray-900">{c.manufacturer}</h2>
                  {c.brand && <span className="text-xs text-gray-500">{c.brand.name}</span>}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      {STR.cols.map((h, i) => (
                        <th key={i} className="px-4 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {c.versions.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{v.label}</td>
                        <td className="px-4 py-3 text-gray-700">{fmtDate(v.createdAt)}</td>
                        <td className="px-4 py-3 text-gray-700">{v.pages || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">{v._count?.blocks || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={v.status} />
                          {v.error && <p className="text-xs text-red-700 mt-1">{v.error}</p>}
                          {(v.warnings || []).map((w, i) => (
                            <p key={i} className="text-xs text-amber-800 mt-1">
                              {w.message}
                            </p>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link to={`/catalogues/versions/${v.id}`} className="font-medium text-blue-600 hover:underline whitespace-nowrap">
                            {STR.open}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
