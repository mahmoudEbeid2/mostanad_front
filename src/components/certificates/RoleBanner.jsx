// Who you are working as, on every certificates page (mockups A1/B1):
// a system user works for any company (picked on the page); a company
// account only ever sees its own data.
const STR = {
  system: "System admin",
  systemNote: "You can work for every company. Pick the company first — everything you create belongs to it.",
  company: "Company account",
  companyNote: (name) => `${name} — you see only your own templates, invoices and certificates.`,
};

export default function RoleBanner({ scope, systemNote, companyNote }) {
  const { isCompany, companyName } = scope;
  return (
    <div
      role="status"
      data-testid="role-banner"
      className={`flex flex-wrap items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] ${
        isCompany ? "border-green-200 bg-green-50 text-emerald-900" : "border-indigo-200 bg-indigo-50 text-indigo-800"
      }`}
    >
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${isCompany ? "bg-emerald-700" : "bg-indigo-700"}`}>
        {isCompany ? STR.company : STR.system}
      </span>
      <span className="flex-1 min-w-56">{isCompany ? (companyNote || STR.companyNote)(companyName) : systemNote || STR.systemNote}</span>
    </div>
  );
}
