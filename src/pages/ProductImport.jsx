import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Upload, FileText, CheckCheck, AlertTriangle, X, ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser } from "../utils/permissions";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { startProductImport, getProductImport, editImportRow, skipImportRow, saveAllImported } from "../services/apiProductImports";

// "Add products from files": many products at once — label files, product sheets
// (PDF, .ai, images), an Excel/CSV list or a pasted list → one table, one product
// per file or row, read from the files only (nothing guessed). Correct any cell, skip
// what isn't wanted, then "Save all". A row matching an existing product is left alone.

const ACCEPT = "application/pdf,.ai,image/png,image/jpeg,.xlsx,.csv,text/csv";

function Start() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSystem = !(isCompanyUser(user) || user?.isCompany);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState("");
  const [files, setFiles] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    if (isSystem) getCompanies({ limit: 200 }).then((r) => setCompanies(r?.data?.companies || [])).catch(() => {});
  }, [isSystem]);
  useEffect(() => {
    const c = isSystem ? companyId : null;
    if (isSystem && !c) return setBrands([]);
    getBrands(c || undefined).then((r) => setBrands(r?.data?.brands || [])).catch(() => setBrands([]));
  }, [isSystem, companyId]);

  const add = (list) => setFiles((old) => [...old, ...[...list].filter((f) => !old.some((o) => o.name === f.name && o.size === f.size))]);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await startProductImport({ files, text, companyId: isSystem ? companyId : undefined, brandId: brandId || undefined });
      if (out.refused?.length) toast(`Not read: ${out.refused.map((r) => r.file).join(", ")}`, { icon: "⚠️" });
      navigate(`/products/import/${out.versionId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-5">
      <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Products
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Add products from files</h1>
        <p className="text-gray-500 mt-1">Drop label files, product sheets or a list — many at once. You check one table, then save them all.</p>
      </div>
      {isSystem && (
        <label className="block text-sm">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Company</span>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2" aria-label="Company">
            <option value="">Choose the company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {brands.length > 0 && (
        <label className="block text-sm">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Brand (optional)</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2" aria-label="Brand">
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files || []);
        }}
        className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center"
        data-testid="import-dropzone"
      >
        <p className="text-sm text-gray-600">Drop files here: PDF, Illustrator (.ai), images, Excel or CSV</p>
        <Button variant="secondary" className="mt-3" onClick={() => input.current?.click()}>
          <Upload className="w-4 h-4" /> Choose files
        </Button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => add(e.target.files || [])} aria-label="Product files" />
        {files.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-gray-200">
                <FileText className="w-3.5 h-3.5 text-gray-400" /> {f.name}
                <button type="button" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Remove ${f.name}`}>
                  <X className="w-3 h-3 text-gray-400 hover:text-gray-700" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="block text-sm">
        <span className="block text-xs font-semibold text-gray-600 mb-1">Or paste a list (one product per line, or a table copied from Excel)</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 font-mono text-xs" aria-label="Pasted list" />
      </label>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert">
          <AlertTriangle className="w-4 h-4" /> {error}
        </p>
      )}
      <Button onClick={start} isLoading={busy} disabled={busy || (!files.length && !text.trim()) || (isSystem && !companyId)} data-testid="import-start">
        Read {files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "the list"}
      </Button>
    </div>
  );
}

function Cell({ value, onSave, multiline = false, disabled, label, placeholder }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  const save = () => (v ?? "") !== (value ?? "") && onSave(v);
  const cls = "w-full rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-gray-300 focus:border-blue-500 focus:bg-white disabled:hover:border-transparent";
  return multiline ? (
    <textarea rows={Math.min(6, Math.max(2, String(v).split("\n").length))} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} disabled={disabled} className={`${cls} font-mono text-[11px]`} aria-label={label} placeholder={placeholder} />
  ) : (
    <input value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} disabled={disabled} className={cls} aria-label={label} placeholder={placeholder} />
  );
}

