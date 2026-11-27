import { useState, useEffect } from "react";
import { getRoles, createRole, updateRole, deleteRole, getRoleById } from "../services/apiRoles";
import { Search, Plus, Edit2, Trash2, ShieldAlert, Check } from "lucide-react";
import Button from "../ui/Button";
import toast from "react-hot-toast";
import { t } from "../i18n";

// Predefined static permissions to build the UI
const PERMISSIONS_MODULES = [
  {
    module: "users",
    label: t("roles.users"),
    permissions: [
      { slug: "create_users", label: t("roles.create") },
      { slug: "read_users", label: t("roles.read") },
      { slug: "update_users", label: t("roles.update") },
      { slug: "delete_users", label: t("roles.delete") },
    ]
  },
  {
    module: "roles",
    label: t("roles.roles"),
    permissions: [
      { slug: "create_roles", label: t("roles.create") },
      { slug: "read_roles", label: t("roles.read") },
      { slug: "update_roles", label: t("roles.update") },
      { slug: "delete_roles", label: t("roles.delete") },
    ]
  },
  {
    module: "companies",
    label: t("roles.companies"),
    permissions: [
      { slug: "create_companies", label: t("roles.create") },
      { slug: "read_companies", label: t("roles.read") },
      { slug: "update_companies", label: t("roles.update") },
      { slug: "delete_companies", label: t("roles.delete") },
    ]
  },
  {
    module: "plans",
    label: t("roles.plans"),
    permissions: [
      { slug: "create_plans", label: t("roles.create") },
      { slug: "read_plans", label: t("roles.read") },
      { slug: "update_plans", label: t("roles.update") },
      { slug: "delete_plans", label: t("roles.delete") },
    ]
  },
  {
    module: "subscriptions",
    label: t("roles.subscriptions"),
    permissions: [
      { slug: "create_subscriptions", label: t("roles.create") },
      { slug: "read_subscriptions", label: t("roles.read") },
      { slug: "update_subscriptions", label: t("roles.update") },
      { slug: "delete_subscriptions", label: t("roles.delete") },
    ]
  },
  {
    module: "products",
    label: t("roles.products"),
    permissions: [
      { slug: "create_products", label: t("roles.create") },
      { slug: "read_products", label: t("roles.read") },
      { slug: "update_products", label: t("roles.update") },
      { slug: "delete_products", label: t("roles.delete") },
    ]
  },
  {
    module: "categories",
    label: t("roles.categories"),
    permissions: [
      { slug: "create_categories", label: t("roles.create") },
      { slug: "read_categories", label: t("roles.read") },
      { slug: "update_categories", label: t("roles.update") },
      { slug: "delete_categories", label: t("roles.delete") },
    ]
  },
  {
    module: "templates",
    label: t("roles.templates"),
    permissions: [
      { slug: "create_templates", label: t("roles.create") },
      { slug: "read_templates", label: t("roles.read") },
      { slug: "update_templates", label: t("roles.update") },
      { slug: "delete_templates", label: t("roles.delete") },
    ]
  },
  {
    module: "certificates",
    label: t("roles.certificates"),
    permissions: [
      { slug: "create_certificates", label: t("roles.create") },
      { slug: "read_certificates", label: t("roles.read") },
      { slug: "update_certificates", label: t("roles.update") },
      { slug: "delete_certificates", label: t("roles.delete") },
    ]
  },
  {
    module: "dashboard",
    label: t("roles.dashboard"),
    permissions: [
      { slug: "read_dashboard", label: t("roles.read") },
    ]
  },
  {
    module: "eda_requirements",
    label: t("roles.edaRequirements"),
    permissions: [
      { slug: "create_eda_requirements", label: t("roles.create") },
      { slug: "read_eda_requirements", label: t("roles.read") },
      { slug: "update_eda_requirements", label: t("roles.update") },
      { slug: "delete_eda_requirements", label: t("roles.delete") },
    ]
  }
];

