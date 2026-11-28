// Product pages of the UI plan (Phase D's sidebar) that wait on an endpoint. Each says plainly what it will
// show; missing endpoints are in BACKEND_API_TODO.md.
import { Link } from "react-router-dom";
import ComingSoon from "../ui/ComingSoon";
import { t } from "../i18n";

// Until GET /products/conflicts exists, a product's conflicts are on its own page (Data from files tab)
export const ProductConflicts = () => (
  <ComingSoon title={t("placeholders.conflicts")} subtitle={t("placeholders.conflictsHint")} what={t("placeholders.conflictsSoon")}>
    <Link to="/products" className="inline-flex text-sm font-semibold text-blue-700 hover:underline">{t("placeholders.conflictsOpenProducts")}</Link>
  </ComingSoon>
);
export default ProductConflicts;
