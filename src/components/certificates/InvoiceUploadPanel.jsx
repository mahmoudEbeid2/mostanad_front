import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import countryList from "react-select-country-list";
import { FileText } from "lucide-react";
import Button from "../../ui/Button";
import { uploadInvoice } from "../../services/apiInvoices";
import { getBrands } from "../../services/apiBrands";

// Invoice upload (plan §13.5, mockup B1): drop zone + optional brand hint and
// destination country, then straight to the review page while it is read.
const STR = {
  drop: "Drop the invoice here, or",
  browse: "browse",
  dropHint: "PDF, PNG, JPEG or WebP · up to 15 MB · a phone photo works",
  brand: "Brand",
  brandHint: "optional hint",
  detectBrand: "Detect from products",
  country: "Destination country",
  countryHint: "optional",
  readCountry: "Read from invoice",
  upload: "Upload & read invoice →",
  tooLarge: "Invoices are limited to 15 MB.",
};

const MAX_BYTES = 15 * 1024 * 1024;

export default function InvoiceUploadPanel({ scope, companyId }) {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [country, setCountry] = useState("");
  const [brands, setBrands] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const countries = useMemo(() => countryList().getData(), []);

  useEffect(() => {
    if (!companyId) return;
    setBrandId("");
    getBrands(companyId)
      .then((res) => setBrands(res?.data?.brands || []))
      .catch(() => setBrands([]));
  }, [companyId]);

  const pick = (f) => {
    if (!f) return;
    setError(f.size > MAX_BYTES ? STR.tooLarge : null);
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { invoiceId, taskId } = await uploadInvoice(scope, { file, brandId, country });
      navigate(`/invoices/${invoiceId}?task=${taskId}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-10 cursor-pointer text-center transition-colors min-h-56 ${
          over ? "border-blue-500 bg-blue-50" : "border-blue-300 hover:border-blue-500"
        }`}
      >
        <span className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center">
          <FileText className="w-6 h-6 text-blue-600" />
        </span>
        {file ? (
          <span className="font-semibold text-gray-900">
            {file.name} <span className="text-gray-500 font-normal">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
          </span>
        ) : (
          <span className="font-semibold text-gray-900">
            {STR.drop} <span className="text-blue-600">{STR.browse}</span>
          </span>
        )}
        <span className="text-sm text-gray-500">{STR.dropHint}</span>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      <div className="space-y-4 text-sm">
        <label className="block">
          <span className="font-semibold text-gray-800">{STR.brand}</span> <span className="text-gray-500">· {STR.brandHint}</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white">
            <option value="">{STR.detectBrand}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold text-gray-800">{STR.country}</span> <span className="text-gray-500">· {STR.countryHint}</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white">
            <option value="">{STR.readCountry}</option>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.value})
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-red-600">{error}</p>}
        <Button type="submit" className="w-full" isLoading={busy} disabled={!file || file.size > MAX_BYTES}>
          {STR.upload}
        </Button>
      </div>
    </form>
  );
}
