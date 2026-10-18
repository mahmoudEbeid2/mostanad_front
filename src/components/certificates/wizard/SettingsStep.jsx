import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Select from "react-select";
import countryList from "react-select-country-list";
import toast from "react-hot-toast";
import { Info } from "lucide-react";
import Button from "../../../ui/Button";
import { updateTemplateSettings } from "../../../services/apiCertificateTemplates";
import { getBrands } from "../../../services/apiBrands";
import { describeCertificateError } from "../../../utils/certificateErrors";

// Wizard step 3 — review the template's slot (plan §13.4): name, type, brand,
// country, scope. The server re-checks slot uniqueness on save.

const STR = {
  name: "Template name",
  type: "Certificate type",
  brand: "Brand",
  anyBrand: "Any brand",
  country: "Country",
  anyCountry: "Any country",
  scope: "One certificate per…",
  perProduct: "Product (invoice line)",
  perInvoice: "Invoice",
  save: "Save settings",
  saved: "Settings saved",
  next: "Next: prepare & test",
  supersedes: (n) => `Activating this version will replace version ${n}, which is active now. Certificates already generated keep the design they used.`,
  firstActive: "This template has no active version yet — activating this one makes it available for generation.",
  slotTaken: "Another template already covers this type, brand, country and scope:",
  open: "Open it",
};

export default function SettingsStep({ scope, companyId, template, version, types, onSaved, onNext }) {
  const countries = useMemo(() => countryList().getData(), []);
  const [form, setForm] = useState(() => ({
    name: template.name,
    certificateTypeId: template.certificateTypeId,
    brandId: template.brandId || "",
    country: template.country ? countries.find((c) => c.value === template.country) || { value: template.country, label: template.country } : null,
    scope: template.scope,
  }));
  const [brands, setBrands] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    getBrands(companyId)
      .then((res) => setBrands(res?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId]);

  const active = template.versions?.find((v) => v.id === template.activeVersionId);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateTemplateSettings(scope, template.id, { ...form, brandId: form.brandId || "", country: form.country?.value || "" });
      toast.success(STR.saved);
      onSaved?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-white";
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className={`flex gap-2 rounded-lg p-3 text-sm ${active && active.id !== version.id ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}>
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        {active && active.id !== version.id ? STR.supersedes(active.versionNumber) : STR.firstActive}
      </div>
      <label className="block text-sm">
        <span className="font-medium text-gray-700">{STR.name}</span>
        <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-700">{STR.type}</span>
        <select value={form.certificateTypeId} onChange={(e) => setForm({ ...form, certificateTypeId: e.target.value })} className={field}>
          {(types || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.code})
            </option>
          ))}
        </select>
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">{STR.brand}</span>
          <select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })} className={field}>
            <option value="">{STR.anyBrand}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <span className="font-medium text-gray-700">{STR.country}</span>
          <Select className="mt-1" options={countries} value={form.country} onChange={(c) => setForm({ ...form, country: c })} isClearable placeholder={STR.anyCountry} />
        </div>
      </div>
      <fieldset className="text-sm">
        <legend className="font-medium text-gray-700 mb-1">{STR.scope}</legend>
        <div className="flex gap-3">
          {[
            ["per_product", STR.perProduct],
            ["per_invoice", STR.perInvoice],
          ].map(([v, l]) => (
            <label key={v} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${form.scope === v ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
              <input type="radio" checked={form.scope === v} onChange={() => setForm({ ...form, scope: v })} /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          {error.code === "TEMPLATE_SLOT_TAKEN" ? (
            <>
              {STR.slotTaken}{" "}
              <Link className="underline font-medium" to={`/certificates/templates/${error.data?.existingTemplateId}`}>
                {STR.open}
              </Link>
            </>
          ) : (
            describeCertificateError(error)
          )}
        </div>
      )}
      <div className="flex justify-between gap-3">
        <Button type="submit" variant="secondary" isLoading={busy}>
          {STR.save}
        </Button>
        <Button type="button" onClick={onNext}>
          {STR.next}
        </Button>
      </div>
    </form>
  );
}
