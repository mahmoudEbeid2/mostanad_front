// A text layout's fit per section ("ليبل جديد من النص"): fits, font reduced, or how many mm it needs.

export default function FitList({ fit }) {
  if (!fit) return null;
  if (fit.mode === "scale" || fit.mode === "smart") return null;
  return (
    <ul className="space-y-1 text-xs" data-testid="fit-sections">
      {(fit.sections || []).map((s) => (
        <li key={s.key} className={`flex justify-between gap-3 rounded-md px-2 py-1 ${s.status === "overflow" ? "bg-red-50 text-red-800" : s.status === "reduced" ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-700"}`}>
          <span className="font-medium">{s.title || s.key}</span>
          <span>{s.status === "overflow" ? `ينقصه ${s.overflowMm} مم` : s.status === "reduced" ? `صُغّر الخط إلى ${fit.fontPt} نقطة${fit.columns > 1 ? ` · ${fit.columns} أعمدة` : ""}` : "يتّسع"}</span>
        </li>
      ))}
    </ul>
  );
}
