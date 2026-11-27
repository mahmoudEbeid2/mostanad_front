// A request's progress per certificate type (COA / COC / HC / FSC): final of made, as a small bar each.
import { t } from "../../i18n";

export default function TypeProgress({ codes = [], types = {} }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => {
        const x = types[code] || { total: 0, final: 0, failed: 0 };
        const pct = x.total ? Math.round((100 * x.final) / x.total) : 0;
        return (
          <span key={code} className="inline-flex min-w-[7.5rem] flex-col rounded-lg border border-gray-200 px-2 py-1 text-xs" data-type={code}>
            <span className="flex justify-between gap-2">
              <span className="font-semibold text-gray-800">{code}</span>
              <span className="text-gray-500">{x.total ? t("certificateRequests.finalOf", { 0: x.final, 1: x.total, f: x.final, t: x.total }) : t("certificateRequests.none")}</span>
            </span>
            <span className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label={code} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span className="block h-full bg-green-500" style={{ width: `${pct}%` }} />
            </span>
            {x.failed > 0 && <span className="mt-0.5 text-red-700">{t("certificateRequests.failed", { 0: x.failed, n: x.failed })}</span>}
          </span>
        );
      })}
    </div>
  );
}
