import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { setFontFallback, uploadCompanyFont } from "../../services/apiCertificateTemplates";
import { describeCertificateError } from "../../utils/certificateErrors";
import { strings, t } from "../../i18n";

// Template "Prepare & test": each font embedded in the design with the font matched
// to it. A character the design's subset font lacks is drawn from that match; the
// owner can correct it until the version is activated. The company's own fonts
// (uploaded here: .ttf, .otf, .woff2) are offered first and are matched to the
// design fonts of the same family when uploaded.
const STR = {
  ...strings("fontMatches"),
  uploaded: (font, n) => t("fontMatches.added", { name: font.name }) + (n ? t("fontMatches.usedFor", { count: n }) : ""),
};
const COMPANY = "company:";

export default function FontMatches({ scope, version, onChanged }) {
  const [saving, setSaving] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const editable = ["draft", "ready"].includes(version.status);
  const matches = version.fontMatches || [];
  const companyFonts = version.companyFonts || [];
  if (!matches.length) return null;

  const change = async (fontClass, value) => {
    setSaving(fontClass);
    try {
      await setFontFallback(scope, version.id, value.startsWith(COMPANY) ? { fontClass, companyFontId: value.slice(COMPANY.length) } : { fontClass, fallbackFamily: value });
      await onChanged?.();
    } catch (err) {
      toast.error(describeCertificateError(err));
    } finally {
      setSaving(null);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { font, appliedTo } = await uploadCompanyFont({ ...scope, companyId: scope?.companyId || version.template?.companyId }, file);
      toast.success(STR.uploaded(font, appliedTo));
      await onChanged?.();
    } catch (err) {
      toast.error(describeCertificateError(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="px-5 py-4 border-t border-gray-100" data-testid="font-matches">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{STR.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{STR.hint}</p>
        </div>
        <label className={`inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 ${uploading ? "opacity-60" : ""}`}>
          {uploading ? STR.uploading : STR.upload}
          <input ref={fileRef} type="file" accept=".ttf,.otf,.woff2,font/ttf,font/otf,font/woff2" className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} aria-label={t("fontMatches.fontFile")} data-testid="font-upload" />
        </label>
      </div>
      <ul className="mt-2 space-y-1.5">
        {matches.map((m) => (
          <li key={m.fontClass} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-700" data-font={m.fontClass}>
            <span>
              <span className="font-mono text-gray-500">{m.fontClass}</span> · {m.pdfName || STR.unknown} →
            </span>
            {editable ? (
              <select
                value={m.companyFontId ? `${COMPANY}${m.companyFontId}` : m.fallbackFamily}
                disabled={saving === m.fontClass}
                onChange={(e) => change(m.fontClass, e.target.value)}
                aria-label={STR.change(m.pdfName || m.fontClass)}
                className="min-h-9 border border-gray-300 rounded-lg px-2 text-[13px] bg-white"
              >
                {companyFonts.length > 0 && (
                  <optgroup label={STR.yours}>
                    {companyFonts.map((f) => (
                      <option key={f.id} value={`${COMPANY}${f.id}`}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={STR.shipped}>
                  {(version.fallbackFontFamilies || []).map((family) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </optgroup>
              </select>
            ) : (
              <span className="font-medium">{m.fallbackName}</span>
            )}
            {editable && !m.companyFontId && m.fallbackName !== m.fallbackFamily && <span className="text-xs text-gray-500">{m.fallbackName.slice(m.fallbackFamily.length + 1)}</span>}
            {m.source === "company_auto" && <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">{t("fontMatches.yourFontSameFamily")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
