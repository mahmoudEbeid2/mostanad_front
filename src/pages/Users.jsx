import { useState, useEffect } from "react";
import { getUsers, createUser, updateUser, deleteUser, getUserById, resetUserPassword } from "../services/apiUsers";
import { getRoles } from "../services/apiRoles";
import { Search, Plus, Edit2, Trash2, Users as UsersIcon, Copy, Wand2, Key } from "lucide-react";
import Button from "../ui/Button";
import toast from "react-hot-toast";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    roleId: "",
    username: "",
    password: "",
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateUsername = () => {
    if (!formData.email) {
      toast.error("Please enter an email first to generate a username");
      return;
    }
    const base = formData.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
    const suffix = Math.floor(100 + Math.random() * 900);
    setFormData(prev => ({ ...prev, username: `${base}${suffix}` }));
  };

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password }));
  };

  const copyToClipboard = (text, type) => {
    if (!text) {
      toast.error(`No ${type} to copy`);
      return;
    }
    navigator.clipboard.writeText(text).catch(() => {});
    toast.success(`${type} copied to clipboard!`);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        getUsers({ limit: 100 }),
        getRoles({ limit: 100 })
      ]);
      
      if (usersRes.status === "success") {
        setUsers(usersRes.data.users || []);
      }
      if (rolesRes.status === "success") {
        setRoles(rolesRes.data.roles || []);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setModalMode("add");
    setFormData({ 
      name: "", 
      email: "", 
      phone: "", 
      roleId: roles.length > 0 ? roles[0].id : "", 
      username: "",
      password: "",
      isActive: true 
    });
    setCurrentUser(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode("edit");
    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      roleId: user.roleId || "",
      isActive: user.isActive ?? true,
    });
    setCurrentUser(user);
    setIsModalOpen(true);
  };

  const openViewModal = async (user) => {
    // Open immediately with cached data
    setModalMode("view");
    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      roleId: user.roleId || "",
      isActive: user.isActive ?? true,
    });
    setCurrentUser(user);
    setIsModalOpen(true);

    try {
      // Fetch fresh data
      const res = await getUserById(user.id);
      if (res.status === "success" && res.data?.user) {
        const freshUser = res.data.user;
        setFormData({
          name: freshUser.name || "",
          email: freshUser.email || "",
          phone: freshUser.phone || "",
          roleId: freshUser.roleId || "",
          isActive: freshUser.isActive ?? true,
        });
        setCurrentUser(freshUser);
      }
    } catch (error) {
      toast.error("Failed to fetch latest user details");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Name and Email are required");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const payload = { ...formData };

      // Ensure roleId is not empty string, if empty make it null
      if (!payload.roleId) payload.roleId = null;

      if (modalMode === "add") {
        const res = await createUser(payload);
        const newUser = res.data.user;
        
        // We only show the alert if the system generated them on backend (legacy), 
        // but now the user sees them and can copy them from the UI before saving.
        toast.success("User created successfully!");
      } else {
        await updateUser(currentUser.id, payload);
        toast.success("User updated successfully");
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
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      setIsLoading(true);
      await deleteUser(id);
      toast.success("User deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete user");
      setIsLoading(false); 
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Are you sure you want to reset the password for ${user.username}?`)) return;

    try {
      const res = await resetUserPassword(user.id);
      const newPassword = res.data.generatedPassword;
      
      const creds = `Username: ${user.username}\nNew Password: ${newPassword}`;
      navigator.clipboard.writeText(creds).catch(() => {});
      
      toast.success("Password reset successfully. Credentials copied to clipboard!", { duration: 6000 });
      window.prompt(`Password for ${user.username} has been reset. Please copy the new credentials:`, creds);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon className="w-8 h-8 text-teal-600" />
            Users Management
          </h1>
          <p className="text-gray-500 mt-1">Manage system administrators and operators.</p>
        </div>
        <Button className="shrink-0 bg-teal-600 hover:bg-teal-700" onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" />
          Add User
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
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <span className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <UsersIcon className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-lg font-medium text-gray-500">No users found</p>
                      <p className="text-sm mt-1">Try adjusting your search or add a new user.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} onClick={() => openViewModal(user)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-mono border border-gray-200">
                          @{user.username}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(user.username, "Username");
                          }}
                          className="text-gray-400 hover:text-teal-600 transition-colors p-1 rounded hover:bg-teal-50"
                          title="Copy Username"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">{user.role?.name || "No Role"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        user.isActive 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetPassword(user);
                          }}
                          className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(user);
                          }}
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(user.id);
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
                <UsersIcon className="w-5 h-5 text-teal-600" />
                {modalMode === "add" ? "Add New User" : modalMode === "edit" ? "Edit User" : "View User Details"}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="Enter full name"
                    required
                    disabled={modalMode === "view"}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="john@example.com"
                    required
                    disabled={modalMode === "view"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
                    disabled={modalMode === "view"}
                  >
                    <option value="">No Role</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    placeholder="+123456789"
                    disabled={modalMode === "view"}
                  />
                </div>

                {modalMode === "add" && (
                  <>
                    <div className="md:col-span-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-semibold text-gray-700">Username</label>
                        <button type="button" onClick={generateUsername} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 font-medium bg-teal-50 px-2 py-1 rounded transition-colors">
                          <Wand2 className="w-3 h-3" /> Auto Generate
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono text-sm"
                          placeholder="e.g. admin123 (or leave blank to auto-generate)"
                        />
                        <button type="button" onClick={() => copyToClipboard(formData.username, "Username")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 bg-white" title="Copy Username">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-semibold text-gray-700">Password</label>
                        <button type="button" onClick={generatePassword} className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 font-medium bg-teal-50 px-2 py-1 rounded transition-colors">
                          <Wand2 className="w-3 h-3" /> Auto Generate
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono text-sm"
                          placeholder="Leave blank to generate automatically"
                        />
                        <button type="button" onClick={() => copyToClipboard(formData.password, "Password")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 bg-white" title="Copy Password">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mt-2 ${modalMode === "view" ? "opacity-75" : ""}`}>
                <div>
                  <div className="text-sm font-semibold text-gray-700">Account Status</div>
                  <div className="text-xs text-gray-500">Allow login for this user</div>
                </div>
                <label className={`relative inline-flex items-center ${modalMode === "view" ? "cursor-not-allowed" : "cursor-pointer"}`}>
                  <input 
                    type="checkbox" 
                    checked={formData.isActive} 
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} 
                    className="sr-only peer" 
                    disabled={modalMode === "view"}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0 mt-6 -mx-6 -mb-6">
                {modalMode === "view" ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => openEditModal(currentUser)} 
                      type="button"
                      className="text-teal-600 border-teal-200 hover:bg-teal-50 hover:border-teal-300"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit User
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        handleDelete(currentUser.id);
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
                        {modalMode === "add" ? "Create User" : "Save Changes"}
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
