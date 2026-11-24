import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Filter,
  FolderTree,
  Globe2,
  PencilLine,
  Plus,
  Search,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Select from "react-select";
import countryList from "react-select-country-list";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  createReferenceLabelManual,
  deleteReferenceLabel,
  getReferenceLabels,
  setReferenceLabelBrand,
  uploadReferenceLabelFile,
} from "../services/apiReferenceLabels";
import { getBrands } from "../services/apiBrands";
import { getCategories } from "../services/apiCategories";
import { getCompanies } from "../services/apiCompanies";
import { useAuth } from "../context/AuthContext";
import Button from "../ui/Button";
import { categoryOptions } from "../utils/categoryOptions";

const emptyForm = {
  name: "",
  country: "",
  companyId: "",
  brandId: "",
  categoryId: "",
  manualCategoryName: "",
  fullText: "",
};

const fieldInputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";

export default function ReferenceLabels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const assignedSlugs = user?.role?.permissions?.map(p => typeof p === "string" ? p : p?.permission?.slug).filter(Boolean) || [];
  const canDelete = assignedSlugs.includes("delete_eda_requirements");

  const [labels, setLabels] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ search: "", country: "", categoryId: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("upload");
  const [viewingLabel, setViewingLabel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // per-file upload: [{ file, progress 0..1, state: waiting|uploading|queued|skipped|failed, taskId?, uploadedAt?, reason? }]
  const [uploads, setUploads] = useState([]);

  const fetchLabels = useCallback(async () => {
    try {
      setIsLoading(true);
      setLabels(await getReferenceLabels({ limit: 100 }));
    } catch (error) {
      toast.error(error.message || "Failed to fetch reference labels");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLookups = useCallback(async () => {
    try {
      const categoryRes = await getCategories({ limit: 100 });
      if (categoryRes.status === "success") setCategories(categoryRes.data?.categories || []);

      if (!user?.isCompany) {
        const companyRes = await getCompanies({ limit: 100 });
        if (companyRes.status === "success") setCompanies(companyRes.data?.companies || []);
      }
    } catch (error) {
      console.error("Failed to fetch reference label lookups:", error);
    }
  }, [user?.isCompany]);

  const fetchBrands = useCallback(async (companyId) => {
    try {
      const res = await getBrands(companyId || undefined);
      if (res.status === "success") setBrands(res.data?.brands || []);
    } catch (error) {
      console.error("Failed to fetch brands:", error);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
    fetchLookups();
  }, [fetchLabels, fetchLookups]);

  useEffect(() => {
    fetchBrands(form.companyId);
  }, [fetchBrands, form.companyId]);

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setFiles([]);
    setUploads([]);
    setForm(emptyForm);
    setModalTab("upload");
  };

  const validateSharedFields = () => {
    if (!form.country.trim()) {
      toast.error("Country is required.");
      return false;
    }
    // Category is now optional. The AI will infer it based on ingredients.
    return true;
  };

  // Each file is sent on its own, one after the other, so every file shows its
  // own progress and its own result (queued / skipped / failed with the reason).
  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!validateSharedFields()) return;
    if (files.length === 0) return toast.error("Please choose at least one label file.");

    const fields = Object.fromEntries(["country", "companyId", "brandId", "categoryId", "manualCategoryName"].map((key) => [key, form[key]]));
    const list = Array.from(files).map((file) => ({ file, progress: 0, state: "waiting" }));
    setUploads(list);
    setIsSubmitting(true);
    const patch = (i, change) => setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, ...change } : u)));
    for (let i = 0; i < list.length; i++) {
      patch(i, { state: "uploading" });
      const out = await uploadReferenceLabelFile(list[i].file, fields, (progress) => patch(i, { progress }));
      list[i] = { ...list[i], ...out, progress: 1 };
      patch(i, list[i]);
    }
    setIsSubmitting(false);
    const count = (state) => list.filter((u) => u.state === state).length;
    if (count("queued")) fetchLabels();
    const summary = [`${count("queued")} queued`, count("skipped") && `${count("skipped")} skipped`, count("failed") && `${count("failed")} failed`].filter(Boolean).join(" · ");
    (count("failed") ? toast.error : toast.success)(summary);
  };

  const trackQueued = () => {
    const tasks = uploads.filter((u) => u.state === "queued").map((u) => ({ taskId: u.taskId, fileName: u.file.name }));
    resetModal();
    navigate("/processing-bulk", { state: { tasks, type: "reference_label_extraction" } });
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    if (!validateSharedFields()) return;
    if (!form.name.trim()) return toast.error("Reference name is required.");
    if (!form.fullText.trim()) return toast.error("Full text is required.");

    try {
      setIsSubmitting(true);
      await createReferenceLabelManual(form);
      toast.success("Reference saved");
      resetModal();
      fetchLabels();
    } catch (error) {
      toast.error(error.message || "Failed to save reference");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this reference?")) return;
    try {
      await deleteReferenceLabel(id);
      toast.success("Reference deleted");
      fetchLabels();
    } catch (error) {
      toast.error(error.message || "Failed to delete reference");
    }
  };

  const countryOptions = useMemo(() => {
    return [...new Set(labels.map(label => label.country).filter(Boolean))].sort();
  }, [labels]);

  const filteredLabels = labels.filter((label) => {
    const searchText = `${label.name || ""} ${label.country || ""} ${label.category?.name || ""} ${label.manualCategoryName || ""}`.toLowerCase();
    return (
      searchText.includes(filters.search.toLowerCase()) &&
      (!filters.country || label.country === filters.country) &&
      (!filters.categoryId || label.categoryId === filters.categoryId)
    );
  });

  const getCategoryName = (label) => label.category?.name || label.manualCategoryName || "Uncategorized";

  const getFlagEmoji = (countryName) => {
    if (!countryName || countryName.trim().toLowerCase() === "global") return "🌍";
    const cleanName = countryName.trim().toLowerCase();
    const data = countryList().getData();
    const found = data.find(c => c.label.toLowerCase() === cleanName);
    if (!found) return "🌍";
    const codePoints = found.value
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Reference Labels</h1>
          <p className="text-gray-500 mt-1">Store approved label text by country and category to guide future AI output.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Reference
        </Button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px] gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, country, category..."
              value={filters.search}
              onChange={(event) => setFilters(prev => ({ ...prev, search: event.target.value }))}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>
          <select
            value={filters.country}
            onChange={(event) => setFilters(prev => ({ ...prev, country: event.target.value }))}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
          >
            <option value="">All countries</option>
            {countryOptions.map(country => <option key={country} value={country}>{country}</option>)}
          </select>
          <select
            value={filters.categoryId}
            onChange={(event) => setFilters(prev => ({ ...prev, categoryId: event.target.value }))}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none"
          >
            <option value="">All stored categories</option>
            {categoryOptions(categories).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredLabels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLabels.map((label) => (
              <div key={label.id} onClick={() => setViewingLabel(label)} className="group relative p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  {canDelete && (
                    <button onClick={(event) => handleDelete(label.id, event)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 truncate pr-8" title={label.name}>{label.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{label.fullText || "AI extraction data saved for this reference."}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge icon={Globe2}>{getFlagEmoji(label.country)} {label.country || "No country"}</Badge>
                  <Badge icon={FolderTree}>{getCategoryName(label)}</Badge>
                  <Badge icon={Tag}>{label.companyId ? "Company" : "Global"}</Badge>
                  {label.brand?.name ? <Badge icon={Tag}>{label.brand.name}</Badge> : label.extractedData?.brand_match?.candidates?.length > 1 ? <Badge icon={Tag}>Brand: choose</Badge> : null}
                  <Badge icon={label.sourceType === "manual" ? PencilLine : UploadCloud}>{label.sourceType || "upload"}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No references found</h3>
            <p className="text-gray-500">Add approved documents or manual references to teach the AI.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Add Reference Label</h2>
              <button onClick={resetModal} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pt-5 flex gap-2">
              <TabButton active={modalTab === "upload"} onClick={() => setModalTab("upload")} icon={UploadCloud}>Upload Files</TabButton>
              <TabButton active={modalTab === "manual"} onClick={() => setModalTab("manual")} icon={PencilLine}>Manual Entry</TabButton>
            </div>

            <form onSubmit={modalTab === "upload" ? handleUploadSubmit : handleManualSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
              <ReferenceFields user={user} form={form} companies={companies} brands={brands} categories={categories} updateForm={updateForm} modalTab={modalTab} />

              {modalTab === "upload" ? (
                <div className="mt-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Label files</label>
                  {uploads.length === 0 ? (
                    <label
                      className="flex justify-center w-full h-36 px-4 bg-white border-2 border-gray-300 border-dashed rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (event.dataTransfer.files?.length) setFiles(Array.from(event.dataTransfer.files));
                      }}
                    >
                      <span className="flex flex-col items-center justify-center gap-2">
                        <UploadCloud className="w-6 h-6 text-gray-400" />
                        <span className="text-center">
                          {files.length ? (
                            <span className="text-gray-800">{files.length === 1 ? files[0].name : `${files.length} files chosen`}</span>
                          ) : (
                            <>
                              <span className="text-blue-600 hover:text-blue-700">Click to upload</span> or drag and drop
                            </>
                          )}
                          <br />
                          <span className="text-xs text-gray-500 font-normal mt-1">One or more PDFs or images (up to 20 at a time, 50 MB each). Each label is read on its own.</span>
                        </span>
                      </span>
                      <input type="file" multiple className="hidden" accept="image/*,.pdf" onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 20))} aria-label="Label files" data-testid="reference-files" />
                    </label>
                  ) : (
                    <UploadResults uploads={uploads} />
                  )}
                </div>
              ) : (
                <div className="mt-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Approved Text</label>
                  <textarea
                    value={form.fullText}
                    onChange={(event) => updateForm("fullText", event.target.value)}
                    rows={10}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Paste the complete approved reference label text..."
                  />
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
                <Button type="button" variant="secondary" onClick={resetModal} disabled={isSubmitting}>
                  {modalTab === "upload" && uploads.length ? "Close" : "Cancel"}
                </Button>
                {modalTab === "upload" && uploads.length > 0 ? (
                  uploads.some((u) => u.state === "queued") &&
                  !isSubmitting && (
                    <Button type="button" onClick={trackQueued} data-testid="track-queued">
                      Track {uploads.filter((u) => u.state === "queued").length} queued
                    </Button>
                  )
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : modalTab === "upload" ? (files.length > 1 ? `Upload ${files.length} files & analyze` : "Upload & Analyze") : "Save Reference"}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-xl my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900 truncate pr-4">{viewingLabel.name}</h2>
                <p className="text-sm text-gray-500">{viewingLabel.country || "No country"} · {getCategoryName(viewingLabel)}</p>
              </div>
              <button onClick={() => setViewingLabel(null)} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
              {viewingLabel.companyId && (
                <ReferenceBrand
                  label={viewingLabel}
                  onChanged={(updated) => {
                    setViewingLabel((v) => ({ ...v, brandId: updated.brandId, brand: updated.brand, extractedData: updated.extractedData }));
                    fetchLabels();
                  }}
                />
              )}
              <InfoBlock title="Full Text" value={viewingLabel.fullText || "No full text saved."} />
              {viewingLabel.extractedData && <InfoBlock title="AI Structured Data" value={JSON.stringify(viewingLabel.extractedData, null, 2)} mono />}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <Button variant="secondary" onClick={() => setViewingLabel(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReferenceFields({ user, form, companies, brands, categories, updateForm, modalTab }) {
  const countryOptions = useMemo(() => [
    { label: "Global (Any)", value: "Global" },
    ...countryList().getData()
  ], []);

  const selectedCountry = useMemo(() => {
    return countryOptions.find(c => c.value === form.country) || null;
  }, [form.country, countryOptions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {modalTab === "manual" && (
        <Field label="Reference Name">
          <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} className={fieldInputClass} placeholder="Required for manual entry" />
        </Field>
      )}
      <Field label="Accepted Country">
        <Select
          options={countryOptions}
          value={selectedCountry}
          onChange={(opt) => updateForm("country", opt ? opt.value : "")}
          className="text-sm z-50"
          placeholder="Select country..."
        />
      </Field>
      {!user?.isCompany && (
        <Field label="Company">
          <select value={form.companyId} onChange={(event) => updateForm("companyId", event.target.value)} className={fieldInputClass}>
            <option value="">Global (All Companies)</option>
            {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Brand">
        <select value={form.brandId} onChange={(event) => updateForm("brandId", event.target.value)} className={fieldInputClass}>
          <option value="">Global (All Brands)</option>
          {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select>
      </Field>
      <Field label="Stored Product Category">
        <select value={form.categoryId} onChange={(event) => updateForm("categoryId", event.target.value)} className={fieldInputClass}>
          <option value="">Choose from product categories</option>
          {categoryOptions(categories).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Manual Category">
        <input value={form.manualCategoryName} onChange={(event) => updateForm("manualCategoryName", event.target.value)} className={fieldInputClass} placeholder="Use if no stored category fits" />
      </Field>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {children}
    </div>
  );
}

function Badge({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
      <Icon className="w-3.5 h-3.5" />
      {children}
    </span>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
        active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function InfoBlock({ title, value, mono = false }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">{title}</h4>
      <pre className={`text-sm text-gray-800 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200 ${mono ? "font-mono" : "font-sans"}`}>
        {value}
      </pre>
    </div>
  );
}

const STATE_TEXT = { waiting: "Waiting", uploading: "Uploading", queued: "Queued for reading", skipped: "Skipped", failed: "Failed" };
const STATE_CLASS = { waiting: "text-gray-500", uploading: "text-blue-700", queued: "text-green-700", skipped: "text-amber-700", failed: "text-red-700" };

/** One row per file: its progress while sent, then queued / skipped (with the date) / failed (with the reason). */
function UploadResults({ uploads }) {
  return (
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" data-testid="reference-upload-results">
      {uploads.map((u, i) => (
        <li key={`${u.file.name}-${i}`} className="px-4 py-3 text-sm" data-state={u.state}>
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-gray-800">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate" title={u.file.name}>
                {u.file.name}
              </span>
            </span>
            <span className={`shrink-0 font-medium ${STATE_CLASS[u.state]}`}>{STATE_TEXT[u.state]}</span>
          </div>
          {u.state === "uploading" && (
            <div className="mt-2 h-1.5 rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.progress * 100)} aria-label={`Uploading ${u.file.name}`}>
              <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${Math.round(u.progress * 100)}%` }} />
            </div>
          )}
          {u.state === "skipped" && <p className="mt-1 text-xs text-amber-700">Already uploaded{u.uploadedAt ? ` on ${new Date(u.uploadedAt).toLocaleDateString()}` : ""} for this company. Not uploaded again.</p>}
          {u.state === "failed" && <p className="mt-1 text-xs text-red-700">{u.reason}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * The reference's brand. The brand printed on the label was matched against the
 * company's brands when it was read: one clear match is set already; several
 * are offered as choices here; any brand of the company can be picked.
 */
function ReferenceBrand({ label, onChanged }) {
  const [brands, setBrands] = useState(null);
  const [busy, setBusy] = useState(false);
  const match = label.extractedData?.brand_match;
  useEffect(() => {
    getBrands(label.companyId)
      .then((res) => setBrands(res.data?.brands || []))
      .catch(() => setBrands([]));
  }, [label.companyId]);
  const pick = async (brandId) => {
    setBusy(true);
    try {
      onChanged(await setReferenceLabelBrand(label.id, brandId || null));
      toast.success(brandId ? "Brand set" : "Brand cleared");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const choices = !label.brandId && match?.candidates?.length > 1 ? match.candidates : [];
  return (
    <div className="rounded-xl border border-gray-200 p-4 text-sm" data-testid="reference-brand">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-gray-700">Brand</span>
        <select value={label.brandId || ""} disabled={busy || !brands} onChange={(e) => pick(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1" aria-label="Reference brand">
          <option value="">No brand</option>
          {(brands || []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {match?.printed && <span className="text-gray-500">Printed on the label: “{match.printed}”{match.chosen && label.brandId === match.chosen ? " — matched" : ""}</span>}
      </div>
      {choices.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-amber-800">Several brands match — which one is it?</span>
          {choices.map((c) => (
            <button key={c.id} type="button" disabled={busy} onClick={() => pick(c.id)} className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-blue-700 hover:bg-blue-100">
              {c.name}
            </button>
          ))}
        </div>
      )}
      {match?.printed && match.candidates?.length === 0 && !label.brandId && <p className="mt-2 text-xs text-gray-500">None of this company's brands matches “{match.printed}”. Add the brand on the Brands page, then pick it here.</p>}
    </div>
  );
}
