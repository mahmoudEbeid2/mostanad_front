import { useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { searchCertificateProducts } from "../../services/apiCertificateTemplates";

// Product picker for one invoice line (plan §13.2, §9.3): the ranked match
// candidates first, then a live search of the company's own catalogue
// (GET /certificate-products — tenant-forced on the server).
const STR = {
  candidates: "Suggested matches",
  catalogue: "Catalogue",
  placeholder: (n) => (n ? `Choose… (${n} suggestion${n === 1 ? "" : "s"})` : "Search the catalogue…"),
  noOptions: "No product found — type to search the catalogue",
  loading: "Searching…",
};

const optionOf = (p, extra = {}) => ({ value: p.id ?? p.productId, label: p.name, code: p.productCode ?? p.code ?? null, ...extra });

export default function ProductMatchSelect({ scope, item, onChange, disabled, inputId, ariaLabel }) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = input.trim();
    if (!q) {
      setResults([]);
      return undefined;
    }
    const n = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      searchCertificateProducts(scope, q, 20)
        .then((list) => n === seq.current && setResults(list))
        .catch(() => n === seq.current && setResults([]))
        .finally(() => n === seq.current && setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [input, scope]);

  const groups = useMemo(() => {
    const candidates = (item.matchCandidates || []).map((c) => optionOf(c, { score: c.score, reasons: c.ai ? c.ai.reasons : c.reasons, ai: c.ai || null }));
    const seen = new Set(candidates.map((c) => c.value));
    const catalogue = results.filter((p) => !seen.has(p.id)).map((p) => optionOf(p));
    return [
      ...(candidates.length ? [{ label: STR.candidates, options: candidates }] : []),
      ...(catalogue.length ? [{ label: STR.catalogue, options: catalogue }] : []),
    ];
  }, [item.matchCandidates, results]);

  const value = item.product ? optionOf(item.product) : null;

  return (
    <Select
      // picking the AI's own suggestion here confirms it (plan.md §7)
      onChange={(opt) => onChange(opt ? opt.value : null, opt, opt?.ai ? { aiSuggestionId: opt.ai.suggestionId } : undefined)}
      className="cert-select"
      inputId={inputId}
      aria-label={ariaLabel}
      value={value}
      options={groups}
      onInputChange={(v, { action }) => action === "input-change" && setInput(v)}
      inputValue={input}
      filterOption={null}
      isClearable
      isDisabled={disabled}
      isLoading={loading}
      placeholder={STR.placeholder(item.matchCandidates?.length || 0)}
      noOptionsMessage={() => STR.noOptions}
      loadingMessage={() => STR.loading}
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      styles={{ menuPortal: (base) => ({ ...base, zIndex: 50 }), control: (base) => ({ ...base, minHeight: 34, fontSize: 13 }) }}
      formatOptionLabel={(o, { context }) =>
        context === "value" ? (
          <span>
            {o.label} {o.code && <span className="text-gray-400 font-mono text-xs">{o.code}</span>}
          </span>
        ) : (
          <div className="text-sm">
            <div>
              {o.label} {o.code && <span className="text-gray-400 font-mono text-xs">{o.code}</span>}
              {o.ai ? <span className="ml-2 text-xs text-violet-700">AI {Math.round(o.ai.confidence * 100)}%</span> : typeof o.score === "number" && <span className="ml-2 text-xs text-blue-600">{Math.round(o.score * 100)}%</span>}
            </div>
            {o.reasons?.length > 0 && <div className="text-xs text-gray-400">{o.reasons.join(" · ")}</div>}
          </div>
        )
      }
    />
  );
}
