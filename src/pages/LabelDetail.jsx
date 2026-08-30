import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Tags, RefreshCw, CheckCircle2, AlertCircle, ShieldAlert, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { getLabel, postValidate } from "../services/apiGeneratedLabels";
import LabelFieldsPanel from "../components/LabelFieldsPanel";
import VerdictList from "../components/VerdictList";
import VersionsTab from "../components/label-detail/VersionsTab";
import EditFieldModal from "../components/label-detail/EditFieldModal";
import ChatTab from "../components/label-detail/ChatTab";
import ApprovalTab from "../components/label-detail/ApprovalTab";
import ExtractionTab from "../components/label-detail/ExtractionTab";
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
  { key: "overview", label: "Report" },
  { key: "chat", label: "Assistant" },
  { key: "approval", label: "Sign-off" },
  { key: "extraction", label: "Extraction", detailedOnly: true },
  { key: "versions", label: "Versions", detailedOnly: true },
];

function countStatuses(verdicts = []) {
  return verdicts.reduce((acc, verdict) => {
    acc[verdict.status] = (acc[verdict.status] || 0) + 1;
    return acc;
  }, {});
}

function verdictBand(latestValidation) {
  const counts = countStatuses(latestValidation?.verdicts || []);
  const failCount = counts.FAIL || 0;
  const confirmCount = counts.NEEDS_CONFIRMATION || 0;
  const reviewCount = counts.NEEDS_REVIEW || 0;
  const unverifiableCount = counts.UNVERIFIABLE || 0;
  const warnCount = counts.WARN || 0;

  if (!latestValidation) {
    return {
      title: "Cannot fully check yet",
      body: "Run validation to get a field-by-field report.",
      icon: ShieldAlert,
      classes: "bg-amber-50 border-amber-300 text-amber-900",
    };
  }
  if (failCount > 0) {
    return {
      title: `Not ready - ${failCount} ${failCount === 1 ? "thing must" : "things must"} be fixed`,
      body: "Start with Must fix below. Nothing blocking is hidden.",
      icon: AlertCircle,
      classes: "bg-red-50 border-red-400 text-red-900",
    };
  }
  if (confirmCount + reviewCount > 0) {
    return {
      title: `Needs you - ${confirmCount + reviewCount} ${confirmCount + reviewCount === 1 ? "thing" : "things"} to confirm`,
      body: "The label may be close, but these values need a human decision.",
      icon: ShieldAlert,
      classes: "bg-orange-50 border-orange-300 text-orange-900",
    };
  }
  if (unverifiableCount > 0) {
    return {
      title: "Cannot fully check",
      body: `${unverifiableCount} ${unverifiableCount === 1 ? "rule could" : "rules could"} not be checked with the approved rules on file.`,
      icon: ShieldAlert,
      classes: "bg-indigo-50 border-indigo-300 text-indigo-900",
    };
  }
  if (warnCount > 0) {
    return {
      title: "Ready with notes",
      body: `${warnCount} ${warnCount === 1 ? "thing is" : "things are"} worth a look, but nothing is blocking.`,
      icon: CheckCircle2,
      classes: "bg-amber-50 border-amber-300 text-amber-900",
    };
  }
  return {
    title: "Ready - nothing blocking",
    body: "No blocking failures were found.",
    icon: CheckCircle2,
    classes: "bg-green-50 border-green-400 text-green-900",
  };
}

function validationContext(latestValidation) {
  if (!latestValidation) return null;
  const rules = latestValidation.ruleCount ?? latestValidation.rulesApplied ?? latestValidation.rulesetIds?.length;
  const coverage = latestValidation.coveragePercent != null ? `${latestValidation.coveragePercent.toFixed(1)}% document coverage` : "no coverage figure recorded";
  const rulesText = rules != null ? `${rules} ${rules === 1 ? "rule" : "rules"}` : `${latestValidation.rulesetIds?.length || 0} rulesets`;
  return `Checked at v${latestValidation.versionNumber} - ${rulesText} - ${coverage}`;
}

