import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Archive, FileCheck, Plus, Upload } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import StatusBadge from "../components/certificates/StatusBadge";
import AuthImage from "../components/certificates/AuthImage";
import useCompanyScope from "../hooks/useCompanyScope";
import { listCertificateTypes } from "../services/apiCertificateTypes";
import { archiveTemplate, getVersionThumbnail, listTemplates } from "../services/apiCertificateTemplates";
import { getBrands } from "../services/apiBrands";
import { describeCertificateError } from "../utils/certificateErrors";

// /certificates/templates (plan §13.1; mockup A1): filter card, status pills,
// one card per template with a status-specific next action.
const STR = {
  title: "Certificate templates",
  subtitle: "Upload a design once, mark what changes, and every invoice fills it automatically.",
  upload: "Upload template",
  types: "Certificate types",
  type: "Type",
  allTypes: "All types",
  brand: "Brand",
  allBrands: "All brands",
  all: "All",
  statuses: { active: "Active", ready: "Ready", draft: "Draft", failed: "Failed", converting: "Converting" },
  showArchived: "Show archived",
  noTypes: "Create a certificate type first — every template belongs to one.",
  goTypes: "Go to certificate types",
  empty: "No templates yet. Upload your first certificate design (.ai, .pdf or .html).",
  pickCompany: "Pick a company to see its templates.",
  tileTitle: "Upload a design",
  tileHint: ".ai (PDF compatible), .pdf or .html — up to 60 MB",
  archive: "Archive",
  archived: "Template archived",
  confirmArchive: (n) => `Archive “${n}”? It will no longer be used for new certificates.`,
  perProduct: "Per product",
  perInvoice: "Per invoice",
  anyBrand: "Any brand",
  anyCountry: "All countries",
  prev: "Previous",
  next: "Next",
  // per latest-version status: the card's hint line and its next action
  hint: {
    converting: "Converting the design…",
    uploaded: "Converting the design…",
    draft: "Mark the fields that change, then prepare.",
    preparing: "Checking the fields…",
    ready: "Passed the gate — not active yet",
    active: "Used for every new certificate of this type.",
  },
  action: { converting: "View progress", uploaded: "View progress", draft: "Continue marking", ready: "Activate", failed: "Upload new version" },
  open: "Open",
  // fieldCount / pixelDiffPct of the version that passed the gate (active, else latest ready)
  gate: (n, pct) => [n !== null ? `${n} field${n === 1 ? "" : "s"}` : null, pct !== null ? `round-trip ${pct < 0.001 ? "< 0.001" : pct.toFixed(3)} %` : null].filter(Boolean).join(" · "),
};

const HINT_TONE = { draft: "text-amber-800", ready: "text-emerald-700", failed: "text-red-700" };
const PAGE_SIZE = 20;
const field = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600";
const select = "min-h-10 border border-gray-300 rounded-lg px-3 bg-white text-sm font-normal text-gray-800";
const pill = "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700";

