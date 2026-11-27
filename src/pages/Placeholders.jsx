// Admin and product pages of the UI plan (Phase D's sidebar) that Phases E/F fill in. Each says plainly
// what it will show; missing endpoints are in BACKEND_API_TODO.md.
import ComingSoon from "../ui/ComingSoon";
import { t } from "../i18n";

export const AdminOverview = () => <ComingSoon title={t("placeholders.adminOverview")} subtitle={t("placeholders.adminOverviewHint")} />;
export const AdminAiUsage = () => <ComingSoon title={t("placeholders.aiUsage")} subtitle={t("placeholders.aiUsageHint")} />;
export const AdminHealth = () => <ComingSoon title={t("placeholders.health")} subtitle={t("placeholders.healthHint")} />;
export const ProductConflicts = () => <ComingSoon title={t("placeholders.conflicts")} subtitle={t("placeholders.conflictsHint")} />;
export default AdminOverview;