// Helper to get all slugs flat
const ALL_SLUGS = PERMISSIONS_MODULES.flatMap(mod => mod.permissions.map(p => p.slug));

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
  const [currentRole, setCurrentRole] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissionSlugs: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await getRoles({ limit: 100 });
      if (res.status === "success") {
        setRoles(res.data.roles || []);
      }
    } catch (error) {
      toast.error(t("roles.failedToLoadRoles"));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setModalMode("add");
    setFormData({ name: "", description: "", permissionSlugs: [] });
    setCurrentRole(null);
    setIsModalOpen(true);
  };

  const openEditModal = (role) => {
    setModalMode("edit");
    const assignedSlugs = role.permissions?.map(p => p.permission.slug) || [];
    setFormData({
      name: role.name || "",
      description: role.description || "",
      permissionSlugs: assignedSlugs,
    });
    setCurrentRole(role);
    setIsModalOpen(true);
  };

  const openViewModal = async (role) => {
    // Open modal immediately with current data
    setModalMode("view");
    const assignedSlugs = role.permissions?.map(p => p.permission.slug) || [];
    setFormData({
      name: role.name || "",
      description: role.description || "",
      permissionSlugs: assignedSlugs,
    });
    setCurrentRole(role);
    setIsModalOpen(true);

    try {
      // Fetch fresh data from backend
      const res = await getRoleById(role.id);
      if (res.status === "success" && res.data?.role) {
        const freshRole = res.data.role;
        const freshSlugs = freshRole.permissions?.map(p => p.permission.slug) || [];
        setFormData({
          name: freshRole.name || "",
          description: freshRole.description || "",
          permissionSlugs: freshSlugs,
        });
        setCurrentRole(freshRole);
      }
    } catch (error) {
      toast.error(t("roles.failedToFetchLatestRole"));
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Checkbox Logic
  const handleTogglePermission = (slug) => {
    setFormData(prev => {
      const isSelected = prev.permissionSlugs.includes(slug);
      return {
        ...prev,
        permissionSlugs: isSelected 
          ? prev.permissionSlugs.filter(s => s !== slug)
          : [...prev.permissionSlugs, slug]
      };
    });
  };

  const handleToggleModule = (moduleSlugs) => {
    setFormData(prev => {
      const allSelected = moduleSlugs.every(s => prev.permissionSlugs.includes(s));
      if (allSelected) {
        return {
          ...prev,
          permissionSlugs: prev.permissionSlugs.filter(s => !moduleSlugs.includes(s))
        };
      } else {
        const toAdd = moduleSlugs.filter(s => !prev.permissionSlugs.includes(s));
        return {
          ...prev,
          permissionSlugs: [...prev.permissionSlugs, ...toAdd]
        };
      }
    });
  };

  const handleToggleAll = () => {
    setFormData(prev => {
      if (prev.permissionSlugs.length === ALL_SLUGS.length) {
        return { ...prev, permissionSlugs: [] };
      }
      return { ...prev, permissionSlugs: [...ALL_SLUGS] };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(t("roles.roleNameIsRequired"));
      return;
    }

    try {
      setIsSubmitting(true);
      if (modalMode === "add") {
        await createRole(formData);
        toast.success(t("roles.roleCreatedSuccessfully"));
      } else {
        await updateRole(currentRole.id, formData);
        toast.success(t("roles.roleUpdatedSuccessfully"));
      }
      closeModal();
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.message || t("roles.operationFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("roles.areYouSureYouWant"))) return;

    try {
      setIsLoading(true);
      await deleteRole(id);
      toast.success(t("roles.roleDeletedSuccessfully"));
      fetchRoles();
    } catch (error) {
      toast.error(error.response?.data?.message || t("roles.failedToDeleteRole"));
      setIsLoading(false); 
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-orange-600" />{t("roles.rolesPermissions")}</h1>
          <p className="text-gray-500 mt-1">{t("roles.manageSystemRolesAndTheir")}</p>
        </div>
        <Button className="shrink-0 bg-orange-600 hover:bg-orange-700" onClick={openAddModal}>
          <Plus className="w-5 h-5 me-2" />{t("roles.addRole")}</Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t("roles.searchRoles")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-10 pe-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">{t("roles.roleName")}</th>
                <th className="px-6 py-4">{t("roles.description")}</th>
                <th className="px-6 py-4 text-center">{t("roles.permissionsCount")}</th>
                <th className="px-6 py-4 text-end">{t("roles.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <span className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></span>
                    </div>
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <ShieldAlert className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-lg font-medium text-gray-500">{t("roles.noRolesFound")}</p>
                      <p className="text-sm mt-1">{t("roles.tryAdjustingYourSearchOr")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <tr key={role.id} onClick={() => openViewModal(role)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 text-base group-hover:text-orange-600 transition-colors">{role.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-500 truncate max-w-sm">{role.description || "-"}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {role.permissions?.length || 0}{" "}{t("roles.permissions")}</span>
                    </td>
                    <td className="px-6 py-4 text-end" onClick={(e) => e.stopPropagation()}>
                      {role.name !== "Admin" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(role)}
                            className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title={t("roles.edit")}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t("roles.delete2")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium italic">{t("roles.systemRole")}</span>
                      )}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange-600" />
                {modalMode === "add" ? t("roles.createNewRole") : modalMode === "edit" ? t("roles.editRole") : t("roles.viewRoleDetails")}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col overflow-hidden flex-1">
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t("roles.roleName2")}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder={t("roles.eGEditorManagerSupport")}
                      required
                      disabled={modalMode === "view"}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t("roles.description")}</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none resize-none h-20 disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder={t("roles.whatDoesThisRoleDo")}
                      disabled={modalMode === "view"}
                    />
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* Permissions Grid */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t("roles.permissions")}</h3>
                    {modalMode !== "view" && (
                      <button
                        type="button"
                        onClick={handleToggleAll}
                        className="text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        {formData.permissionSlugs.length === ALL_SLUGS.length ? t("roles.deselectAll") : t("roles.selectAll")}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PERMISSIONS_MODULES.map(group => {
                      const moduleSlugs = group.permissions.map(p => p.slug);
                      const isAllSelected = moduleSlugs.every(s => formData.permissionSlugs.includes(s));
                      
                      return (
                        <div key={group.module} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                            <h4 className="font-bold text-gray-800">{group.label}</h4>
                            <label className={`flex items-center gap-2 text-xs font-semibold transition-colors ${modalMode === "view" ? "text-gray-400 cursor-not-allowed" : "cursor-pointer text-gray-600 hover:text-gray-900"}`}>
                              <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={() => handleToggleModule(moduleSlugs)}
                                className="rounded text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                                disabled={modalMode === "view"}
                              />{t("roles.all")}</label>
                          </div>
                          <div className="space-y-2">
                            {group.permissions.map(perm => (
                              <label key={perm.slug} className={`flex items-center gap-3 group ${modalMode === "view" ? "cursor-not-allowed" : "cursor-pointer"}`}>
                                <div className="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={formData.permissionSlugs.includes(perm.slug)}
                                    onChange={() => handleTogglePermission(perm.slug)}
                                    className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                                    disabled={modalMode === "view"}
                                  />
                                </div>
                                <span className={`text-sm transition-colors ${
                                  formData.permissionSlugs.includes(perm.slug) 
                                    ? (modalMode === "view" ? "text-gray-700 font-medium" : "text-gray-900 font-medium") 
                                    : (modalMode === "view" ? "text-gray-400" : "text-gray-600 group-hover:text-gray-900")
                                }`}>
                                  {perm.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                {modalMode === "view" && currentRole?.name !== "Admin" ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => openEditModal(currentRole)} 
                      type="button"
                      className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
                    >
                      <Edit2 className="w-4 h-4 me-2" />{t("roles.editRole")}</Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        handleDelete(currentRole.id);
                        closeModal();
                      }} 
                      type="button"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    >
                      <Trash2 className="w-4 h-4 me-2" />{t("roles.delete2")}</Button>
                  </div>
                ) : (
                  <div></div>
                )}
                
                <div className="flex gap-3">
                  {modalMode === "view" ? (
                    <Button variant="secondary" onClick={closeModal} type="button">{t("roles.close")}</Button>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={closeModal} type="button">{t("roles.cancel")}</Button>
                      <Button type="submit" isLoading={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white border-none">
                        {modalMode === "add" ? t("roles.createRole") : t("roles.saveChanges")}
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
