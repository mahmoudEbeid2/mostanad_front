export default function FormRow({ label, error, children }) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-300 ml-1">
          {label}
        </label>
      )}
      {children}
      {error && <span className="text-xs text-red-400 mt-1 ml-1">{error}</span>}
    </div>
  );
}
