import { useState } from "react";
import { Link } from "react-router-dom";
import { entityRoute } from "../../utils/assistantContext";

// One record a tool returned (a product, a company, a certificate, the dashboard numbers…),
// shown by code from the stored values: full text, never translated; only the field
// names are labelled in the conversation's language. Long values fold behind "show more".

const LONG = 280;
const yesNo = (v, ar) => (v ? (ar ? "نعم" : "Yes") : ar ? "لا" : "No");

function Value({ value, ar }) {
  const [open, setOpen] = useState(false);
  if (value === null || value === undefined || value === "") return <span className="text-gray-400">{ar ? "فارغ" : "empty"}</span>;
  if (typeof value === "boolean") return <span>{yesNo(value, ar)}</span>;
  const s = String(value);
  const long = s.length > LONG;
  return (
    <span className="whitespace-pre-wrap break-words" dir="auto">
      {long && !open ? `${s.slice(0, LONG)}…` : s}
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="ms-1 text-xs font-semibold text-blue-600 hover:underline">
          {open ? (ar ? "عرض أقل" : "show less") : ar ? "عرض المزيد" : "show more"}
        </button>
      )}
    </span>
  );
}

export default function RecordBlock({ block, lang = "en" }) {
  const ar = lang === "ar";
  const to = block.ref ? entityRoute(block.ref.type, block.ref.id) : null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3" data-testid="record-block" dir={ar ? "rtl" : "ltr"}>
      {to && (
        <Link to={to} className="w-fit text-[13px] font-semibold text-blue-600 hover:underline">
          {ar ? "فتح" : "Open"} →
        </Link>
      )}
      <dl className="m-0 grid grid-cols-[minmax(110px,max-content)_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {block.fields.map((f) => (
          <div key={f.key} className="contents">
            <dt className="text-gray-500">{(ar ? f.label?.ar : f.label?.en) || f.key}</dt>
            <dd className="m-0 min-w-0 text-gray-900">
              <Value value={f.value} ar={ar} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
