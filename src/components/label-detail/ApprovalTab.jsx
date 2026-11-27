import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertCircle, ShieldCheck, ShieldAlert, Award, RotateCcw, AlertTriangle, Users, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { getApprovals, postApprove, postRevoke } from "../../services/apiGeneratedLabels";
import { useAuth } from "../../context/AuthContext";
import Button from "../../ui/Button";
import { LABEL_FIELD_CATALOG, provenanceForField } from "../../utils/labelFieldCatalog";
import { fmtDateTime, t } from "../../i18n";

// Turns a raw field path ("activeIngredients[0].amount") into something a
// signer can actually read without knowing the schema.
function friendlyFieldLabel(path) {
  const nested = path.match(/^([a-zA-Z]+)\[(\d+)\]\.(.+)$/);
  if (nested) {
    const [, base, idx, sub] = nested;
    const entry = LABEL_FIELD_CATALOG.find((f) => f.path === base);
    return `${entry?.label || base} — ingredient ${Number(idx) + 1} ${sub}`;
  }
  const entry = LABEL_FIELD_CATALOG.find((f) => f.path === path);
  return entry?.label || path;
}

export default function ApprovalTab({ label, latestValidation, currentVersion, provenance, onApprovalChanged, acknowledge = [] }) {
  const { user } = useAuth();
  // Mirrors the backend's assertCanPublishGlobal (labelApprovalController.js):
  // a company account can never publish globally, and a system user needs the
  // specific publish_global_reference grant, not just approve_labels.
  const canPublishGlobal = !user?.isCompany && Boolean(user?.role?.permissions?.includes("publish_global_reference"));
  const [approvals, setApprovals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for approval
  const [signedEstimated, setSignedEstimated] = useState([]);
  const [acknowledgedUnverifiable, setAcknowledgedUnverifiable] = useState([]);
  const [scope, setScope] = useState("company");
  const [note, setNote] = useState("");
  const [secondApproverUserId, setSecondApproverUserId] = useState("");

  // Revoke modal state
  const [revokingApproval, setRevokingApproval] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  const estimatedFields = label?.labelData?.estimatedFields || [];
  const unverifiableVerdicts = (latestValidation?.verdicts || []).filter((v) => v.status === "UNVERIFIABLE");

  const loadApprovals = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await getApprovals(label.id);
      setApprovals(rows || []);
    } catch (err) {
      toast.error(err.message || t("approvalTab.failedToLoadApprovals"));
    } finally {
      setIsLoading(false);
    }
  }, [label.id]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  // "Continue with this warning" on the label page: that warning arrives ticked (still visible, can be unticked)
  const ackKey = acknowledge.join("|");
  useEffect(() => {
    if (ackKey) setAcknowledgedUnverifiable((prev) => [...new Set([...prev, ...ackKey.split("|")])]);
  }, [ackKey]);

  // Gate evaluations
  const gate1Passed = latestValidation && latestValidation.versionNumber === currentVersion;
  const gate2Passed = latestValidation && latestValidation.passed === true;
  const gate3Passed = unverifiableVerdicts.length === 0 || unverifiableVerdicts.every((v) => acknowledgedUnverifiable.includes(v.path));
  const gate4Passed = estimatedFields.length === 0 || estimatedFields.every((f) => signedEstimated.includes(f));
  const gate5NeedsDual = label.autonomyTier === "dual_review";
  const gate5Passed = !gate5NeedsDual || Boolean(secondApproverUserId.trim());
  const gate6Passed = (latestValidation?.coveragePercent ?? 100) >= 95;

  const allGatesPassed = gate1Passed && gate2Passed && gate3Passed && gate4Passed && gate5Passed && gate6Passed;

  const toggleSignEstimated = (field) => {
    setSignedEstimated((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const toggleAcknowledgeUnverifiable = (path) => {
    setAcknowledgedUnverifiable((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const handleApprove = async () => {
    if (!allGatesPassed) {
      toast.error(t("approvalTab.all6ApprovalGatesMust"));
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        expectedVersion: currentVersion,
        signedEstimatedFields: signedEstimated,
        acknowledgedUnverifiable,
        scope,
        note: note.trim() || undefined,
        secondApproverUserId: gate5NeedsDual ? secondApproverUserId.trim() : undefined,
      };

      const result = await postApprove(label.id, payload);
      toast.success(t("approvalTab.labelVersionVApprovedAnd", { currentVersion }));
      await loadApprovals();
      onApprovalChanged?.();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t("approvalTab.failedToApproveLabel");
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeReason.trim()) {
      toast.error(t("approvalTab.pleaseProvideAReasonFor"));
      return;
    }

    try {
      setIsRevoking(true);
      const result = await postRevoke(label.id, revokingApproval.id, revokeReason.trim());
      toast.success(
        t("approvalTab.approvalRevokedDependentLabelsMarked", { v: result.affectedLabelIds?.length || 0 })
      );
      setRevokingApproval(null);
      setRevokeReason("");
      await loadApprovals();
      onApprovalChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || t("approvalTab.failedToRevokeApproval"));
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 6-Gate Compliance Checklist */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />{" "}{t("approvalTab.regulatedApprovalGatesSection12")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t("approvalTab.signingALabelPromotesIt")}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
            allGatesPassed ? "bg-green-50 text-green-800 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"
          }`}>
            {allGatesPassed ? t("approvalTab.readyForSignature") : t("approvalTab.gatesPending")}
          </span>
        </div>

        <div className="space-y-4">
          {/* Gate 1 */}
          <div className="flex items-start gap-3 text-sm">
            {gate1Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold text-gray-900">{t("approvalTab.gate1FreshValidationReport")}</p>
              <p className="text-xs text-gray-500">
                {gate1Passed
                  ? t("approvalTab.reportMatchesCurrentVersionV", { currentVersion })
                  : t("approvalTab.stale", { latest: latestValidation?.versionNumber || "—", current: currentVersion })}
              </p>
            </div>
          </div>

          {/* Gate 2 */}
          <div className="flex items-start gap-3 text-sm">
            {gate2Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold text-gray-900">{t("approvalTab.gate2ZeroRegulatoryFailures")}</p>
              <p className="text-xs text-gray-500">
                {gate2Passed
                  ? t("approvalTab.allDeterministicAndComplianceRule")
                  : t("approvalTab.validationReportContainsErrorS", { v: latestValidation?.errorCount || 0 })}
              </p>
            </div>
          </div>

          {/* Gate 3 */}
          <div className="flex items-start gap-3 text-sm">
            {gate3Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{t("approvalTab.gate3UnverifiableVerdictsAcknowledged")}</p>
              {unverifiableVerdicts.length === 0 ? (
                <p className="text-xs text-gray-500">{t("approvalTab.noUnverifiableVerdictsInCurrent")}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-amber-800">{t("approvalTab.theFollowingFieldsCouldNot")}</p>
                  {unverifiableVerdicts.map((v) => (
                    <label key={v.path} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgedUnverifiable.includes(v.path)}
                        onChange={() => toggleAcknowledgeUnverifiable(v.path)}
                        className="rounded text-blue-600"
                      />
                      {v.ruleKey === "NO_AUTHORITATIVE_REQUIREMENTS" ? (
                        <span>
                          <strong>{t("approvalTab.noRulesFor")}{" "}{label.country}</strong>{" "}{t("approvalTab.iApproveWithoutTheRegulatory")}</span>
                      ) : (
                        <span>{t("approvalTab.iAcknowledgeUnverifiableCheckOn")}{" "}<strong>{v.path}</strong> ({v.message || t("approvalTab.manualCheckRequired")})</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Gate 4 */}
          <div className="flex items-start gap-3 text-sm">
            {gate4Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{t("approvalTab.gate4PerFieldEstimated")}</p>
              {estimatedFields.length === 0 ? (
                <p className="text-xs text-gray-500">{t("approvalTab.noEstimatedInferredFieldsIn")}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-amber-800">{t("approvalTab.signingAnEstimatedValueIs")}</p>
                  {estimatedFields.map((field) => {
                    const basis = provenanceForField(provenance, field).find((p) => p.key === field)?.estimateBasis;
                    return (
                      <label key={field} className="flex items-start gap-2 text-xs text-gray-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={signedEstimated.includes(field)}
                          onChange={() => toggleSignEstimated(field)}
                          className="rounded text-amber-600 mt-0.5"
                        />
                        <span>{t("approvalTab.iFormallyVerifyAndSign")}{" "}<strong>{friendlyFieldLabel(field)}</strong>
                          {basis && <span className="block mt-1 text-amber-800 italic">{basis}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Gate 5 */}
          <div className="flex items-start gap-3 text-sm">
            {gate5Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{t("approvalTab.gate5AutonomyTierSeparation")}</p>
              <p className="text-xs text-gray-500">{t("approvalTab.tier")}{" "}<span className="font-mono font-bold uppercase">{label.autonomyTier || t("approvalTab.standard")}</span>{" "}{t("approvalTab.riskScore")}{" "}{label.riskScore ?? t("approvalTab.nA")}
              </p>
              {gate5NeedsDual && (
                <div className="mt-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t("approvalTab.secondApproverUserIdDual")}</label>
                  <input
                    type="text"
                    value={secondApproverUserId}
                    onChange={(e) => setSecondApproverUserId(e.target.value)}
                    placeholder={t("approvalTab.enterUserIdOfSecond")}
                    className="w-full text-xs rounded-xl border border-gray-300 p-2.5"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Gate 6 */}
          <div className="flex items-start gap-3 text-sm">
            {gate6Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold text-gray-900">{t("approvalTab.gate6BackingDocumentsCoverage")}</p>
              <p className="text-xs text-gray-500">
                {gate6Passed
                  ? t("approvalTab.regulatoryDocumentsCoverageIs95", { v: latestValidation?.coveragePercent?.toFixed(1) || 100 })
                  : t("approvalTab.regulatoryDocumentCoverageIsBelow", { v: latestValidation?.coveragePercent?.toFixed(1) })}
              </p>
            </div>
          </div>
        </div>

        {/* Approval Form */}
        <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t("approvalTab.promotionScope")}</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full text-sm rounded-xl border border-gray-300 p-2.5 bg-white"
              >
                <option value="company">{t("approvalTab.companyPrivateReferenceForThis")}</option>
                {canPublishGlobal && <option value="global">{t("approvalTab.globalPublishAsAnAuthoritative")}</option>}
              </select>
              {!canPublishGlobal && (
                <p className="text-[11px] text-gray-400 mt-1">{t("approvalTab.globalPromotionRequiresThePublish")}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t("approvalTab.approvalNoteOptional")}</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("approvalTab.eGApprovedForExport")}
                className="w-full text-sm rounded-xl border border-gray-300 p-2.5"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleApprove}
              disabled={!allGatesPassed || isSubmitting}
              isLoading={isSubmitting}
              className="px-6 py-2.5 font-bold"
            >
              <Award className="w-4 h-4" />{" "}{t("approvalTab.formallyApprovePromoteReference")}</Button>
          </div>
        </div>
      </div>

      {/* Approvals History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />{" "}{t("approvalTab.approvalPromotionHistory")}</h3>

        {isLoading ? (
          <div className="text-center py-6">
            <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block" />
          </div>
        ) : approvals.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{t("approvalTab.noFormalApprovalsHaveBeen")}</p>
        ) : (
          <div className="space-y-3">
            {approvals.map((app) => {
              const isRevoked = Boolean(app.revokedAt);
              return (
                <div
                  key={app.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-4 flex-wrap ${
                    isRevoked ? "bg-gray-50 border-gray-200 opacity-75" : "bg-blue-50/40 border-blue-200"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{t("approvalTab.versionVApproved", { approvedVersion: app.approvedVersion })}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isRevoked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                      }`}>
                        {isRevoked ? t("approvalTab.revoked") : t("approvalTab.activeReference")}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 mt-1">{t("approvalTab.approvedBy")}{" "}<strong>{app.approverName || t("approvalTab.authorizedReviewer")}</strong> ({app.approverRole || t("approvalTab.staff")}{t("approvalTab.on", { toLocaleString: fmtDateTime(app.approvedAt) })}</p>

                    {app.promotedReferenceId && (
                      <p className="text-xs text-blue-700 font-mono mt-0.5">{t("approvalTab.promotedReferenceId", { promotedReferenceId: app.promotedReferenceId })}</p>
                    )}

                    {app.note && <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{app.note}&rdquo;</p>}

                    {isRevoked && (
                      <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                        <p className="font-bold">{t("approvalTab.revocationReason")}{" "}{app.revocationReason}</p>
                        <p className="text-[10px] text-gray-500">{t("approvalTab.revokedAt")}{" "}{fmtDateTime(app.revokedAt)}</p>
                      </div>
                    )}
                  </div>

                  {!isRevoked && (
                    <Button
                      variant="secondary"
                      onClick={() => setRevokingApproval(app)}
                      className="text-xs text-red-600 hover:text-red-800 border-red-200 hover:bg-red-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />{" "}{t("approvalTab.revokeApproval")}</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revoke Modal */}
      {revokingApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-600" />{" "}{t("approvalTab.revokeApprovalV", { approvedVersion: revokingApproval.approvedVersion })}</h3>
            <p className="text-xs text-gray-600 mb-4">{t("approvalTab.revokingWillMarkThePromoted")}{" "}<strong>{t("approvalTab.needingReview")}</strong>.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">{t("approvalTab.reasonForRevocation")}</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={3}
                placeholder={t("approvalTab.eGDiscoveredUpdatedGuideline")}
                className="w-full text-xs rounded-xl border border-gray-300 p-3 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRevokingApproval(null)} disabled={isRevoking}>{t("approvalTab.cancel")}</Button>
              <Button
                onClick={handleRevoke}
                isLoading={isRevoking}
                className="bg-red-600 hover:bg-red-700 text-white"
              >{t("approvalTab.confirmRevocation")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
