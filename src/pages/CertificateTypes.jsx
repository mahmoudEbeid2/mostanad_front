import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { BadgeCheck, Edit2, Plus, Trash2, X } from "lucide-react";
import Button from "../ui/Button";
import Spinner from "../ui/Spinner";
import CompanyPicker from "../components/certificates/CompanyPicker";
import RoleBanner from "../components/certificates/RoleBanner";
import useCompanyScope from "../hooks/useCompanyScope";
import useConfirm from "../hooks/useConfirm";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import { createCertificateType, deleteCertificateType, listCertificateTypes, updateCertificateType } from "../services/apiCertificateTypes";

const STR = {
  title: "Certificate types",
  subtitle: "The kinds of certificates your company issues. Every template belongs to one type.",
  add: "New type",
  name: "Name",
  code: "Code",
  description: "Description",
  templates: "Templates",
  active: "Active",
  empty: "No certificate types yet. Create one first — for example “Certificate of Analysis” with code COA — then upload its template.",
  pickCompany: "Pick a company to manage its certificate types.",
  created: "Certificate type created",
  saved: "Certificate type saved",
  deleted: "Certificate type deleted",
  confirmDelete: (n) => ({ title: `Delete “${n}”?`, message: "This cannot be undone.", confirmLabel: "Delete", tone: "danger" }),
  save: "Save",
  cancel: "Cancel",
  inUse: "Used by templates — deactivate it instead",
  uploadTemplate: "Upload a template",
  codeHint: "Short, unique per company — letters, digits, - and _",
};

const EMPTY = { name: "", code: "", description: "" };

export default function CertificateTypes() {
  const scopeState = useCompanyScope();
  const [ask, askDialog] = useConfirm();
  const { scope } = scopeState;
  const { user } = useAuth();
  const canCreate = hasPermission(user, "create_certificate_types");
  const canUpdate = hasPermission(user, "update_certificate_types");
  const canDelete = hasPermission(user, "delete_certificate_types");

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | type
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      setTypes(await listCertificateTypes(scope, { includeInactive: true }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing("new");
    setForm(EMPTY);
  };
  const openEdit = (t) => {
    setEditing(t);
    setForm({ name: t.name, code: t.code, description: t.description || "" });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing === "new") {
        await createCertificateType(scope, form);
        toast.success(STR.created);
      } else {
        await updateCertificateType(scope, editing.id, form);
        toast.success(STR.saved);
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (t) => {
    try {
      await updateCertificateType(scope, t.id, { isActive: !t.isActive });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (t) => {
    if (!(await ask(STR.confirmDelete(t.name)))) return;
    try {
      await deleteCertificateType(scope, t.id);
      toast.success(STR.deleted);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {askDialog}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{STR.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{STR.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <CompanyPicker scope={scopeState} />
          {canCreate && scope && (
            <Button onClick={openNew}>
              <Plus className="w-4 h-4" /> {STR.add}
            </Button>
          )}
        </div>
      </div>

      <RoleBanner scope={scopeState} />

      {editing && (
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-xl p-5 grid gap-4 md:grid-cols-[1fr_180px] shadow-sm">
          <label className="text-sm">
            <span className="font-medium text-gray-700">{STR.name}</span>
            <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Certificate of Analysis" />
          </label>
          <label className="text-sm">
            <span className="font-medium text-gray-700">{STR.code}</span>
            <input required pattern="[A-Za-z0-9_\-]+" maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono" placeholder="COA" title={STR.codeHint} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="font-medium text-gray-700">{STR.description}</span>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" />
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              <X className="w-4 h-4" /> {STR.cancel}
            </Button>
            <Button type="submit" isLoading={saving}>
              {STR.save}
            </Button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {!scope ? (
          <p className="p-8 text-sm text-gray-500">{STR.pickCompany}</p>
        ) : loading ? (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        ) : types.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <BadgeCheck className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm text-gray-600 max-w-md mx-auto">{STR.empty}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">{STR.name}</th>
                <th className="text-left px-4 py-3">{STR.code}</th>
                <th className="text-left px-4 py-3">{STR.templates}</th>
                <th className="text-left px-4 py-3">{STR.active}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map((t) => (
                <tr key={t.id} className={t.isActive ? "" : "text-gray-400"}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    {t.description && <div className="text-xs text-gray-500">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono">{t.code}</td>
                  <td className="px-4 py-3">
                    {t._count?.templates ? (
                      <Link className="text-blue-600 hover:underline" to={`/certificates/templates?certificateTypeId=${t.id}`}>
                        {t._count.templates}
                      </Link>
                    ) : (
                      <Link className="text-blue-600 hover:underline text-xs" to={`/certificates/templates/new?certificateTypeId=${t.id}`}>
                        {STR.uploadTemplate}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={t.isActive} disabled={!canUpdate} onChange={() => toggleActive(t)} aria-label={STR.active} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {canUpdate && (
                        <button type="button" onClick={() => openEdit(t)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => remove(t)}
                          disabled={t._count?.templates > 0}
                          title={t._count?.templates > 0 ? STR.inUse : undefined}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
