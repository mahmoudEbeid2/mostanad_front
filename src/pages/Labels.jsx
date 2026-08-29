import { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { verifyLabel } from "../services/apiLabels";
import { getTaskStatus } from "../services/apiProducts"; // reuse for checking task status
import { io } from "socket.io-client";
import { CheckCircle, AlertCircle, Image as ImageIcon, ShieldCheck, FileText, Database, CloudUpload, FileCheck, Scan, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import LocalizedField from "../components/LocalizedField";
import VerdictList from "../components/VerdictList";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

// The old-shape Product row (dbProduct) is unchanged by Phase 2 — these are its own
// flat fields, still valid as-is.
const DB_PRODUCT_FIELDS = [
  { key: "name", label: "Product Name" },
  { key: "productCode", label: "Product Code" },
  { key: "targetSpecies", label: "Target Species", type: "array" },
  { key: "physicalForm", label: "Physical Form" },
  { key: "dosage", label: "Dosage", full: true },
  { key: "withdrawalPeriod", label: "Withdrawal Period" },
  { key: "storage", label: "Storage", full: true },
  { key: "registrationNumber", label: "Registration Number" },
];

function countStatuses(verdicts = []) {
  return verdicts.reduce((acc, verdict) => {
    acc[verdict.status] = (acc[verdict.status] || 0) + 1;
    return acc;
  }, {});
}

function verificationBand(validation) {
  const counts = countStatuses(validation?.verdicts || []);
  const failCount = counts.FAIL || 0;
  const confirmCount = counts.NEEDS_CONFIRMATION || 0;
  const reviewCount = counts.NEEDS_REVIEW || 0;
  const unverifiableCount = counts.UNVERIFIABLE || 0;
  const warnCount = counts.WARN || 0;

  if (failCount > 0) {
    return {
      title: `Not ready - ${failCount} ${failCount === 1 ? "thing must" : "things must"} be fixed`,
      body: "Start with Must fix below. The label should not be treated as ready.",
      classes: "bg-red-50 border-red-400 text-red-900",
      icon: AlertCircle,
    };
  }
  if (confirmCount + reviewCount > 0) {
    return {
      title: `Needs you - ${confirmCount + reviewCount} ${confirmCount + reviewCount === 1 ? "thing" : "things"} to confirm`,
      body: "Some values need a human decision before relying on the result.",
      classes: "bg-orange-50 border-orange-300 text-orange-900",
      icon: ShieldAlert,
    };
  }
  if (unverifiableCount > 0) {
    return {
      title: "Cannot fully check",
      body: `${unverifiableCount} ${unverifiableCount === 1 ? "rule could" : "rules could"} not be checked with the approved rules on file.`,
      classes: "bg-indigo-50 border-indigo-300 text-indigo-900",
      icon: ShieldAlert,
    };
  }
  if (warnCount > 0) {
    return {
      title: "Ready with notes",
      body: `${warnCount} ${warnCount === 1 ? "thing is" : "things are"} worth a look, but nothing is blocking.`,
      classes: "bg-amber-50 border-amber-300 text-amber-900",
      icon: CheckCircle,
    };
  }
  return {
    title: "Ready - nothing blocking",
    body: "No blocking failures were found.",
    classes: "bg-green-50 border-green-400 text-green-900",
    icon: CheckCircle,
  };
}

export default function Labels() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  
  const countryOptions = useMemo(() => [
    { label: "Global", value: "Global" },
    ...countryList().getData()
  ], []);
  const [selectedCountry, setSelectedCountry] = useState(countryOptions[0]);
  
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  
  const [file, setFile] = useState(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); 
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobResults, setJobResults] = useState(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await getCompanies({ limit: 100 });
        if (res.status === "success") {
          setCompanies(res.data.companies || []);
        }
      } catch (error) {
        toast.error("Failed to load companies");
      }
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (!selectedCompany) {
      setBrands([]);
      setSelectedBrand("");
      return;
    }
    const fetchBrands = async () => {
      try {
        const res = await getBrands(selectedCompany);
        if (res.status === "success") {
          setBrands(res.data.brands || []);
        }
      } catch (error) {}
    };
    fetchBrands();
  }, [selectedCompany]);

  useEffect(() => {
    if (!jobId) return;

    const socket = io(BACKEND_URL);

    socket.on("connect", async () => {
      console.log("Connected to WebSocket, joining job:", jobId);
      socket.emit("join_job", jobId);
      
      try {
        const res = await getTaskStatus(jobId);
        if (res.status === "success" && res.data) {
          const currentStatus = res.data.status;
          if (currentStatus === "completed" || currentStatus === "failed") {
             setJobStatus(currentStatus);
             if (res.data.result) setJobResults(res.data.result);
             if (res.data.error) setJobMessage(res.data.error);
             
             if (currentStatus === "completed") toast.success("Label verified successfully!");
             else toast.error("Label verification failed.");
             
             socket.disconnect();
          }
        }
      } catch (err) {
        console.error("Failed to fetch initial task status", err);
      }
    });

    socket.on("job_status", (data) => {
      console.log("Job Update:", data);
      setJobStatus(data.status);
      setJobProgress(data.progress || 0);
      if (data.message) setJobMessage(data.message);
      if (data.result) setJobResults(data.result);

      if (data.status === "completed") {
        toast.success("Label verified successfully!");
        socket.disconnect();
      } else if (data.status === "failed") {
        toast.error("Label verification failed.");
        socket.disconnect();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return null;
  }, [file]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
        toast.error("Please select a valid Image or PDF file");
        e.target.value = null;
        setFile(null);
        return;
      }
      setFile(selected);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a label image or PDF");
    if (!selectedCountry) return toast.error("Please select a target country");

    try {
      setIsUploading(true);
      
      setJobId(null);
      setJobStatus(null);
      setJobProgress(0);
      setJobMessage("");
      setJobResults(null);

      const formData = new FormData();
      if (selectedCompany) formData.append("companyId", selectedCompany);
      if (selectedBrand) formData.append("brandId", selectedBrand);
      formData.append("country", selectedCountry.label);
      formData.append("label", file);

      const res = await verifyLabel(formData);
      if (res.status === "accepted" || res.status === "success") {
        toast.success("Label uploaded! AI Verification started...");
        setJobId(res.data.jobId || res.data.task?.id);
        setJobStatus("pending");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to verify label");
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setJobId(null);
    setFile(null);
    setJobStatus(null);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" /> Check a Label
        </h1>
        <p className="text-gray-500 mt-2">Upload an existing label and see whether it is ready, what must be fixed, and what could not be checked.</p>
      </div>

      {!jobId ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleUpload} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Country Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Food and Drug Authority (Country)</label>
                <Select
                  options={countryOptions}
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  className="react-select-container text-sm"
                  classNamePrefix="react-select"
                />
                <p className="text-[10px] text-gray-500 mt-2 leading-tight">AI will check compliance against the selected country's FDA regulations.</p>
              </div>

              {/* Company Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Company (Optional)</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-4 py-[9px] bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                >
                  <option value="">Global Verification</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Brand Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Brand (Optional)</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  disabled={!selectedCompany || brands.length === 0}
                  className="w-full px-4 py-[9px] bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700 disabled:opacity-50"
                >
                  <option value="">Global Verification</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Label Design (Image or PDF)</label>
              
              {!file ? (
                <label 
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center px-6 pt-10 pb-12 border-2 border-gray-300 border-dashed rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors relative cursor-pointer"
                >
                  <div className="space-y-3 text-center">
                    <ImageIcon className="mx-auto h-16 w-16 text-gray-400" />
                    <div className="flex text-base text-gray-600 justify-center">
                      <span className="font-bold text-blue-600 hover:text-blue-500 px-1">
                        Upload a file
                      </span>
                      <input id="file-upload" name="file-upload" type="file" accept="image/*,.pdf" className="sr-only" onChange={handleFileChange} />
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-sm text-gray-500">PNG, JPG, or PDF up to 20MB</p>
                  </div>
                </label>
              ) : (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-blue-900 font-bold text-lg">
                      <CheckCircle className="w-6 h-6 text-green-500" /> 
                      File Selected
                    </div>
                    <p className="text-blue-800 text-sm font-mono truncate max-w-sm">{file.name}</p>
                    
                    <div className="mt-auto pt-4">
                      <button type="button" onClick={() => setFile(null)} className="text-sm text-red-600 font-semibold hover:underline">
                        Remove and select another
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl overflow-hidden border border-gray-200 h-64 flex items-center justify-center relative shadow-sm">
                    {file.type.startsWith("image/") ? (
                      <img src={previewUrl} alt="Label Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full" title="PDF Preview" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <Button type="submit" isLoading={isUploading} className="w-full md:w-auto px-10 py-3 text-lg" disabled={!file}>
                <ShieldCheck className="w-6 h-6 mr-2" /> Verify Compliance
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-center gap-4 mb-8">
            {previewUrl && file?.type.startsWith("image/") && (
              <img src={previewUrl} alt="Uploaded label" className="w-16 h-16 object-cover rounded-xl border border-gray-200 shadow-sm flex-shrink-0" />
            )}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Label</h2>
              <p className="text-gray-500">Job ID: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{jobId}</span></p>
            </div>
          </div>

          <div className="max-w-3xl mx-auto space-y-8">

            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-4">
              {jobStatus === "pending" || jobStatus === "processing" ? (
                <div className="flex flex-col w-full max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                  {/* Decorative Background */}
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
                  <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="font-extrabold text-2xl text-gray-900 tracking-tight">AI Analysis in Progress</h3>
                        <p className="text-sm text-gray-500 mt-1.5 font-medium">Please wait while the AI verifies compliance.</p>
                      </div>
                      <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full font-black text-sm shadow-sm">
                        {jobProgress}%
                      </div>
                    </div>
                    
                    {/* Dynamic Icon & Message Stage */}
                    <div className="flex items-center gap-5 p-5 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-100/50 mb-8">
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-30"></div>
                        <div className="relative bg-white p-3.5 rounded-full shadow-sm border border-blue-100 text-blue-600">
                          {jobProgress < 20 ? <CloudUpload className="w-7 h-7" /> :
                           jobProgress < 40 ? <Scan className="w-7 h-7" /> :
                           jobProgress < 60 ? <Database className="w-7 h-7" /> :
                           jobProgress < 80 ? <ShieldCheck className="w-7 h-7" /> :
                           <FileCheck className="w-7 h-7" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1.5">Current Stage</h4>
                        <p className="text-gray-800 font-bold text-base leading-snug break-words">
                          {jobMessage || "Initializing AI processors..."}
                        </p>
                      </div>
                    </div>
                    
                    {/* Unified Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-700 ease-out relative"
                        style={{ width: `${Math.max(jobProgress, 5)}%` }}
                      >
                        <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 w-full overflow-hidden animate-[shimmer_2s_infinite]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : jobStatus === "completed" ? (
                <div className="flex flex-col items-center text-green-600">
                  <ShieldCheck className="w-20 h-20 mb-4" />
                  <span className="font-bold text-2xl text-gray-900">Verification Complete!</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-red-600">
                  <AlertCircle className="w-16 h-16 mb-4" />
                  <span className="font-bold text-xl">Verification Failed</span>
                  <span className="text-sm text-red-500 mt-2 bg-red-50 p-3 rounded-lg border border-red-100">{jobMessage}</span>
                </div>
              )}
            </div>

            {/* Results Section — result.validation is now a ValidationReport
                (deterministic engine, §10.2), not the old AI-judged
                {compliant, results:[]} shape. See API-CHANGES.md Phase 2. */}
            {jobStatus === "completed" && jobResults && jobResults.validation && (
              <div className="mt-8">
                {(() => {
                  const band = verificationBand(jobResults.validation);
                  const BandIcon = band.icon;
                  return (
                    <div className={`p-6 rounded-2xl border-2 mb-6 ${band.classes}`}>
                      <div className="flex items-start gap-3">
                        <BandIcon className="w-7 h-7 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-2xl font-black mb-1">{band.title}</h3>
                          <p className="text-sm">{band.body}</p>
                          <p className="text-xs opacity-75 mt-2">
                            Checked {jobResults.validation.rulesetIds?.length || 0} ruleset(s) - {jobResults.validation.coveragePercent != null ? `${jobResults.validation.coveragePercent.toFixed(1)}% document coverage` : "no coverage figure recorded"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Detailed engine result */}
                <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 mb-6">
                  <h3 className="text-sm font-bold text-gray-800 mb-1">
                    Detailed result
                  </h3>
                  <p className="text-sm opacity-80 font-medium">
                    {jobResults.validation.errorCount} error(s), {jobResults.validation.warningCount} warning(s)
                    {" "}— engine {jobResults.validation.engineVersion}
                  </p>
                  {jobResults.validation.rulesetIds?.length === 0 && (
                    <p className="text-xs opacity-70 mt-2">
                      No country-specific regulatory rules were applied to this check — this endpoint always
                      validates against schema/structure rules only, not a country's ruleset.
                    </p>
                  )}
                </div>

                {/* Field-by-field verdicts */}
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                    <ShieldAlert className="w-7 h-7 text-gray-700" />
                    <h4 className="text-2xl font-black text-gray-900">Field-by-Field Report</h4>
                  </div>
                  <VerdictList verdicts={jobResults.validation.verdicts} />
                </div>

                {/* Database match banner (existsInDb/isExactMatch/dbProduct are unchanged by
                    Phase 2 — only extractedDetails changed shape, so this stays a plain banner
                    rather than a merged field-by-field diff table, since the two sides no
                    longer share a common field vocabulary). */}
                {jobResults.product?.existsInDb && jobResults.product?.dbProduct && (
                  <div className="mb-6 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-4 flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <p className="text-sm text-blue-900">
                      {jobResults.product.isExactMatch ? "Exact match" : "Closest alternative"} found in database:{" "}
                      <span className="font-bold">{jobResults.product.dbProduct.name}</span>
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Extracted Label Information — extractedDetails is now a partial
                      labelSchema object, e.g. productName.translations.en, not the old
                      flat {name, category, productCode, ...} shape. */}
                  {jobResults.product?.extractedDetails && (
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-gray-500" /> Extracted from Label
                        </h4>
                        {!jobResults.product.existsInDb && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            Not found in database
                          </span>
                        )}
                      </div>
                      <div className="p-6 space-y-4">
                        <LocalizedField label="Product Name" value={jobResults.product.extractedDetails.productName} />
                        <LocalizedField label="Withdrawal Period" value={jobResults.product.extractedDetails.withdrawalPeriod} />
                        <LocalizedField label="Storage" value={jobResults.product.extractedDetails.storage} />
                        <LocalizedField label="Registration Number" value={jobResults.product.extractedDetails.registrationNumber ? { translations: { en: jobResults.product.extractedDetails.registrationNumber }, primary: "en" } : null} />
                        {jobResults.product.extractedDetails.targetAnimalSpecies?.list?.length > 0 && (
                          <div>
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wide block mb-1">Target Animal Species</span>
                            <span className="text-sm text-gray-900">{jobResults.product.extractedDetails.targetAnimalSpecies.list.join(", ")}</span>
                          </div>
                        )}
                        {jobResults.product.extractedDetails.activeIngredients?.length > 0 && (
                          <div>
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wide block mb-1">Active Ingredients</span>
                            <ul className="text-sm text-gray-900 space-y-0.5">
                              {jobResults.product.extractedDetails.activeIngredients.map((ing, idx) => (
                                <li key={idx}>{ing.translations?.en} — {ing.amount}{ing.unit || ""}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Database Product — dbProduct's own unchanged shape, shown as its own
                      panel rather than forced into the same rows as extractedDetails. */}
                  {jobResults.product?.dbProduct && (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
                        <h4 className="font-bold text-blue-900 flex items-center gap-2">
                          <Database className="w-5 h-5 text-blue-600" /> Database Product
                        </h4>
                      </div>
                      <div className="p-6 space-y-4 text-sm">
                        {DB_PRODUCT_FIELDS.map(({ key, label, type }) => {
                          const val = jobResults.product.dbProduct?.[key];
                          if (!val || (type === "array" && val.length === 0)) return null;
                          return (
                            <div key={key}>
                              <span className="text-gray-500 text-xs font-bold uppercase tracking-wide block mb-1">{label}</span>
                              <span className="text-gray-900">{type === "array" ? val.join(", ") : val}</span>
                            </div>
                          );
                        })}
                        {jobResults.product.dbProduct?.activeIngredients?.length > 0 && (
                          <div>
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wide block mb-1">Active Ingredients</span>
                            <span className="text-gray-900">
                              {jobResults.product.dbProduct.activeIngredients.map((i) => `${i.name} (${i.concentration})`).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {(jobStatus === "completed" || jobStatus === "failed") && (
              <div className="flex justify-center mt-12 pt-6 border-t border-gray-100">
                <Button onClick={resetUpload} variant="secondary" className="px-8 py-3">
                  Verify Another Label
                </Button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
