import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { getExpressToReview } from "../../services/apiIntake";
import { t } from "../../i18n";

// Dashboard: urgent orders' items nobody checked yet ("Express — needs review"). Hidden when none.
export default function ExpressToReviewTile() {
  const [n, setN] = useState(0);
  useEffect(() => {
    getExpressToReview().then((d) => setN(d.count || 0)).catch(() => setN(0));
  }, []);
  if (!n) return null;
  return (
    <Link to="/express" className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-violet-900 hover:bg-violet-100" data-testid="express-tile">
      <span className="flex items-center gap-2 font-semibold">
        <Zap className="h-5 w-5" />{" "}{t("expressToReviewTile.expressRequestsItemsNeedReview", { n })}</span>
      <span className="text-sm underline">{t("expressToReviewTile.reviewThem")}</span>
    </Link>
  );
}
