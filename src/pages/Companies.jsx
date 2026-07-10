import { useState, useEffect } from "react";
import { getCompanies, createCompany, updateCompany, deleteCompany, getCompanyById } from "../services/apiCompanies";
import { Search, Plus, Edit2, Trash2, Building2 } from "lucide-react";
import Button from "../ui/Button";
import toast from "react-hot-toast";

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
  const [currentCompany, setCurrentCompany] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    email: "",
    phone: "",
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      const res = await getCompanies({ limit: 100 });
      if (res.status === "success") {
        setCompanies(res.data.companies || []);
      }
    } catch (error) {
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setModalMode("add");
    setFormData({ name: "", username: "", password: "", email: "", phone: "", isActive: true });
    setCurrentCompany(null);
    setIsModalOpen(true);
  };

  const openEditModal = (company) => {
    setModalMode("edit");
    setFormData({
      name: company.name || "",
      username: company.username || "",
      password: "", // Leave blank so it doesn't update unless typed
      email: company.email || "",
      phone: company.phone || "",
      isActive: company.isActive ?? true,
    });
    setCurrentCompany(company);
    setIsModalOpen(true);
  };

  const openViewModal = async (company) => {
    setModalMode("view");
    setFormData({
      name: company.name || "",
      username: company.username || "",
      password: "",
      email: company.email || "",
      phone: company.phone || "",
      isActive: company.isActive ?? true,
    });
    setCurrentCompany(company);
    setIsModalOpen(true);

    try {
      const res = await getCompanyById(company.id);
      if (res.status === "success" && res.data?.company) {
        const freshComp = res.data.company;
        setFormData({
          name: freshComp.name || "",
          username: freshComp.username || "",
          password: "",
          email: freshComp.email || "",
          phone: freshComp.phone || "",
          isActive: freshComp.isActive ?? true,
        });
        setCurrentCompany(freshComp);
      }
    } catch (error) {
      toast.error("Failed to fetch latest company details");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.username.trim()) {
      toast.error("Name and Username are required");
      return;
    }
    if (modalMode === "add" && !formData.password.trim()) {
      toast.error("Password is required for new companies");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = { ...formData };
      if (modalMode === "edit" && !payload.password) {
        delete payload.password; // Don't send empty password on edit
      }

      if (modalMode === "add") {
        await createCompany(payload);
        toast.success("Company created successfully");
      } else {
        await updateCompany(currentCompany.id, payload);
        toast.success("Company updated successfully");
      }
      closeModal();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this company? All associated products, brands, and templates will also be deleted!")) return;

    try {
      setIsLoading(true);
      await deleteCompany(id);
      toast.success("Company deleted successfully");
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete company");
      setIsLoading(false); 
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            Companies Management
          </h1>
          <p className="text-gray-500 mt-1">Manage tenant companies, their credentials, and status.</p>
        </div>
        <Button className="shrink-0" onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Company Name</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Email & Phone</th>
                <th className="px-6 py-4">Status</th>
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
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <Building2 className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-lg font-medium text-gray-500">No companies found</p>
                      <p className="text-sm mt-1">Try adjusting your search or add a new company.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.id} onClick={() => openViewModal(company)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{company.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-1">ID: {company.id.split('-')[0]}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-mono border border-gray-200">
                        @{company.username}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 text-sm">{company.email || "-"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{company.phone || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        company.isActive 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {company.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(company);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(company.id);
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                {modalMode === "add" ? "Add New Company" : modalMode === "edit" ? "Edit Company" : "View Company Details"}
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
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company Name</label>
                      <div className="text-gray-900 font-bold text-xl">{formData.name}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Username</label>
                        <div className="text-gray-900 font-mono text-sm bg-white border border-gray-200 px-3 py-2 rounded-md inline-block">
                          @{formData.username}
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

                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                        <div className="text-gray-900 font-medium text-base">
                          {formData.email || "—"}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                        <div className="text-gray-900 font-medium text-base">
                          {formData.phone || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Company Name *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Enter company name"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Username *</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="company_user"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Password {modalMode === "add" ? "*" : "(Leave blank to keep current)"}
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="••••••••"
                          required={modalMode === "add"}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="info@company.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="+123456789"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mt-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-700">Account Status</div>
                        <div className="text-xs text-gray-500">Allow login for this company</div>
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
                      onClick={() => openEditModal(currentCompany)} 
                      type="button"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Company
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        handleDelete(currentCompany.id);
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
                      <Button type="submit" isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {modalMode === "add" ? "Create Company" : "Save Changes"}
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
