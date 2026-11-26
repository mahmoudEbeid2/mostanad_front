// «اعتمد كل المستنتج» (28 Nov): a draft's estimated descriptive values are printed marked «مستنتج» and never
// block; a reviewer who checked them accepts them all in one click (the product's estimates too, so the
// next certificates aren't marked again).
import { useState } from "react";
import toast from "react-hot-toast";
import { Sparkles } from "lucide-react";
import Button from "../../ui/Button";
import { acceptAllEstimates } from "../../services/apiWorkflow";
import { tr } from "../../i18n/lang";

export default function EstimatesBar({ scope, values, certificateIds = [], productIds = [], onAccepted }) {
  const [busy, setBusy] = useState(false);
  const count = Object.values(values || {}).filter((v) => (v?.flags || []).includes("estimated")).length;
  if (!count) return null;
  const accept = async () => {
    setBusy(true);
    try {
      const r = await acceptAllEstimates(scope, certificateIds.length ? { certificateIds } : { productIds });
      toast.success(tr(`اتعمد ${r.marksCleared || r.accepted} قيمة مستنتجة`, `${r.marksCleared || r.accepted} estimated value(s) accepted`));
      onAccepted?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3" data-testid="estimates-bar">
      <p className="flex items-center gap-2 text-sm text-violet-900">
        <Sparkles className="h-4 w-4" />
        {tr(`${count} قيمة «مستنتجة» — مش من ملف. راجعها، وبعدين اعتمدها مرة واحدة.`, `${count} value(s) are estimated — not from a file. Check them, then accept them at once.`)}
      </p>
      <Button onClick={accept} isLoading={busy} className="py-2! text-sm">
        {tr("اعتمد كل المستنتج", "Accept all estimates")}
      </Button>
    </div>
  );
}
