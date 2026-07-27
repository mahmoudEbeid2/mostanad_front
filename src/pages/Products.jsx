import { useState, useEffect } from "react";
import { getProducts, createProduct, updateProduct, deleteProduct, getProductById } from "../services/apiProducts";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { getCategories } from "../services/apiCategories";
import { Package, Search, Filter, Plus, Edit2, Trash2, X } from "lucide-react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import toast from "react-hot-toast";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  
  // Dropdown Data
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
  const [currentProduct, setCurrentProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "", gtin: "", categoryId: "", companyId: "", brandId: "",
    description: "", indications: "", physicalForm: "", appearance: "",
    dosage: "", mixingInstructions: "", withdrawalPeriod: "",
    contraindications: "", storage: "", packaging: "", registrationNumber: "",
    origin: "", producer: "", activeIngredients: [], targetSpecies: [], userSafety: []
  });
  const [modalBrands, setModalBrands] = useState([]);

  // Init Data
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [compRes, catRes] = await Promise.all([
        getCompanies({ limit: 100 }),
        getCategories({ limit: 100 })
      ]);
      if (compRes.status === "success") setCompanies(compRes.data.companies || []);
      if (catRes.status === "success") setCategories(catRes.data.categories || []);
      fetchProducts();
    } catch (error) {
      toast.error("Failed to load initial data");
    }
  };

  // Fetch Products (Triggered on mount, search, or filter changes)
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const params = { limit: 50 };
      if (searchTerm) params.search = searchTerm;
      if (filterCompany) params.companyId = filterCompany;
      if (filterBrand) params.brandId = filterBrand;

      const res = await getProducts(params);
      if (res.status === "success") {
        setProducts(res.data.products || []);
      }
    } catch (error) {
      toast.error("Failed to load products");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch brands for main filter when filterCompany changes
  useEffect(() => {
    if (!filterCompany) {
      setBrands([]);
      setFilterBrand("");
      return;
    }
    const fetchBrandsForFilter = async () => {
      try {
        const res = await getBrands(filterCompany);
        if (res.status === "success") {
          setBrands(res.data.brands || []);
        }
      } catch (error) {}
    };
    fetchBrandsForFilter();
  }, [filterCompany]);

  // Fetch brands for Modal when formData.companyId changes
  useEffect(() => {
    if (!formData.companyId) {
      setModalBrands([]);
      setFormData(prev => ({ ...prev, brandId: "" }));
      return;
    }
    const fetchBrandsForModal = async () => {
      try {
        const res = await getBrands(formData.companyId);
        if (res.status === "success") {
          setModalBrands(res.data.brands || []);
        }
      } catch (error) {}
    };
    fetchBrandsForModal();
  }, [formData.companyId]);

  // Handle Search Debounce (Optional but good UX)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filterCompany, filterBrand]);

  // Modal Handlers
  const openAddModal = () => {
    setModalMode("add");
    setCurrentStep(1);
    setFormData({ 
      name: "", gtin: "", categoryId: "", companyId: "", brandId: "",
      description: "", indications: "", physicalForm: "", appearance: "",
      dosage: "", mixingInstructions: "", withdrawalPeriod: "",
      contraindications: "", storage: "", packaging: "", registrationNumber: "",
      origin: "", producer: "", activeIngredients: [], targetSpecies: [], userSafety: []
    });
    setCurrentProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setModalMode("edit");
    setCurrentStep(1);
    setFormData({
      name: product.name || "",
      gtin: product.gtin || product.productCode || "",
      categoryId: product.categoryId || "",
      companyId: product.companyId || "",
      brandId: product.brandId || "",
      description: product.description || "",
      indications: product.indications || "",
      physicalForm: product.physicalForm || "",
      appearance: product.appearance || "",
      dosage: product.dosage || "",
      mixingInstructions: product.mixingInstructions || "",
      withdrawalPeriod: product.withdrawalPeriod || "",
      contraindications: product.contraindications || "",
      storage: product.storage || "",
      packaging: product.packaging || "",
      registrationNumber: product.registrationNumber || "",
      origin: product.origin || "",
      producer: product.producer || "",
      activeIngredients: product.activeIngredients || [],
      targetSpecies: product.targetSpecies || [],
      userSafety: product.userSafety || []
    });
    setCurrentProduct(product);
    setIsModalOpen(true);
  };

  const openViewModal = async (product) => {
    setModalMode("view");
    setFormData({
      name: product.name || "",
      gtin: product.gtin || "",
      categoryId: product.categoryId || "",
      companyId: product.companyId || "",
      brandId: product.brandId || ""
    });
    setCurrentProduct(product);
    setIsModalOpen(true);

    try {
      const res = await getProductById(product.id);
      if (res.status === "success" && res.data?.product) {
        setCurrentProduct(res.data.product);
      }
    } catch (error) {
      toast.error("Failed to fetch latest product details");
    }
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.companyId) {
      toast.error("Name and Company are required");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = { ...formData };
      
      // Cleanup payload
      payload.productCode = payload.gtin || null;
      delete payload.gtin;
      
      if (!payload.categoryId) payload.categoryId = null;
      if (!payload.brandId) payload.brandId = null;
      
      // Clean empty arrays
      payload.targetSpecies = payload.targetSpecies.filter(Boolean);
      payload.userSafety = payload.userSafety.filter(Boolean);
      payload.activeIngredients = payload.activeIngredients.filter(a => a.name && a.concentration);
      
      // Clean empty strings to null
      Object.keys(payload).forEach(key => {
        if (payload[key] === "") payload[key] = null;
      });

      if (modalMode === "add") {
        await createProduct(payload);
        toast.success("Product created successfully");
      } else {
        await updateProduct(currentProduct.id, payload);
        toast.success("Product updated successfully");
      }
      closeModal();
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    try {
      setIsLoading(true);
      await deleteProduct(id);
      toast.success("Product deleted successfully");
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete product");
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 mt-1">Manage your products database.</p>
        </div>
        <Button className="shrink-0" onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" />
          Add Product
        </Button>
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
          
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            disabled={!filterCompany || brands.length === 0}
            className="w-full md:w-48 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700 disabled:opacity-50"
          >
            <option value="">All Brands</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
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
                <th className="px-6 py-4">Product Info</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Company & Brand</th>
                <th className="px-6 py-4 text-center">Added Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <Package className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium text-gray-900">No products found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} onClick={() => openViewModal(product)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">{product.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {product.gtin || "No GTIN"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {product.category?.name || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{product.company?.name || "-"}</div>
                      {product.brand && (
                        <div className="text-xs text-gray-500 mt-1">{product.brand.name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(product);
                          }}
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(product.id);
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                {modalMode === "add" ? "Add New Product" : modalMode === "edit" ? "Edit Product" : "View Product Details"}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                {modalMode === "view" && currentProduct ? (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Product Name</label>
                      <div className="text-gray-900 font-bold text-xl">{currentProduct.name}</div>
                      {currentProduct.description && (
                        <p className="text-gray-600 text-sm mt-2 leading-relaxed">{currentProduct.description}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">GTIN (Barcode) / Code</label>
                        <div className="text-gray-900 font-mono text-sm bg-white border border-gray-200 px-3 py-2 rounded-md inline-block">
                          {currentProduct.gtin || currentProduct.productCode || "—"}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</label>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-teal-50 text-teal-700 border border-teal-100">
                          {currentProduct.category?.name || categories.find(c => c.id === currentProduct.categoryId)?.name || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company</label>
                        <div className="text-gray-900 font-medium text-base">
                          {currentProduct.company?.name || companies.find(c => c.id === currentProduct.companyId)?.name || "—"}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Brand</label>
                        <div className="text-gray-900 font-medium text-base">
                          {currentProduct.brand?.name || modalBrands.find(b => b.id === currentProduct.brandId)?.name || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Physical Form</label>
                        <div className="text-gray-900 text-sm">{currentProduct.physicalForm || "—"}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Packaging</label>
                        <div className="text-gray-900 text-sm">{currentProduct.packaging || "—"}</div>
                      </div>
                    </div>

                    {currentProduct.targetSpecies && currentProduct.targetSpecies.length > 0 && (
                      <div className="pt-4 border-t border-gray-200">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Species</label>
                        <div className="flex flex-wrap gap-2">
                          {currentProduct.targetSpecies.map((species, i) => (
                            <span key={i} className="bg-white border border-gray-200 px-2.5 py-1 rounded-md text-sm text-gray-700">
                              {species}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(currentProduct.indications || currentProduct.dosage) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                        {currentProduct.indications && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Indications</label>
                            <p className="text-gray-800 text-sm">{currentProduct.indications}</p>
                          </div>
                        )}
                        {currentProduct.dosage && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dosage</label>
                            <p className="text-gray-800 text-sm">{currentProduct.dosage}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {(currentProduct.withdrawalPeriod || currentProduct.storage) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                        {currentProduct.withdrawalPeriod && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Withdrawal Period</label>
                            <p className="text-gray-800 text-sm">{currentProduct.withdrawalPeriod}</p>
                          </div>
                        )}
                        {currentProduct.storage && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Storage</label>
                            <p className="text-gray-800 text-sm">{currentProduct.storage}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {currentProduct.activeIngredients && (
                      <div className="pt-4 border-t border-gray-200">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Ingredients</label>
                        <pre className="bg-white p-3 rounded-md border border-gray-200 text-sm overflow-x-auto text-gray-800 font-mono">
                          {JSON.stringify(currentProduct.activeIngredients, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200 text-xs">
                      <div>
                        <span className="text-gray-500 font-semibold uppercase tracking-wider">Origin:</span> 
                        <span className="ml-2 text-gray-900">{currentProduct.origin || "—"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-semibold uppercase tracking-wider">Reg #:</span> 
                        <span className="ml-2 text-gray-900">{currentProduct.registrationNumber || "—"}</span>
                      </div>
                    </div>

                  </div>
                ) : (
                  <>
                    {/* Stepper Header */}
                    <div className="flex items-center justify-between mb-6 px-2">
                      {[1, 2, 3, 4].map((step) => (
                        <div key={step} className="flex flex-col items-center flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${currentStep === step ? 'bg-teal-600 text-white' : currentStep > step ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'}`}>
                            {step}
                          </div>
                        </div>
                      ))}
                    </div>

                    {currentStep === 1 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Step 1: Basic Information</h3>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Product Name *</label>
                          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" required />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">GTIN (Barcode)</label>
                          <input type="text" value={formData.gtin} onChange={(e) => setFormData({ ...formData, gtin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Company *</label>
                          <select value={formData.companyId} onChange={(e) => setFormData({ ...formData, companyId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white" required>
                            <option value="">Select Company...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Brand (Optional)</label>
                          <select value={formData.brandId} onChange={(e) => setFormData({ ...formData, brandId: e.target.value })} disabled={!formData.companyId || modalBrands.length === 0} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 disabled:opacity-50">
                            <option value="">No Brand</option>
                            {modalBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                          <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white">
                            <option value="">No Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Step 2: Characteristics</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Physical Form</label>
                            <input type="text" value={formData.physicalForm} onChange={(e) => setFormData({ ...formData, physicalForm: e.target.value })} placeholder="e.g. Powder, Liquid" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Appearance</label>
                            <input type="text" value={formData.appearance} onChange={(e) => setFormData({ ...formData, appearance: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Packaging</label>
                            <input type="text" value={formData.packaging} onChange={(e) => setFormData({ ...formData, packaging: e.target.value })} placeholder="e.g. 25KG Bag" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Reg Number</label>
                            <input type="text" value={formData.registrationNumber} onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Origin (Country)</label>
                            <input type="text" value={formData.origin} onChange={(e) => setFormData({ ...formData, origin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Producer</label>
                            <input type="text" value={formData.producer} onChange={(e) => setFormData({ ...formData, producer: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                          <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" rows="3"></textarea>
                        </div>
                      </div>
                    )}

                    {currentStep === 3 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Step 3: Medical & Usage</h3>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Indications</label>
                          <textarea value={formData.indications} onChange={(e) => setFormData({ ...formData, indications: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" rows="2"></textarea>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Dosage</label>
                          <textarea value={formData.dosage} onChange={(e) => setFormData({ ...formData, dosage: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" rows="2"></textarea>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Mixing Instructions</label>
                          <textarea value={formData.mixingInstructions} onChange={(e) => setFormData({ ...formData, mixingInstructions: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" rows="2"></textarea>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Contraindications</label>
                          <textarea value={formData.contraindications} onChange={(e) => setFormData({ ...formData, contraindications: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" rows="2"></textarea>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Withdrawal Period</label>
                            <input type="text" value={formData.withdrawalPeriod} onChange={(e) => setFormData({ ...formData, withdrawalPeriod: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Storage</label>
                            <input type="text" value={formData.storage} onChange={(e) => setFormData({ ...formData, storage: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStep === 4 && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Step 4: Composition & Safety</h3>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Target Species (Comma separated)</label>
                          <input type="text" value={formData.targetSpecies.join(", ")} onChange={(e) => setFormData({ ...formData, targetSpecies: e.target.value.split(",").map(s => s.trim()) })} placeholder="e.g. Poultry, Cattle, Sheep" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">User Safety (Comma separated)</label>
                          <input type="text" value={formData.userSafety.join(", ")} onChange={(e) => setFormData({ ...formData, userSafety: e.target.value.split(",").map(s => s.trim()) })} placeholder="e.g. Wear gloves, Avoid eye contact" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex justify-between items-center">
                            <span>Active Ingredients</span>
                            <button type="button" onClick={() => setFormData({ ...formData, activeIngredients: [...formData.activeIngredients, { name: "", concentration: "" }] })} className="text-teal-600 hover:text-teal-700 text-xs flex items-center gap-1 font-bold bg-teal-50 px-2 py-1 rounded">
                              <Plus className="w-3 h-3" /> Add Ingredient
                            </button>
                          </label>
                          <div className="space-y-2">
                            {formData.activeIngredients.map((ing, i) => (
                              <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
                                <input type="text" placeholder="Name (e.g. Vitamin A)" value={ing.name} onChange={(e) => {
                                  const arr = [...formData.activeIngredients];
                                  arr[i].name = e.target.value;
                                  setFormData({ ...formData, activeIngredients: arr });
                                }} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-teal-500" />
                                <input type="text" placeholder="Conc. (e.g. 50%)" value={ing.concentration} onChange={(e) => {
                                  const arr = [...formData.activeIngredients];
                                  arr[i].concentration = e.target.value;
                                  setFormData({ ...formData, activeIngredients: arr });
                                }} className="w-1/3 px-3 py-1.5 text-sm border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-teal-500" />
                                <button type="button" onClick={() => {
                                  const arr = formData.activeIngredients.filter((_, idx) => idx !== i);
                                  setFormData({ ...formData, activeIngredients: arr });
                                }} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {formData.activeIngredients.length === 0 && (
                              <p className="text-xs text-gray-400 text-center py-2 bg-gray-50 rounded-lg border border-gray-200 border-dashed">No active ingredients added.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center shrink-0">
                {modalMode === "view" ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => openEditModal(currentProduct)} 
                      type="button"
                      className="text-teal-600 border-teal-200 hover:bg-teal-50 hover:border-teal-300"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Product
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        handleDelete(currentProduct.id);
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
                      {currentStep > 1 && (
                        <Button variant="secondary" onClick={() => setCurrentStep(currentStep - 1)} type="button">
                          Previous
                        </Button>
                      )}
                      {currentStep < 4 ? (
                        <Button type="button" onClick={() => setCurrentStep(currentStep + 1)} className="bg-teal-600 hover:bg-teal-700 text-white border-none">
                          Next
                        </Button>
                      ) : (
                        <Button type="submit" isLoading={isSubmitting} className="bg-teal-600 hover:bg-teal-700 text-white border-none">
                          {modalMode === "add" ? "Create Product" : "Save Changes"}
                        </Button>
                      )}
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
