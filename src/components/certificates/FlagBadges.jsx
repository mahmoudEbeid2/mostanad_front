// Field flags with the plan's fixed colours and copy (plan §13.7), shown as in
// mockup B5: a short code pill ("missing") followed by the sentence — the words
// carry the meaning, the colour only repeats it.
const FLAGS = {
  missing: { tone: "red", text: "Required value missing" },
  overflow: { tone: "red", text: "Doesn't fit — shorten or change" },
  shrunk: { tone: "amber", text: "Shrunk to fit" },
  format: { tone: "amber", text: "Couldn't format as date" },
  missing_span: { tone: "red", text: "Field not found in the design" },
};
const TONES = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
};

function describeFlag(flag) {
  if (flag.startsWith("glyph:")) return { tone: "amber", text: `Character not in the design font: ${Array.from(flag.slice(6)).join(", ")}` };
  return FLAGS[flag] || { tone: "amber", text: flag };
}

export default function FlagBadges({ flags, className = "" }) {
  if (!flags?.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {flags.map((f) => {
        const { tone, text } = describeFlag(f);
        return (
          <span key={f} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${TONES[tone]}`}>{f.startsWith("glyph:") ? "glyph" : f.replace("_", " ")}</span>
            {text}
          </span>
        );
      })}
    </span>
  );
}
