import { Building2 } from "lucide-react";

// System users pick the company every Certificates V2 page works on (plan §13.1).
// Renders nothing for a company session.
export default function CompanyPicker({ scope }) {
  const { isCompany, companies, companyId, setCompanyId, loading } = scope;
  if (isCompany) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      <Building2 className="w-4 h-4 text-gray-400" />
      <span className="sr-only">Company</span>
      <select
        value={companyId || ""}
        onChange={(e) => setCompanyId(e.target.value)}
        disabled={loading}
        className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-800 min-w-56"
      >
        {!companies.length && <option value="">{loading ? "Loading companies…" : "No companies"}</option>}
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
