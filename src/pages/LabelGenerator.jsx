import { useState, useMemo, useEffect } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import iso6391 from "iso-639-1";
import { generateLabelAi } from "../services/apiReferenceLabels";
import { getLabel } from "../services/apiGeneratedLabels";
import { getTaskStatus } from "../services/apiProducts"; // Reuse existing task polling
import { getCompanies } from "../services/apiCompanies";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser } from "../utils/permissions";
import LocalizedField from "../components/LocalizedField";
import { io } from "socket.io-client";
import { Copy, Sparkles, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

// Read-only, correct against the new labelSchema. Not the rich editable/provenance
// view — that's the label detail screen (B1). This just shows what generation
// produced without lying about a field's shape.
function GeneratedLabelSummary({ label, estimatedFields }) {
  if (!label) return null;
  const isEstimated = (path) => (estimatedFields || []).includes(path);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
      <div className="p-6">
        <LocalizedField label="Product Name" value={label.productName} estimated={isEstimated("productName")} />
      </div>
      <div className="p-6 space-y-4">
        <LocalizedField label="Aim of Use" value={label.aimOfUse} estimated={isEstimated("aimOfUse")} />
        <LocalizedField label="Direction of Use" value={label.directionOfUse} estimated={isEstimated("directionOfUse")} />
        <LocalizedField label="Withdrawal Period" value={label.withdrawalPeriod} estimated={isEstimated("withdrawalPeriod")} />
        <LocalizedField label="Storage" value={label.storage} estimated={isEstimated("storage")} />
      </div>
      {label.targetAnimalSpecies?.list?.length > 0 && (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">Target Animal Species</span>
            {isEstimated("targetAnimalSpecies") && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                Estimated
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
              source: {label.targetAnimalSpecies.source}
            </span>
          </div>
          <p className="text-sm text-gray-900">{label.targetAnimalSpecies.list.join(", ")}</p>
        </div>
      )}
      {label.activeIngredients?.length > 0 && (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">Active Ingredients</span>
            {isEstimated("activeIngredients") && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                Estimated
              </span>
            )}
          </div>
          <ul className="space-y-1">
            {label.activeIngredients.map((ing, idx) => (
              <li key={idx} className="text-sm text-gray-900">
                {ing.translations?.en} {ing.translations?.ar ? `(${ing.translations.ar})` : ""} — {ing.amount}{ing.unit || ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function LabelGenerator() {
  const { user } = useAuth();
  const companyUser = isCompanyUser(user);

  const [formulationText, setFormulationText] = useState("");
  const [aimOfUseHint, setAimOfUseHint] = useState("");
  const [targetSpeciesHint, setTargetSpeciesHint] = useState("");
  const [directionOfUseHint, setDirectionOfUseHint] = useState("");

  // A2: POST /reference-labels/generate-text-ai now requires an explicit companyId
  // for a system-user caller — there is no "Global" option on this endpoint (Phase 0
  // removed that; the scope:"global" concept exists only on the approval endpoint).
  // A company-authenticated caller is scoped automatically and never sees this.
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(!companyUser);
  const [companiesError, setCompaniesError] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    if (companyUser) return;
    let cancelled = false;
    (async () => {
      try {
        setCompaniesLoading(true);
        setCompaniesError(null);
        const res = await getCompanies({ limit: 100 });
        if (cancelled) return;
        if (res.status === "success") {
          setCompanies(res.data.companies || []);
        }
      } catch (err) {
        if (!cancelled) setCompaniesError(err.response?.data?.message || "Failed to load companies");
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyUser]);

  const companyOptions = useMemo(
    () => companies.map((c) => ({ value: c.id, label: c.name })),
    [companies]
  );

  const countryOptions = useMemo(() => [
    ...countryList().getData()
  ], []);
  const [selectedCountry, setSelectedCountry] = useState(countryOptions.find(c => c.label === "Egypt") || countryOptions[0]);

  const languageOptions = useMemo(() => {
    return iso6391.getAllNames().map(name => ({ label: name, value: name }));
  }, []);
  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions.find(l => l.value === "Arabic") || languageOptions[0]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobError, setJobError] = useState(null);

  // A1: the task result no longer carries the label as the thing to trust directly —
  // once the task completes we fetch the authoritative record from GET /labels/:labelId.
  const [labelId, setLabelId] = useState(null);
  const [genSummary, setGenSummary] = useState(null); // { validation, riskScore, autonomyTier } from the task result
  const [labelDetail, setLabelDetail] = useState(null); // { label, currentVersion, latestValidation, provenance }
  const [isFetchingLabel, setIsFetchingLabel] = useState(false);
  const [fetchLabelError, setFetchLabelError] = useState(null);

  const fetchGeneratedLabel = async (id) => {
    try {
      setIsFetchingLabel(true);
      setFetchLabelError(null);
      const detail = await getLabel(id);
      setLabelDetail(detail);
    } catch (err) {
      setFetchLabelError(err.message || "Failed to load the generated label");
    } finally {
      setIsFetchingLabel(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();

    if (!formulationText.trim()) return toast.error("Please enter the product formulation/details.");
    if (!aimOfUseHint.trim()) return toast.error("Please enter the confirmed Aim of Use — the AI will not guess this.");
    if (!selectedCountry) return toast.error("Please select a target country.");
    if (!selectedLanguage) return toast.error("Please select a target language.");
    if (!companyUser && !selectedCompany) {
      return toast.error("Please select which company this label belongs to.");
    }

    try {
      setIsGenerating(true);
      setJobError(null);
      setLabelId(null);
      setGenSummary(null);
      setLabelDetail(null);
      setFetchLabelError(null);
      setJobProgress(0);
      setJobMessage("Starting AI label generation...");

      const payload = {
        formulationText,
        country: selectedCountry.label,
        language: selectedLanguage.value,
        aimOfUseHint,
        targetSpeciesHint,
        directionOfUseHint,
      };
      // Never send this field omitted-by-accident for a system caller — the backend
      // rejects a missing companyId on purpose. A company caller must not send one at
      // all (their own company is always used server-side).
      if (!companyUser) {
        payload.companyId = selectedCompany.value;
      }

      const res = await generateLabelAi(payload);
      const taskId = res.data?.taskId || res.taskId;

      toast.success("AI is writing your label... Please wait.");

      const handleCompletion = async (result) => {
        setIsGenerating(false);
        const newLabelId = result?.labelId;
        setGenSummary({ validation: result?.validation, riskScore: result?.riskScore, autonomyTier: result?.autonomyTier });
        if (newLabelId) {
          setLabelId(newLabelId);
          toast.success("Label generated successfully!");
          fetchGeneratedLabel(newLabelId);
        } else {
          // Contract says this can't happen post-Phase-1, but don't silently show
          // nothing if it ever does.
          setJobError("The generation task completed but returned no labelId.");
        }
      };

      // Use Sockets for Real-Time Updates
      const socket = io(BACKEND_URL);

      socket.on("connect", async () => {
        socket.emit("join_job", taskId);

        try {
          const statusRes = await getTaskStatus(taskId);
          const currentStatus = statusRes.data?.status;

          if (currentStatus === "completed" || currentStatus === "failed") {
            if (currentStatus === "completed") {
              await handleCompletion(statusRes.data?.result);
            } else {
              setIsGenerating(false);
              setJobError(statusRes.data?.error || "AI generation failed.");
              toast.error("Generation failed. Please try again.");
            }
            socket.disconnect();
          }
        } catch (err) {
          console.error("Failed to fetch initial task status", err);
        }
      });

      socket.on("job_status", (data) => {
        if (data.progress) setJobProgress(data.progress);
        if (data.message) setJobMessage(data.message);

        if (data.status === "completed") {
          handleCompletion(data.result);
          socket.disconnect();
        } else if (data.status === "failed") {
          setIsGenerating(false);
          setJobError(data.error || "AI generation failed.");
          toast.error("Generation failed. Please try again.");
          socket.disconnect();
        }
      });

    } catch (err) {
      toast.error(err.message || "Failed to start generation");
      setIsGenerating(false);
    }
  };

  const copyRawJson = () => {
    if (!labelDetail?.label) return;
    navigator.clipboard.writeText(JSON.stringify(labelDetail.label, null, 2));
    toast.success("Copied to clipboard!");
  };

  const startOver = () => {
    setLabelId(null);
    setGenSummary(null);
    setLabelDetail(null);
    setFetchLabelError(null);
  };

  if (labelId) {
    return (
      <div className="max-w-5xl mx-auto pb-12 animate-in fade-in zoom-in-95">
        <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-blue-600" /> Generated Label
            </h1>
            <p className="text-gray-500 mt-2 font-mono text-xs">Label ID: {labelId}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={copyRawJson}
              disabled={!labelDetail?.label}
              className="flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors"
            >
              <Copy className="w-5 h-5" /> Copy Raw JSON
            </button>
            <button
              onClick={startOver}
              className="bg-gray-800 hover:bg-gray-900 text-white rounded-xl px-5 py-2 font-bold transition-colors"
            >
              Generate Another
            </button>
          </div>
        </div>

        {genSummary?.validation && (
          <div className={`mb-4 text-sm px-4 py-3 rounded-xl border flex items-center gap-2 ${
            genSummary.validation.passed
              ? "text-green-800 bg-green-50 border-green-200"
              : "text-red-800 bg-red-50 border-red-200"
          }`}>
            {genSummary.validation.passed ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>
              First-pass validation: {genSummary.validation.passed ? "passed" : "failed"} —{" "}
              {genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).
              This is a quick summary from generation; run full validation on the label detail screen for the field-by-field report.
            </span>
          </div>
        )}

        {isFetchingLabel && (
          <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
            <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading generated label...
          </div>
        )}

        {fetchLabelError && (
          <div className="flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{fetchLabelError}</span>
            <button onClick={() => fetchGeneratedLabel(labelId)} className="ml-auto font-bold underline">Retry</button>
          </div>
        )}

        {jobError && (
          <div className="mb-4 flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{jobError}</span>
          </div>
        )}

        {labelDetail?.label && (
          <>
            <p className="mb-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              This is a read-only summary of what was generated. The full editable view with
              per-field validation and provenance is on the label detail screen (coming soon).
            </p>
            <GeneratedLabelSummary
              label={labelDetail.label}
              estimatedFields={labelDetail.label.estimatedFields}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-in fade-in zoom-in-95">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-600" /> AI Label Writer
        </h1>
        <p className="text-gray-500 mt-2">Generate a highly compliant, professional label text for any product by providing its details.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleGenerate} className="space-y-6">
            {!companyUser && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Company <span className="text-red-600">*</span>
                </label>
                <Select
                  options={companyOptions}
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  isLoading={companiesLoading}
                  isDisabled={isGenerating}
                  placeholder={companiesError ? "Failed to load companies" : "Select the company this label belongs to..."}
                  className="text-sm"
                  noOptionsMessage={() => (companiesLoading ? "Loading..." : "No companies found")}
                />
                {companiesError && (
                  <p className="text-xs text-red-600 mt-1">{companiesError}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">
                  Required — this label is always scoped to one company, there is no global option.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Product Formulation & Details</label>
              <textarea
                value={formulationText}
                onChange={(e) => setFormulationText(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                rows="8"
                placeholder="e.g., A veterinary liquid supplement containing Vitamin A (1,000,000 IU/L), Vitamin D3 (200,000 IU/L) for poultry. Dose: 1ml per 10 liters of drinking water for 3-5 days."
                disabled={isGenerating}
                required
              />
              <p className="text-[11px] text-gray-500 mt-1">The more details you provide, the better the AI can construct the label sections.</p>
            </div>

            <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4">
              <span className="text-sm font-bold text-amber-900">
                Expert Details — pin down facts the AI shouldn't guess
              </span>
              <p className="text-[11px] text-amber-800 mt-1">
                Many active ingredients (e.g. Ammonium Chloride) have several valid veterinary uses. Telling the AI the exact indication here stops it from guessing between them and getting it wrong.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Confirmed Aim of Use / Indication <span className="text-red-600">*</span>
                  </label>
                  <input
                    value={aimOfUseHint}
                    onChange={(e) => setAimOfUseHint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Example: Urinary acidifier used to help prevent urinary calculi (urolithiasis) in ruminants"
                    disabled={isGenerating}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Confirmed Target Animal Species</label>
                  <input
                    value={targetSpeciesHint}
                    onChange={(e) => setTargetSpeciesHint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Example: Cow, Buffalo, Camel, Sheep, Goat"
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Confirmed Direction of Use / Dosage</label>
                  <input
                    value={directionOfUseHint}
                    onChange={(e) => setDirectionOfUseHint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Example: Sheep and Goats 5g/head/day; Cattle, Buffalo and Camels 30g/head/day, mixed with feed"
                    disabled={isGenerating}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Target Country (FDA rules)</label>
                <Select
                  options={countryOptions}
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  className="text-sm"
                  isDisabled={isGenerating}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Target Language</label>
                <Select
                  options={languageOptions}
                  value={selectedLanguage}
                  onChange={setSelectedLanguage}
                  className="text-sm"
                  isDisabled={isGenerating}
                />
              </div>
            </div>

            <Button type="submit" isLoading={isGenerating} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" /> {isGenerating ? "Generating Label..." : "Write Label Text"}
            </Button>
          </form>

          {isGenerating && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex justify-between text-sm text-blue-700 mb-2 font-medium">
                <span>{jobMessage}</span>
                <span>{jobProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${jobProgress}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
