import { Building2 } from "lucide-react";

// The company every Certificates V2 page works on (plan §13.1; mockups A1/A2/B1).
// System users pick it (every call adds ?companyId=); a company session sees
// its own name read-only in the same place.
//  - variant "inline": compact, for page headers
//  - variant "field":  labelled form/filter field ("Company" + optional hint);
//    `yours` adds "· your company" to a company session's name (A2, not A1/B1);
//    `compact` matches the 40px selects of a filter card
const STR = {
  label: "Company",
  loading: "Loading companies…",
  none: "No companies",
  yours: "your company",
};

export default function CompanyPicker({ scope, variant = "inline", hint, yours = true, compact = false, labelClassName = "text-xs font-semibold text-gray-600", className = "" }) {
  const { isCompany, companies, companyId, companyName, setCompanyId, loading } = scope;
  const field = variant === "field";
  const height = compact ? "min-h-10" : "min-h-11";

  const control = isCompany ? (
    <div
      data-testid="company-fixed"
      className={`flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-lg px-3 text-sm font-medium text-gray-900 ${field ? height : "py-2"}`}
    >
      {!field && <Building2 className="w-4 h-4 text-gray-400" />}
      {companyName}
      {field && yours && <span className="font-normal text-gray-500">· {STR.yours}</span>}
    </div>
  ) : (
    <select
      value={companyId || ""}
      onChange={(e) => setCompanyId(e.target.value)}
      disabled={loading}
      aria-label={STR.label}
      className={`border border-gray-300 rounded-lg px-3 bg-white text-sm text-gray-800 min-w-56 ${field ? `${height} w-full` : "py-2"}`}
    >
      {!companies.length && <option value="">{loading ? STR.loading : STR.none}</option>}
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );

  if (field) {
    return (
      <div className={`flex flex-col gap-1.5 ${labelClassName} ${className}`}>
        <span>
          {STR.label}
          {hint && !isCompany && <span className="font-normal text-gray-500"> · {hint}</span>}
        </span>
        {control}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
      {!isCompany && <Building2 className="w-4 h-4 text-gray-400" />}
      {control}
    </div>
  );
}
