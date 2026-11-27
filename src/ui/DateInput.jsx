// A date typed and shown as DD/MM/YYYY in both languages (UI plan, Phase A §6: the browser's own date
// picker showed mm/dd/yyyy). The value in and out is ISO "YYYY-MM-DD" (or "" for none). The calendar
// button opens the browser's picker on a hidden native input, so picking still works.
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { t } from "../i18n";

const toShown = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const toIso = (shown) => {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(shown.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export default function DateInput({ value, onChange, disabled, className = "", ariaLabel, testId }) {
  const [text, setText] = useState(toShown(value));
  const [bad, setBad] = useState(false);
  const native = useRef(null);
  useEffect(() => {
    setText(toShown(value));
    setBad(false);
  }, [value]);

  const commit = () => {
    if (!text.trim()) {
      setBad(false);
      if (value) onChange("");
      return;
    }
    const iso = toIso(text);
    if (!iso) return setBad(true);
    setBad(false);
    if (iso !== value) onChange(iso);
  };

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={text}
        disabled={disabled}
        placeholder={t("common.datePlaceholder")}
        aria-label={ariaLabel}
        aria-invalid={bad || undefined}
        title={bad ? t("common.dateInvalid") : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        data-testid={testId}
        className={`w-32 rounded-lg border px-2 py-1 text-sm tabular-nums ${bad ? "border-red-400 bg-red-50" : "border-gray-300"}`}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => native.current?.showPicker?.()}
        aria-label={t("common.pickDate")}
        className="relative rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        <input
          ref={native}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value || ""}
          onChange={(e) => onChange(e.target.value || "")}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </button>
    </span>
  );
}
