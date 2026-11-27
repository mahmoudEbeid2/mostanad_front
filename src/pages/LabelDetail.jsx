import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Tags, RefreshCw, CheckCircle2, AlertCircle, ShieldAlert, SlidersHorizontal, MessageSquarePlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { getLabel, postValidate } from "../services/apiGeneratedLabels";
import LabelFieldsPanel from "../components/LabelFieldsPanel";
import VerdictList from "../components/VerdictList";
import EditFieldModal from "../components/label-detail/EditFieldModal";
import ChatTab from "../components/label-detail/ChatTab";
import ApprovalTab from "../components/label-detail/ApprovalTab";
import LayoutSizeTab from "../components/label-detail/LayoutSizeTab";
import RulesForCountryModal from "../components/label-detail/RulesForCountryModal";
import Button from "../ui/Button";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser } from "../utils/permissions";
import { t } from "../i18n";

const STATUS_CLASSES = {
  draft: "bg-gray-50 text-gray-600 border-gray-200",
  validated: "bg-green-50 text-green-800 border-green-200",
  failed_validation: "bg-red-50 text-red-800 border-red-200",
  approved: "bg-blue-50 text-blue-800 border-blue-200",
  revoked: "bg-orange-50 text-orange-800 border-orange-200",
  archived: "bg-gray-50 text-gray-500 border-gray-200",
};



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
      title: t("labelDetail.cannotFullyCheckYet"),
      body: t("labelDetail.runValidationToGetA"),
      icon: ShieldAlert,
      classes: "bg-amber-50 border-amber-300 text-amber-900",
    };
  }
  if (failCount > 0) {
    return {
      title: t("labelDetail.notReady", { count: failCount }),
      body: t("labelDetail.aiGeneratedTextIsA"),
      icon: AlertCircle,
      classes: "bg-red-50 border-red-400 text-red-900",
      jumpTo: true,
    };
  }
  if (confirmCount + reviewCount > 0) {
    return {
      title: t("labelDetail.needsReview", { count: confirmCount + reviewCount }),
      body: t("labelDetail.nothingFailedOutrightButThese"),
      icon: ShieldAlert,
      classes: "bg-orange-50 border-orange-300 text-orange-900",
      jumpTo: true,
    };
  }
  const onlyRuleGap = unverifiableCount > 0 && (latestValidation.verdicts || []).filter((v) => v.status === "UNVERIFIABLE").every((v) => v.ruleKey === "NO_AUTHORITATIVE_REQUIREMENTS");
  if (onlyRuleGap) {
    return {
      title: t("labelDetail.notCheckedAgainstRulesNone"),
      body: t("labelDetail.nothingFailedYouCanContinue"),
      icon: ShieldAlert,
      classes: "bg-amber-50 border-amber-300 text-amber-900",
    };
  }
  if (unverifiableCount > 0) {
    return {
      title: t("labelDetail.cannotFullyCheck"),
      body: t("labelDetail.notChecked", { count: unverifiableCount }),
      icon: ShieldAlert,
      classes: "bg-indigo-50 border-indigo-300 text-indigo-900",
    };
  }
  if (warnCount > 0) {
    return {
      title: t("labelDetail.readyWithNotes"),
      body: t("labelDetail.worthALook", { count: warnCount }),
      icon: CheckCircle2,
      classes: "bg-amber-50 border-amber-300 text-amber-900",
    };
  }
  return {
    title: t("labelDetail.readyNothingBlocking"),
    body: t("labelDetail.noBlockingFailuresWereFound"),
    icon: CheckCircle2,
    classes: "bg-green-50 border-green-400 text-green-900",
  };
}

function validationContext(latestValidation) {
  if (!latestValidation) return null;
  const rules = latestValidation.ruleCount ?? latestValidation.rulesApplied ?? latestValidation.rulesetIds?.length;
  const coverage = latestValidation.coveragePercent != null ? t("labelDetail.documentCoverage", { v: latestValidation.coveragePercent.toFixed(1) }) : t("labelDetail.noCoverageFigureRecorded");
  const rulesText = rules != null ? `${rules} ${rules === 1 ? "rule" : "rules"}` : `${latestValidation.rulesetIds?.length || 0} rulesets`;
  return t("labelDetail.checkedAtV", { versionNumber: latestValidation.versionNumber, rulesText, coverage });
}

