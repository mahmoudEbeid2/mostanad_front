import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { getReadiness, setStaticAreas } from "../../../services/apiCertificateTemplates";
import { describeCertificateError } from "../../../utils/certificateErrors";
import { has, t } from "../../../i18n";

// Template readiness (26 Nov: a COA printed another product's batch and results): the places
// of the design that look like they change per product / batch — batch, dates, results,
// composition, product data — and are neither a marked field nor confirmed "static on purpose".
// Until the list is empty the template can't be activated, generate or be finalized.
// "حدده كحقل" opens Mark fields; "ثابت" confirms that text is the same on every certificate.

export default function ReadinessPanel({ scope, versionId, onMark, onChange, reloadKey }) {
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(
    () =>
      getReadiness(scope, versionId)
        .then((x) => {
          setR(x);
          onChange?.(x);
        })
        .catch((e) => toast.error(describeCertificateError(e))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [versionId, reloadKey]
  );
  useEffect(() => {
    load();
  }, [load]);

  const mark = async (ids, isStatic) => {
    setBusy(ids.join());
    try {
      const x = await setStaticAreas(scope, versionId, ids, isStatic);
      setR(x);
      onChange?.(x);
    } catch (e) {
      toast.error(describeCertificateError(e));
    } finally {
      setBusy(null);
    }
  };

  if (!r) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  const open = r.areas.filter((a) => !a.staticConfirmed);
  const confirmed = r.areas.filter((a) => a.staticConfirmed);
  if (r.ready)
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" data-testid="readiness-ready">
        <p className="flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="h-4 w-4" />{" "}{t("readinessPanel.allTheVariablePlacesAre")}{confirmed.length ? t("readinessPanel.confirmedFixed", { length: confirmed.length }) : ""}.
        </p>
        {confirmed.length > 0 && (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer">{t("readinessPanel.confirmedAsFixed")}</summary>
            <ul className="mt-1 space-y-0.5">
              {confirmed.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <span className="font-mono">{a.text}</span> <span className="text-emerald-700">({a.label})</span>
                  <button type="button" className="text-blue-700 hover:underline" disabled={!!busy} onClick={() => mark([a.id], false)}>{t("readinessPanel.makeItVariableAgain")}</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    );
  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" data-testid="readiness-open">
      <p className="flex items-start gap-1.5 font-semibold">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{" "}{t("readinessPanel.thisTemplateStillHasUnmarked", { length: open.length })}</p>
      <p className="text-xs">{t("readinessPanel.anyPlaceHereIfLeft")}</p>
      <ul className="divide-y divide-amber-200 rounded-md border border-amber-200 bg-white">
        {open.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-xs" data-testid="readiness-area">
            <span className="w-28 shrink-0 text-gray-600">{a.label}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-gray-900" dir="ltr">
              {a.text}
            </span>
            <span className="text-gray-500">{has(`readinessPanel.kind.${a.kind}`) ? t(`readinessPanel.kind.${a.kind}`) : a.kindAr}</span>
            {onMark && (
              <button type="button" className="text-blue-700 hover:underline" onClick={() => onMark(a)}>{t("readinessPanel.markItAsAField")}</button>
            )}
            <button type="button" className="text-gray-600 hover:text-gray-900 hover:underline" disabled={!!busy} onClick={() => mark([a.id], true)}>{t("readinessPanel.fixed")}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
