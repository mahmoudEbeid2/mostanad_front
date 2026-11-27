import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, AlertTriangle, Files, Wrench, XCircle, ClipboardList, Sparkles, MessageSquareText } from "lucide-react";
import { makeExpressTemplates, expressNewRequest } from "../../services/apiIntake";
import { acceptAllEstimates } from "../../services/apiWorkflow";
import { downloadCertificatePdf, downloadBatchZip, downloadBatchPdf } from "../../services/apiCertificatesV2";
import { has, isAr, pickText, t } from "../../i18n";

// Express (urgent order) on the drop's card, after "طلّع الشهادات": the steps as they
// happen, then the certificate DRAFTS with their PDFs (each, ZIP, one combined PDF), what
// each draft still needs (marked blanks — nothing was filled in), the templates that need a
// person, and "complete the registration". Everything here is "Express — needs review".

const STAGES = [
  ["filing", t("expressPanel.filingTheFiles")],
  ["templates", t("expressPanel.preparingTheTemplates")],
  ["rendering", t("expressPanel.makingTheCertificates")],
  ["done", t("expressPanel.done")],
];
const TEMPLATE_STATE = {
  reading: t("expressPanel.readingItsFields"),
  preparing: t("expressPanel.preparingIt"),
  active: t("expressPanel.used"),
  needs_table: t("expressPanel.itsProductTableNeedsSetting"),
  no_fields: t("expressPanel.noFieldsFoundOnIt"),
  failed: t("expressPanel.weCouldntUseIt"),
};
// the backend's reasons, in Arabic (the original is kept for anything not known here)
const WHY_AR = [
  [/^lists (\d+) products in one table: (.+?) — set up its product rows on the template screen$/, (m) => t("expressPanel.listsProductsInOneTable", { v: m[1], v2: m[2] })],
  [/^lists (\d+) products in one table/, (m) => t("expressPanel.listsProductsInOneTable2", { v: m[1] })],
  [/^these places couldn't be left blank automatically: (.+?) — mark them/, (m) => t("expressPanel.thesePlacesCouldntBeLeft", { v: m[1] })],
  [/^the design didn't pass the preparation check/, () => t("expressPanel.theDesignDidntPassThe")],
  [/^no field could be found on it/, () => t("expressPanel.noFieldsCouldBeFound")],
  [/^the design couldn't be converted/, () => t("expressPanel.theDesignCouldntBeConverted")],
  [/^the template is gone/, () => t("expressPanel.theTemplateWasDeleted")],
];
const whyAr = (w) => {
  for (const [re, f] of WHY_AR) {
    const m = String(w || "").match(re);
    if (m) return f(m);
  }
  return w;
};
const fixText = (s) => (has(`expressPanel.fix.${s.fix}`) ? t(`expressPanel.fix.${s.fix}`) : s.fixAr);
const fieldAr = (k) => ({ batch_no: t("expressPanel.batchNumber"), batchNo: t("expressPanel.batchNumber"), expiry: t("expressPanel.expiryDate"), expiry_date: t("expressPanel.expiryDate"), production: t("expressPanel.productionDate"), production_date: t("expressPanel.productionDate") })[k] || k.replace(/_/g, " ");

// what each step really produced: never a green check for a step that made nothing (26 Nov)
const STEP_STYLE = { ok: "border-green-200 bg-green-50 text-green-900", warn: "border-amber-200 bg-amber-50 text-amber-900", fail: "border-red-200 bg-red-50 text-red-900" };
const STEP_ICON = { ok: CheckCircle2, warn: AlertTriangle, fail: XCircle };

// QA 27 Nov (re-test): the same files dropped again reuse the earlier request; «طلب جديد» makes a separate one
function NewRequestButton({ batchId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await expressNewRequest(batchId);
      toast.success(t("expressPanel.makingANewRequestFrom"));
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={go} disabled={busy} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50" data-testid="express-new-request">
      {busy ? "…" : t("expressPanel.newRequest")}
    </button>
  );
}

function Steps({ ex, batchId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const firstTemplate = (ex.templates || []).find((t) => t.link);
  const fix = async (s) => {
    if (s.fix !== "make_templates") return;
    setBusy(true);
    try {
      const r = await makeExpressTemplates(batchId);
      if (r.made?.length) toast.success(t("expressPanel.templatesMadeMakingTheCertificates", { length: r.made.length, join: r.made.map((m) => m.code).join(t("common.listSep")) }));
      else toast.error(t("expressPanel.noCertificateFilesToMake"));
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ul className="space-y-1 text-xs" data-testid="express-steps">
      {ex.steps.map((s) => {
        const Icon = STEP_ICON[s.status];
        return (
          <li key={s.key} className={`flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 ${STEP_STYLE[s.status]}`} data-step={s.key} data-status={s.status}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{pickText(s)}</span>
            {s.fix === "make_templates" && (
              <button type="button" disabled={busy} onClick={() => fix(s)} className="rounded-md bg-violet-700 px-2 py-1 font-semibold text-white hover:bg-violet-800 disabled:opacity-50" data-testid="express-fix-templates">
                {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} {fixText(s)}
              </button>
            )}
            {s.fix === "open_templates" && firstTemplate && (
              <Link to={firstTemplate.link} className="font-semibold text-blue-700 hover:underline">
                {fixText(s)}
              </Link>
            )}
            {s.fix === "add_products" && (
              <Link to="/products/import" className="font-semibold text-blue-700 hover:underline">
                {fixText(s)}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// 28 Nov: what was estimated (descriptive values no file states) — accepted at once after a look
function EstimatesLine({ ex, scope, onChanged }) {
  const [busy, setBusy] = useState(false);
  const n = ex.inferred?.filled || 0;
  // an experiment sample's AI values are test data — never accepted (QA 28 Nov)
  if (!n || (ex.certificates || []).some((c) => c.experiment)) return null;
  const accept = async () => {
    setBusy(true);
    try {
      const r = await acceptAllEstimates(scope, { certificateIds: (ex.certificates || []).map((c) => c.id) });
      toast.success(t("expressPanel.estimatedValuesAccepted", { accepted: r.accepted }));
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs text-violet-900" data-testid="express-estimates">
      <Sparkles className="h-3.5 w-3.5" />
      <span>{n}{" "}{t("expressPanel.aDescriptiveValueWithNo")}</span>
      <button type="button" onClick={accept} disabled={busy} className="rounded-md bg-violet-700 px-2 py-1 font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{t("expressPanel.acceptAllEstimates")}</button>
    </div>
  );
}

export default function ExpressPanel({ ex, scope = {}, batchId = null, onChanged = null }) {
  if (!ex) return null;
  const at = STAGES.findIndex(([k]) => k === (ex.stage === "generate" ? "rendering" : ex.stage));
  const done = ex.stage === "done";
  const g = ex.generation;
  const dl = (p) => p.catch((e) => toast.error(e?.response?.data?.message || e.message));
  const needsPerson = (ex.templates || []).filter((t) => t.status !== "active");
  return (
    <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm" data-testid="express-panel" data-stage={ex.stage}>
      <p className="flex items-center gap-2 font-semibold text-violet-900">{t("expressPanel.expressRequest")}{" "}<span className="rounded bg-violet-200 px-1.5 py-0.5 text-[11px] font-medium text-violet-900">{t("expressPanel.expressNeedsReview")}</span>
      </p>
      {ex.waitingHarvest && !done && (
        <p className="flex items-center gap-1.5 text-xs text-gray-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}{t("expressPanel.waitingForTheFilesTo")}</p>
      )}
      {done && isAr && ex.replyAr && (
        <p className="font-semibold text-gray-900" data-testid="express-reply">
          {ex.replyAr}
        </p>
      )}
      {done && ex.request && (
        <div className="flex flex-wrap items-center gap-2">
          <Link to={ex.request.link} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50" data-testid="express-request">
            <ClipboardList className="h-4 w-4" /> {ex.request.sameFiles ? t("expressPanel.theSameFilesWereSent") : ex.request.added ? t("expressPanel.addedToTheCertificateRequest") : t("expressPanel.openTheCertificateRequest")}
          </Link>
          {ex.request.sameFiles && <NewRequestButton batchId={batchId} onChanged={onChanged} />}
        </div>
      )}
      {done && ex.summary && (
        <p className={`text-sm font-semibold ${ex.summary.ok ? "text-green-900" : "text-red-800"}`} data-testid="express-summary">
          {pickText(ex.summary)}
        </p>
      )}
      {done && ex.steps?.length ? <Steps ex={ex} batchId={batchId} onChanged={onChanged} /> : null}
      <ol className={`flex flex-wrap gap-2 text-xs ${done && ex.steps?.length ? "hidden" : ""}`} aria-label={t("expressPanel.steps")}>
        {STAGES.map(([k, l], i) => (
          <li key={k} className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${i < at || done ? "bg-green-100 text-green-800" : i === at ? "bg-violet-200 text-violet-900" : "bg-gray-100 text-gray-500"}`}>
            {i < at || done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === at ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {l}
          </li>
        ))}
      </ol>

      {(ex.templates || []).length > 0 && (
        <ul className="space-y-1 text-xs" data-testid="express-templates">
          {ex.templates.map((it) => (
            <li key={it.versionId} className="flex flex-wrap items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              <b>{it.code}</b> <span className="text-gray-500">({it.file})</span>:
              <span className={it.status === "active" ? "text-green-800" : ["needs_table", "no_fields", "failed"].includes(it.status) ? "text-amber-800" : "text-gray-600"}>{it.status === "active" && it.suggested ? t("expressPanel.activatedWithTheSuggestionsFields", { suggested: it.suggested }) : TEMPLATE_STATE[it.status] || it.status}</span>
              {it.why && it.status !== "active" && <span className="text-gray-500">— {whyAr(it.why)}</span>}
              {it.status === "active" && it.toFill?.length > 0 && <span className="text-gray-500">{t("expressPanel.filledOnEveryCertificate")}{" "}{it.toFill.join(t("common.listSep"))}</span>}
            </li>
          ))}
        </ul>
      )}

      {g?.missingTypes?.length > 0 && <p className="text-xs text-amber-900">{t("expressPanel.noTemplateForTheseTypes")}{" "}{g.missingTypes.join(t("common.listSep"))}</p>}

      {done && ex.certificates?.length > 0 && (
        <div className="space-y-2" data-testid="express-certificates">
          <p className="font-semibold text-gray-900">
            {t("expressPanel.draftCount", { count: ex.certificates.length })}{ex.seconds != null ? t("expressPanel.inMin", { max: Math.max(1, Math.round(ex.seconds / 60)) }) : ""}
            {ex.ai?.calls ? ` · ${t("expressPanel.aiCalls", { count: ex.ai.calls })}${ex.ai.costUsd != null ? ` ($${ex.ai.costUsd})` : ""}` : ""}
          </p>
          <ul className="divide-y divide-violet-100 rounded-lg border border-violet-100 bg-white text-xs">
            {ex.certificates.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                <b className="w-10">{c.type}</b>
                <span className="min-w-0 flex-1 truncate">{c.products.join(t("common.listSep")) || "—"}</span>
                {c.status === "failed" ? (
                  <span className="text-red-700">{c.error || t("expressPanel.failed")}</span>
                ) : (
                  <>
                    {c.blanks?.length > 0 && <span className="text-amber-800">{t("expressPanel.missing")}{" "}{c.blanks.map(fieldAr).join(t("common.listSep"))}</span>}
                    {c.removedAr && (
                      <span className="basis-full text-amber-800" data-testid="express-removed">
                        {isAr ? c.removedAr : t("expressPanel.removedRows")}
                      </span>
                    )}
                    <Link to={`/certificates/${c.id}`} className="text-blue-700 hover:underline">{t("expressPanel.open")}</Link>
                    {ex.files?.zip && (
                      <button type="button" onClick={() => dl(downloadCertificatePdf(scope, c.id))} className="inline-flex items-center gap-1 text-blue-700 hover:underline" aria-label={t("expressPanel.pdf2", { type: c.type, join: c.products.join(" ") })}>
                        <Download className="h-3.5 w-3.5" />{" "}PDF</button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {g?.certificateBatchId && ex.files?.zip && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => dl(downloadBatchPdf(scope, g.certificateBatchId))} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800" data-testid="express-combined">
                <Files className="h-4 w-4" />{" "}{t("expressPanel.allCertificatesInOnePdf")}</button>
              <button type="button" onClick={() => dl(downloadBatchZip(scope, g.certificateBatchId))} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50" data-testid="express-zip">
                <Download className="h-4 w-4" />{" "}ZIP</button>
            </div>
          )}
          {g?.exportProblem && <p className="text-xs text-amber-900">{t("expressPanel.theCombinedFilesWerentMade", { exportProblem: g.exportProblem })}</p>}
          <EstimatesLine ex={ex} scope={scope} onChanged={onChanged} />
          {(ex.missing?.ar || ex.missing?.items > 0) && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950" data-testid="express-missing">
              {/* the backend writes this message in Arabic only (BACKEND_STRINGS_TODO.md); English shows the counts */}
              <p className="whitespace-pre-line">{isAr && ex.missing.ar ? ex.missing.ar : pickText(ex.missing.text) || t("expressPanel.missingCount", { items: ex.missing.items || 0, certificates: ex.missing.certificates || 0 })}</p>
              <p className="flex items-center gap-1 font-semibold text-amber-900">
                <MessageSquareText className="h-3.5 w-3.5" />{" "}{t("expressPanel.replyInTheChatBelow")}</p>
            </div>
          )}
          <p className="text-xs text-gray-600">{t("expressPanel.everyCertificateIsADraft")}</p>
        </div>
      )}

      {done && (
        <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs" data-testid="express-complete">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-gray-800">
            <Wrench className="h-3.5 w-3.5" />{" "}{t("expressPanel.completeTheRegistration")}</p>
          <ul className="list-disc space-y-0.5 pe-5">
            {(ex.templates || [])
              .filter((t) => t.link)
              .map((it) => (
                <li key={it.versionId}>
                  <Link to={it.link} className="text-blue-700 hover:underline">
                    {it.status === "active" ? t("expressPanel.confirmTheTemplatesFields", { code: it.code }) : t("expressPanel.fixTheTemplate", { code: it.code })}
                  </Link>
                  {needsPerson.includes(it) && it.why ? <span className="text-gray-500"> — {whyAr(it.why)}</span> : null}
                </li>
              ))}
            <li>
              <Link to="/products" className="text-blue-700 hover:underline">{t("expressPanel.reviewTheNewProductsData")}</Link>
            </li>
            <li>
              <Link to="/express" className="text-blue-700 hover:underline">{t("expressPanel.everythingFromExpressRequestsThat")}</Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
