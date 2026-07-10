import { useState, useEffect } from "react";
import { getBrands, createBrand, updateBrand, deleteBrand, getBrandById } from "../services/apiBrands";
import { getCompanies } from "../services/apiCompanies";
import { Search, Plus, Edit2, Trash2, Tag } from "lucide-react";
import Button from "../ui/Button";
import toast from "react-hot-toast";

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
  const [currentBrand, setCurrentBrand] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    companyId: "",
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedCompanyFilter]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Fetch both companies (for dropdowns/filters) and brands
      const [compRes, brandRes] = await Promise.all([
        getCompanies({ limit: 100 }),
        getBrands(selectedCompanyFilter)
      ]);
      
      if (compRes.status === "success") {
        setCompanies(compRes.data.companies || []);
      }
      if (brandRes.status === "success") {
        setBrands(brandRes.data.brands || []);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setModalMode("add");
    setFormData({ name: "", companyId: selectedCompanyFilter || "", isActive: true });
    setCurrentBrand(null);
    setIsModalOpen(true);
  };

  const openEditModal = (brand) => {
    setModalMode("edit");
    setFormData({
      name: brand.name || "",
      companyId: brand.companyId || "",
      isActive: brand.isActive ?? true,
    });
    setCurrentBrand(brand);
    setIsModalOpen(true);
  };

  const openViewModal = async (brand) => {
    setModalMode("view");
    setFormData({
      name: brand.name || "",
      companyId: brand.companyId || "",
      isActive: brand.isActive ?? true,
    });
    setCurrentBrand(brand);
    setIsModalOpen(true);

    try {
      const res = await getBrandById(brand.id);
      if (res.status === "success" && res.data?.brand) {
        const freshBrand = res.data.brand;
        setFormData({
          name: freshBrand.name || "",
          companyId: freshBrand.companyId || "",
          isActive: freshBrand.isActive ?? true,
        });
        setCurrentBrand(freshBrand);
      }
    } catch (error) {
      toast.error("Failed to fetch latest brand details");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.companyId) {
      toast.error("Name and Company are required");
      return;
    }

    try {
      setIsSubmitting(true);
      if (modalMode === "add") {
        await createBrand(formData);
        toast.success("Brand created successfully");
      } else {
        await updateBrand(currentBrand.id, formData);
        toast.success("Brand updated successfully");
      }
      closeModal();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this brand? Products associated with it may be affected.")) return;

    try {
      setIsLoading(true);
      await deleteBrand(id);
      toast.success("Brand deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete brand");
      setIsLoading(false); 
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-8 h-8 text-indigo-600" />
            Brands Management
          </h1>
          <p className="text-gray-500 mt-1">Manage tenant brands and sub-brands.</p>
        </div>
        <Button className="shrink-0" onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" />
          Add Brand
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96 flex gap-4">
          <div className="relative w-full">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by brand name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="w-full sm:w-64">
          <select
            value={selectedCompanyFilter}
            onChange={(e) => setSelectedCompanyFilter(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
                <th className="px-6 py-4">Brand Name</th>
                <th className="px-6 py-4">Parent Company</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <span className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    </div>
                  </td>
                </tr>
              ) : filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <Tag className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-lg font-medium text-gray-500">No brands found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or add a new brand.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBrands.map((brand) => (
                  <tr key={brand.id} onClick={() => openViewModal(brand)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{brand.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">ID: {brand.id.split('-')[0]}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 text-sm font-medium">{brand.company?.name || "Unknown"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        brand.isActive 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {brand.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(brand);
                          }}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(brand.id);
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-600" />
                {modalMode === "add" ? "Add New Brand" : modalMode === "edit" ? "Edit Brand" : "View Brand Details"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col">
              <div className="p-6 space-y-4">
                {modalMode === "view" ? (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Brand Name</label>
                      <div className="text-gray-900 font-bold text-xl">{formData.name}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company</label>
                        <div className="text-gray-900 font-medium text-base">
                          {companies.find(c => c.id === formData.companyId)?.name || "—"}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${
                          formData.isActive 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {formData.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Brand Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Enter brand name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Parent Company *</label>
                      <select
                        value={formData.companyId}
                        onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        required
                      >
                        <option value="" disabled>Select a company</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mt-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-700">Brand Status</div>
                        <div className="text-xs text-gray-500">Is this brand active?</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={formData.isActive} 
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center mt-auto">
                {modalMode === "view" ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => openEditModal(currentBrand)} 
                      type="button"
                      className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Brand
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        handleDelete(currentBrand.id);
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
                      <Button type="submit" isLoading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {modalMode === "add" ? "Create Brand" : "Save Changes"}
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
