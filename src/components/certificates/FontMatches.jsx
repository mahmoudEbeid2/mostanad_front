import { useState } from "react";
import toast from "react-hot-toast";
import { setFontFallback } from "../../services/apiCertificateTemplates";
import { describeCertificateError } from "../../utils/certificateErrors";

// Template "Prepare & test": each font embedded in the design with the shipped font
// matched to it. A character the design's subset font lacks is drawn from that match;
// the owner can correct it until the version is activated.
const STR = {
  title: "Design fonts",
  hint: "A character the design font lacks is drawn from its match.",
  unknown: "Name unreadable",
  change: (name) => `Fallback font for ${name}`,
};

export default function FontMatches({ scope, version, onChanged }) {
  const [saving, setSaving] = useState(null);
  const editable = ["draft", "ready"].includes(version.status);
  const matches = version.fontMatches || [];
  if (!matches.length) return null;

  const change = async (fontClass, fallbackFamily) => {
    setSaving(fontClass);
    try {
      await setFontFallback(scope, version.id, { fontClass, fallbackFamily });
      await onChanged?.();
    } catch (err) {
      toast.error(describeCertificateError(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="px-5 py-4 border-t border-gray-100" data-testid="font-matches">
      <h3 className="text-sm font-semibold text-gray-900">{STR.title}</h3>
      <p className="text-xs text-gray-500 mt-0.5">{STR.hint}</p>
      <ul className="mt-2 space-y-1.5">
        {matches.map((m) => (
          <li key={m.fontClass} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-700" data-font={m.fontClass}>
            <span>
              <span className="font-mono text-gray-500">{m.fontClass}</span> · {m.pdfName || STR.unknown} →
            </span>
            {editable ? (
              <select
                value={m.fallbackFamily}
                disabled={saving === m.fontClass}
                onChange={(e) => change(m.fontClass, e.target.value)}
                aria-label={STR.change(m.pdfName || m.fontClass)}
                className="min-h-9 border border-gray-300 rounded-lg px-2 text-[13px] bg-white"
              >
                {(version.fallbackFontFamilies || []).map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium">{m.fallbackName}</span>
            )}
            {editable && m.fallbackName !== m.fallbackFamily && <span className="text-xs text-gray-500">{m.fallbackName.slice(m.fallbackFamily.length + 1)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
