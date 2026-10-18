import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Archive, FileCheck, Plus } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import StatusBadge from "../components/certificates/StatusBadge";
import AuthImage from "../components/certificates/AuthImage";
import useCompanyScope from "../hooks/useCompanyScope";
import { listCertificateTypes } from "../services/apiCertificateTypes";
import { archiveTemplate, getVersionThumbnail, listTemplates } from "../services/apiCertificateTemplates";

const STR = {
  title: "Certificate templates",
  subtitle: "Designs uploaded once and filled automatically from invoices.",
  upload: "Upload template",
  allTypes: "All types",
  allStatuses: "Any status",
  showArchived: "Show archived",
  noTypes: "Create a certificate type first — every template belongs to one.",
  goTypes: "Go to certificate types",
  empty: "No templates yet. Upload your first certificate design (.ai, .pdf or .html).",
  pickCompany: "Pick a company to see its templates.",
  active: "Active",
  latest: "Latest",
  open: "Open",
  archive: "Archive",
  archived: "Template archived",
  confirmArchive: (n) => `Archive “${n}”? It will no longer be used for new certificates.`,
  perProduct: "Per product",
  perInvoice: "Per invoice",
  anyBrand: "Any brand",
  anyCountry: "Any country",
  prev: "Previous",
  next: "Next",
};

const PAGE_SIZE = 20;

export default function CertificateTemplates() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const [params, setParams] = useSearchParams();
  const certificateTypeId = params.get("certificateTypeId") || "";
  const status = params.get("status") || "";
  const includeArchived = params.get("archived") === "1";
  const page = Number(params.get("page") || 1);

  const [types, setTypes] = useState(null);
  const [data, setData] = useState({ templates: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const [t, list] = await Promise.all([
        listCertificateTypes(scope, { includeInactive: true }),
        listTemplates(scope, { certificateTypeId: certificateTypeId || undefined, status: status || undefined, includeArchived, page, limit: PAGE_SIZE }),
      ]);
      setTypes(t);
      setData(list);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope, certificateTypeId, status, includeArchived, page]);

  useEffect(() => {
    load();
  }, [load]);

  const archive = async (t) => {
    if (!window.confirm(STR.confirmArchive(t.name))) return;
    try {
      await archiveTemplate(scope, t.id);
      toast.success(STR.archived);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{STR.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <CompanyPicker scope={scopeState} />
          {scope && types?.length > 0 && (
            <Link to={`/certificates/templates/new${certificateTypeId ? `?certificateTypeId=${certificateTypeId}` : ""}`}>
              <Button>
                <Plus className="w-4 h-4" /> {STR.upload}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {scope && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select value={certificateTypeId} onChange={(e) => setParam("certificateTypeId", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
            <option value="">{STR.allTypes}</option>
            {(types || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.code})
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setParam("status", e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
            <option value="">{STR.allStatuses}</option>
            {["draft", "ready", "active", "failed", "converting"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-gray-600">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setParam("archived", e.target.checked ? "1" : "")} /> {STR.showArchived}
          </label>
        </div>
      )}

      {!scope ? (
        <p className="text-sm text-gray-500">{STR.pickCompany}</p>
      ) : loading ? (
        <div className="p-10 flex justify-center">
          <Spinner />
        </div>
      ) : types && types.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-gray-600">{STR.noTypes}</p>
          <Link to="/certificates/types" className="text-blue-600 hover:underline text-sm font-medium">
            {STR.goTypes}
          </Link>
        </div>
      ) : data.templates.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center space-y-3">
          <FileCheck className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-sm text-gray-600">{STR.empty}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.templates.map((t) => {
              const latest = t.latestVersion;
              const active = t.activeVersion;
              return (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                  <Link to={latest ? `/certificates/templates/${t.id}/versions/${latest.id}` : "#"} className="block bg-gray-50 border-b border-gray-100">
                    <AuthImage
                      load={() => (latest?.hasThumbnail ? getVersionThumbnail(scope, latest.id) : null)}
                      reloadKey={latest?.id}
                      alt={t.name}
                      className="w-full h-44"
                    />
                  </Link>
                  <div className="p-4 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 leading-tight">{t.name}</h3>
                      {t.archivedAt ? <StatusBadge status="archived" /> : active ? <StatusBadge status="active" /> : latest && <StatusBadge status={latest.status} />}
                    </div>
                    <div className="text-xs text-gray-500 space-x-2">
                      <span className="font-mono">{t.certificateType?.code}</span>
                      <span>·</span>
                      <span>{t.scope === "per_invoice" ? STR.perInvoice : STR.perProduct}</span>
                      <span>·</span>
                      <span>{t.brand?.name || STR.anyBrand}</span>
                      <span>·</span>
                      <span>{t.country || STR.anyCountry}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {active && (
                        <span className="mr-3">
                          {STR.active}: v{active.versionNumber}
                        </span>
                      )}
                      {latest && (
                        <span>
                          {STR.latest}: v{latest.versionNumber} ({latest.status})
                        </span>
                      )}
                    </div>
                    {latest?.status === "failed" && latest.error && <p className="text-xs text-red-600 line-clamp-2">{latest.error}</p>}
                  </div>
                  <div className="px-4 pb-4 flex justify-between items-center">
                    {latest && (
                      <Link to={`/certificates/templates/${t.id}/versions/${latest.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {STR.open}
                      </Link>
                    )}
                    {!t.archivedAt && (
                      <button type="button" onClick={() => archive(t)} className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1">
                        <Archive className="w-3.5 h-3.5" /> {STR.archive}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="flex justify-center items-center gap-3 text-sm">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                {STR.prev}
              </Button>
              <span>
                {page} / {pages}
              </span>
              <Button variant="secondary" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>
                {STR.next}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
