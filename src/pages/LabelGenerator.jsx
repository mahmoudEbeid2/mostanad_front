import AiAction from "../ui/AiAction";
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
import { LANG, languageName, localizeCountries, t } from "../i18n";

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
        if (!cancelled) setCompaniesError(err.response?.data?.message || t("labelGenerator.failedToLoadCompanies"));
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
    ...localizeCountries(countryList().getData())
  ], []);
  const [selectedCountry, setSelectedCountry] = useState(countryOptions.find(c => c.value === "EG") || countryOptions[0]);

  const languageOptions = useMemo(() => {
    return iso6391.getAllCodes().map((code) => ({ label: languageName(code, iso6391.getName(code)), value: iso6391.getName(code) })).sort((a, b) => a.label.localeCompare(b.label, LANG));
  }, []);
  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions.find(l => l.value === "Arabic") || languageOptions[0]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");

  const handleGenerate = async (e) => {
    e.preventDefault();

    if (!formulationText.trim()) return toast.error(t("labelGenerator.pleaseEnterTheProductFormulation"));
    if (!aimOfUseHint.trim()) return toast.error(t("labelGenerator.pleaseEnterTheConfirmedAim"));
    if (!selectedCountry) return toast.error(t("labelGenerator.pleaseSelectATargetCountry"));
    if (!selectedLanguage) return toast.error(t("labelGenerator.pleaseSelectATargetLanguage"));
    if (!companyUser && !selectedCompany) {
      return toast.error(t("labelGenerator.pleaseSelectWhichCompanyThis"));
    }

    try {
      setIsGenerating(true);
      setJobProgress(0);
      setJobMessage(t("labelGenerator.startingAiLabelGeneration"));

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

      toast.success(t("labelGenerator.aiIsWritingYourLabel"));

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
          toast.success(t("labelGenerator.labelGeneratedSuccessfully"));
          navigate(`/labels/detail/${newLabelId}`);
        } else {
          // Contract says this can't happen post-Phase-1, but don't silently show
          // nothing if it ever does.
          toast.error(t("labelGenerator.theGenerationTaskCompletedBut"));
        }
      };

      const handleFailure = (message) => {
        if (settled) return;
        settled = true;
        cleanup();
        setIsGenerating(false);
        toast.error(message || t("labelGenerator.aiGenerationFailed"));
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
      toast.error(err.message || t("labelGenerator.failedToStartGeneration"));
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-in fade-in zoom-in-95">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-600" />{" "}{t("labelGenerator.createALabel")}</h1>
        <p className="text-gray-500 mt-2">{t("labelGenerator.generateLabelTextFromProduct")}</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleGenerate} className="space-y-6">
            {!companyUser && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t("labelGenerator.company")}{" "}<span className="text-red-600">*</span>
                </label>
                <Select
                  options={companyOptions}
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  isLoading={companiesLoading}
                  isDisabled={isGenerating}
                  placeholder={companiesError ? t("labelGenerator.failedToLoadCompanies") : t("labelGenerator.selectTheCompanyThisLabel")}
                  className="text-sm"
                  noOptionsMessage={() => (companiesLoading ? t("labelGenerator.loading") : t("labelGenerator.noCompaniesFound"))}
                />
                {companiesError && (
                  <p className="text-xs text-red-600 mt-1">{companiesError}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">{t("labelGenerator.requiredThisLabelIsAlways")}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t("labelGenerator.productFormulationDetails")}</label>
              <textarea
                value={formulationText}
                onChange={(e) => setFormulationText(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                rows="8"
                placeholder={t("labelGenerator.eGAVeterinaryLiquid")}
                disabled={isGenerating}
                required
              />
              <p className="text-[11px] text-gray-500 mt-1">{t("labelGenerator.theMoreDetailsYouProvide")}</p>
            </div>

            <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4">
              <span className="text-sm font-bold text-amber-900">{t("labelGenerator.productFactsPinDownDetails")}</span>
              <p className="text-[11px] text-amber-800 mt-1">{t("labelGenerator.theseHintsBecomeGuardrailsFor")}</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t("labelGenerator.confirmedAimOfUseIndication")}{" "}<span className="text-red-600">*</span>
                  </label>
                  <input
                    value={aimOfUseHint}
                    onChange={(e) => setAimOfUseHint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder={t("labelGenerator.exampleUrinaryAcidifierUsedTo")}
                    disabled={isGenerating}
                    required
                  />
                  <p className="text-[11px] text-gray-500 mt-1">{t("labelGenerator.requiredBecauseTheSameIngredients")}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t("labelGenerator.confirmedTargetAnimalSpecies")}</label>
                  <input
                    value={targetSpeciesHint}
                    onChange={(e) => setTargetSpeciesHint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder={t("labelGenerator.exampleCowBuffaloCamelSheep")}
                    disabled={isGenerating}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">{t("labelGenerator.speciesCanChangeRequiredWarnings")}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{t("labelGenerator.confirmedDirectionOfUseDosage")}</label>
                  <input
                    value={directionOfUseHint}
                    onChange={(e) => setDirectionOfUseHint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder={t("labelGenerator.exampleSheepAndGoats5g")}
                    disabled={isGenerating}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">{t("labelGenerator.dosageWordingIsOftenA")}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t("labelGenerator.targetCountryFdaRules")}</label>
                <Select
                  options={countryOptions}
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  className="text-sm"
                  isDisabled={isGenerating}
                />
                <p className="text-[11px] text-gray-500 mt-1">{t("labelGenerator.choosesWhichCountrysRegulatoryWording")}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t("labelGenerator.targetLanguage")}</label>
                <Select
                  options={languageOptions}
                  value={selectedLanguage}
                  onChange={setSelectedLanguage}
                  className="text-sm"
                  isDisabled={isGenerating}
                />
                <p className="text-[11px] text-gray-500 mt-1">{t("labelGenerator.controlsTheLanguageTheGenerated")}</p>
              </div>
            </div>

            <AiAction><Button type="submit" isLoading={isGenerating} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" /> {isGenerating ? t("labelGenerator.generatingLabel") : t("labelGenerator.writeLabelText")}
            </Button></AiAction>
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
