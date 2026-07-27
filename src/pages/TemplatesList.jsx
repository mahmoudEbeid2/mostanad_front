import { useState, useEffect } from "react";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from "../services/apiTemplates";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { FileCheck, Search, Plus, Edit2, Trash2, X, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Input from "../ui/Input";
import toast from "react-hot-toast";

export default function TemplatesList() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  
  // Dropdown Data
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    type: "CERTIFICATE",
    companyId: "",
    brandId: "",
    htmlContent: "",
    fields: "",
    isGlobal: true,
    isActive: true,
    productId: ""
  });
  const [modalBrands, setModalBrands] = useState([]);

  // Init Data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const compRes = await getCompanies({ limit: 100 });
      if (compRes.status === "success") setCompanies(compRes.data.companies || []);
      fetchTemplates();
    } catch (error) {
      toast.error("Failed to load initial data");
    }
  };

  // Fetch Templates
  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const params = { limit: 50 };
      if (searchTerm) params.search = searchTerm;
      // We rely on the global /templates endpoint if no company is selected, or /companies/:id/templates if selected
      const res = await getTemplates(filterCompany, params);
      if (res.status === "success") {
        setTemplates(res.data.templates || []);
      }
    } catch (error) {
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch brands for main filter
  useEffect(() => {
    if (!filterCompany) {
      setBrands([]);
      setFilterBrand("");
      return;
    }
    const fetchBrandsForFilter = async () => {
      try {
        const res = await getBrands(filterCompany);
        if (res.status === "success") setBrands(res.data.brands || []);
      } catch (error) {}
    };
    fetchBrandsForFilter();
  }, [filterCompany]);

  // Fetch brands for Modal
  useEffect(() => {
    if (!formData.companyId) {
      setModalBrands([]);
      setFormData(prev => ({ ...prev, brandId: "" }));
      return;
    }
    const fetchBrandsForModal = async () => {
      try {
        const res = await getBrands(formData.companyId);
        if (res.status === "success") setModalBrands(res.data.brands || []);
      } catch (error) {}
    };
    fetchBrandsForModal();
  }, [formData.companyId]);

  // Handle Search Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchTemplates();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filterCompany, filterBrand]);

  // Modal Handlers
  const openAddModal = () => {
    setModalMode("add");
    setFormData({ 
      name: "", type: "CERTIFICATE", companyId: "", brandId: "", 
      htmlContent: "", fields: "", isGlobal: true, isActive: true, productId: "" 
    });
    setCurrentTemplate(null);
    setIsModalOpen(true);
  };

  const openEditModal = (template) => {
    setModalMode("edit");
    setFormData({
      name: template.name || "",
      type: template.type || "CERTIFICATE",
      companyId: template.companyId || "",
      brandId: template.brandId || "",
      htmlContent: template.htmlContent || "",
      fields: template.fields ? JSON.stringify(template.fields, null, 2) : "",
      isGlobal: template.isGlobal !== undefined ? template.isGlobal : true,
      isActive: template.isActive !== undefined ? template.isActive : true,
      productId: template.productId || ""
    });
    setCurrentTemplate(template);
    setIsModalOpen(true);
  };

  const openViewModal = async (template) => {
    setModalMode("view");
    setFormData({
      name: template.name || "",
      type: template.type || "CERTIFICATE",
      companyId: template.companyId || "",
      brandId: template.brandId || "",
      htmlContent: template.htmlContent || "",
      fields: template.fields ? JSON.stringify(template.fields, null, 2) : "",
      isGlobal: template.isGlobal !== undefined ? template.isGlobal : true,
      isActive: template.isActive !== undefined ? template.isActive : true,
      productId: template.productId || ""
    });
    setCurrentTemplate(template);
    setIsModalOpen(true);

    try {
      const { getTemplateById } = await import("../services/apiTemplates");
      const res = await getTemplateById(template.id);
      if (res.status === "success" && res.data?.template) {
        const freshTpl = res.data.template;
        setFormData({
          name: freshTpl.name || "",
          type: freshTpl.type || "CERTIFICATE",
          companyId: freshTpl.companyId || "",
          brandId: freshTpl.brandId || "",
          htmlContent: freshTpl.htmlContent || "",
          fields: freshTpl.fields ? JSON.stringify(freshTpl.fields, null, 2) : "",
          isGlobal: freshTpl.isGlobal !== undefined ? freshTpl.isGlobal : true,
          isActive: freshTpl.isActive !== undefined ? freshTpl.isActive : true,
          productId: freshTpl.productId || ""
        });
        setCurrentTemplate(freshTpl);
      }
    } catch (error) {
      toast.error("Failed to fetch latest template details");
    }
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.htmlContent.trim()) {
      toast.error("Name and HTML Content are required");
      return;
    }
    if (!formData.isGlobal && !formData.companyId) {
      toast.error("Company is required for non-global templates");
      return;
    }

    let parsedFields = null;
    if (formData.fields.trim()) {
      try {
        parsedFields = JSON.parse(formData.fields);
      } catch (err) {
        toast.error("Invalid JSON format in Fields");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload = { 
        ...formData,
        companyId: formData.companyId || undefined,
        productId: formData.isGlobal ? null : (formData.productId || null),
        brandId: formData.brandId || null,
        fields: parsedFields
      };

      if (modalMode === "add") {
        await createTemplate(formData.companyId || undefined, payload);
        toast.success("Template created successfully");
      } else {
        await updateTemplate(currentTemplate.id, payload);
        toast.success("Template updated successfully");
      }
      closeModal();
      fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;

    try {
      setIsLoading(true);
      await deleteTemplate(id);
      toast.success("Template deleted successfully");
      fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete template");
      setIsLoading(false);
    }
  };

  const openInEditor = (template) => {
    // Currently the editor in Certificates.jsx does not accept route params to load a specific template.
    // In a real scenario, you'd navigate to `/templates/editor/${template.id}`
    // For now, we'll navigate to the editor page with state.
    navigate("/templates/editor", { state: { templateId: template.id } });
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-500 mt-1">Manage your certificate and label templates.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate("/templates/editor")}>
            Open Visual Builder
          </Button>
          <Button onClick={openAddModal}>
            <Plus className="w-5 h-5 mr-2" />
            Add Manual
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96 shrink-0">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex w-full md:w-auto gap-4">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="w-full md:w-48 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
          >
            <option value="">All Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Template Name</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Company & Brand</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                    </div>
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <FileCheck className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium text-gray-900">No templates found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} onClick={() => openViewModal(template)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                        <FileCheck className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                        {template.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium">
                        {template.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {template.isGlobal ? (
                        <span className="text-gray-500 italic text-sm">Global</span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-gray-900 font-medium text-sm">{template.company?.name || "—"}</span>
                          <span className="text-xs text-gray-500">{template.brand?.name || "—"}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openInEditor(template);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Open Visual Builder"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(template);
                          }}
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Edit Code"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(template.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`bg-white rounded-xl shadow-xl w-full ${modalMode === "view" ? "max-w-4xl" : "max-w-lg"} overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-600" />
                {modalMode === "add" ? "Add Template Details" : modalMode === "edit" ? "Edit Template Details" : "View Template Details"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                {modalMode === "view" ? (
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 space-y-6">
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
                          <div className="text-gray-900 font-medium text-lg">{formData.name}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type</label>
                            <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">{formData.type}</span>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${formData.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {formData.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Scope</label>
                            <span className="text-gray-900 font-medium text-sm">{formData.isGlobal ? "Global" : "Specific"}</span>
                          </div>
                        </div>
                        
                        {!formData.isGlobal && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company</label>
                              <div className="text-gray-900 font-medium text-sm">
                                {companies.find(c => c.id === formData.companyId)?.name || "—"}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Brand</label>
                              <div className="text-gray-900 font-medium text-sm">
                                {modalBrands.find(b => b.id === formData.brandId)?.name || "—"}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {formData.fields && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dynamic Fields</label>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              try {
                                const fields = JSON.parse(formData.fields);
                                return Array.isArray(fields) ? fields.map((f, i) => (
                                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs font-mono">{f}</span>
                                )) : <span className="text-sm text-gray-500">Invalid fields format</span>;
                              } catch {
                                return <span className="text-sm text-gray-500">Invalid JSON</span>;
                              }
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 lg:max-w-md border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between shrink-0">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 text-teal-600" />
                          Live Preview
                        </label>
                        <button 
                          type="button" 
                          onClick={() => openInEditor(currentTemplate)} 
                          className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                        >
                          Open in Builder
                        </button>
                      </div>
                      <div className="w-full flex-1 bg-gray-100 relative min-h-[500px] overflow-hidden flex justify-center p-4">
                         <div 
                           dangerouslySetInnerHTML={{ __html: formData.htmlContent || "<div class='text-gray-400 p-10 text-center w-full'>No HTML Content</div>" }} 
                           className="origin-top shadow-md bg-white"
                           style={{ transform: "scale(0.4)", transformOrigin: "top center", marginBottom: "-850px" }}
                         />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Input
                      label="Template Name *"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter template name"
                      autoFocus
                    />

                <Input
                  label="Template Type *"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  placeholder="CERTIFICATE, LABEL, etc."
                />

                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isGlobalList"
                      checked={formData.isGlobal}
                      onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="isGlobalList" className="text-sm font-medium text-gray-700">Is Global?</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActiveList"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <label htmlFor="isActiveList" className="text-sm font-medium text-gray-700">Is Active?</label>
                  </div>
                </div>

                {!formData.isGlobal && (
                  <Input
                    label="Product ID (Optional)"
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    placeholder="Enter Product UUID"
                  />
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HTML Content *</label>
                  <textarea
                    value={formData.htmlContent}
                    onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 font-mono text-sm"
                    rows={4}
                    placeholder="<div>...</div>"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fields (JSON array)</label>
                  <textarea
                    value={formData.fields}
                    onChange={(e) => setFormData({ ...formData, fields: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 font-mono text-sm"
                    rows={2}
                    placeholder='["field1", "field2"]'
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.isGlobal ? "Company (Optional)" : "Company *"}
                    </label>
                    <select
                      value={formData.companyId}
                      onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                      required={!formData.isGlobal}
                    >
                      <option value="">{formData.isGlobal ? "Global Template (No Company)" : "Select Company..."}</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand (Optional)</label>
                    <select
                      value={formData.brandId}
                      onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                      disabled={!formData.companyId || modalBrands.length === 0}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 disabled:opacity-50"
                    >
                      <option value="">No Brand</option>
                      {modalBrands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                </>
                )}
              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
                {modalMode === "view" ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => openEditModal(currentTemplate)} 
                      type="button"
                      className="text-teal-600 border-teal-200 hover:bg-teal-50 hover:border-teal-300"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Settings
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        handleDelete(currentTemplate.id);
                        closeModal();
                      }} 
                      type="button"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                ) : (
                  <div></div>
                )}
                
                <div className="flex gap-3">
                  {modalMode === "view" ? (
                    <Button variant="secondary" onClick={closeModal} type="button">
                      Close
                    </Button>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={closeModal} type="button">
                        Cancel
                      </Button>
                      <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700 text-white border-none">
                        {modalMode === "add" ? "Create Template" : "Save Changes"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