export default function LabelDetail() {
  const { user } = useAuth();
  const isSystem = !(isCompanyUser(user) || user?.isCompany);
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null); // { label, currentVersion, latestValidation, provenance }
  // ?tab=layout opens "Layout & size" (the assistant links there after a resize)
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("tab") === "layout" ? "layout" : "content";
  const setView = (v) => setSearchParams(v === "layout" ? { tab: "layout" } : {}, { replace: true });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showOnlyEstimated, setShowOnlyEstimated] = useState(false);
  const [detailedView, setDetailedView] = useState(() => localStorage.getItem("labelDetailDetailedView") === "true");
  // an "Ask Assistant to fix" request: sent as soon as the chat is open (n makes a repeat of the same text a new request)
  const [assistantDraft, setAssistantDraft] = useState(null);

  // "no rules for <country>": continue with the warning (pre-ticked at sign-off) or add the rules
  const [continueWithWarning, setContinueWithWarning] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Direct Field Edit State
  const [editingField, setEditingField] = useState(null);

  const load = useCallback(async () => {
    try {
      if (!detail) setIsLoading(true);
      else setIsRefreshing(true);
      setLoadError(null);
      const d = await getLabel(id);
      setDetail(d);
    } catch (err) {
      setLoadError(err.message || t("labelDetail.failedToLoadLabel"));
    } finally {
      setIsLoading(false);
        setIsRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem("labelDetailDetailedView", detailedView ? "true" : "false");
  }, [detailedView]);

  const handleRunValidation = async () => {
    try {
      setIsValidating(true);
      const report = await postValidate(id);
      setDetail((prev) => (prev ? { ...prev, latestValidation: report } : prev));
      toast.success(report.passed ? t("labelDetail.validationPassed") : t("labelDetail.validationFoundErrorS", { errorCount: report.errorCount }));
    } catch (err) {
      toast.error(err.message || t("labelDetail.failedToRunValidation"));
    } finally {
      setIsValidating(false);
    }
  };

  const handleAskAssistant = (message) => {
    setAssistantDraft({ text: message, n: Date.now() });
    setIsChatOpen(true);
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
          <button onClick={load} className="ms-auto font-bold underline">{t("labelDetail.retry")}</button>
        </div>
      </div>
    );
  }

  if (!detail?.label) return null;
  const { label, latestValidation, provenance } = detail;
  const band = verdictBand(latestValidation);
  const BandIcon = band.icon;
  

  return (
    <div className="flex relative min-h-screen bg-white overflow-hidden">
      {/* Main Content (Left) */}
      <div className={`flex-1 transition-all duration-300 pb-16 px-4 h-screen overflow-y-auto ${isChatOpen ? 'mr-[400px]' : ''}`}>
        <div className="max-w-5xl mx-auto pt-6">
          <button
            onClick={() => navigate("/labels/browse")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />{" "}{t("labelDetail.backToLabels")}</button>

          <div className="mb-6 flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Tags className="w-8 h-8 text-blue-600" />
                {label.labelData?.productName?.translations?.en || t("labelDetail.generatedLabel")}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${STATUS_CLASSES[label.status] || STATUS_CLASSES.draft}`}>
                  {label.status?.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-gray-500 font-mono">v{label.currentVersion}</span>
                <span className="text-xs text-gray-500">{label.country} - {label.language}</span>
                {label.riskScore != null && (
                  <span className="text-xs text-gray-500">{t("labelDetail.riskScore", { riskScore: label.riskScore, autonomyTier: label.autonomyTier })}</span>
                )}
                {label.needsReview && (
                  <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300">{t("labelDetail.needsReview")}</span>
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
                <SlidersHorizontal className="w-4 h-4 text-gray-500" />{t("labelDetail.detailedView")}</label>
              <Button onClick={handleRunValidation} isLoading={isValidating} variant="secondary">
                <RefreshCw className="w-4 h-4" />{" "}{t("labelDetail.reRunValidation")}</Button>
            </div>
          </div>

          <div className="mb-6 flex gap-1 border-b border-gray-200" role="tablist">
            {[
              ["content", "Content & validation"],
              ["layout", "Layout & size"],
            ].map(([k, t]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === k ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
                {t}
              </button>
            ))}
          </div>

          {view === "layout" ? (
            <LayoutSizeTab labelId={id} labelName={label.labelData?.productName?.translations?.en || "label"} companyId={label.companyId} isSystem={isSystem} />
          ) : (
          <>
          <div className="mb-6">
            <h2 className="text-lg font-black text-gray-900 mb-3">{t("labelDetail.labelFields")}</h2>
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

          {!latestValidation ? (
            <div className="mb-6 flex items-center gap-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{t("labelDetail.thisLabelHasNotBeen")}</span>
            </div>
          ) : latestValidation.versionNumber !== label.currentVersion ? (
            <div className="mb-6 flex items-center gap-3 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <span>{t("labelDetail.theLatestValidationReportIs", { versionNumber: latestValidation.versionNumber, currentVersion: label.currentVersion })}</span>
            </div>
          ) : null}

          {detail?.label?.labelData?.estimatedFields?.length > 0 && (
            <div className="mb-6 flex items-center justify-between gap-3 text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-semibold">
                  {t("labelDetail.estimatedValues", { count: detail.label.labelData.estimatedFields.length })}</span>
              </div>
              <button
                onClick={() => setShowOnlyEstimated(!showOnlyEstimated)}
                className={`px-3 py-1.5 text-sm font-bold rounded-lg border transition-colors ${showOnlyEstimated ? 'bg-amber-200 border-amber-400 text-amber-900' : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-100'}`}
              >
                {showOnlyEstimated ? t("labelDetail.showAllFields") : t("labelDetail.showEstimates")}
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
                  <p className="text-xs mt-1 opacity-75">{t("labelDetail.engine")}{" "}{latestValidation.engineVersion}</p>
                )}
                {band.jumpTo && (
                  <button
                    type="button"
                    onClick={() => document.getElementById("verdict-list")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="text-sm font-bold underline mt-2 hover:opacity-75"
                  >{t("labelDetail.seeWhatNeedsAttention")}</button>
                )}
              </div>
            </div>
          </div>

          {latestValidation?.verdicts?.some((v) => v.ruleKey === "NO_AUTHORITATIVE_REQUIREMENTS") && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm" data-testid="rule-gap">
              <p className="font-bold text-gray-900">{t("labelDetail.notCheckedNoRulesFor")}{" "}{label.country}</p>
              <p className="mt-1 text-sm text-gray-700">{t("labelDetail.theRegulatoryCheckNeedsS", { country: label.country })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setContinueWithWarning(true);
                    setTimeout(() => document.getElementById("final-sign-off")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  }}
                  data-testid="continue-with-warning"
                >{t("labelDetail.continueWithThisWarning")}</Button>
                <Button variant="secondary" onClick={() => setRulesOpen(true)} data-testid="add-rules">{t("labelDetail.addRulesFor", { country: label.country })}</Button>
              </div>
            </div>
          )}
          {rulesOpen && (
            <RulesForCountryModal
              country={label.country}
              onClose={() => setRulesOpen(false)}
              onRecheck={async () => {
                await handleRunValidation();
                setRulesOpen(false);
              }}
            />
          )}

          <div className="space-y-6">
            {latestValidation?.verdicts?.length > 0 && (
              <div id="verdict-list">
                <h2 className="text-lg font-black text-gray-900 mb-3">{t("labelDetail.whatNeedsAttention")}</h2>
                <VerdictList
                  verdicts={latestValidation.verdicts}
                  detailedView={detailedView}
                  onEditField={(field) => setEditingField(field)}
                  onAskAssistant={handleAskAssistant}
                  scope={{ country: label.country, productType: label.labelData?.productType || null }}
                />
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-gray-200" id="final-sign-off">
              <h2 className="text-xl font-black mb-4">{t("labelDetail.finalSignOff")}</h2>
              <ApprovalTab
                acknowledge={continueWithWarning ? ["_regulatory"] : []}
                label={label}
                latestValidation={latestValidation}
                currentVersion={label.currentVersion}
                provenance={provenance}
                onApprovalChanged={load}
              />
            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Chat Sidebar (Right) */}
      <div className={`fixed top-0 end-0 h-screen bg-gray-50 border-s border-gray-200 shadow-xl transition-transform duration-300 z-40 w-[400px] ${isChatOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'}`}>
        <div className="h-full flex flex-col pt-[72px] pb-4 px-3">
          <ChatTab
            labelId={id}
            currentVersion={label.currentVersion}
            askRequest={assistantDraft}
            onLabelUpdated={load}
            estimatedFields={label.labelData?.estimatedFields}
            provenance={provenance}
          />
        </div>
      </div>

      {/* Floating Bot Button (if chat closed) */}
      {!isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(true)} 
          className="fixed bottom-6 end-6 p-4 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors z-50 group flex items-center justify-center"
        >
          <MessageSquarePlus className="w-6 h-6" />
        </button>
      )}

      {/* Close Bot Button (if chat open) */}
      {isChatOpen && (
        <button 
          onClick={() => setIsChatOpen(false)} 
          className="fixed top-6 end-[416px] p-2 bg-white text-gray-500 hover:text-gray-900 rounded-full shadow-md z-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
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
