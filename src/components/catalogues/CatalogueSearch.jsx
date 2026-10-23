import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenText, ChevronDown, Search } from "lucide-react";
import Spinner from "../../ui/Spinner";
import CompanyPicker from "../certificates/CompanyPicker";
import useCompanyScope from "../../hooks/useCompanyScope";
import { searchCatalogues } from "../../services/apiCatalogues";

// "Search catalogues" (backend plan.md §15.6, A6.6): full text over the company's
// catalogue pages plus fuzzy product names. Each hit names the product, the page
// and a snippet with the matched words highlighted, and opens the review screen
// on that block (the PDF page beside it).
const STR = {
  title: "Search catalogues",
  hint: "Search every printed page of this company's catalogues — “Vitamin E”, “withdrawal none”, “AKS0”.",
  placeholder: "Ingredient, product, code, phrase…",
  search: "Search",
  none: "Nothing printed matches.",
  count: (n) => `${n} result${n === 1 ? "" : "s"}`,
  page: (p) => `p.${p}`,
  phrase: "exact phrase",
  name: "similar name",
  context: "Cover / back page",
};

/** "a [[b]] c" → ["a ", <mark>b</mark>, " c"] */
function Snippet({ text }) {
  if (!text) return null;
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith("[[") ? (
          <mark key={i} className="bg-amber-200/70 text-gray-900 rounded px-0.5">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p.replace(/\t/g, " ")}</span>
        )
      )}
    </p>
  );
}

export default function CatalogueSearch() {
  const scopeState = useCompanyScope();
  const { scope } = scopeState;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [state, setState] = useState({ loading: false, results: null, error: null });

  const run = async (e) => {
    e.preventDefault();
    if (!q.trim() || !scope) return;
    setState({ loading: true, results: null, error: null });
    try {
      const d = await searchCatalogues(scope, q.trim());
      setState({ loading: false, results: d.results, error: null });
    } catch (err) {
      setState({ loading: false, results: null, error: err.message });
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <BookOpenText className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-gray-900">{STR.title}</span>
        <ChevronDown className={`w-4 h-4 ml-auto text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-500">{STR.hint}</p>
          <form onSubmit={run} className="flex flex-wrap gap-2 items-end">
            {!scopeState.isCompany && <CompanyPicker scope={scopeState} variant="field" compact className="min-w-[14rem]" />}
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={STR.placeholder} className="w-full min-h-10 pl-9 pr-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <button type="submit" disabled={!q.trim() || !scope || state.loading} className="min-h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50">
              {STR.search}
            </button>
          </form>
          {state.loading && <Spinner />}
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.results && (
            <div>
              <p className="text-xs text-gray-500 mb-2">{state.results.length ? STR.count(state.results.length) : STR.none}</p>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {state.results.map((r) => (
                  <li key={r.blockId}>
                    <Link to={`/catalogues/versions/${r.versionId}/review?block=${r.blockId}`} className="block px-3 py-2 hover:bg-gray-50">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{r.kind === "context" ? STR.context : r.name || STR.page(r.page)}</span>
                        {r.productCode && <span className="text-xs font-mono text-gray-500">{r.productCode}</span>}
                        <span className="text-xs text-gray-500">
                          {r.manufacturer} · {r.versionLabel} · {STR.page(r.page)}
                        </span>
                        {r.match !== "words" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{r.match === "phrase" ? STR.phrase : STR.name}</span>}
                      </div>
                      <Snippet text={r.snippet} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
