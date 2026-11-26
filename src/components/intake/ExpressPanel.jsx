import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, AlertTriangle, Files, Wrench, XCircle, ClipboardList, Sparkles, MessageSquareText } from "lucide-react";
import { makeExpressTemplates } from "../../services/apiIntake";
import { acceptAllEstimates } from "../../services/apiWorkflow";
import { downloadCertificatePdf, downloadBatchZip, downloadBatchPdf } from "../../services/apiCertificatesV2";

// Express (urgent order) on the drop's card, after "طلّع الشهادات": the steps as they
// happen, then the certificate DRAFTS with their PDFs (each, ZIP, one combined PDF), what
// each draft still needs (marked blanks — nothing was filled in), the templates that need a
// person, and "complete the registration". Everything here is "Express — needs review".

const STAGES = [
  ["filing", "بنسجّل الملفات"],
  ["templates", "بنجهّز القوالب"],
  ["rendering", "بنطلّع الشهادات"],
  ["done", "خلصت"],
];
const TEMPLATE_STATE = {
  reading: "بنقرا حقوله…",
  preparing: "بنجهّزه…",
  active: "اتستخدم",
  needs_table: "محتاج تظبط جدول المنتجات فيه",
  no_fields: "ملقيناش فيه حقول",
  failed: "معرفناش نستخدمه",
};
// the backend's reasons, in Arabic (the original is kept for anything not known here)
const WHY_AR = [
  [/^lists (\d+) products in one table: (.+?) — set up its product rows on the template screen$/, (m) => `فيها ${m[1]} منتج في جدول واحد: ${m[2]} — ظبّط صف المنتجات في صفحة القالب`],
  [/^lists (\d+) products in one table/, (m) => `فيها ${m[1]} منتج في جدول واحد — ظبّط صف المنتجات في صفحة القالب`],
  [/^these places couldn't be left blank automatically: (.+?) — mark them/, (m) => `الأماكن دي معرفناش نفضّيها لوحدنا: ${m[1]} — حددها في صفحة القالب (ماطبعناش حاجة من الملف)`],
  [/^the design didn't pass the preparation check/, () => "التصميم ماعدّاش اختبار التجهيز — افتحه في صفحة القالب"],
  [/^no field could be found on it/, () => "معرفناش نلاقي فيه حقول — حدد حقوله في صفحة القالب"],
  [/^the design couldn't be converted/, () => "معرفناش نحوّل التصميم"],
  [/^the template is gone/, () => "القالب اتمسح"],
];
const whyAr = (w) => {
  for (const [re, f] of WHY_AR) {
    const m = String(w || "").match(re);
    if (m) return f(m);
  }
  return w;
};
const fieldAr = (k) => ({ batch_no: "رقم التشغيلة", batchNo: "رقم التشغيلة", expiry: "تاريخ الانتهاء", expiry_date: "تاريخ الانتهاء", production: "تاريخ الإنتاج", production_date: "تاريخ الإنتاج" })[k] || k.replace(/_/g, " ");

// what each step really produced: never a green check for a step that made nothing (26 Nov)
const STEP_STYLE = { ok: "border-green-200 bg-green-50 text-green-900", warn: "border-amber-200 bg-amber-50 text-amber-900", fail: "border-red-200 bg-red-50 text-red-900" };
const STEP_ICON = { ok: CheckCircle2, warn: AlertTriangle, fail: XCircle };

function Steps({ ex, batchId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const firstTemplate = (ex.templates || []).find((t) => t.link);
  const fix = async (s) => {
    if (s.fix !== "make_templates") return;
    setBusy(true);
    try {
      const r = await makeExpressTemplates(batchId);
      if (r.made?.length) toast.success(`اتعمل ${r.made.length} قالب: ${r.made.map((m) => m.code).join("، ")} — بنطلّع الشهادات تاني`);
      else toast.error("مفيش ملفات شهادات نقدر نعمل منها قوالب");
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
            <span className="min-w-0 flex-1">{s.ar}</span>
            {s.fix === "make_templates" && (
              <button type="button" disabled={busy} onClick={() => fix(s)} className="rounded-md bg-violet-700 px-2 py-1 font-semibold text-white hover:bg-violet-800 disabled:opacity-50" data-testid="express-fix-templates">
                {busy ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null} {s.fixAr}
              </button>
            )}
            {s.fix === "open_templates" && firstTemplate && (
              <Link to={firstTemplate.link} className="font-semibold text-blue-700 hover:underline">
                {s.fixAr}
              </Link>
            )}
            {s.fix === "add_products" && (
              <Link to="/products/import" className="font-semibold text-blue-700 hover:underline">
                {s.fixAr}
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
  if (!n) return null;
  const accept = async () => {
    setBusy(true);
    try {
      const r = await acceptAllEstimates(scope, { certificateIds: (ex.certificates || []).map((c) => c.id) });
      toast.success(`اتعمد ${r.accepted} قيمة مستنتجة`);
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
      <span>{n} قيمة وصفية ملهاش ملف اتستنتجت — عليها علامة «مستنتج» في كل شهادة، ومش بتوقف حاجة.</span>
      <button type="button" onClick={accept} disabled={busy} className="rounded-md bg-violet-700 px-2 py-1 font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
        اعتمد كل المستنتج
      </button>
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
      <p className="flex items-center gap-2 font-semibold text-violet-900">
        طلب سريع <span className="rounded bg-violet-200 px-1.5 py-0.5 text-[11px] font-medium text-violet-900">Express — محتاج مراجعة</span>
      </p>
      {ex.waitingHarvest && !done && (
        <p className="flex items-center gap-1.5 text-xs text-gray-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> مستنيين قراية الملفات تخلص عشان الشهادات تتملى من اللي فيها…
        </p>
      )}
      {done && ex.replyAr && (
        <p className="font-semibold text-gray-900" data-testid="express-reply">
          {ex.replyAr}
        </p>
      )}
      {done && ex.request && (
        <Link to={ex.request.link} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50" data-testid="express-request">
          <ClipboardList className="h-4 w-4" /> {ex.request.added ? "اتضافت لطلب الشهادات — افتحه" : "افتح طلب الشهادات"}
        </Link>
      )}
      {done && ex.summary && (
        <p className={`text-sm font-semibold ${ex.summary.ok ? "text-green-900" : "text-red-800"}`} data-testid="express-summary">
          {ex.summary.ar}
        </p>
      )}
      {done && ex.steps?.length ? <Steps ex={ex} batchId={batchId} onChanged={onChanged} /> : null}
      <ol className={`flex flex-wrap gap-2 text-xs ${done && ex.steps?.length ? "hidden" : ""}`} aria-label="الخطوات">
        {STAGES.map(([k, l], i) => (
          <li key={k} className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${i < at || done ? "bg-green-100 text-green-800" : i === at ? "bg-violet-200 text-violet-900" : "bg-gray-100 text-gray-500"}`}>
            {i < at || done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === at ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {l}
          </li>
        ))}
      </ol>

      {(ex.templates || []).length > 0 && (
        <ul className="space-y-1 text-xs" data-testid="express-templates">
          {ex.templates.map((t) => (
            <li key={t.versionId} className="flex flex-wrap items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              <b>{t.code}</b> <span className="text-gray-500">({t.file})</span>:
              <span className={t.status === "active" ? "text-green-800" : ["needs_table", "no_fields", "failed"].includes(t.status) ? "text-amber-800" : "text-gray-600"}>{TEMPLATE_STATE[t.status] || t.status}</span>
              {t.why && t.status !== "active" && <span className="text-gray-500">— {whyAr(t.why)}</span>}
              {t.status === "active" && t.toFill?.length > 0 && <span className="text-gray-500">— بيتملى في كل شهادة: {t.toFill.join("، ")}</span>}
            </li>
          ))}
        </ul>
      )}

      {g?.missingTypes?.length > 0 && <p className="text-xs text-amber-900">مفيش قالب للأنواع دي: {g.missingTypes.join("، ")}</p>}

      {done && ex.certificates?.length > 0 && (
        <div className="space-y-2" data-testid="express-certificates">
          <p className="font-semibold text-gray-900">
            {ex.certificates.length} شهادة (مسودة){ex.seconds != null ? ` · في ${Math.max(1, Math.round(ex.seconds / 60))} دقيقة` : ""}
            {ex.ai?.calls ? ` · ${ex.ai.calls} طلب ذكاء اصطناعي${ex.ai.costUsd != null ? ` ($${ex.ai.costUsd})` : ""}` : ""}
          </p>
          <ul className="divide-y divide-violet-100 rounded-lg border border-violet-100 bg-white text-xs">
            {ex.certificates.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                <b className="w-10">{c.type}</b>
                <span className="min-w-0 flex-1 truncate">{c.products.join("، ") || "—"}</span>
                {c.status === "failed" ? (
                  <span className="text-red-700">{c.error || "فشلت"}</span>
                ) : (
                  <>
                    {c.blanks?.length > 0 && <span className="text-amber-800">ناقص: {c.blanks.map(fieldAr).join("، ")}</span>}
                    <Link to={`/certificates/${c.id}`} className="text-blue-700 hover:underline">
                      افتح
                    </Link>
                    {ex.files?.zip && (
                      <button type="button" onClick={() => dl(downloadCertificatePdf(scope, c.id))} className="inline-flex items-center gap-1 text-blue-700 hover:underline" aria-label={`PDF ${c.type} ${c.products.join(" ")}`}>
                        <Download className="h-3.5 w-3.5" /> PDF
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {g?.certificateBatchId && ex.files?.zip && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => dl(downloadBatchPdf(scope, g.certificateBatchId))} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800" data-testid="express-combined">
                <Files className="h-4 w-4" /> كل الشهادات في PDF واحد
              </button>
              <button type="button" onClick={() => dl(downloadBatchZip(scope, g.certificateBatchId))} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50" data-testid="express-zip">
                <Download className="h-4 w-4" /> ZIP
              </button>
            </div>
          )}
          {g?.exportProblem && <p className="text-xs text-amber-900">الملفات المجمّعة متعملتش: {g.exportProblem}. افتح كل شهادة لوحدها.</p>}
          <EstimatesLine ex={ex} scope={scope} onChanged={onChanged} />
          {ex.missing?.ar && (
            <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950" data-testid="express-missing">
              <p className="whitespace-pre-line">{ex.missing.ar}</p>
              <p className="flex items-center gap-1 font-semibold text-amber-900">
                <MessageSquareText className="h-3.5 w-3.5" /> رد في الشات تحت في سطر واحد — هتتملى في نفس الشهادات.
              </p>
            </div>
          )}
          <p className="text-xs text-gray-600">كل الشهادات مسودات: بتتراجع وتتعتمد من صفحتها. بيانات التشغيلة ونتايج التحليل مبنكتبهاش من عندنا أبداً.</p>
        </div>
      )}

      {done && (
        <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs" data-testid="express-complete">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-gray-800">
            <Wrench className="h-3.5 w-3.5" /> كمّل التسجيل
          </p>
          <ul className="list-disc space-y-0.5 pr-5">
            {(ex.templates || [])
              .filter((t) => t.link)
              .map((t) => (
                <li key={t.versionId}>
                  <Link to={t.link} className="text-blue-700 hover:underline">
                    {t.status === "active" ? `أكّد حقول قالب ${t.code}` : `ظبّط قالب ${t.code}`}
                  </Link>
                  {needsPerson.includes(t) && t.why ? <span className="text-gray-500"> — {whyAr(t.why)}</span> : null}
                </li>
              ))}
            <li>
              <Link to="/products" className="text-blue-700 hover:underline">
                راجع بيانات المنتجات الجديدة
              </Link>
            </li>
            <li>
              <Link to="/express" className="text-blue-700 hover:underline">
                كل حاجات الطلبات السريعة اللي محتاجة مراجعة
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
