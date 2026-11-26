// The company's certificate numbering per type (Phase 3, 28 Nov): learnt from its own documents
// ("COCAF26009010" → COCAF{YY}0{MM}{SEQ3}), the default, or set here. Each row shows the next number; a
// number is never given twice. Placeholders: {YYYY} {YY} {MM} and {SEQ3} (any width).
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Hash } from "lucide-react";
import apiClient from "../../services/apiClient";

const SOURCE_AR = { detected: "اتعرف من شهادة قديمة", default: "افتراضي — مش متأكدين", user: "انت حددته" };

export default function NumberingPanel({ companyId, scope = {} }) {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState({});
  const load = () =>
    apiClient
      .get(`/companies/${companyId}/numbering`, { params: scope })
      .then((r) => setRows(r.data.data.schemes))
      .catch(() => setRows([]));
  useEffect(() => {
    if (companyId) load();
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!companyId || !rows?.length) return null;
  const save = async (code) => {
    const e = edit[code] || {};
    try {
      const r = await apiClient.put(`/companies/${companyId}/numbering/${code}`, { pattern: e.pattern, ...(e.lastSeq !== undefined && e.lastSeq !== "" ? { lastSeq: Number(e.lastSeq) } : {}) }, { params: scope });
      setRows(r.data.data.schemes);
      setEdit((x) => ({ ...x, [code]: undefined }));
      toast.success(`اتحفظ ترقيم ${code}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message);
    }
  };
  return (
    <section dir="rtl" className="space-y-2 rounded-xl border border-gray-200 bg-white p-4" data-testid="numbering-panel">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900">
        <Hash className="h-4 w-4 text-gray-500" /> ترقيم الشهادات
      </h2>
      <p className="text-xs text-gray-500">رقم كل شهادة جديدة بيكمّل ترقيم الشركة — عمره ما بيتكرر ولا بياخد رقم نموذج الشهادة. الأماكن: {"{YYYY} {YY} {MM}"} و{"{SEQ3}"}.</p>
      <ul className="divide-y divide-gray-100 text-sm">
        {rows.map((s) => {
          const e = edit[s.certCode];
          return (
            <li key={s.certCode} className="flex flex-wrap items-center gap-2 py-2">
              <b className="w-12">{s.certCode}</b>
              {e ? (
                <>
                  <input value={e.pattern} onChange={(ev) => setEdit((x) => ({ ...x, [s.certCode]: { ...e, pattern: ev.target.value } }))} dir="ltr" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 font-mono text-xs" aria-label={`ترقيم ${s.certCode}`} />
                  <input value={e.lastSeq} onChange={(ev) => setEdit((x) => ({ ...x, [s.certCode]: { ...e, lastSeq: ev.target.value.replace(/\D/g, "") } }))} dir="ltr" className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-xs" aria-label="آخر رقم اتدّى" title="آخر رقم اتدّى" />
                  <button type="button" onClick={() => save(s.certCode)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">احفظ</button>
                </>
              ) : (
                <>
                  <code className="flex-1 text-xs" dir="ltr">{s.pattern}</code>
                  <span className="text-xs text-gray-600">اللي جاي: <b dir="ltr">{s.next}</b></span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${s.confirmed ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"}`}>{SOURCE_AR[s.source] || s.source}</span>
                  <button type="button" onClick={() => setEdit((x) => ({ ...x, [s.certCode]: { pattern: s.pattern, lastSeq: String(s.lastSeq) } }))} className="text-xs text-blue-700 hover:underline">
                    {s.confirmed ? "غيّر" : "أكّد أو غيّر"}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
