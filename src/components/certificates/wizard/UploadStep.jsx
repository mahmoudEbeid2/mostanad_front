import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Select from "react-select";
import countryList from "react-select-country-list";
import toast from "react-hot-toast";
import { ArrowRight, Upload } from "lucide-react";
import Button from "../../../ui/Button";
import CompanyPicker from "../CompanyPicker";
import { createCertificateType } from "../../../services/apiCertificateTypes";
import { uploadTemplate, uploadTemplateVersion } from "../../../services/apiCertificateTemplates";
import { getBrands } from "../../../services/apiBrands";
import { describeCertificateError } from "../../../utils/certificateErrors";

const STR = {
  drop: "Drop the certificate design here, or",
  browse: "browse",
  dropHint: "Illustrator .ai (saved with “Create PDF Compatible File”), .pdf or .html · up to 60 MB",
  liveText: "Keep the text as live text — don’t convert it to outlines.",
  replace: "Replace",
  companyHint: "you can create for any company",
  name: "Template name",
  type: "Certificate type",
  orNewType: "or",
  newType: "create a new type",
  typeName: "Type name",
  typeCode: "Code",
  createType: "Create",
  cancel: "Cancel",
  brand: "Brand",
  brandHint: "optional · this company’s brands",
  anyBrand: "Any brand",
  country: "Country",
  optional: "optional",
  anyCountry: "All countries",
  scope: "One certificate for…",
  perProduct: "Each product",
  perProductHint: "An invoice with 5 products gives 5 certificates.",
  perInvoice: "The whole invoice",
  // plan §17: repeating groups (product lists) are Phase 7 — not built yet
  perInvoiceHint: "One certificate for the whole invoice (invoice-level fields only for now).",
  upload: "Upload & convert",
  uploadVersion: "Upload as a new version",
  slotTaken: "Another template already covers this type, brand, country and scope.",
  openExisting: "Open it",
};

const FORMAT_BADGE = { ai: "bg-orange-50 text-orange-700", pdf: "bg-red-50 text-red-700", html: "bg-blue-50 text-blue-700", htm: "bg-blue-50 text-blue-700" };
const lbl = "flex flex-col gap-1.5 text-xs font-semibold text-gray-600";
const inp = "min-h-11 w-full border border-gray-300 rounded-lg px-3 bg-white text-sm font-normal text-gray-900";
const hint = "font-normal text-gray-500";
const selectStyles = { control: (b) => ({ ...b, minHeight: 44, borderRadius: 8, borderColor: "#d1d5db" }), valueContainer: (b) => ({ ...b, fontWeight: 400 }) };

/**
 * Step 1 (plan §13.4; mockup A2). New template: file + company + name, type,
 * brand, country, scope. `existingTemplate`: only a file — uploads a new
 * design version (vN+1) of that template.
 */
export default function UploadStep({ scope, scopeState, companyId, types, onTypesChanged, onUploaded, existingTemplate, initialTypeId, inputId = "template-file" }) {
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

  const ext = file?.name.split(".").pop().toLowerCase();

  return (
    <form onSubmit={submit} className="max-w-[960px] bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-5">
      <label
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
        className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
          over ? "border-blue-500 bg-blue-50" : "border-blue-300 bg-blue-50/30 hover:bg-blue-50/60"
        }`}
      >
        <span className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
          <Upload className="w-6 h-6 text-blue-700" />
        </span>
        <span className="text-base font-semibold text-gray-900">
          {STR.drop} <span className="text-blue-600">{STR.browse}</span>
        </span>
        <span className="text-[13px] text-gray-600">{STR.dropHint}</span>
        <span className="text-xs text-gray-500">{STR.liveText}</span>
        <input id={inputId} type="file" accept=".ai,.pdf,.html,.htm" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      {file && (
        <div className="flex items-center gap-3.5 rounded-lg border border-gray-200 px-3.5 py-3">
          <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono text-xs font-bold uppercase ${FORMAT_BADGE[ext] || "bg-gray-100 text-gray-700"}`}>{ext}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
          <label htmlFor={inputId} className="inline-flex items-center px-3 py-2 rounded-xl border border-gray-300 bg-white text-[13px] font-semibold text-gray-700 cursor-pointer hover:bg-gray-50">
            {STR.replace}
          </label>
        </div>
      )}

      {!existingTemplate && (
        <>
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
            {scopeState && <CompanyPicker scope={scopeState} variant="field" hint={STR.companyHint} />}
            <label className={lbl}>
              {STR.name}
              <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={inp} />
            </label>
            <div className={lbl}>
              <span>
                {STR.type}
                {!newType && (
                  <span className={hint}>
                    {" "}
                    · {STR.orNewType}{" "}
                    <button type="button" onClick={() => setNewType({ name: "", code: "" })} className="text-blue-600 hover:underline">
                      {STR.newType}
                    </button>
                  </span>
                )}
              </span>
              {newType ? (
                <div className="grid grid-cols-[1fr_90px_auto_auto] gap-2">
                  <input placeholder={STR.typeName} value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} className={inp} />
                  <input placeholder={STR.typeCode} value={newType.code} onChange={(e) => setNewType({ ...newType, code: e.target.value.toUpperCase() })} className={`${inp} font-mono`} />
                  <Button type="button" variant="secondary" className="!py-2" onClick={createType} disabled={newType.name.length < 2 || !newType.code}>
                    {STR.createType}
                  </Button>
                  <Button type="button" variant="ghost" className="!py-2 !px-2" onClick={() => setNewType(null)}>
                    {STR.cancel}
                  </Button>
                </div>
              ) : (
                <select required value={certificateTypeId} onChange={(e) => setTypeId(e.target.value)} className={inp}>
                  <option value="" disabled>
                    —
                  </option>
                  {(types || [])
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
            <label className={lbl}>
              <span>
                {STR.brand} <span className={hint}>· {STR.brandHint}</span>
              </span>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inp}>
                <option value="">{STR.anyBrand}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={lbl}>
              <span>
                {STR.country} <span className={hint}>· {STR.optional}</span>
              </span>
              <Select options={countries} value={country} onChange={setCountry} isClearable placeholder={STR.anyCountry} styles={selectStyles} />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="text-[13px] font-semibold text-gray-700 mb-2.5">{STR.scope}</legend>
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
              {[
                ["per_product", STR.perProduct, STR.perProductHint],
                ["per_invoice", STR.perInvoice, STR.perInvoiceHint],
              ].map(([value, label, help]) => {
                const on = templateScope === value;
                return (
                  <label key={value} className={`flex gap-3 rounded-xl px-4 py-3.5 cursor-pointer ${on ? "border-2 border-blue-600 bg-blue-50" : "border border-gray-300 bg-white m-px"}`}>
                    <input type="radio" name="scope" value={value} checked={on} onChange={() => setTemplateScope(value)} className="w-[18px] h-[18px] mt-0.5" />
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{label}</span>
                      <span className="block text-[13px] text-gray-600">{help}</span>
                    </span>
                  </label>
                );
              })}
            </div>
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

      <div className="flex justify-end gap-3 pt-1.5 border-t border-gray-100">
        {!existingTemplate && (
          <Link to="/certificates/templates">
            <Button type="button" variant="secondary">
              {STR.cancel}
            </Button>
          </Link>
        )}
        <Button type="submit" isLoading={busy} disabled={!file || (!existingTemplate && !certificateTypeId)}>
          {existingTemplate ? STR.uploadVersion : STR.upload} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}
