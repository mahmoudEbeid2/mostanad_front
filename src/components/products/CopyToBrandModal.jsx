import { useEffect, useMemo, useState } from "react";
import { X, Copy, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { getBrands } from "../../services/apiBrands";
import { getCopyFields, copyProduct, copyProductsBulk } from "../../services/apiProducts";
import { t } from "../../i18n";

// "Copy to another brand" (backend productCopyService): one product, or several
// from the products list. The checklist is the backend's field groups; the
// registration number is never offered — each product needs its own.
// A company user copies within its company (another of its brands); a system
// user may pick another company first.

const Modal = ({ title, onClose, children, footer, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
    <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} flex flex-col max-h-[90vh]`}>
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Copy className="w-5 h-5 text-teal-600" />
          {title}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t("copyToBrandModal.close")}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 py-5 overflow-y-auto space-y-5">{children}</div>
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">{footer}</div>
    </div>
  </div>
);

const fieldLabel = (f) => f.replace(/Id$/, "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/**
 * products: [{ id, name, productCode, companyId, brandId, brand }] — one → single copy, several → bulk table.
 * companies: the company list (system users only). onDone(result): single → { product }, bulk → { results }.
 */
export default function CopyToBrandModal({ products, isSystem, companies = [], onClose, onDone }) {
  const bulk = products.length > 1;
  const first = products[0];
  const [groups, setGroups] = useState(null);
  const [ticked, setTicked] = useState(new Set());
  const [companyId, setCompanyId] = useState(first?.companyId || "");
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState("");
  const [names, setNames] = useState(() => Object.fromEntries(products.map((p) => [p.id, { name: p.name, productCode: "" }])));
  const [keepLinked, setKeepLinked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCopyFields()
      .then((d) => {
        setGroups(d.groups);
        setTicked(new Set(d.groups.map((g) => g.key)));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!companyId) return;
    setBrandId("");
    getBrands(companyId)
      .then((r) => setBrands(r?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId]);

  // the products' own brand is not a target when every product is in it
  const brandOptions = useMemo(() => brands.filter((b) => !(products.every((p) => p.brandId === b.id) && companyId === first?.companyId)), [brands, products, companyId, first]);
  const allTicked = groups && ticked.size === groups.length;
  const fieldsToCopy = allTicked ? undefined : [...ticked];
  const namesOk = products.every((p) => (names[p.id]?.name || "").trim().length >= 2);
  const canCopy = brandId && namesOk && ticked.size > 0 && !busy;

  const toggle = (key) =>
    setTicked((t) => {
      const n = new Set(t);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    const target = { ...(isSystem && companyId ? { targetCompanyId: companyId } : {}), targetBrandId: brandId, fieldsToCopy, keepLinked };
    try {
      if (!bulk) {
        const out = await copyProduct(first.id, { ...target, name: names[first.id].name.trim(), productCode: names[first.id].productCode.trim() || null });
        toast.success(t("copyToBrandModal.createdAddItsOwnRegistration", { name: out.product.name }));
        onDone?.(out);
      } else {
        const out = await copyProductsBulk({ ...target, productIds: products.map((p) => p.id), names: products.map((p) => ({ productId: p.id, name: names[p.id].name.trim(), productCode: names[p.id].productCode.trim() || null })) });
        setReport(out);
        if (out.copied) toast.success(t("copyToBrandModal.productsCopied", { count: out.copied }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (report) {
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    return (
      <Modal title={t("copyToBrandModal.copyToBrandResult")} onClose={() => onDone?.(report)} wide footer={<Button onClick={() => onDone?.(report)}>{t("copyToBrandModal.done")}</Button>}>
        <p className="text-sm text-gray-600">
          {t("copyToBrandModal.copiedReport", { copied: report.copied, failed: report.failed })}</p>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" data-testid="copy-bulk-report">
          {report.results.map((r) => (
            <li key={r.productId} className="px-4 py-2 text-sm flex justify-between gap-3">
              <span className="text-gray-700">{byId[r.productId]?.name}</span>
              {r.ok ? <span className="text-teal-700">→ {r.product.name}</span> : <span className="text-red-600">{r.error}</span>}
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      title={bulk ? t("copyToBrandModal.copyProductsToABrand", { length: products.length }) : t("copyToBrandModal.copyToAnotherBrand")}
      onClose={onClose}
      wide={bulk}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">{t("copyToBrandModal.cancel")}</Button>
          <Button onClick={submit} disabled={!canCopy} isLoading={busy} data-testid="copy-submit">
            <Copy className="w-4 h-4" />
            {bulk ? t("copyToBrandModal.copy", { length: products.length }) : t("copyToBrandModal.copy2")}
          </Button>
        </>
      }
    >
      {!groups && !error && <Spinner />}
      {groups && (
        <>
          <p className="text-sm text-gray-600">
            {bulk ? t("copyToBrandModal.eachProductIsCopied") : <><b>{first.name}</b> {t("copyToBrandModal.isCopied")}</>}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {isSystem && (
              <label className="block text-sm">
                <span className="block font-semibold text-gray-700 mb-1">{t("copyToBrandModal.targetCompany")}</span>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" aria-label={t("copyToBrandModal.targetCompany")}>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">
              <span className="block font-semibold text-gray-700 mb-1">{t("copyToBrandModal.targetBrand")}</span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white" aria-label={t("copyToBrandModal.targetBrand")}>
                <option value="">{t("copyToBrandModal.chooseABrand")}</option>
                {brandOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {companyId && !brandOptions.length && <span className="block text-xs text-amber-700 mt-1">{t("copyToBrandModal.thisCompanyHasNoOther")}</span>}
            </label>
          </div>

          {!bulk ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="block font-semibold text-gray-700 mb-1">{t("copyToBrandModal.newName")}</span>
                <input value={names[first.id].name} onChange={(e) => setNames({ ...names, [first.id]: { ...names[first.id], name: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" aria-label={t("copyToBrandModal.newName")} />
              </label>
              <label className="block text-sm">
                <span className="block font-semibold text-gray-700 mb-1">{t("copyToBrandModal.productCodeOptional")}</span>
                <input value={names[first.id].productCode} onChange={(e) => setNames({ ...names, [first.id]: { ...names[first.id], productCode: e.target.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono" aria-label={t("copyToBrandModal.productCode")} />
              </label>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm" data-testid="copy-bulk-names">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">{t("copyToBrandModal.original")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("copyToBrandModal.newName")}</th>
                    <th className="px-3 py-2 text-start font-semibold">{t("copyToBrandModal.productCode")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-gray-700">
                        {p.name}
                        {p.brand?.name && <span className="block text-xs text-gray-400">{p.brand.name}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <input value={names[p.id].name} onChange={(e) => setNames({ ...names, [p.id]: { ...names[p.id], name: e.target.value } })} className="w-full px-2 py-1 border border-gray-300 rounded-md" aria-label={t("copyToBrandModal.newNameFor", { name: p.name })} />
                      </td>
                      <td className="px-3 py-2">
                        <input value={names[p.id].productCode} onChange={(e) => setNames({ ...names, [p.id]: { ...names[p.id], productCode: e.target.value } })} className="w-full px-2 py-1 border border-gray-300 rounded-md font-mono" aria-label={t("copyToBrandModal.productCodeFor", { name: p.name })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-semibold text-gray-700 mb-2">{t("copyToBrandModal.dataToCopy")}</legend>
            <div className="grid gap-2 sm:grid-cols-2" data-testid="copy-groups">
              {groups.map((g) => (
                <label key={g.key} className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm" title={g.fields.map(fieldLabel).join(", ")}>
                  <input type="checkbox" className="mt-0.5" checked={ticked.has(g.key)} onChange={() => toggle(g.key)} />
                  <span>
                    <span className="block font-medium text-gray-900">{g.label}</span>
                    <span className="block text-xs text-gray-500">{g.fields.map(fieldLabel).join(", ")}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0" />{t("copyToBrandModal.theRegistrationNumberIsNot")}</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={keepLinked} onChange={(e) => setKeepLinked(e.target.checked)} />{t("copyToBrandModal.keepLinkedToTheOriginal")}{" "}<span className="text-xs text-gray-500">{t("copyToBrandModal.showsWhereItCameFrom")}</span>
          </label>
        </>
      )}
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </Modal>
  );
}
