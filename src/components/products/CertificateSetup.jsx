import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FilePlus2, Loader2, Plus, UploadCloud } from "lucide-react";
import { createCertificateType } from "../../services/apiCertificateTypes";
import { uploadTemplate } from "../../services/apiCertificateTemplates";
import { KNOWN, codeFromFileName } from "../../utils/certificateTypeFromName";

// "Make certificates…" with nothing set up yet (26 Nov: "This company has no certificate types yet."
// and nothing else): make a type in one click, or drop a certificate file — its type is read from the
// file name (asked when it doesn't say), the type is created when missing, and the file becomes that
// type's DRAFT template; its fields are marked on the template screen (link) before it can be used.

export default function CertificateSetup({ companyId, types, missingTypes = [], onChanged }) {
  const scope = { companyId };
  const [busy, setBusy] = useState(null);
  const [made, setMade] = useState([]); // [{ code, file, link }]
  const [ask, setAsk] = useState(null); // a file whose name doesn't say its type
  const typeOf = (code) => types.find((t) => t.code === code);

  const ensureType = async (code) => {
    const have = typeOf(code);
    if (have) return have;
    const k = KNOWN.find(([c]) => c === code);
    const t = await createCertificateType(scope, { code, name: k ? k[1] : code });
    await onChanged?.();
    return t;
  };
  const addType = async (code) => {
    setBusy(code);
    try {
      await ensureType(code);
      toast.success(`اتعمل نوع ${code}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(null);
    }
  };
  const upload = async (file, code) => {
    setBusy(file.name);
    try {
      const type = await ensureType(code);
      const out = await uploadTemplate(scope, { file, name: file.name.replace(/\.[a-z0-9]+$/i, ""), certificateTypeId: type.id });
      setMade((m) => [...m, { code, file: file.name, link: `/certificates/templates/${out.templateId}/versions/${out.versionId}?step=fields` }]);
      await onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(null);
    }
  };
  const take = (files) => {
    for (const f of files) {
      const code = codeFromFileName(f.name);
      if (code) upload(f, code);
      else setAsk(f);
    }
  };

  const absent = KNOWN.filter(([c]) => !typeOf(c));
  return (
    <div dir="rtl" className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-3" data-testid="certificate-setup">
      {!types.length && <p className="font-semibold text-gray-800">الشركة دي لسه مفيهاش أنواع شهادات.</p>}
      {missingTypes.length > 0 && <p className="text-xs text-amber-900">مفيش قالب شغّال لـ: {missingTypes.join("، ")} — ارفع الشهادة نفسها وتبقى قالب.</p>}
      {absent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-700">اعمل نوع شهادة:</span>
          {absent.map(([c, , ar]) => (
            <button key={c} type="button" disabled={!!busy} onClick={() => addType(c)} className="inline-flex items-center gap-1 rounded-full border border-teal-400 bg-white px-2.5 py-0.5 font-semibold text-teal-800 hover:bg-teal-50" data-testid={`add-type-${c}`}>
              {busy === c ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} {c} <span className="font-normal text-gray-500">{ar}</span>
            </button>
          ))}
        </div>
      )}
      <label
        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-teal-300 bg-white px-3 py-4 text-center text-xs text-gray-700 hover:bg-teal-50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          take([...e.dataTransfer.files]);
        }}
        data-testid="template-drop"
      >
        <UploadCloud className="h-5 w-5 text-teal-600" />
        <span className="font-semibold">ارفع قالب: اسحب ملف الشهادة هنا (.pdf أو .ai)</span>
        <span className="text-gray-500">بيبقى قالب مسودة لنوعه (من اسم الملف) — تحدد حقوله في صفحة القالب قبل ما يطلّع شهادات.</span>
        <input type="file" accept=".pdf,.ai" multiple className="hidden" onChange={(e) => take([...e.target.files])} />
      </label>
      {ask && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" data-testid="ask-type">
          <span>«{ask.name}» — نوعه إيه؟</span>
          {KNOWN.map(([c]) => (
            <button key={c} type="button" onClick={() => (upload(ask, c), setAsk(null))} className="rounded-full border border-gray-300 bg-white px-2 py-0.5 hover:bg-gray-50">
              {c}
            </button>
          ))}
          <button type="button" onClick={() => setAsk(null)} className="text-gray-500 underline">
            إلغاء
          </button>
        </div>
      )}
      {busy && !KNOWN.some(([c]) => c === busy) && (
        <p className="flex items-center gap-1.5 text-xs text-gray-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> بنرفع {busy}…
        </p>
      )}
      {made.length > 0 && (
        <ul className="space-y-0.5 text-xs" data-testid="templates-made">
          {made.map((m) => (
            <li key={m.link} className="flex items-center gap-1.5">
              <FilePlus2 className="h-3.5 w-3.5 text-teal-700" /> {m.code} من «{m.file}» —{" "}
              <Link to={m.link} className="font-semibold text-blue-700 hover:underline">
                حدد حقوله
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
