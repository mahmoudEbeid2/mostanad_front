// diff entries: [{ path, op, before, after }] — computed server-side (versionService.diff).
const OP_CLASSES = {
  replace: "bg-blue-50 text-blue-700 border-blue-200",
  append: "bg-green-50 text-green-700 border-green-200",
  insert: "bg-green-50 text-green-700 border-green-200",
  remove: "bg-red-50 text-red-700 border-red-200",
};

function renderValue(v) {
  if (v === null || v === undefined) return <span className="italic text-gray-400">empty</span>;
  if (typeof v === "object") return <code className="text-xs">{JSON.stringify(v)}</code>;
  return String(v);
}

export default function DiffView({ diff }) {
  if (!diff || diff.length === 0) {
    return <p className="text-sm text-gray-500 italic">No differences between these versions.</p>;
  }
  return (
    <div className="space-y-2">
      {diff.map((d, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${OP_CLASSES[d.op] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {d.op}
            </span>
            <span className="font-mono text-xs text-gray-500">{d.path}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {d.op !== "insert" && d.op !== "append" && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Before</p>
                <p className="text-red-700 line-through decoration-red-300">{renderValue(d.before)}</p>
              </div>
            )}
            {d.op !== "remove" && (
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">After</p>
                <p className="text-green-700">{renderValue(d.after)}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
