// Field flags with the plan's fixed colours and copy (plan §13.7).
const FLAGS = {
  missing: { tone: "red", text: "Required value missing" },
  overflow: { tone: "red", text: "Doesn't fit — shorten or change" },
  shrunk: { tone: "amber", text: "Shrunk to fit" },
  format: { tone: "amber", text: "Couldn't format as date" },
  missing_span: { tone: "red", text: "Field not found in the design" },
};
const TONES = {
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
};

function describeFlag(flag) {
  if (flag.startsWith("glyph:")) return { tone: "amber", text: `Character not in the design font: ${Array.from(flag.slice(6)).join(", ")}` };
  return FLAGS[flag] || { tone: "amber", text: flag };
}

export default function FlagBadges({ flags, className = "" }) {
  if (!flags?.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {flags.map((f) => {
        const { tone, text } = describeFlag(f);
        return (
          <span key={f} className={`px-1.5 py-0.5 rounded border text-[11px] font-medium ${TONES[tone]}`}>
            {text}
          </span>
        );
      })}
    </span>
  );
}
