import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, CornerUpLeft, GitBranch, Send, ShieldCheck } from "lucide-react";
import Button from "../../ui/Button";
import { reviewCertificate, getReviewChecks, reviseCertificate, getCertificateChanges } from "../../services/apiWorkflow";
import { t } from "../../i18n";

// The certificate's review steps (client workflow §5): مسودة → في المراجعة → بانتظار الاعتماد →
// معتمدة. The reviewer sees what is missing and any result outside its specification (the value
// stays as recorded), passes it on or returns it with a comment on ONE field. An approved
// certificate is changed only through a new revision, which shows what changed.

const STEP = { null: t("reviewBar.draft"), returned: t("reviewBar.sentBackForChanges"), in_review: t("reviewBar.inReview"), awaiting_authorization: t("reviewBar.waitingForApproval") };

export default function ReviewBar({ scope, cert, fields = [], onChanged }) {
  const navigate = useNavigate();
  const [checks, setChecks] = useState(null);
  const [changes, setChanges] = useState(null);
  const [ret, setRet] = useState(null); // { field, comment }
  const [busy, setBusy] = useState(null);
  const [specWhy, setSpecWhy] = useState("");
  useEffect(() => {
    if (cert.status === "draft") getReviewChecks(scope, cert.id).then(setChecks).catch(() => {});
    if (cert.revisionOfId) getCertificateChanges(scope, cert.id).then(setChanges).catch(() => {});
  }, [cert.id, cert.currentVersion, cert.reviewStatus, cert.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action, extra = {}) => {
    setBusy(action);
    try {
      await reviewCertificate(scope, cert.id, { action, expectedVersion: cert.currentVersion, ...extra });
      setRet(null);
      await onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(null);
    }
  };
  const revise = async () => {
    setBusy("revise");
    try {
      const c = await reviseCertificate(scope, cert.id);
      navigate(`/certificates/${c.id}${scope.companyId ? `?companyId=${scope.companyId}` : ""}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(null);
    }
  };

  const open = (cert.reviewComments || []).filter((c) => c.field && !c.resolvedAt);
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 text-sm" data-testid="review-bar" data-review={cert.reviewStatus || cert.status}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-gray-800">
          {cert.status === "final" ? (cert.exportedAt ? t("reviewBar.approvedDelivered") : t("reviewBar.approved")) : STEP[cert.reviewStatus] || t("reviewBar.draft")}
          {cert.revisionNumber > 1 ? t("reviewBar.revision", { revisionNumber: cert.revisionNumber }) : ""}
        </span>
        {cert.status === "draft" && [null, "returned"].includes(cert.reviewStatus) && (
          <Button className="!px-3 !py-1 text-xs" onClick={() => act("submit")} isLoading={busy === "submit"} disabled={!!busy || (checks?.missing?.length || 0) > 0} data-testid="review-submit">
            <Send className="h-3.5 w-3.5" />{" "}{t("reviewBar.sendForReview")}</Button>
        )}
        {cert.reviewStatus === "in_review" && (
          <Button className="!px-3 !py-1 text-xs" onClick={() => act("pass")} isLoading={busy === "pass"} disabled={!!busy} data-testid="review-pass">
            <CheckCircle2 className="h-3.5 w-3.5" />{" "}{t("reviewBar.reviewOkToApproval")}</Button>
        )}
        {cert.reviewStatus === "awaiting_authorization" && (
          <Button className="!px-3 !py-1 text-xs !bg-emerald-700" onClick={() => act("authorize")} isLoading={busy === "authorize"} disabled={!!busy} data-testid="review-authorize">
            <ShieldCheck className="h-3.5 w-3.5" />{" "}{t("reviewBar.approve")}</Button>
        )}
        {["in_review", "awaiting_authorization"].includes(cert.reviewStatus) && (
          <Button variant="secondary" className="!px-3 !py-1 text-xs" onClick={() => setRet({ field: fields[0]?.key || "", comment: "" })} disabled={!!busy} data-testid="review-return">
            <CornerUpLeft className="h-3.5 w-3.5" />{" "}{t("reviewBar.sendBackForChanges")}</Button>
        )}
        {cert.status === "final" && (
          <Button variant="secondary" className="!px-3 !py-1 text-xs" onClick={revise} isLoading={busy === "revise"} disabled={!!busy} data-testid="review-revise">
            <GitBranch className="h-3.5 w-3.5" />{" "}{t("reviewBar.newRevisionAChangeAfter")}</Button>
        )}
      </div>
      {checks?.missing?.length > 0 && <p className="text-xs text-red-700">{t("reviewBar.missingBeforeReview")}{" "}{checks.missing.map((m) => m.label).join(t("common.listSep"))}</p>}
      {checks?.outOfSpec?.length > 0 && (
        <div className="space-y-0.5 text-xs text-red-800" data-testid="out-of-spec">
          {checks.outOfSpec.map((o) => (
            <p key={o.field} className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {o.label}{t("reviewBar.theResultIsOutOf", { value: o.value, spec: o.spec })}</p>
          ))}
          {/* Phase 3: approval stays blocked until someone writes why it is approved anyway (for this version) */}
          {(cert.reviewComments || []).some((c) => c.action === "spec_override" && c.version === cert.currentVersion) ? (
            <p className="text-gray-700">{t("reviewBar.theReasonForApprovingDespite")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <input value={specWhy} onChange={(e) => setSpecWhy(e.target.value)} placeholder={t("reviewBar.whyApproveItAlthoughIts")} className="min-w-0 flex-1 rounded-lg border border-red-300 px-2 py-1 text-xs text-gray-900" data-testid="spec-override-why" />
              <button type="button" onClick={() => act("override_spec", { comment: specWhy })} disabled={!specWhy.trim() || !!busy} className="rounded-lg bg-red-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40" data-testid="spec-override">{t("reviewBar.recordTheReason")}</button>
            </div>
          )}
        </div>
      )}
      {open.length > 0 && (
        <ul className="space-y-0.5 text-xs text-amber-900">
          {open.map((c, i) => (
            <li key={i}>
              {t("reviewBar.reviewerNote", { field: fields.find((f) => f.key === c.field)?.label || c.field, comment: c.comment })}
            </li>
          ))}
        </ul>
      )}
      {ret && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={ret.field} onChange={(e) => setRet({ ...ret, field: e.target.value })} className="rounded border border-gray-300 px-1 py-0.5" aria-label={t("reviewBar.field")}>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <input value={ret.comment} onChange={(e) => setRet({ ...ret, comment: e.target.value })} placeholder={t("reviewBar.whatNeedsFixing")} className="min-w-[16rem] flex-1 rounded border border-gray-300 px-2 py-1" />
          <Button className="!px-3 !py-1 text-xs" onClick={() => act("return", ret)} disabled={!ret.field || !ret.comment.trim() || !!busy}>{t("reviewBar.sendItBack")}</Button>
        </div>
      )}
      {changes?.changes?.length > 0 && (
        <div className="text-xs text-gray-700" data-testid="revision-changes">
          <p className="font-semibold">{t("reviewBar.whatChangedSinceApprovedRevision", { revision: changes.of?.revision })}</p>
          <ul className="list-disc pe-5">
            {changes.changes.map((c) => (
              <li key={c.field}>
                {fields.find((f) => f.key === c.field)?.label || c.field}: <s className="text-gray-500">{c.before || "—"}</s> ← {c.after || "—"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
