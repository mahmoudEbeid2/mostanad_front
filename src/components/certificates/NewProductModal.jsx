import { useEffect, useId, useMemo, useRef, useState } from "react";
import Select from "react-select";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import Button from "../../ui/Button";
import Spinner from "../../ui/Spinner";
import { useAiStatus } from "../../context/AiStatusContext";
import { getCategories } from "../../services/apiCategories";
import { createProductFromLine, getNewProductDraft, suggestNewProduct } from "../../services/apiInvoices";

// "+ New product" on an unmatched invoice line (mockup D2). By default it asks only for what this
// line's certificates require; "Full product" shows every field. The list of fields comes from the
// server (the line's selected templates) and follows the certificate type chips on the page.
// Required fields may stay empty: they show up as missing in the data check.
const STR = {
  title: (n) => `New product from line ${n}`,
  group: "How much to add",
  needed: "Only what the certificates need",
  neededHint: (n, codes) => `${n} required field${n === 1 ? "" : "s"}${codes.length ? ` for ${codes.join(" + ")}` : ""}`,
  full: "Full product",
  fullHint: "Every product field — for the product list too",
  name: "Name",
  required: (codes, done, total) => `Required for ${codes.join(" + ") || "these certificates"} · ${done} of ${total} filled`,
  allFields: "Product fields",
  suggest: "Suggest with AI",
  suggesting: "Asking…",
  nothingSuggested: "AI had nothing to suggest for the empty fields.",
  estimated: "estimated",
  stays: "Batch, quantity and dates stay on the invoice line; lab results go in the results grid.",
  rowName: "Name",
  rowAmount: "Amount",
  rowValue: "Value",
  addRow: "Add a row",
  removeRow: "Remove this row",
  remember: "Use this name for future invoices",
  cancel: "Cancel",
  create: (n) => `Create product and match line ${n}`,
  createFull: (n) => `Create full product and match line ${n}`,
  close: "Close",
  registry: "From the official registry only",
  tags: "Separate with commas",
  brand: "Choose a brand…",
  category: "Choose a category…",
};

const inputClass = "mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white";
const selectStyles = { menuPortal: (base) => ({ ...base, zIndex: 70 }), control: (base) => ({ ...base, minHeight: 38, fontSize: 14 }) };

const blank = (v) => v === undefined || v === null || (typeof v === "string" ? !v.trim() : Array.isArray(v) ? !v.some((row) => (typeof row === "string" ? row.trim() : Object.values(row).some((x) => String(x || "").trim()))) : false);

