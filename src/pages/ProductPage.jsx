// A product as a full page (UI plan, Phase F — it was a small modal): Overview · Composition · Packs ·
// Data from files · Certificates · Labels. Packs are the same product in other packagings (one product,
// several packs — never shown as a "copy").
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Pencil, Package } from "lucide-react";
import Spinner from "../ui/Spinner";
import ProductHarvestSection from "../components/certificates/ProductHarvestSection";
import { getProductById, getProducts } from "../services/apiProducts";
import { listCertificates } from "../services/apiCertificatesV2";
import { getAllLabels } from "../services/apiGeneratedLabels";
import { countryName, fmtDate, t } from "../i18n";

const TABS = ["overview", "composition", "packs", "files", "certificates", "labels"];
const show = (v) => (Array.isArray(v) ? v.filter(Boolean).join(t("common.listSep")) : v) || "—";
const pill = "rounded-full px-2 py-0.5 text-xs font-semibold";

function Field({ label, value }) {
  return (
    <div className="grid grid-cols-[minmax(9rem,max-content)_1fr] gap-3 py-2 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="m-0 whitespace-pre-line text-gray-900" dir="auto">{show(value)}</dd>
    </div>
  );
}

function Loading() {
  return <div className="flex justify-center py-10"><Spinner /></div>;
}

export default function ProductPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview";
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [extra, setExtra] = useState({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getProductById(id);
      setProduct(res?.data?.product || null);
      if (!res?.data?.product) setError(t("productPage.notFound"));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const scope = product?.companyId ? { companyId: product.companyId } : {};
  // each tab's data, loaded when the tab is first opened
  useEffect(() => {
    if (!product || extra[tab] !== undefined) return;
    const set = (v) => setExtra((x) => ({ ...x, [tab]: v }));
    if (tab === "packs")
      getProducts({ search: product.name, companyId: product.companyId, limit: 50 })
        .then((r) => set((r?.data?.products || []).filter((p) => p.name?.trim().toLowerCase() === product.name.trim().toLowerCase())))
        .catch(() => set([]));
    else if (tab === "certificates")
      listCertificates(scope, { q: product.name, limit: 50 })
        .then((r) => set((r.certificates || []).filter((c) => c.product?.id === product.id || c.product?.name === product.name)))
        .catch(() => set([]));
    else if (tab === "labels") getAllLabels({ productId: product.id, limit: 50 }).then((r) => set(r.labels || [])).catch(() => set([]));
  }, [tab, product]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTab = (k) => setParams(k === "overview" ? {} : { tab: k }, { replace: true });

  if (error) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>;
  if (!product) return <Loading />;

  return (
    <div className="space-y-6" data-testid="product-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/products" className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("productPage.back")}
          </Link>
          <h1 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-bold text-gray-900" dir="auto">
            <Package className="h-6 w-6 text-gray-400" aria-hidden="true" />
            {product.name}
            {product.packaging && <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-base font-semibold text-gray-700">{product.packaging}</span>}
          </h1>
          <p className="mt-1 text-sm text-gray-500" dir="auto">{[product.company?.name, product.brand?.name, product.category?.name].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <Link to={`/products?edit=${product.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
          <Pencil className="h-4 w-4" aria-hidden="true" /> {t("productPage.edit")}
        </Link>
      </div>

      <div role="tablist" aria-label={t("productPage.sections")} className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`product-tab-${k}`} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
            {t(`productPage.tabs.${k}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "overview" && (
          <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white px-4">
            <Field label={t("products.gtinBarcodeCode")} value={product.gtin || product.productCode} />
            <Field label={t("products.physicalForm")} value={product.physicalForm} />
            <Field label={t("products.packaging")} value={product.packaging} />
            <Field label={t("products.appearance")} value={product.appearance} />
            <Field label={t("products.targetSpecies")} value={product.targetSpecies} />
            <Field label={t("products.indications")} value={product.indications} />
            <Field label={t("products.dosage")} value={product.dosage} />
            <Field label={t("products.withdrawalPeriod")} value={product.withdrawalPeriod} />
            <Field label={t("products.storage")} value={product.storage} />
            <Field label={t("products.regNumber")} value={product.registrationNumber} />
            <Field label={t("products.originCountry")} value={product.origin} />
            <Field label={t("products.producer")} value={product.producer} />
            <Field label={t("products.description")} value={product.description} />
          </dl>
        )}

        {tab === "composition" &&
          (product.activeIngredients?.length ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm" data-testid="product-composition">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr><th scope="col" className="px-4 py-2.5 text-start">{t("productPage.ingredient")}</th><th scope="col" className="px-4 py-2.5 text-start">{t("productPage.amount")}</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {product.activeIngredients.map((i, k) => (
                    <tr key={k}><td className="px-4 py-2" dir="auto">{i.name}</td><td className="px-4 py-2" dir="auto">{i.amountRaw || i.concentration || [i.amount, i.unit].filter(Boolean).join(" ") || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">{t("productPage.noComposition")}</p>
          ))}

        {tab === "packs" &&
          (extra.packs === undefined ? <Loading /> : (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" data-testid="product-packs">
              {extra.packs.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="font-semibold text-gray-900">{p.packaging || t("productPage.noPack")}</span>
                  {p.id === product.id ? <span className={`${pill} bg-blue-50 text-blue-700`}>{t("productPage.thisPack")}</span> : <Link to={`/products/${p.id}`} className="text-blue-700 hover:underline">{t("productPage.open")}</Link>}
                  <span className="ms-auto text-xs text-gray-500">{p.gtin || p.productCode || ""}</span>
                </li>
              ))}
              {!extra.packs.length && <li className="px-4 py-4 text-sm text-gray-500">{t("productPage.onlyPack")}</li>}
            </ul>
          ))}

        {tab === "files" && <ProductHarvestSection scope={scope} productId={product.id} onChanged={load} />}

        {tab === "certificates" &&
          (extra.certificates === undefined ? <Loading /> : extra.certificates.length ? (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" data-testid="product-certificates">
              {extra.certificates.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <Link to={`/certificates/${c.id}`} className="font-semibold text-blue-700 hover:underline">{c.certificateType?.code || "—"}</Link>
                  <span className="text-gray-700" dir="auto">{c.batchNo || ""}</span>
                  <span className={`${pill} bg-gray-100 text-gray-700`}>{t(`productPage.status.${["draft", "final", "failed"].includes(c.status) ? c.status : "draft"}`)}</span>
                  <span className="ms-auto text-xs text-gray-500">{fmtDate(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">{t("productPage.noCertificates")}</p>
          ))}

        {tab === "labels" &&
          (extra.labels === undefined ? <Loading /> : extra.labels.length ? (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white" data-testid="product-labels">
              {extra.labels.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <Link to={`/labels/detail/${l.id}`} className="font-semibold text-blue-700 hover:underline">{l.targetCountry && l.targetCountry !== "XX" ? countryName(l.targetCountry) : "—"}</Link>
                  <span className="text-gray-600">{l.language || ""}</span>
                  <span className="ms-auto text-xs text-gray-500">{fmtDate(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">{t("productPage.noLabels")}</p>
          ))}
      </div>
    </div>
  );
}
