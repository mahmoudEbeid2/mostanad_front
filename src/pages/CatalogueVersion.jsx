import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import Spinner from "../ui/Spinner";
import StatusBadge from "../components/certificates/StatusBadge";
import { catalogueVersionStatus } from "../utils/catalogueStatus";
import { withNextStep } from "../utils/aiReason";
import useCompanyScope from "../hooks/useCompanyScope";
import { getCatalogueVersion } from "../services/apiCatalogues";

// /catalogues/versions/:id (backend plan.md §15.3): the blocks code found in one
// uploaded catalogue — each with its page and its text, exactly as printed.
const STR = {
  back: "Catalogues",
  blocks: (n) => `${n} product blocks`,
  extractionFailed: (e) => `Products weren't read automatically. ${withNextStep(e, "Open the review to enter them by hand.")}`,
  context: "Cover / context",
  page: (n) => `Page ${n}`,
  untitled: "Title drawn as artwork",
  review: "Review extracted products",
  pages: "Choose the pages to read",
};

export default function CatalogueVersion() {
  const { id } = useParams();
  const { scope } = useCompanyScope();
  const [version, setVersion] = useState(null);

  useEffect(() => {
    if (!scope) return;
    getCatalogueVersion(scope, id)
      .then(setVersion)
      .catch((err) => toast.error(err.message));
  }, [scope, id]);

  if (!version) {
    return (
      <div className="p-10 flex justify-center">
        <Spinner />
      </div>
    );
  }
  const products = version.blocks.filter((b) => b.kind === "product");
  return (
    <div className="space-y-6">
      <div>
        <Link to="/catalogues" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {STR.back}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-3">
          {version.catalogue?.manufacturer} · {version.label} <StatusBadge status={catalogueVersionStatus(version)} />
        </h1>
        <p className="text-sm text-gray-500 mt-1">{STR.blocks(products.length)}</p>
        {catalogueVersionStatus(version) === "extraction_failed" && (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" data-testid="extraction-failed">
            {STR.extractionFailed(version.error)}
          </p>
        )}
        <div className="flex flex-wrap gap-4 mt-2">
          {["uploaded", "segmenting", "segmented", "review"].includes(version.status) && (
            <Link to={`/catalogues/versions/${id}/pages`} className="text-sm font-semibold text-blue-600 hover:underline" data-testid="version-choose-pages">
              {STR.pages} →
            </Link>
          )}
          {["review", "applied"].includes(version.status) && (
            <Link to={`/catalogues/versions/${id}/review`} className="text-sm font-semibold text-blue-600 hover:underline">
              {STR.review} →
            </Link>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {version.blocks.map((b) => (
          <article key={b.id} className={`bg-white border rounded-xl p-4 ${b.kind === "product" ? "border-gray-200" : "border-dashed border-gray-300"}`} data-testid="catalogue-block">
            <header className="flex items-center justify-between gap-2 mb-2">
              <h2 className="font-semibold text-gray-900">{b.kind === "product" ? b.title || <span className="italic text-gray-500">{STR.untitled}</span> : STR.context}</h2>
              <span className="text-xs text-gray-500">{STR.page(b.page)}</span>
            </header>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans max-h-64 overflow-auto">{b.text.replace(/\t/g, "   ")}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
