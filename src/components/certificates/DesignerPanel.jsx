import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, ExternalLink, Loader2, X } from "lucide-react";
import Button from "../../ui/Button";
import { getDesignerData, saveDesignEstimates, getCompositionReview, decideComposition, openEvidence } from "../../services/apiWorkflow";

// The designer's panel (client workflow §4): the product's data in the order it goes into
// Illustrator, with copy buttons — the name, the ingredients, the quantities (row-aligned with the
// ingredients when copied apart) and the whole table as tab-separated text, plus the shipment
// columns. An appearance / pH estimate is allowed HERE only, marked «تقدير», with its assumptions;
// a COA result never comes from it. Each value opens the document page it came from.

const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text || "");
    toast.success(`اتنسخ: ${what}`);
  } catch {
    toast.error("المتصفح منع النسخ");
  }
};
const CopyBtn = ({ text, what, testid }) => (
  <button type="button" onClick={() => copy(text, what)} disabled={!text} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-40" data-testid={testid}>
    <Copy className="h-3 w-3" /> {what}
  </button>
);
const LABEL_AR = { name: "اسم المنتج", packaging: "العبوة", type: "النوع", form: "الشكل", compositionBasis: "أساس التركيب", ingredients: "المكونات", quantities: "الكميات", appearance: "المظهر / اللون", ph: "pH" };

export default function DesignerPanel({ scope = {}, productId, requestId = null, onClose }) {
  const [d, setD] = useState(null);
  const [review, setReview] = useState(null);
  const [est, setEst] = useState({ appearance: "", ph: "", assumptions: "" });
  const [reason, setReason] = useState({});
  const [busy, setBusy] = useState(false);
  const load = () =>
    Promise.all([getDesignerData(scope, productId, requestId), getCompositionReview(scope, productId)])
      .then(([x, r]) => {
        setD(x);
        setReview(r);
      })
      .catch((e) => toast.error(e?.response?.data?.message || e.message));
  useEffect(() => {
    load();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveEst = async () => {
    setBusy(true);
    try {
      setD(await saveDesignEstimates(scope, productId, est));
      toast.success("اتحفظ التقدير");
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };
  const decide = async (i, chosen) => {
    try {
      setReview(await decideComposition(scope, productId, i, chosen, reason[i] || ""));
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="بيانات المصمم">
      <div dir="rtl" className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-lg font-bold text-gray-900">بيانات المصمم{d ? ` — ${d.fields[0].value}` : ""}</h2>
          <button onClick={onClose} aria-label="اقفل" className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        {!d ? (
          <Loader2 className="m-6 h-6 w-6 animate-spin text-gray-400" />
        ) : (
          <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm" data-testid="designer-panel">
            <div className="flex flex-wrap gap-1.5">
              <CopyBtn text={d.fields[0].value} what="الاسم" />
              <CopyBtn text={d.tsv.names} what="المكونات" testid="copy-names" />
              <CopyBtn text={d.tsv.quantities} what="الكميات" testid="copy-quantities" />
              <CopyBtn text={d.tsv.table} what="الجدول كله (TSV)" testid="copy-table" />
              {d.tsv.shipment && <CopyBtn text={d.tsv.shipment} what="بيانات الشحنة" />}
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-gray-100">
                {d.fields.map((f) => (
                  <tr key={f.key} className="align-top">
                    <th className="w-32 py-1.5 text-right font-semibold text-gray-600">{LABEL_AR[f.key] || f.label}</th>
                    <td className="py-1.5 whitespace-pre-line text-gray-900" dir="auto">
                      {f.value || <span className="text-gray-400">—</span>}
                      {f.estimate && (
                        <span className="ms-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-900" title={f.assumptions || ""}>
                          تقدير
                        </span>
                      )}
                    </td>
                    <td className="w-40 py-1.5 text-[11px] text-gray-500">
                      {f.evidence?.link ? (
                        <button type="button" onClick={() => (f.evidence.link.startsWith("/api/") ? openEvidence(f.evidence.link) : window.open(f.evidence.link, "_blank"))} className="inline-flex items-center gap-1 text-blue-700 hover:underline" title={f.evidence.quote || ""}>
                          <ExternalLink className="h-3 w-3" /> {f.evidence.label}
                        </button>
                      ) : (
                        f.evidence?.label || ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {review?.conflicts?.length > 0 && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs" data-testid="composition-conflicts">
                <p className="font-semibold text-red-900">مصادر مختلفة على نفس المكوّن — القرار عند المراجع:</p>
                {review.conflicts.map((c) => (
                  <div key={c.index} className="space-y-1 rounded-md bg-white p-2">
                    <p className="font-semibold">{c.ingredient}</p>
                    {c.comparison && <p className="text-red-800">على نفس الأساس: {c.comparison}</p>}
                    {c.values.map((v, k) => (
                      <p key={k} dir="auto">
                        {k + 1}. {v.amountRaw} {v.basis ? `(${v.basis})` : ""} — {v.source?.file || v.source?.source || "المنتج"}
                        {!c.decision && (
                          <button type="button" onClick={() => decide(c.index, k)} className="ms-2 text-blue-700 hover:underline">
                            اعتمد ده
                          </button>
                        )}
                      </p>
                    ))}
                    {c.decision ? (
                      <p className="text-green-800">اتقرر: {c.decision.amountRaw} — {c.decision.reason}</p>
                    ) : (
                      <input value={reason[c.index] || ""} onChange={(e) => setReason({ ...reason, [c.index]: e.target.value })} placeholder="السبب (مطلوب، بيتسجل)" className="w-full rounded border border-gray-300 px-2 py-1" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs">
              <p className="font-semibold text-amber-900">تقدير للتصميم بس (مش نتيجة تحليل — شهادة التحليل بتاخد النتيجة من تقرير التشغيلة)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={est.appearance} onChange={(e) => setEst({ ...est, appearance: e.target.value })} placeholder="المظهر / اللون المتوقع" className="rounded border border-gray-300 px-2 py-1" />
                <input value={est.ph} onChange={(e) => setEst({ ...est, ph: e.target.value })} placeholder="pH متوقع" className="rounded border border-gray-300 px-2 py-1" />
              </div>
              <input value={est.assumptions} onChange={(e) => setEst({ ...est, assumptions: e.target.value })} placeholder="الافتراضات (الوسط، التخفيف، المرحلة اللي اتقاست)" className="w-full rounded border border-gray-300 px-2 py-1" />
              <Button variant="secondary" className="!px-3 !py-1 text-xs" onClick={saveEst} isLoading={busy}>
                احفظ التقدير
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
