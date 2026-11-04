import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../utils/permissions";

// "Certificates to make" on the invoice upload (mockup D1): one card per type. A type with no
// active template can't be chosen; it offers to create one. All selected + "Include new types
// automatically" is sent as null: every type with an active template, now and later.
const STR = {
  title: "Certificates to make",
  hint: "Pick the certificates this shipment needs. Each one is made for every matched product.",
  selectAll: (n, m) => `Select all · ${n} of ${m}`,
  group: "Certificate types",
  templates: (n) => `${n} template${n === 1 ? "" : "s"}`,
  scope: { per_product: "one per product", per_invoice: "one for the whole invoice" },
  noTemplate: "No active template yet",
  createTemplate: "Create a template →",
  willMake: (codes) => `Will make ${codes.join(" + ")} for every matched product`,
  pickOne: "Pick at least one certificate.",
  includeNew: "Include new certificate types automatically",
  remember: (company) => `Remember for ${company}`,
  noneUsable: "No certificate type has an active template yet, so nothing is chosen here. You can still upload the invoice.",
  failed: "Couldn't load the certificate types. The upload uses the company's usual choice.",
};

// mockup D1: a square per type, by its place in the list
const COLOURS = ["bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-amber-100 text-amber-700", "bg-pink-100 text-pink-700", "bg-violet-100 text-violet-700"];

const scopeText = (t) => t.scopes.map((s) => STR.scope[s]).filter(Boolean).join(" and ");

function TypeCard({ type, colour, checked, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      data-testid="type-card"
      data-code={type.code}
      className={`flex items-center gap-3 rounded-xl p-3.5 text-left transition-colors border-2 ${checked ? "border-blue-600 bg-blue-50/40 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      <span aria-hidden="true" className={`w-11 h-11 rounded-lg shrink-0 flex items-center justify-center font-mono text-xs font-bold ${colour}`}>
        {type.code}
      </span>
      <span className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-sm font-semibold text-gray-900">{type.name}</span>
        <span className="text-xs text-gray-500">
          {STR.templates(type.activeTemplates)} · {scopeText(type)}
        </span>
      </span>
      <span aria-hidden="true" className={`w-5.5 h-5.5 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${checked ? "bg-blue-600 text-white" : "border-2 border-gray-300"}`}>
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}

function UnusableCard({ type, canCreate }) {
  return (
    <div data-testid="type-card" data-code={type.code} data-unusable="true" className="flex items-center gap-3 rounded-xl p-3.5 m-px border border-dashed border-gray-300 bg-gray-50">
      <span aria-hidden="true" className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center font-mono text-xs font-bold bg-gray-100 text-gray-400">
        {type.code}
      </span>
      <span className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span role="checkbox" aria-checked="false" aria-disabled="true" className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-gray-400">{type.name}</span>
          <span className="text-xs text-gray-500">{STR.noTemplate}</span>
        </span>
        {canCreate && (
          <Link to={`/certificates/templates/new?certificateTypeId=${type.id}`} className="text-xs font-semibold text-blue-600 hover:underline">
            {STR.createTemplate}
          </Link>
        )}
      </span>
      <span aria-hidden="true" className="w-5.5 h-5.5 rounded-full shrink-0 border-2 border-gray-200" />
    </div>
  );
}

/**
 * types: from listCertificateTypesForPicker (null while loading); failed: they couldn't be loaded.
 * selected: Set of type ids. includeNew, remember: the two options; onChange({ selected?, includeNew?, remember? }).
 */
export default function CertificateTypePicker({ types, failed, selected, includeNew, remember, companyName, onChange }) {
  const { user } = useAuth();
  const canCreate = hasPermission(user, "create_certificate_templates");
  if (failed) return <p className="text-sm text-amber-800">{STR.failed}</p>;
  if (!types?.length) return null;
  const usable = types.filter((t) => t.activeTemplates > 0);
  const chosen = usable.filter((t) => selected.has(t.id));
  const all = usable.length > 0 && chosen.length === usable.length;
  const some = chosen.length > 0 && !all;
  const toggle = (id) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    onChange({ selected: next });
  };
  return (
    <section aria-labelledby="certificates-to-make" className="space-y-3.5" data-testid="certificate-types">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="certificates-to-make" className="text-base font-bold text-gray-900">
            {STR.title}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{STR.hint}</p>
        </div>
        {usable.length > 0 && (
          <button
            type="button"
            role="checkbox"
            aria-checked={all ? "true" : some ? "mixed" : "false"}
            onClick={() => onChange({ selected: new Set(all ? [] : usable.map((t) => t.id)) })}
            data-testid="select-all-types"
            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-full bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <span aria-hidden="true" className={`w-4 h-4 rounded flex items-center justify-center text-[11px] font-bold ${all || some ? "bg-blue-600 text-white" : "border-2 border-gray-300"}`}>
              {all ? "✓" : some ? "–" : ""}
            </span>
            {STR.selectAll(chosen.length, usable.length)}
          </button>
        )}
      </div>

      <div role="group" aria-label={STR.group} className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {types.map((t, i) =>
          t.activeTemplates > 0 ? <TypeCard key={t.id} type={t} colour={COLOURS[i % COLOURS.length]} checked={selected.has(t.id)} onToggle={() => toggle(t.id)} /> : <UnusableCard key={t.id} type={t} canCreate={canCreate} />
        )}
      </div>

      {usable.length === 0 ? (
        <p className="text-sm text-gray-600">{STR.noneUsable}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2.5 px-3.5 py-3 rounded-lg bg-gray-100 text-sm" data-testid="types-summary">
          {chosen.length ? <span className="font-semibold text-gray-900">{STR.willMake(chosen.map((t) => t.code))}</span> : <span className="font-semibold text-red-600">{STR.pickOne}</span>}
          {all && (
            <label className="flex items-center gap-2 text-gray-700">
              <input type="checkbox" checked={includeNew} onChange={(e) => onChange({ includeNew: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="include-new-types" /> {STR.includeNew}
            </label>
          )}
          <label className="flex items-center gap-2 text-gray-700 ml-auto">
            <input type="checkbox" checked={remember} onChange={(e) => onChange({ remember: e.target.checked })} className="w-4 h-4 accent-blue-600" data-testid="remember-types" /> {STR.remember(companyName)}
          </label>
        </div>
      )}
    </section>
  );
}
