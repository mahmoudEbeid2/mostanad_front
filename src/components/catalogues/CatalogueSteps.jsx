import { Check } from "lucide-react";

// The catalogue upload flow (design C1): Upload → Choose pages → Extract products → Review & apply.
const STEPS = ["Upload", "Choose pages", "Extract products", "Review & apply"];

/** current: 1-based step; earlier steps show a check */
export default function CatalogueSteps({ current }) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap items-center gap-2 text-sm" data-testid="catalogue-steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const now = n === current;
        return (
          <li
            key={label}
            aria-current={now ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${now ? "bg-blue-600 text-white" : done ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}
          >
            {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <span aria-hidden="true">{n}</span>}
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
