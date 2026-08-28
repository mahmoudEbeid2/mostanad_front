import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Tags, RefreshCw, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { getLabel, postValidate } from "../services/apiGeneratedLabels";
import LabelFieldsPanel from "../components/LabelFieldsPanel";
import VersionsTab from "../components/label-detail/VersionsTab";
import Button from "../ui/Button";

const STATUS_CLASSES = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  validated: "bg-green-50 text-green-800 border-green-200",
  failed_validation: "bg-red-50 text-red-800 border-red-200",
  approved: "bg-blue-50 text-blue-800 border-blue-200",
  revoked: "bg-orange-50 text-orange-800 border-orange-200",
  archived: "bg-gray-50 text-gray-500 border-gray-200",
};

const TABS = [
  { key: "overview", label: "Label & Validation" },
  { key: "versions", label: "Version History" },
];

export default function LabelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null); // { label, currentVersion, latestValidation, provenance }
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const d = await getLabel(id);
      setDetail(d);
    } catch (err) {
      setLoadError(err.message || "Failed to load label");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleRunValidation = async () => {
    try {
      setIsValidating(true);
      const report = await postValidate(id);
      setDetail((prev) => (prev ? { ...prev, latestValidation: report } : prev));
      toast.success(report.passed ? "Validation passed." : `Validation found ${report.errorCount} error(s).`);
    } catch (err) {
      toast.error(err.message || "Failed to run validation");
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{loadError}</span>
          <button onClick={load} className="ml-auto font-bold underline">Retry</button>
        </div>
      </div>
    );
  }

  if (!detail?.label) return null;
  const { label, latestValidation, provenance } = detail;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <button onClick={() => navigate("/labels/browse")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to labels
      </button>

      <div className="mb-6 flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Tags className="w-8 h-8 text-blue-600" />
            {label.labelData?.productName?.translations?.en || "Generated Label"}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${STATUS_CLASSES[label.status] || STATUS_CLASSES.draft}`}>
              {label.status?.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-gray-500 font-mono">v{label.currentVersion}</span>
            <span className="text-xs text-gray-500">{label.country} · {label.language}</span>
            {label.riskScore != null && (
              <span className="text-xs text-gray-500">Risk score: {label.riskScore} ({label.autonomyTier})</span>
            )}
          </div>
        </div>
        <Button onClick={handleRunValidation} isLoading={isValidating} variant="secondary">
          <RefreshCw className="w-4 h-4" /> Re-run Validation
        </Button>
      </div>

      {!latestValidation ? (
        <div className="mb-6 flex items-center gap-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>This label has not been validated at its current version yet. Run validation to get a field-by-field report.</span>
        </div>
      ) : latestValidation.versionNumber !== label.currentVersion ? (
        <div className="mb-6 flex items-center gap-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>
            The latest validation report is for version {latestValidation.versionNumber}, but this label is now at
            version {label.currentVersion}. Re-run validation before relying on it.
          </span>
        </div>
      ) : (
        <div className={`mb-6 p-5 rounded-2xl border-2 flex items-center justify-between flex-wrap gap-3 ${
          latestValidation.passed ? "bg-green-50 border-green-500 text-green-800" : "bg-red-50 border-red-500 text-red-800"
        }`}>
          <div className="flex items-center gap-3">
            {latestValidation.passed ? <CheckCircle2 className="w-7 h-7 flex-shrink-0" /> : <AlertCircle className="w-7 h-7 flex-shrink-0" />}
            <div>
              <p className="text-xl font-black uppercase tracking-wide">{latestValidation.passed ? "Passed" : "Failed"}</p>
              <p className="text-sm opacity-80">
                {latestValidation.errorCount} error(s), {latestValidation.warningCount} warning(s) · engine {latestValidation.engineVersion}
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            {latestValidation.coveragePercent != null ? (
              <p className="font-bold">Document coverage: {latestValidation.coveragePercent.toFixed(1)}%</p>
            ) : (
              <p className="text-xs opacity-70">No coverage figure recorded</p>
            )}
            <p className="text-xs opacity-70">{latestValidation.rulesetIds?.length || 0} rule(s) applied</p>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200 mb-6 flex gap-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
              activeTab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <LabelFieldsPanel
          labelData={label.labelData}
          verdicts={latestValidation?.verdicts}
          provenance={provenance}
        />
      )}

      {activeTab === "versions" && (
        <VersionsTab
          labelId={id}
          currentVersion={label.currentVersion}
          onRestored={async () => {
            await load();
            setActiveTab("overview");
          }}
        />
      )}
    </div>
  );
}
