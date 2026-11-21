// Where a value of an operation came from: the page, a lookup, the person, a default.
const SOURCE = {
  context: ["Page", "bg-sky-50 text-sky-700 border-sky-200"],
  lookup: ["Found", "bg-violet-50 text-violet-700 border-violet-200"],
  user: ["You typed", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  default: ["Default", "bg-gray-100 text-gray-600 border-gray-200"],
};

export default function SourceBadge({ source, evidence }) {
  const [label, cls] = SOURCE[source] || SOURCE.default;
  return (
    <span title={evidence || undefined} data-testid="source-badge" className={`inline-flex flex-none items-center rounded-full border px-1.5 py-px text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}
