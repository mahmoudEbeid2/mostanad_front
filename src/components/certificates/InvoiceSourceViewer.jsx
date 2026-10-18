import { useEffect, useState } from "react";
import Spinner from "../../ui/Spinner";
import { getInvoiceSource } from "../../services/apiInvoices";

// The original invoice, shown next to what was read from it (plan §13.5;
// mockups B2/B3). Fetched with the auth token → blob URL; a PDF opens in the
// browser's own PDF viewer, an image as <img>. Nothing is injected into the app DOM.
const STR = { title: "Original invoice", full: "Open full size", missing: "The original file was not found.", failed: "Couldn't load the original invoice." };

export default function InvoiceSourceViewer({ scope, invoiceId, mimeType, heightClass = "h-[34rem]" }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    setUrl(null);
    setError(null);
    getInvoiceSource(scope, invoiceId)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => alive && setError(err.response?.status === 404 ? STR.missing : STR.failed));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scope, invoiceId]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{STR.title}</h2>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
            {STR.full}
          </a>
        )}
      </div>
      <div className={`${heightClass} bg-gray-100`}>
        {error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : !url ? (
          <div className="h-full flex items-center justify-center">
            <Spinner />
          </div>
        ) : mimeType === "application/pdf" ? (
          <iframe title="Original invoice" src={url} className="w-full h-full bg-white" />
        ) : (
          <div className="h-full overflow-auto">
            <img src={url} alt="Original invoice" className="max-w-full mx-auto" />
          </div>
        )}
      </div>
    </section>
  );
}
