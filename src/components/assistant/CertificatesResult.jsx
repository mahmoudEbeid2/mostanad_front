import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { getCertificateThumbnail, exportCertificatePdf, downloadCertificatePdf, waitForTask } from "../../services/apiCertificatesV2";
import { tr } from "../../i18n/lang";

// A chat card that made certificates (26 Nov: "الرابط التالي: الشهادات" with no real link, and
// "Open →" to the hidden internal invoice of a no-invoice certificate): each certificate with its
// thumbnail, a PDF button and «افتح» to its own page.

function Thumb({ scope, id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    let tries = 0;
    const tick = () =>
      getCertificateThumbnail(scope, id)
        .then((blob) => {
          if (!alive) return;
          made = URL.createObjectURL(blob);
          setUrl(made);
        })
        .catch(() => alive && ++tries < 20 && setTimeout(tick, 2000)); // still rendering
    tick();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return url ? <img src={url} alt="" className="h-20 w-16 rounded border border-gray-200 object-cover object-top" /> : <div className="flex h-20 w-16 items-center justify-center rounded border border-gray-200 bg-gray-50"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>;
}

export default function CertificatesResult({ certificates = [], link = null, companyId = null }) {
  const scope = companyId ? { companyId } : {};
  const [busy, setBusy] = useState(null);
  const pdf = async (id) => {
    setBusy(id);
    try {
      const { taskId } = await exportCertificatePdf(scope, id);
      if (taskId) await waitForTask(taskId, { timeoutMs: 180_000 });
      await downloadCertificatePdf(scope, id);
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(null);
    }
  };
  const q = companyId ? `?companyId=${companyId}` : "";
  return (
    <div className="space-y-1.5" data-testid="certificates-result">
      {certificates.map((c) => (
        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-1.5">
          <Thumb scope={scope} id={c.id} />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="flex items-center gap-1 font-semibold text-gray-900">
              <FileText className="h-3.5 w-3.5 text-gray-400" /> {c.type}
            </p>
            <p className="truncate text-gray-600" dir="auto">{c.products.join("، ") || "—"}</p>
          </div>
          <button type="button" onClick={() => pdf(c.id)} disabled={busy === c.id} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
          </button>
          <Link to={`/certificates/${c.id}${q}`} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700" data-testid="certificate-open">
            <ExternalLink className="h-3.5 w-3.5" /> {tr("افتح", "Open")}
          </Link>
        </div>
      ))}
      {certificates.length > 1 && link && (
        <Link to={`${link}${companyId ? `&companyId=${companyId}` : ""}`} className="text-[13px] font-semibold text-blue-600 hover:underline">
          {tr(`كل الـ ${certificates.length} شهادات ←`, `All ${certificates.length} certificates →`)}
        </Link>
      )}
    </div>
  );
}
