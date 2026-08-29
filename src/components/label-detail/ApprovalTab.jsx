import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertCircle, ShieldCheck, ShieldAlert, Award, RotateCcw, AlertTriangle, Users, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { getApprovals, postApprove, postRevoke } from "../../services/apiGeneratedLabels";
import { useAuth } from "../../context/AuthContext";
import Button from "../../ui/Button";

export default function ApprovalTab({ label, latestValidation, currentVersion, onApprovalChanged }) {
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
      toast.error(err.message || "Failed to load approvals");
    } finally {
      setIsLoading(false);
    }
  }, [label.id]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

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
      toast.error("All 6 approval gates must be cleared before signing.");
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
      toast.success(`Label version v${currentVersion} approved and promoted to Reference Label!`);
      await loadApprovals();
      onApprovalChanged?.();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to approve label";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeReason.trim()) {
      toast.error("Please provide a reason for revocation.");
      return;
    }

    try {
      setIsRevoking(true);
      const result = await postRevoke(label.id, revokingApproval.id, revokeReason.trim());
      toast.success(
        `Approval revoked. ${result.affectedLabelIds?.length || 0} dependent labels marked as needing review.`
      );
      setRevokingApproval(null);
      setRevokeReason("");
      await loadApprovals();
      onApprovalChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to revoke approval");
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
              <ShieldCheck className="w-5 h-5 text-blue-600" /> Regulated Approval Gates (Section 12)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Signing a label promotes it to an authoritative reference label. All six criteria must be met.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
            allGatesPassed ? "bg-green-50 text-green-800 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"
          }`}>
            {allGatesPassed ? "Ready for Signature" : "Gates Pending"}
          </span>
        </div>

        <div className="space-y-4">
          {/* Gate 1 */}
          <div className="flex items-start gap-3 text-sm">
            {gate1Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold text-gray-900">Gate 1: Fresh Validation Report</p>
              <p className="text-xs text-gray-500">
                {gate1Passed
                  ? `Report matches current version (v${currentVersion}).`
                  : `Validation is stale or missing (Latest: v${latestValidation?.versionNumber || "none"}, Current: v${currentVersion}). Re-run validation.`}
              </p>
            </div>
          </div>

          {/* Gate 2 */}
          <div className="flex items-start gap-3 text-sm">
            {gate2Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="font-semibold text-gray-900">Gate 2: Zero Regulatory Failures</p>
              <p className="text-xs text-gray-500">
                {gate2Passed
                  ? "All deterministic and compliance rule checks passed."
                  : `Validation report contains ${latestValidation?.errorCount || 0} error(s). Cannot approve with active failures.`}
              </p>
            </div>
          </div>

          {/* Gate 3 */}
          <div className="flex items-start gap-3 text-sm">
            {gate3Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Gate 3: UNVERIFIABLE Verdicts Acknowledged</p>
              {unverifiableVerdicts.length === 0 ? (
                <p className="text-xs text-gray-500">No unverifiable verdicts in current report.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-amber-800">
                    The following fields could not be verified automatically. Explicit human acknowledgment is required:
                  </p>
                  {unverifiableVerdicts.map((v) => (
                    <label key={v.path} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgedUnverifiable.includes(v.path)}
                        onChange={() => toggleAcknowledgeUnverifiable(v.path)}
                        className="rounded text-blue-600"
                      />
                      <span>I acknowledge unverifiable check on: <strong>{v.path}</strong> ({v.message || "Manual check required"})</span>
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
              <p className="font-semibold text-gray-900">Gate 4: Per-Field Estimated Values Signature</p>
              {estimatedFields.length === 0 ? (
                <p className="text-xs text-gray-500">No estimated/inferred fields in this label.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-amber-800">
                    Signing an estimated value is a legal commitment on regulated output. Check each field deliberately:
                  </p>
                  {estimatedFields.map((field) => (
                    <label key={field} className="flex items-center gap-2 text-xs text-gray-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signedEstimated.includes(field)}
                        onChange={() => toggleSignEstimated(field)}
                        className="rounded text-amber-600"
                      />
                      <span>I formally verify and sign the estimated value for: <strong>{field}</strong></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Gate 5 */}
          <div className="flex items-start gap-3 text-sm">
            {gate5Passed ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Gate 5: Autonomy Tier & Separation of Duties</p>
              <p className="text-xs text-gray-500">
                Tier: <span className="font-mono font-bold uppercase">{label.autonomyTier || "standard"}</span> · Risk Score: {label.riskScore ?? "N/A"}
              </p>
              {gate5NeedsDual && (
                <div className="mt-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Second Approver User ID (Dual Review Required)
                  </label>
                  <input
                    type="text"
                    value={secondApproverUserId}
                    onChange={(e) => setSecondApproverUserId(e.target.value)}
                    placeholder="Enter User ID of second independent reviewer..."
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
              <p className="font-semibold text-gray-900">Gate 6: Backing Documents Coverage</p>
              <p className="text-xs text-gray-500">
                {gate6Passed
                  ? `Regulatory documents coverage is ${latestValidation?.coveragePercent?.toFixed(1) || 100}% (>= 95% threshold).`
                  : `Regulatory document coverage (${latestValidation?.coveragePercent?.toFixed(1)}%) is below the mandatory 95% threshold.`}
              </p>
            </div>
          </div>
        </div>

        {/* Approval Form */}
        <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Promotion Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full text-sm rounded-xl border border-gray-300 p-2.5 bg-white"
              >
                <option value="company">Company (Private Reference for this tenant)</option>
                {canPublishGlobal && <option value="global">Global (Publish as an authoritative reference for all tenants)</option>}
              </select>
              {!canPublishGlobal && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Global promotion requires the publish_global_reference permission on a system account.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Approval Note (Optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Approved for export registration packaging"
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
              <Award className="w-4 h-4" /> Formally Approve & Promote Reference
            </Button>
          </div>
        </div>
      </div>

      {/* Approvals History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" /> Approval & Promotion History
        </h3>

        {isLoading ? (
          <div className="text-center py-6">
            <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block" />
          </div>
        ) : approvals.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No formal approvals have been granted for this label yet.</p>
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
                      <span className="font-bold text-gray-900 text-sm">
                        Version v{app.approvedVersion} Approved
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isRevoked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                      }`}>
                        {isRevoked ? "Revoked" : "Active Reference"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 mt-1">
                      Approved by: <strong>{app.approverName || "Authorized Reviewer"}</strong> ({app.approverRole || "Staff"}) on {new Date(app.approvedAt).toLocaleString()}
                    </p>

                    {app.promotedReferenceId && (
                      <p className="text-xs text-blue-700 font-mono mt-0.5">
                        Promoted Reference ID: {app.promotedReferenceId}
                      </p>
                    )}

                    {app.note && <p className="text-xs text-gray-500 mt-1 italic">&ldquo;{app.note}&rdquo;</p>}

                    {isRevoked && (
                      <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">
                        <p className="font-bold">Revocation Reason: {app.revocationReason}</p>
                        <p className="text-[10px] text-gray-500">Revoked at: {new Date(app.revokedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {!isRevoked && (
                    <Button
                      variant="secondary"
                      onClick={() => setRevokingApproval(app)}
                      className="text-xs text-red-600 hover:text-red-800 border-red-200 hover:bg-red-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Revoke Approval
                    </Button>
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
              <RotateCcw className="w-5 h-5 text-red-600" /> Revoke Approval (v{revokingApproval.approvedVersion})
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Revoking will mark the promoted reference label inactive and flag all other generated labels whose provenance cites this reference as <strong>needing review</strong>.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Reason for Revocation *</label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={3}
                placeholder="e.g. Discovered updated guideline from authority rendering clause 4.2 invalid..."
                className="w-full text-xs rounded-xl border border-gray-300 p-3 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRevokingApproval(null)} disabled={isRevoking}>
                Cancel
              </Button>
              <Button
                onClick={handleRevoke}
                isLoading={isRevoking}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Revocation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
