import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Select from "react-select";
import countryList from "react-select-country-list";
import toast from "react-hot-toast";
import { Plus, UploadCloud } from "lucide-react";
import Button from "../../../ui/Button";
import { createCertificateType } from "../../../services/apiCertificateTypes";
import { uploadTemplate, uploadTemplateVersion } from "../../../services/apiCertificateTemplates";
import { getBrands } from "../../../services/apiBrands";
import { describeCertificateError } from "../../../utils/certificateErrors";

const STR = {
  drop: "Drop the certificate design here",
  dropHint: ".ai (saved with “Create PDF Compatible File”), .pdf or .html — up to 60 MB",
  choose: "or click to choose a file",
  name: "Template name",
  type: "Certificate type",
  newType: "New type",
  typeName: "Type name",
  typeCode: "Code",
  createType: "Create",
  brand: "Brand (optional)",
  anyBrand: "Any brand",
  country: "Country (optional)",
  anyCountry: "Any country",
  scope: "One certificate per…",
  perProduct: "Product",
  perProductHint: "Each invoice line gets its own certificate (e.g. a COA per batch).",
  perInvoice: "Invoice",
  perInvoiceHint: "One certificate covers the whole invoice (invoice-level fields only for now).",
  upload: "Upload and convert",
  uploadVersion: "Upload as a new version",
  slotTaken: "Another template already covers this type, brand, country and scope.",
  openExisting: "Open it",
};

/**
 * Step 1 (plan §13.4). New template: full form. `existingTemplate`: only a
 * file — uploads a new design version (vN+1) of that template.
 */
export default function UploadStep({ scope, companyId, types, onTypesChanged, onUploaded, existingTemplate, initialTypeId }) {
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const [certificateTypeId, setTypeId] = useState(initialTypeId || "");
  const [brandId, setBrandId] = useState("");
  const [country, setCountry] = useState(null);
  const [templateScope, setTemplateScope] = useState("per_product");
  const [brands, setBrands] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [newType, setNewType] = useState(null); // { name, code } while creating inline
  const countries = useMemo(() => countryList().getData(), []);

  useEffect(() => {
    if (!certificateTypeId && types?.length) setTypeId(types.find((t) => t.isActive)?.id || "");
  }, [types, certificateTypeId]);

  useEffect(() => {
    if (existingTemplate || !companyId) return;
    getBrands(companyId)
      .then((res) => setBrands(res?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId, existingTemplate]);

  const pick = (f) => {
    if (!f) return;
    setError(null);
    setFile(f);
    if (!name) setName(f.name.replace(/\.(ai|pdf|html?)$/i, "").replace(/[_-]+/g, " ").trim());
  };

  const createType = async () => {
    try {
      const t = await createCertificateType(scope, newType);
      await onTypesChanged?.();
      setTypeId(t.id);
      setNewType(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = existingTemplate
        ? await uploadTemplateVersion(scope, existingTemplate.id, file)
        : await uploadTemplate(scope, { file, name, certificateTypeId, brandId, country: country?.value, scope: templateScope });
      onUploaded(res);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-xl border-2 border-dashed p-10 text-center flex flex-col items-center justify-center gap-3 transition-colors ${over ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}
      >
        <UploadCloud className="w-12 h-12 text-gray-400" />
        <p className="font-semibold text-gray-800">{file ? file.name : STR.drop}</p>
        <p className="text-xs text-gray-500">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : STR.dropHint}</p>
        <label className="text-sm text-blue-600 hover:underline cursor-pointer">
          {STR.choose}
          <input type="file" accept=".ai,.pdf,.html,.htm" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
        {!existingTemplate && (
          <>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">{STR.name}</span>
              <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
            </label>

            <div className="text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">{STR.type}</span>
                {!newType && (
                  <button type="button" onClick={() => setNewType({ name: "", code: "" })} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> {STR.newType}
                  </button>
                )}
              </div>
              {newType ? (
                <div className="mt-1 grid grid-cols-[1fr_90px_auto] gap-2">
                  <input placeholder={STR.typeName} value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} className="border border-gray-300 rounded-lg px-2 py-2" />
                  <input placeholder={STR.typeCode} value={newType.code} onChange={(e) => setNewType({ ...newType, code: e.target.value.toUpperCase() })} className="border border-gray-300 rounded-lg px-2 py-2 font-mono" />
                  <Button type="button" variant="secondary" className="!py-2" onClick={createType} disabled={newType.name.length < 2 || !newType.code}>
                    {STR.createType}
                  </Button>
                </div>
              ) : (
                <select required value={certificateTypeId} onChange={(e) => setTypeId(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                  <option value="" disabled>
                    —
                  </option>
                  {(types || [])
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                </select>
              )}
            </div>

            <label className="block text-sm">
              <span className="font-medium text-gray-700">{STR.brand}</span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
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
              <Select className="mt-1" options={countries} value={country} onChange={setCountry} isClearable placeholder={STR.anyCountry} />
            </div>

            <fieldset className="text-sm space-y-2">
              <legend className="font-medium text-gray-700 mb-1">{STR.scope}</legend>
              {[
                ["per_product", STR.perProduct, STR.perProductHint],
                ["per_invoice", STR.perInvoice, STR.perInvoiceHint],
              ].map(([value, label, hint]) => (
                <label key={value} className={`flex gap-2 p-2 rounded-lg border cursor-pointer ${templateScope === value ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                  <input type="radio" name="scope" value={value} checked={templateScope === value} onChange={() => setTemplateScope(value)} />
                  <span>
                    <span className="font-medium text-gray-800">{label}</span>
                    <span className="block text-xs text-gray-500">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}

        {error && (
          <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 space-y-1">
            <p>{error.code === "TEMPLATE_SLOT_TAKEN" ? STR.slotTaken : describeCertificateError(error)}</p>
            {error.code === "TEMPLATE_SLOT_TAKEN" && error.data?.existingTemplateId && (
              <Link className="font-medium underline" to={`/certificates/templates/${error.data.existingTemplateId}`}>
                {STR.openExisting}
              </Link>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" isLoading={busy} disabled={!file || (!existingTemplate && !certificateTypeId)}>
          {existingTemplate ? STR.uploadVersion : STR.upload}
        </Button>
      </div>
    </form>
  );
}
