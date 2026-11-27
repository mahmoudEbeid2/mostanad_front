import { useState, useEffect } from "react";
import { getCategories, createCategory, updateCategory, deleteCategory, getCategoryById } from "../services/apiCategories";
import { Search, Plus, Edit2, Trash2, FolderTree, X } from "lucide-react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import toast from "react-hot-toast";
import { categoryOptions } from "../utils/categoryOptions";
import { fmtDate, t } from "../i18n";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // "add" | "edit" | "view"
  const [currentCategory, setCurrentCategory] = useState(null);
  const [formData, setFormData] = useState({ name: "", parentId: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await getCategories({ limit: 100 });
      if (res.status === "success") {
        setCategories(res.data.categories || []);
      }
    } catch (error) {
      toast.error(t("categories.failedToLoadCategories"));
    } finally {
      setIsLoading(false);
    }
  };

  // main categories first, each followed by the ones under it
  const byId = Object.fromEntries(categories.map((c) => [c.id, c]));
  const filteredCategories = categoryOptions(categories)
    .map((o) => ({ ...byId[o.id], depth: o.depth, isMain: o.isMain }))
    .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  // a parent must be a main-level category (no parent itself), never the category itself
  const parentChoices = categories.filter((c) => !c.parentId && c.id !== currentCategory?.id);

  const openAddModal = () => {
    setModalMode("add");
    setFormData({ name: "", parentId: "" });
    setCurrentCategory(null);
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setModalMode("edit");
    setFormData({ name: category.name, parentId: category.parentId || "" });
    setCurrentCategory(category);
    setIsModalOpen(true);
  };

  const openViewModal = async (category) => {
    setModalMode("view");
    setFormData({ name: category.name || "", parentId: category.parentId || "" });
    setCurrentCategory(category);
    setIsModalOpen(true);

    try {
      const res = await getCategoryById(category.id);
      if (res.status === "success" && res.data?.category) {
        const freshCat = res.data.category;
        setFormData({ name: freshCat.name || "", parentId: freshCat.parentId || "" });
        setCurrentCategory(freshCat);
      }
    } catch (error) {
      toast.error(t("categories.failedToFetchLatestCategory"));
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(t("categories.categoryNameIsRequired"));
      return;
    }

    try {
      setIsSubmitting(true);
      if (modalMode === "add") {
        await createCategory({ name: formData.name, parentId: formData.parentId || null });
        toast.success(t("categories.categoryCreatedSuccessfully"));
      } else {
        await updateCategory(currentCategory.id, { name: formData.name, parentId: formData.parentId || null });
        toast.success(t("categories.categoryUpdatedSuccessfully"));
      }
      closeModal();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || t("categories.operationFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("categories.areYouSureYouWant"))) return;

    try {
      setIsLoading(true);
      await deleteCategory(id);
      toast.success(t("categories.categoryDeletedSuccessfully"));
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || t("categories.failedToDeleteCategory"));
      setIsLoading(false); // only needed on fail because fetchCategories handles success
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("categories.categories")}</h1>
          <p className="text-gray-500 mt-1">{t("categories.manageProductCategoriesDatabase")}</p>
        </div>
        <Button className="shrink-0" onClick={openAddModal}>
          <Plus className="w-5 h-5 me-2" />{t("categories.addCategory")}</Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t("categories.searchByName")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-10 pe-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">{t("categories.categoryName")}</th>
                <th className="px-6 py-4">{t("categories.createdAt")}</th>
                <th className="px-6 py-4 text-end">{t("categories.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <FolderTree className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium text-gray-900">{t("categories.noCategoriesFound")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id} onClick={() => openViewModal(category)} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900 flex items-center gap-2 group-hover:text-teal-600 transition-colors">
                        {category.depth ? <span className="w-5 text-gray-300">—</span> : <FolderTree className="w-4 h-4 text-gray-400 group-hover:text-teal-500" />}
                        <span className={category.depth ? "font-normal text-gray-700" : ""}>{category.name}</span>
                        {category.isMain && <span className="rounded bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-700">{t("categories.main")}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-500">
                      {fmtDate(category.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(category);
                          }}
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title={t("categories.edit")}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(category.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t("categories.delete")}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-teal-600" />
                {modalMode === "add" ? t("categories.addNewCategory") : modalMode === "edit" ? t("categories.editCategory") : t("categories.viewCategoryDetails")}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("categories.categoryName")}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder={t("categories.eGInvoicesContracts")}
                  required
                  disabled={modalMode === "view"}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="category-parent">{t("categories.underMainCategory")}</label>
                <select
                  id="category-parent"
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  disabled={modalMode === "view" || categories.some((c) => c.parentId && c.parentId === currentCategory?.id)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="">{t("categories.noneAMainCategory")}</option>
                  {categoryOptions(parentChoices).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {categories.some((c) => c.parentId && c.parentId === currentCategory?.id) && <p className="mt-1 text-xs text-gray-500">{t("categories.otherCategoriesSitUnderThis")}</p>}
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-gray-100 mt-6">
                {modalMode === "view" ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => openEditModal(currentCategory)} 
                      type="button"
                      className="text-teal-600 border-teal-200 hover:bg-teal-50 hover:border-teal-300"
                    >
                      <Edit2 className="w-4 h-4 me-2" />{t("categories.edit")}</Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        handleDelete(currentCategory.id);
                        closeModal();
                      }} 
                      type="button"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    >
                      <Trash2 className="w-4 h-4 me-2" />{t("categories.delete")}</Button>
                  </div>
                ) : (
                  <div></div>
                )}
                
                <div className="flex gap-3">
                  {modalMode === "view" ? (
                    <Button variant="secondary" onClick={closeModal} type="button">{t("categories.close")}</Button>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={closeModal} type="button">{t("categories.cancel")}</Button>
                      <Button type="submit" disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700 text-white">
                        {isSubmitting ? t("categories.saving") : modalMode === "add" ? t("categories.createCategory") : t("categories.saveChanges")}
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