export default function LabelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null); // { label, currentVersion, latestValidation, provenance }
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [detailedView, setDetailedView] = useState(() => localStorage.getItem("labelDetailDetailedView") === "true");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [showOnlyEstimated, setShowOnlyEstimated] = useState(false);

  // Direct Field Edit State
  const [editingField, setEditingField] = useState(null);

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem("labelDetailDetailedView", detailedView ? "true" : "false");
    if (!detailedView && (activeTab === "extraction" || activeTab === "versions")) {
      setActiveTab("overview");
    }
  }, [activeTab, detailedView]);

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

  const handleAskAssistant = (message) => {
    setAssistantDraft(message);
    setActiveTab("chat");
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
  const band = verdictBand(latestValidation);
  const BandIcon = band.icon;
  const visibleTabs = TABS.filter((tab) => detailedView || !tab.detailedOnly);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <button
        onClick={() => navigate("/labels/browse")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
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
            {label.needsReview && (
              <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300">
                Needs Review
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm">
            <input
              type="checkbox"
              checked={detailedView}
              onChange={(event) => setDetailedView(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            Detailed view
          </label>
          <Button onClick={handleRunValidation} isLoading={isValidating} variant="secondary">
            <RefreshCw className="w-4 h-4" /> Re-run Validation
          </Button>
        </div>
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
      ) : null}

      {detail?.label?.labelData?.estimatedFields?.length > 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold">
              {detail.label.labelData.estimatedFields.length} {detail.label.labelData.estimatedFields.length === 1 ? "value is" : "values are"} the system's estimate — check them before approving.
            </span>
          </div>
          <button
            onClick={() => { setActiveTab("overview"); setShowOnlyEstimated(!showOnlyEstimated); }}
            className={`px-3 py-1.5 text-sm font-bold rounded-lg border transition-colors ${showOnlyEstimated ? "bg-amber-200 border-amber-400 text-amber-900" : "bg-white border-amber-300 text-amber-800 hover:bg-amber-100"}`}
          >
            {showOnlyEstimated ? "Show all fields" : "Show estimates"}
          </button>
        </div>
      )}
      <div className={`mb-6 rounded-2xl border-2 p-5 ${band.classes}`}>
        <div className="flex items-start gap-3">
          <BandIcon className="w-7 h-7 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xl font-black">{band.title}</p>
            <p className="text-sm mt-1">{band.body}</p>
            {validationContext(latestValidation) && (
              <p className="text-xs mt-2 opacity-75">{validationContext(latestValidation)}</p>
            )}
            {detailedView && latestValidation?.engineVersion && (
              <p className="text-xs mt-1 opacity-75">Engine {latestValidation.engineVersion}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 mb-6 flex gap-6 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-3 text-sm font-bold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Label Fields & Verdicts Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {latestValidation?.verdicts?.length > 0 && (
            <div>
              <h2 className="text-lg font-black text-gray-900 mb-3">What needs attention</h2>
              <VerdictList
                verdicts={latestValidation.verdicts}
                detailedView={detailedView}
                onEditField={(field) => setEditingField(field)}
                onAskAssistant={handleAskAssistant}
              />
            </div>
          )}
          <div>
            <h2 className="text-lg font-black text-gray-900 mb-3">Label fields</h2>
            <LabelFieldsPanel
              labelData={label.labelData}
              verdicts={latestValidation?.verdicts}
              provenance={provenance}
              onEditField={(field) => setEditingField(field)}
              onAskAssistant={handleAskAssistant}
              detailedView={detailedView}
              showOnlyEstimated={showOnlyEstimated}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Chat & AI Edits */}
      {activeTab === "chat" && (
        <ChatTab
          labelId={id}
          currentVersion={label.currentVersion}
          initialMessage={assistantDraft}
          onLabelUpdated={load}
        />
      )}

      {/* Tab 3: Extraction Verification (§14.5) */}
      {activeTab === "extraction" && (
        <ExtractionTab
          labelId={id}
          labelData={label.labelData}
          currentVersion={label.currentVersion}
          onFieldConfirmed={load}
        />
      )}

      {/* Tab 4: Approval & Release */}
      {activeTab === "approval" && (
        <ApprovalTab
          label={label}
          latestValidation={latestValidation}
          currentVersion={label.currentVersion}
          onApprovalChanged={load}
        />
      )}

      {/* Tab 5: Versions History & Diff */}
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

      {/* Direct Field Edit Modal */}
      {editingField && (
        <EditFieldModal
          isOpen={Boolean(editingField)}
          field={editingField}
          currentValue={label.labelData?.[editingField.path]}
          labelId={id}
          expectedVersion={label.currentVersion}
          onClose={() => setEditingField(null)}
          onSuccess={() => {
            load();
            setEditingField(null);
          }}
        />
      )}
    </div>
  );
}
