import { useState, useMemo, useEffect } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import iso6391 from "iso-639-1";
import { generateLabelAi } from "../services/apiReferenceLabels";
import { getTaskStatus } from "../services/apiProducts"; // Reuse existing task polling
import { getCompanies } from "../services/apiCompanies";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser } from "../utils/permissions";
import { io } from "socket.io-client";
import { Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

export default function LabelGenerator() {
  const navigate = useNavigate();
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

      let settled = false;
      let pollInterval = null;
      let socket = null;

      const cleanup = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = null;
        if (socket) socket.disconnect();
        socket = null;
      };

      const handleCompletion = async (result) => {
        if (settled) return;
        settled = true;
        cleanup();
        setIsGenerating(false);
        const newLabelId = result?.labelId;
        if (newLabelId) {
          toast.success("Label generated successfully!");
          navigate(`/labels/detail/${newLabelId}`);
        } else {
          // Contract says this can't happen post-Phase-1, but don't silently show
          // nothing if it ever does.
          toast.error("The generation task completed but returned no labelId.");
        }
      };

      const handleFailure = (message) => {
        if (settled) return;
        settled = true;
        cleanup();
        setIsGenerating(false);
        toast.error(message || "AI generation failed.");
      };

      const applyStatus = (status, data) => {
        if (status === "completed") {
          handleCompletion(data?.result);
        } else if (status === "failed") {
          handleFailure(data?.error);
        }
      };

      // Sockets give near-instant updates, but the job can complete before the
      // "join_job" ack lands (or the socket connection can drop/never connect on some
      // networks/proxies) and we'd otherwise sit on "Generating..." forever with no
      // way out. Poll the REST endpoint as a backstop regardless of socket state.
      pollInterval = setInterval(async () => {
        try {
          const statusRes = await getTaskStatus(taskId);
          applyStatus(statusRes.data?.status, statusRes.data);
        } catch (err) {
          console.error("Failed to poll task status", err);
        }
      }, 4000);

      socket = io(BACKEND_URL);

      socket.on("connect", async () => {
        socket.emit("join_job", taskId);

        try {
          const statusRes = await getTaskStatus(taskId);
          applyStatus(statusRes.data?.status, statusRes.data);
        } catch (err) {
          console.error("Failed to fetch initial task status", err);
        }
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection failed, relying on polling", err);
      });

      socket.on("job_status", (data) => {
        if (data.taskId && data.taskId !== taskId) return;
        if (data.progress) setJobProgress(data.progress);
        if (data.message) setJobMessage(data.message);
        applyStatus(data.status, data);
      });

    } catch (err) {
      toast.error(err.message || "Failed to start generation");
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-in fade-in zoom-in-95">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-600" /> Create a Label
        </h1>
        <p className="text-gray-500 mt-2">Generate label text from product data, then review the field-by-field report before sign-off.</p>
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
                  Required - this label is always scoped to one company, there is no global option.
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
                Product facts - pin down details the AI should not guess
              </span>
              <p className="text-[11px] text-amber-800 mt-1">
                These hints become guardrails for the label text. They reduce guesses around indications, species, and dose instructions.
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
                  <p className="text-[11px] text-gray-500 mt-1">Required because the same ingredients can legally support different claims depending on intended use.</p>
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
                  <p className="text-[11px] text-gray-500 mt-1">Species can change required warnings, withdrawal periods, and whether a rule applies.</p>
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
                  <p className="text-[11px] text-gray-500 mt-1">Dosage wording is often a compliance-critical value, so the label should not invent it.</p>
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
                <p className="text-[11px] text-gray-500 mt-1">Chooses which country's regulatory wording and validation context the label should target.</p>
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
                <p className="text-[11px] text-gray-500 mt-1">Controls the language the generated label text is written in.</p>
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