function Review({ id }) {
  const [imp, setImp] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const load = useCallback(() => getProductImport(id).then(setImp).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const reading = imp && ["pages_ready", "extracting"].includes(imp.status) && imp.task?.status !== "failed";
  useEffect(() => {
    if (!reading) return undefined;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [reading, load]);

  const edit = async (row, values) => {
    try {
      const next = await editImportRow(id, row.id, values);
      setImp((p) => ({ ...p, rows: p.rows.map((r) => (r.id === row.id ? next : r)) }));
    } catch (e) {
      toast.error(e.message);
    }
  };
  const skip = async (row) => {
    try {
      await skipImportRow(id, row.id);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };
  const saveAll = async () => {
    setSaving(true);
    try {
      const out = await saveAllImported(id);
      setResult(out);
      toast.success(`${out.created.length} product${out.created.length === 1 ? "" : "s"} saved`);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !imp) return <p className="text-sm text-red-600">{error}</p>;
  if (!imp) return <Spinner />;
  const pending = imp.rows.filter((r) => r.status === "pending");
  return (
    <div className="max-w-[90rem] mx-auto pb-12 space-y-4" data-testid="import-review">
      <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Products
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products from files</h1>
          <p className="text-sm text-gray-500">
            {imp.files.map((f) => f.file).join(", ")}
          </p>
        </div>
        <Button onClick={saveAll} isLoading={saving} disabled={saving || reading || !imp.counts.saveable} data-testid="save-all">
          <CheckCheck className="w-4 h-4" /> Save all ({imp.counts.saveable})
        </Button>
      </div>
      {reading && (
        <p className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">
          <Loader2 className="w-4 h-4 animate-spin" /> Reading the files… {imp.task?.message || ""}
        </p>
      )}
      {imp.task?.status === "failed" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          The files couldn't be read: {imp.task.error}. Type the products' values in the table, or try again later.
        </p>
      )}
      {imp.refused.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Not read: {imp.refused.map((r) => `${r.file} (${r.reason})`).join(" · ")}
        </p>
      )}
      {result?.left?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="save-left">
          <p className="font-semibold">Not saved:</p>
          <ul className="list-disc pl-5">
            {result.left.map((l) => (
              <li key={l.rowId}>
                {l.name || "(no name)"} — {l.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2 min-w-40">Name</th>
              <th className="px-3 py-2 min-w-24">Pack</th>
              <th className="px-3 py-2 min-w-24">Form</th>
              <th className="px-3 py-2 min-w-32">Category</th>
              <th className="px-3 py-2 min-w-40">Composition basis</th>
              <th className="px-3 py-2 min-w-64">Ingredients (name: amount)</th>
              <th className="px-3 py-2 min-w-48">Notes</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {imp.rows.map((r) => {
              const done = r.status !== "pending";
              return (
                <tr key={r.id} className={done ? "bg-gray-50 text-gray-400" : ""} data-testid="import-row">
                  <td className="px-3 py-2 max-w-40 truncate" title={r.file}>
                    {r.file}
                  </td>
                  <td className="px-1 py-1">{r.read ? <Cell value={r.name} disabled={done} label={`Name of ${r.file}`} onSave={(v) => edit(r, { name: v })} /> : <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}</td>
                  <td className="px-1 py-1"><Cell value={r.packaging} disabled={done || !r.read} label="Pack" onSave={(v) => edit(r, { packaging: v })} /></td>
                  <td className="px-1 py-1"><Cell value={r.physicalForm} disabled={done || !r.read} label="Form" onSave={(v) => edit(r, { physicalForm: v })} /></td>
                  <td className="px-1 py-1">
                    <select value={r.categoryId || ""} disabled={done || !r.read} onChange={(e) => edit(r, { categoryId: e.target.value || null })} className="w-full rounded border border-gray-200 bg-white px-1 py-1" aria-label="Category">
                      <option value="">{r.categoryProposal ? `(“${r.categoryProposal}” — choose)` : "—"}</option>
                      {imp.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1"><Cell value={r.compositionBasis} disabled={done || !r.read} label="Composition basis" placeholder="Each 1 Litre contains:" onSave={(v) => edit(r, { compositionBasis: v })} /></td>
                  <td className="px-1 py-1"><Cell multiline value={r.ingredients} disabled={done || !r.read} label="Ingredients" placeholder="Vitamin A: 10.000.000 I.U." onSave={(v) => edit(r, { ingredients: v })} /></td>
                  <td className="px-3 py-2 space-y-1">
                    {r.status === "applied" && <span className="font-semibold text-green-700">Saved</span>}
                    {r.status === "rejected" && <span>Skipped</span>}
                    {r.existing && !done && <span className="block text-amber-800">Already a product: {r.existing.name}</span>}
                    {r.typed.length > 0 && !done && <span className="block text-gray-500">Typed: {r.typed.join(", ")}</span>}
                    {r.flags.map((f, i) => (
                      <span key={i} className="block text-amber-800">
                        {f.message}
                      </span>
                    ))}
                  </td>
                  <td className="px-2 py-2">
                    {!done && (
                      <button type="button" onClick={() => skip(r)} className="text-gray-400 hover:text-gray-700" aria-label={`Skip ${r.name || r.file}`} title="Skip">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {imp.counts.rows} rows · {imp.counts.saveable} ready to save · {imp.counts.saved} saved · {pending.length - imp.counts.saveable} need you
      </p>
    </div>
  );
}

export default function ProductImport() {
  const { id } = useParams();
  return id ? <Review id={id} /> : <Start />;
}