function Rows({ value = [], secondKey, secondLabel, label, onChange }) {
  const rows = value.length ? value : [{ name: "", [secondKey]: "" }];
  const set = (i, patch) => onChange(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  return (
    <div className="mt-1 space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input aria-label={`${label} ${i + 1} · ${STR.rowName}`} placeholder={STR.rowName} value={row.name || ""} onChange={(e) => set(i, { name: e.target.value })} className={`${inputClass} !mt-0 flex-[3]`} />
          <input aria-label={`${label} ${i + 1} · ${secondLabel}`} placeholder={secondLabel} value={row[secondKey] || ""} onChange={(e) => set(i, { [secondKey]: e.target.value })} className={`${inputClass} !mt-0 flex-[2]`} />
          <button type="button" aria-label={`${STR.removeRow} (${i + 1})`} title={STR.removeRow} onClick={() => onChange(rows.filter((_, n) => n !== i))} className="text-gray-400 hover:text-red-600 shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { name: "", [secondKey]: "" }])} className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1">
        <Plus className="w-3.5 h-3.5" /> {STR.addRow}
      </button>
    </div>
  );
}

function Field({ field, mark, value, estimate, onChange, brands, categories }) {
  const id = useId();
  const { path, label, input, types = [] } = field;
  const head = (
    <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-700">
      <label htmlFor={id}>
        {label}
        {mark ? " *" : ""}
      </label>
      {types.map((c) => (
        <span key={c} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-600">
          {c}
        </span>
      ))}
      {estimate && (
        <span className="rounded-full bg-violet-50 text-violet-700 px-2 py-0.5 text-[11px] font-semibold" title={estimate.reasoning || undefined} data-testid="estimated-badge">
          {STR.estimated}
        </span>
      )}
    </span>
  );
  let control;
  if (input === "ingredients") control = <Rows value={value} secondKey="concentration" secondLabel={STR.rowAmount} label={label} onChange={onChange} />;
  else if (input === "specs") control = <Rows value={value} secondKey="value" secondLabel={STR.rowValue} label={label} onChange={onChange} />;
  else if (input === "brand" || input === "category") {
    const options = (input === "brand" ? brands : categories).map((o) => ({ value: o.id, label: o.name }));
    control = (
      <Select
        inputId={id}
        className="cert-select mt-1"
        options={options}
        value={options.find((o) => o.value === value) || null}
        onChange={(o) => onChange(o?.value || null)}
        isClearable
        placeholder={input === "brand" ? STR.brand : STR.category}
        menuPortalTarget={document.body}
        styles={selectStyles}
      />
    );
  } else if (input === "long") control = <textarea id={id} rows={2} value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  else control = <input id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={path === "registrationNumber" ? STR.registry : input === "tags" ? STR.tags : undefined} className={inputClass} />;
  return (
    <div data-field={path}>
      {head}
      {control}
    </div>
  );
}

/** The form's value of a field: rows for lists, one text for tags. */
const fromSuggestion = (input, value) => (input === "tags" && Array.isArray(value) ? value.join(", ") : value);

/** Only what the mode shows and the person (or the invoice) filled. */
function bodyOf(visible, values) {
  const body = {};
  const pathValues = {};
  for (const f of visible) {
    const v = values[f.path];
    if (blank(v)) continue;
    if (f.input === "ingredients") body.activeIngredients = v.filter((r) => !blank([r])).map((r) => ({ name: r.name, concentration: r.concentration || null }));
    else if (f.input === "specs") body.specifications = { type: "Specification", values: Object.fromEntries(v.filter((r) => r.name?.trim()).map((r) => [r.name.trim(), r.value || ""])) };
    else if (f.input === "tags") body[f.path] = v.split(",").map((s) => s.trim()).filter(Boolean);
    else if (f.input === "brand") body.brandId = v;
    else if (f.input === "category") body.categoryId = v;
    else if (f.path.includes(".")) pathValues[f.path] = v.trim();
    else body[f.path] = v.trim();
  }
  return Object.keys(pathValues).length ? { ...body, pathValues } : body;
}

export default function NewProductModal({ scope, invoiceId, item, typesKey, brands, offsetForChips = false, onClose, onCreated }) {
  const titleId = useId();
  const dialog = useRef(null);
  const { available: aiAvailable } = useAiStatus();
  const [draft, setDraft] = useState(null);
  const [mode, setMode] = useState("needed");
  const [values, setValues] = useState({});
  const [estimates, setEstimates] = useState({}); // path → { suggestionId, reasoning, edited }
  const [remember, setRemember] = useState(true);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(null); // "create" | "suggest"
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    const before = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
      if (e.key !== "Tab" || !dialog.current) return;
      const all = [...dialog.current.querySelectorAll("button:not([disabled]), input:not([disabled]), textarea, a[href]")].filter((el) => el.offsetParent !== null);
      if (!all.length) return;
      const first = all[0];
      const last = all[all.length - 1];
      const inside = dialog.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  // again whenever the chips on the page change what this line's certificates read
  useEffect(() => {
    let live = true;
    getNewProductDraft(scope, invoiceId, item.id)
      .then((d) => {
        if (!live) return;
        setDraft(d);
        const p = d.prefill;
        // what the person typed stays; the invoice only fills what is still empty
        setValues((now) => ({ name: p.name, productCode: p.productCode, packaging: p.packaging, "brand.name": p.brandId, ...now }));
        setError(null);
      })
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [scope, invoiceId, item.id, typesKey]);

  useEffect(() => {
    if (mode !== "full" || categories.length) return;
    getCategories({ limit: 100 })
      .then((res) => setCategories(res?.data?.categories || []))
      .catch((err) => setError(err.message));
  }, [mode, categories.length]);

  useEffect(() => {
    if (draft) dialog.current?.querySelector("#new-product-name")?.focus();
  }, [draft]);

  const needed = useMemo(() => (draft?.neededFields || []).filter((f) => f.path !== "name"), [draft]);
  const required = needed.filter((f) => f.required);
  const codes = [...new Set(required.flatMap((f) => f.types))].sort();
  const fullList = useMemo(() => {
    if (!draft) return [];
    const inNeeded = new Set(needed.map((f) => f.path));
    const others = draft.fullFields.filter((f) => !inNeeded.has(f.path));
    const code = others.find((f) => f.path === "productCode");
    return [...(code ? [code] : []), ...needed, ...others.filter((f) => f !== code)];
  }, [draft, needed]);
  const visible = mode === "full" ? fullList : required;
  const nameField = { path: "name", input: "text" };

  const setValue = (path, v) => {
    setValues((now) => ({ ...now, [path]: v }));
    setEstimates((now) => (now[path] ? { ...now, [path]: { ...now[path], edited: true } } : now));
  };

  const suggest = async () => {
    setBusy("suggest");
    setError(null);
    setNote(null);
    try {
      const out = await suggestNewProduct(scope, invoiceId, item.id, { mode, values: bodyOf([nameField, ...visible], values) });
      if (out.unavailable) setError(out.reason);
      else if (!out.suggestions.length) setNote(STR.nothingSuggested);
      setValues((now) => {
        const next = { ...now };
        for (const s of out.suggestions) if (blank(next[s.path])) next[s.path] = fromSuggestion(s.input, s.value);
        return next;
      });
      setEstimates((now) => ({ ...now, ...Object.fromEntries(out.suggestions.filter((s) => blank(values[s.path])).map((s) => [s.path, { suggestionId: s.suggestionId, reasoning: s.reasoning }])) }));
    } catch (err) {
      setError(err.message);
    }
    setBusy(null);
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const body = { ...bodyOf([nameField, ...visible], values), mode, rememberAlias: remember, suggestionIds: Object.values(estimates).map((s) => s.suggestionId) };
      onCreated(await createProductFromLine(scope, invoiceId, item.id, body));
    } catch (err) {
      setError(err.message); // the form stays as it is
      setBusy(null);
    }
  };

  const filled = required.filter((f) => !blank(values[f.path])).length;
  const showSuggest = aiAvailable && !!draft && visible.length > 0;
  const estimateOf = (path) => (estimates[path] && !estimates[path].edited ? estimates[path] : null);
  const fieldProps = (f) => ({ field: f, value: values[f.path], estimate: estimateOf(f.path), onChange: (v) => setValue(f.path, v), brands, categories });

  return (
    <div className={`fixed inset-0 z-40 flex justify-center bg-gray-900/40 p-4 ${offsetForChips ? "items-start pt-24" : "items-center"}`}>
      <form ref={dialog} onSubmit={create} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`w-full max-w-2xl rounded-xl bg-white shadow-xl flex flex-col ${offsetForChips ? "max-h-[calc(100vh-7.5rem)]" : "max-h-[calc(100vh-2rem)]"}`} data-testid="new-product-modal">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              {STR.title(item.lineNo)}
            </h2>
            <p className="text-sm text-gray-500 truncate">{draft ? [draft.invoiceText, draft.companyName].filter(Boolean).join(" · ") : item.data?.name}</p>
          </div>
          <button type="button" aria-label={STR.close} onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {!draft && !error && (
            <div className="py-8 flex justify-center">
              <Spinner />
            </div>
          )}
          {draft && (
            <>
              <div role="radiogroup" aria-label={STR.group} className="grid gap-2.5 sm:grid-cols-2">
                {[
                  { id: "needed", label: STR.needed, hint: STR.neededHint(required.length, codes) },
                  { id: "full", label: STR.full, hint: STR.fullHint },
                ].map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} onClick={() => setMode(o.id)} data-testid={`mode-${o.id}`} className={`flex items-start gap-2.5 rounded-xl p-3 text-left border-2 ${mode === o.id ? "border-blue-600 bg-blue-50/40" : "border-gray-200 hover:border-gray-300"}`}>
                    <span aria-hidden="true" className={`mt-0.5 w-4 h-4 rounded-full shrink-0 border-2 ${mode === o.id ? "border-[5px] border-blue-600" : "border-gray-300"}`} />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-900">{o.label}</span>
                      <span className="text-xs text-gray-500">{o.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="new-product-name" className="text-sm font-semibold text-gray-700">
                  {STR.name} *
                </label>
                <input id="new-product-name" required minLength={2} value={values.name || ""} onChange={(e) => setValue("name", e.target.value)} className={inputClass} />
              </div>

              {draft.noCertificate && <p className="text-sm text-amber-800" data-testid="no-certificate">{draft.noCertificate}</p>}

              {visible.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <span className="text-sm font-semibold text-gray-900" data-testid="fields-heading">
                    {mode === "full" ? STR.allFields : STR.required(codes, filled, required.length)}
                  </span>
                  {showSuggest && (
                    <button type="button" onClick={suggest} disabled={busy === "suggest"} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700 hover:underline disabled:opacity-50" data-testid="suggest-ai">
                      <Sparkles className="w-4 h-4" /> {busy === "suggest" ? STR.suggesting : STR.suggest}
                    </button>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2" data-testid="product-fields">
                {visible.map((f) => (
                  <div key={f.path} className={["ingredients", "specs", "long"].includes(f.input) ? "sm:col-span-2" : ""}>
                    <Field {...fieldProps(f)} mark={f.required} />
                  </div>
                ))}
              </div>

              {mode === "full" && <p className="text-xs text-gray-500">{STR.stays}</p>}
            </>
          )}
          {note && <p className="text-sm text-gray-600">{note}</p>}
          {error && (
            <p role="alert" className="text-sm text-red-600" data-testid="new-product-error">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 py-3.5 border-t border-gray-100">
          <label className="flex items-center gap-2 text-xs text-gray-600 mr-auto">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-blue-600" data-testid="remember-name" /> {STR.remember}
          </label>
          <Button type="button" variant="secondary" onClick={onClose}>
            {STR.cancel}
          </Button>
          <Button type="submit" isLoading={busy === "create"} disabled={!draft || !(values.name || "").trim()} data-testid="create-product">
            {mode === "full" ? STR.createFull(item.lineNo) : STR.create(item.lineNo)}
          </Button>
        </div>
      </form>
    </div>
  );
}
