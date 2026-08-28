// A LocalizedText value is { translations: { en, ar, ... }, primary }. Renders
// bilingual (en/ar) side by side, matching this app's bilingual-first convention.
export default function LocalizedField({ label, value, estimated, className = "" }) {
  if (!value?.translations) return null;
  const { en, ar } = value.translations;
  if (!en && !ar) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">{label}</span>
        {estimated && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
            Estimated
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {en && <p className="text-sm text-gray-900">{en}</p>}
        {ar && <p className="text-sm text-gray-900 text-right" dir="rtl">{ar}</p>}
      </div>
    </div>
  );
}
