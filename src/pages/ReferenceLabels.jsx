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
  uploadReferenceLabels,
} from "../services/apiReferenceLabels";
import { getBrands } from "../services/apiBrands";
import { getCategories } from "../services/apiCategories";
import { getCompanies } from "../services/apiCompanies";
import { useAuth } from "../context/AuthContext";
import Button from "../ui/Button";

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
  const canDelete = assignedSlugs.includes("delete_eda_requirements") || user?.isCompany;

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

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!validateSharedFields()) return;
    if (files.length === 0) return toast.error("Please upload at least one document.");

    const payload = new FormData();
    ["country", "companyId", "brandId", "categoryId", "manualCategoryName"].forEach((key) => {
      if (form[key]) payload.append(key, form[key]);
    });
    Array.from(files).forEach((file) => payload.append("files", file));

    try {
      setIsSubmitting(true);
      const res = await uploadReferenceLabels(payload);
      toast.success(res.message || `Reference queued for AI analysis`);
      resetModal();
      fetchLabels();
      const tasks = res?.data?.tasks || res?.tasks;
      if (tasks?.length) {
        navigate("/processing-bulk", { state: { tasks, type: "reference_label_extraction" } });
      }
    } catch (error) {
      toast.error(error.message || "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
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
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Document</label>
                  <label className="flex justify-center w-full h-36 px-4 bg-white border-2 border-gray-300 border-dashed rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50">
                    <span className="flex flex-col items-center justify-center gap-2">
                      <UploadCloud className="w-6 h-6 text-gray-400" />
                      <span className="text-center">
                        <span className="text-blue-600 hover:text-blue-700">Click to upload</span> or drag and drop
                        <br />
                        <span className="text-xs text-gray-500 font-normal mt-1">Single PDF or Image up to 50MB</span>
                      </span>
                    </span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={(event) => setFiles(event.target.files)} />
                  </label>
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
                <Button type="button" variant="secondary" onClick={resetModal}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : modalTab === "upload" ? "Upload & Analyze" : "Save Reference"}
                </Button>
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
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
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
