import Select from "react-select";
import { findOption } from "../../utils/certificateFieldSources";

// Grouped source picker (plan §13.2) over the server catalogue. Fixed text and
// combinations get their extra input right below. "Product details" are the
// values found inside the company's products (AI plan §3.2); `onRefresh`
// re-reads them after products changed.
export default function SourcePicker({ options, value, onChange, inputId, ariaLabel = "Value comes from", dictionary = null, onRefresh = null, refreshing = false }) {
  const selected = findOption(options, value);
  return (
    <div className="space-y-2">
      <Select
        inputId={inputId}
        aria-label={ariaLabel}
        options={options}
        value={selected}
        onChange={(o) => onChange(o ? { ...o.source, ...(o.source.kind === "static" ? { text: value?.text || "" } : {}), ...(o.source.kind === "template" ? { template: value?.template || "" } : {}) } : { kind: "manual" })}
        formatOptionLabel={(o, { context }) =>
          context === "menu" && o.description ? (
            <div>
              <div>{o.label}</div>
              <div className="text-xs text-gray-500">{o.description}</div>
            </div>
          ) : context === "value" && o.group !== "Other" ? (
            `${o.group} · ${o.label}`
          ) : (
            o.label
          )
        }
        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
        styles={{ menuPortal: (b) => ({ ...b, zIndex: 60 }), control: (b) => ({ ...b, minHeight: 36 }) }}
        placeholder="Where does the value come from?"
      />
      {onRefresh && (
        <p className="text-[11px] text-gray-500">
          {dictionary ? `Product details read from ${dictionary.productCount} product${dictionary.productCount === 1 ? "" : "s"}. ` : ""}
          <button type="button" onClick={onRefresh} disabled={refreshing} className="underline hover:text-gray-700 disabled:opacity-50">
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </p>
      )}
      {value?.kind === "static" && (
        <input
          value={value.text || ""}
          onChange={(e) => onChange({ kind: "static", text: e.target.value })}
          placeholder="Text printed on every certificate"
          aria-label="Fixed text"
          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        />
      )}
      {value?.kind === "template" && (
        <div>
          <input
            value={value.template || ""}
            onChange={(e) => onChange({ kind: "template", template: e.target.value })}
            placeholder="COA{{item.batchNo}}"
            aria-label="Combination"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Placeholders: {"{{item.batchNo}}"}, {"{{invoice.invoiceNumber}}"}, {"{{product.name}}"}, {"{{today}}"} — text only, no expressions.
          </p>
        </div>
      )}
    </div>
  );
}
