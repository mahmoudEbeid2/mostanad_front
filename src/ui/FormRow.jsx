export default function FormRow({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-700 ms-1">
          {label}
        </label>
      )}
      {children}
      {error && <span className="text-xs text-red-500 mt-1 ms-1">{error}</span>}
    </div>
  );
}
