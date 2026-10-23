import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import Spinner from "../ui/Spinner";
import StatusBadge from "../components/certificates/StatusBadge";
import useCompanyScope from "../hooks/useCompanyScope";
import { getCatalogueVersion } from "../services/apiCatalogues";

// /catalogues/versions/:id (backend plan.md §15.3): the blocks code found in one
// uploaded catalogue — each with its page and its text, exactly as printed.
const STR = {
  back: "Catalogues",
  blocks: (n) => `${n} product blocks`,
  context: "Cover / context",
  page: (n) => `Page ${n}`,
  untitled: "Title drawn as artwork",
  review: "Review extracted products",
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
          {version.catalogue?.manufacturer} · {version.label} <StatusBadge status={version.status} />
        </h1>
        <p className="text-sm text-gray-500 mt-1">{STR.blocks(products.length)}</p>
        {["review", "applied", "segmented"].includes(version.status) && (
          <Link to={`/catalogues/versions/${id}/review`} className="inline-block mt-2 text-sm font-semibold text-blue-600 hover:underline">
            {STR.review} →
          </Link>
        )}
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
