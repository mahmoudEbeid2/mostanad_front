import Select from "react-select";
import { findOption } from "../../utils/certificateFieldSources";
import { t } from "../../i18n";

// Grouped source picker (plan §13.2) over the server catalogue. Fixed text and
// combinations get their extra input right below. "Product details" are the
// values found inside the company's products (AI plan §3.2); `onRefresh`
// re-reads them after products changed.
export default function SourcePicker({ options, value, onChange, inputId, ariaLabel = t("sourcePicker.valueComesFrom"), dictionary = null, onRefresh = null, refreshing = false }) {
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
        placeholder={t("sourcePicker.whereDoesTheValueCome")}
      />
      {onRefresh && (
        <p className="text-[11px] text-gray-500">
          {dictionary ? `${t("sourcePicker.readFrom", { count: dictionary.productCount })} ` : ""}
          <button type="button" onClick={onRefresh} disabled={refreshing} className="underline hover:text-gray-700 disabled:opacity-50">
            {refreshing ? t("sourcePicker.refreshing") : t("sourcePicker.refresh")}
          </button>
        </p>
      )}
      {value?.kind === "static" && (
        <input
          value={value.text || ""}
          onChange={(e) => onChange({ kind: "static", text: e.target.value })}
          placeholder={t("sourcePicker.textPrintedOnEveryCertificate")}
          aria-label={t("sourcePicker.fixedText")}
          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        />
      )}
      {value?.kind === "template" && (
        <div>
          <input
            value={value.template || ""}
            onChange={(e) => onChange({ kind: "template", template: e.target.value })}
            placeholder="COA{{item.batchNo}}"
            aria-label={t("sourcePicker.combination")}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
          />
          <p className="mt-1 text-[11px] text-gray-500">{t("sourcePicker.placeholders")}{" "}{"{"}{"{"}item.batchNo{"}"}{"}"}, {"{"}{"{"}invoice.invoiceNumber{"}"}{"}"}, {"{"}{"{"}product.name{"}"}{"}"}, {"{{today}}"}{" "}{t("sourcePicker.textOnlyNoExpressions")}</p>
        </div>
      )}
    </div>
  );
}
