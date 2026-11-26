// What the files say about a product (28 Nov): every value with its source ("من: ADDVET COC ص10" — opens
// the page), what the check doubted («محتاجة مراجعة», never filled), conflicts between files (both sources
// shown, nothing overwritten — the person picks), and what was estimated («مستنتج», accepted in one click).
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getProductHarvest, decideHarvestConflict, acceptAllEstimates, openEvidence } from "../../services/apiWorkflow";

const KEY_AR = {
  name: "الاسم", packaging: "العبوة", validity: "الصلاحية", physicalForm: "الشكل", category: "الفئة", origin: "بلد المنشأ", storage: "التخزين",
  dosage: "الجرعة", indications: "الاستخدامات", targetSpecies: "الأنواع المستهدفة", withdrawalPeriod: "فترة السحب", appearance: "المظهر",
  compositionBasis: "أساس التركيب", activeIngredients: "التركيب", routeOfAdmin: "طريقة الإعطاء", registrationNumber: "رقم التسجيل", productCode: "كود المنتج",
  productType: "الفئة", contraindications: "موانع الاستعمال",
};
const keyAr = (k) => (String(k).startsWith("spec:") ? `مواصفة: ${k.slice(5)}` : String(k).startsWith("result:") ? `نتيجة: ${k.slice(7)}` : String(k).startsWith("specifications.values.") ? `مواصفة: ${k.slice(22)}` : KEY_AR[k] || k);
const show = (v) => (Array.isArray(v) ? v.map((x) => (typeof x === "object" ? [x.name, x.amountRaw].filter(Boolean).join(" ") : x)).join("، ") : typeof v === "object" && v ? v.text || v.code || JSON.stringify(v) : String(v ?? ""));

export default function ProductHarvestSection({ scope = {}, productId, onChanged }) {
  const [h, setH] = useState(null);
  const load = () => getProductHarvest(scope, productId).then(setH).catch(() => setH({ facts: [], conflicts: [], estimates: [], perBatch: [] }));
  useEffect(() => {
    load();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!h) return null;
  const open = (h.conflicts || []).filter((c) => !c.decision);
  const est = (h.estimates || []).filter((e) => !e.accepted);
  const choose = async (key, value) => {
    try {
      await decideHarvestConflict(scope, productId, key, value);
      toast.success("اتحفظ اختيارك");
      load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };
  const acceptAll = async () => {
    try {
      const r = await acceptAllEstimates(scope, { productIds: [productId] });
      toast.success(`اتعمد ${r.accepted} قيمة مستنتجة`);
      load();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };
  if (!h.facts.length && !open.length && !est.length) return null;
  return (
    <div className="space-y-3 text-xs" data-testid="product-harvest">
      {open.length > 0 && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3" data-testid="harvest-conflicts">
          <p className="font-semibold text-red-900">الملفات مختلفة على قيمة — مافيش حاجة اتغيرت، اختار انت:</p>
          {open.map((c) => (
            <div key={c.key} className="space-y-1 rounded-md bg-white p-2">
              <p className="font-semibold">{keyAr(c.key)}</p>
              {c.values.map((v, k) => (
                <p key={k} dir="auto" className="flex flex-wrap items-center gap-1.5">
                  <span>{show(v.value)}</span>
                  <span className="text-gray-500">— {v.file || v.sourceType}{v.page ? ` ص${v.page}` : ""}</span>
                  <button type="button" onClick={() => choose(c.key, show(v.value))} className="text-blue-700 hover:underline">
                    اعتمد ده
                  </button>
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
      {est.length > 0 && (
        <div className="space-y-1 rounded-lg border border-violet-200 bg-violet-50 p-3" data-testid="harvest-estimates">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-violet-900">{est.length} قيمة «مستنتجة» — مش من ملف:</p>
            <button type="button" onClick={acceptAll} className="rounded-md bg-violet-700 px-2 py-1 font-semibold text-white hover:bg-violet-800">
              اعتمد كل المستنتج
            </button>
          </div>
          <ul className="space-y-0.5">
            {est.map((e) => (
              <li key={e.path} title={e.reasoning || ""}>
                <b>{keyAr(e.path)}</b> <span className="text-violet-800">— {e.basis}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {h.facts.length > 0 && (
        <details className="rounded-lg border border-gray-200 p-2">
          <summary className="cursor-pointer font-semibold text-gray-800">اللي الملفات قالته ({h.facts.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {h.facts.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-1.5" dir="auto">
                <b>{keyAr(f.key)}:</b> <span>{show(f.value)}</span>
                {f.link ? (
                  <button type="button" onClick={() => openEvidence(f.link).catch(() => {})} className="rounded-full bg-emerald-50 px-2 text-[11px] text-emerald-800 hover:underline" title={f.snippet ? `“${f.snippet}”` : ""}>
                    من: {f.file}{f.page ? ` ص${f.page}` : ""}
                  </button>
                ) : (
                  <span className="text-gray-500">من: {f.file}</span>
                )}
                {f.needsReview && (
                  <span className="rounded-full bg-amber-100 px-2 text-[11px] text-amber-900" title={typeof f.needsReview === "string" ? f.needsReview : ""}>
                    محتاجة مراجعة
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
