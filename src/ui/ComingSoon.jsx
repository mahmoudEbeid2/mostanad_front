// A page whose data the backend doesn't serve yet (UI plan rule: build the UI, say so clearly, and list the
// endpoint in BACKEND_API_TODO.md). `children` is whatever the page can already show.
import { Hourglass } from "lucide-react";
import { t } from "../i18n";

export default function ComingSoon({ title, subtitle, what, children }) {
  return (
    <div className="space-y-6" data-testid="coming-soon-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-6 py-8 text-center" data-testid="coming-soon">
        <Hourglass className="mx-auto h-7 w-7 text-amber-600" aria-hidden="true" />
        <p className="mt-2 font-semibold text-amber-900">{t("comingSoon.title")}</p>
        <p className="mx-auto mt-1 max-w-xl text-sm text-amber-800">{what || t("comingSoon.hint")}</p>
      </div>
    </div>
  );
}