function TemplateCard({ t, scope, onArchive }) {
  const latest = t.latestVersion;
  const active = t.activeVersion;
  const status = latest?.status;
  const href = latest ? `/certificates/templates/${t.id}/versions/${latest.id}${status === "ready" ? "?step=activate" : ""}` : null;
  const gate = STR.gate(t.fieldCount ?? null, t.pixelDiffPct ?? null);
  // mockup A1: an active card shows its numbers in place of the hint
  const hint = status === "failed" ? describeCertificateError(latest.error) : active && gate ? null : STR.hint[status];
  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" data-testid="template-card">
      <Link to={href || "#"} aria-label={t.name} tabIndex={-1} className="block h-44 bg-gray-100 border-b border-gray-200">
        <AuthImage load={() => (latest?.hasThumbnail ? getVersionThumbnail(scope, latest.id) : null)} reloadKey={latest?.id} alt={t.name} className="w-full h-44" />
      </Link>
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[15px] font-semibold leading-snug text-gray-900">{t.name}</h2>
          {t.archivedAt ? <StatusBadge status="archived" /> : active ? <StatusBadge status="active" /> : <StatusBadge status={status} />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {t.certificateType?.code && <span className={`${pill} font-mono`}>{t.certificateType.code}</span>}
          <span className={pill}>{t.brand?.name || STR.anyBrand}</span>
          <span className={pill}>{t.country || STR.anyCountry}</span>
          <span className={pill}>{t.scope === "per_invoice" ? STR.perInvoice : STR.perProduct}</span>
        </div>
        {hint && <p className={`text-[13px] line-clamp-2 ${HINT_TONE[status] || "text-gray-600"}`}>{hint}</p>}
        {gate && (active || status === "ready") && (
          <p className="text-[13px] text-gray-600" data-testid="template-gate">
            {gate}
          </p>
        )}
        <div className="mt-auto pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 text-[13px]">
          <span className="text-gray-500 truncate">
            {(t.versions || [])
              .slice(0, 3)
              .map((v) => `v${v.versionNumber} ${v.status}`)
              .join(" · ")}
          </span>
          <span className="flex items-center gap-3 shrink-0">
            {!t.archivedAt && (
              <button type="button" onClick={() => onArchive(t)} className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1">
                <Archive className="w-3.5 h-3.5" /> {STR.archive}
              </button>
            )}
            {href && (
              <Link to={href} className="font-semibold text-blue-600 hover:underline">
                {(!active && STR.action[status]) || STR.open}
              </Link>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function CertificateTemplates() {
  const scopeState = useCompanyScope();
  const { scope, companyId } = scopeState;
  const [params, setParams] = useSearchParams();
  const certificateTypeId = params.get("certificateTypeId") || "";
  const brandId = params.get("brandId") || "";
  const status = params.get("status") || "";
  const includeArchived = params.get("archived") === "1";
  const page = Number(params.get("page") || 1);

  const [types, setTypes] = useState(null);
  const [brands, setBrands] = useState([]);
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
        listTemplates(scope, {
          certificateTypeId: certificateTypeId || undefined,
          brandId: brandId || undefined,
          status: status || undefined,
          includeArchived,
          page,
          limit: PAGE_SIZE,
        }),
      ]);
      setTypes(t);
      setData(list);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope, certificateTypeId, brandId, status, includeArchived, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    getBrands(companyId)
      .then((res) => setBrands(res?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId]);

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
  const canUpload = scope && types?.length > 0;
  const newHref = `/certificates/templates/new${certificateTypeId ? `?certificateTypeId=${certificateTypeId}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{STR.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/certificates/types">
            <Button variant="secondary">{STR.types}</Button>
          </Link>
          {canUpload && (
            <Link to={newHref}>
              <Button>
                <Plus className="w-4 h-4" /> {STR.upload}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <RoleBanner scope={scopeState} />

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
        <CompanyPicker scope={scopeState} variant="field" yours={false} compact className="min-w-52" />
        {scope && (
          <>
            <label className={field}>
              {STR.type}
              <select value={certificateTypeId} onChange={(e) => setParam("certificateTypeId", e.target.value)} className={`${select} min-w-44`}>
                <option value="">{STR.allTypes}</option>
                {(types || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              {STR.brand}
              <select value={brandId} onChange={(e) => setParam("brandId", e.target.value)} className={`${select} min-w-40`}>
                <option value="">{STR.allBrands}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {["", ...Object.keys(STR.statuses)].map((s) => {
                const on = s === status;
                return (
                  <button
                    key={s || "all"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setParam("status", s)}
                    className={`min-h-8 rounded-full border px-3 text-xs font-semibold ${on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                  >
                    {s ? STR.statuses[s] : STR.all}
                    {on && !loading ? ` · ${data.total}` : ""}
                  </button>
                );
              })}
              <label className="flex items-center gap-2 text-xs text-gray-600 ml-2">
                <input type="checkbox" checked={includeArchived} onChange={(e) => setParam("archived", e.target.checked ? "1" : "")} /> {STR.showArchived}
              </label>
            </div>
          </>
        )}
      </div>

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
      ) : data.templates.length === 0 && !canUpload ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center space-y-3">
          <FileCheck className="w-10 h-10 mx-auto text-gray-300" />
          <p className="text-sm text-gray-600">{STR.empty}</p>
        </div>
      ) : (
        <>
          {data.templates.length === 0 && <p className="text-sm text-gray-600">{STR.empty}</p>}
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
            {data.templates.map((t) => (
              <TemplateCard key={t.id} t={t} scope={scope} onArchive={archive} />
            ))}
            {canUpload && (
              <Link
                to={newHref}
                className="min-h-72 rounded-xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-2.5 p-6 text-center text-gray-600 hover:border-blue-400 hover:bg-blue-50/40"
              >
                <span className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-600" />
                </span>
                <span className="font-semibold text-gray-900">{STR.tileTitle}</span>
                <span className="text-[13px]">{STR.tileHint}</span>
              </Link>
            )}
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
