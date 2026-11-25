import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CheckCheck, Loader2, Zap } from "lucide-react";
import Button from "../ui/Button";
import { getExpressToReview, markExpressReviewed } from "../services/apiIntake";
import { getCertificate, finalizeCertificate } from "../services/apiCertificatesV2";

// "Express items to review": what urgent orders from the chat made — companies, brands,
// products, templates, certificate drafts — that nobody has checked yet. Open each one;
// "Checked" removes it from the list. Certificates: "Approve all" approves every draft of
// the order that has no blank left (one with a blank is refused and says which).

const KIND = { company: "شركة", brand: "براند", product: "منتج", certificate_type: "نوع شهادة", certificate_template: "قالب شهادة", certificate: "شهادة" };
const ORDER = ["company", "brand", "certificate_type", "product", "certificate_template", "certificate"];

export default function ExpressReview() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => getExpressToReview().then(setData).catch((e) => toast.error(e?.response?.data?.message || e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  const checked = async (ids) => {
    setBusy(ids.join());
    try {
      await markExpressReviewed(ids);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(null);
    }
  };
  const approveAll = async (order) => {
    const certs = order.items.filter((i) => i.entityType === "certificate");
    setBusy(`approve-${order.batchId}`);
    const approved = [];
    const refused = [];
    for (const c of certs) {
      try {
        const cert = await getCertificate({}, c.entityId);
        if (cert.status === "final") approved.push(c.id);
        else {
          await finalizeCertificate({}, c.entityId, cert.currentVersion);
          approved.push(c.id);
        }
      } catch (e) {
        refused.push(`${c.name}: ${e.message}`);
      }
    }
    if (approved.length) await markExpressReviewed(approved).catch(() => {});
    if (refused.length) toast.error(`لم تُعتمد ${refused.length}: ${refused.slice(0, 3).join(" · ")}`, { duration: 8000 });
    if (approved.length) toast.success(`اتعتمدت ${approved.length} شهادة`);
    setBusy(null);
    await load();
  };

  if (!data) return <Loader2 className="h-6 w-6 animate-spin text-gray-400" />;
  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-5 pb-12" data-testid="express-review">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Zap className="h-6 w-6 text-violet-600" /> الطلبات السريعة — محتاجة مراجعة
        </h1>
        <p className="mt-1 text-sm text-gray-500">اللي اتعمل من الشات من غير تسجيل يدوي. افتح كل حاجة، راجعها، وعلّمها «اتراجعت».</p>
      </div>
      {!data.orders.length && <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">مفيش حاجة محتاجة مراجعة.</p>}
      {data.orders.map((o) => {
        const certs = o.items.filter((i) => i.entityType === "certificate");
        const sorted = [...o.items].sort((a, b) => ORDER.indexOf(a.entityType) - ORDER.indexOf(b.entityType));
        return (
          <div key={o.batchId} className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4" data-testid="express-order">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">طلب {new Date(o.createdAt).toLocaleString("ar-EG")} · {o.items.length} عنصر</p>
              <div className="flex gap-2">
                {certs.length > 0 && (
                  <Button className="!px-3 !py-1.5 text-xs" isLoading={busy === `approve-${o.batchId}`} disabled={!!busy} onClick={() => approveAll(o)} data-testid="express-approve-all">
                    <CheckCheck className="h-4 w-4" /> اعتمد كل الشهادات ({certs.length})
                  </Button>
                )}
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" disabled={!!busy} onClick={() => checked(o.items.filter((i) => i.entityType !== "certificate").map((i) => i.id))}>
                  علّم الباقي «اتراجع»
                </Button>
              </div>
            </div>
            <ul className="divide-y divide-gray-100 text-sm">
              {sorted.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="w-24 shrink-0 text-xs text-gray-500">{KIND[i.entityType] || i.entityType}</span>
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  {i.link && (
                    <Link to={i.link} className="text-xs text-blue-700 hover:underline">
                      افتح
                    </Link>
                  )}
                  <button type="button" disabled={!!busy} onClick={() => checked([i.id])} className="text-xs text-gray-500 hover:text-gray-900">
                    اتراجع
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
