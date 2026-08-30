const fs = require("fs");
let content = fs.readFileSync("src/pages/LabelGenerator.jsx", "utf8");

// Add VerdictList import if not exists
if (!content.includes("VerdictList")) {
  content = content.replace(
    `import LabelFieldsPanel from "../components/LabelFieldsPanel";`,
    `import LabelFieldsPanel from "../components/LabelFieldsPanel";\nimport VerdictList from "../components/VerdictList";`
  );
}

const oldBanner = `{genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).
                This is a quick summary from generation; run full validation on the label detail screen for the 
field-by-field report.`;
const oldBanner2 = `{genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).
                This is a quick summary from generation; run full validation on the label detail screen for the field-by-field report.`;

const newBanner = `{genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).`;

content = content.replace(oldBanner, newBanner);
content = content.replace(oldBanner2, newBanner);
content = content.replace(`First-pass validation: {genSummary.validation.passed ? "passed" : "failed"}`, `Validation: {genSummary.validation.passed ? "passed" : "failed"}`);

const oldRender = `First-pass validation: {genSummary.validation.passed ? "passed" : "failed"} —{" "}
                {genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).
              </span>
            </div>
          )}`;

const newRender = `Validation: {genSummary.validation.passed ? "passed" : "failed"} —{" "}
                {genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).
              </span>
            </div>
            {genSummary.validation.verdicts && genSummary.validation.verdicts.length > 0 && (
              <div className="mt-4">
                <VerdictList verdicts={genSummary.validation.verdicts} />
              </div>
            )}
          </div>
          )}`;

// Let's do it more robustly:
const blockToReplace = `          {genSummary?.validation && (
            <div className={\`mb-4 text-sm px-4 py-3 rounded-xl border flex items-center gap-2 \${
              genSummary.validation.passed
                ? "text-green-800 bg-green-50 border-green-200"
                : "text-red-800 bg-red-50 border-red-200"
            }\`}>
              {genSummary.validation.passed ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
              <span>
                First-pass validation: {genSummary.validation.passed ? "passed" : "failed"} —{" "}
                {genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).
                This is a quick summary from generation; run full validation on the label detail screen for the field-by-field report.
              </span>
            </div>
          )}`;

const replacementBlock = `          {genSummary?.validation && (
            <div className="mb-4">
              <div className={\`text-sm px-4 py-3 rounded-xl border flex items-center gap-2 \${
                genSummary.validation.passed
                  ? "text-green-800 bg-green-50 border-green-200"
                  : "text-red-800 bg-red-50 border-red-200"
              }\`}>
                {genSummary.validation.passed ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                <span>
                  Validation: {genSummary.validation.passed ? "passed" : "failed"} —{" "}
                  {genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).
                </span>
              </div>
              {!genSummary.validation.passed && genSummary.validation.verdicts && (
                <div className="mt-3">
                  <VerdictList verdicts={genSummary.validation.verdicts} />
                </div>
              )}
            </div>
          )}`;

content = content.replace(blockToReplace, replacementBlock);
// Handle possible newline variations:
const regex = /First-pass validation: \{genSummary\.validation\.passed \? "passed" : "failed"\} —\{" "\}\s*\{genSummary\.validation\.errorCount\} error\(s\), \{genSummary\.validation\.warningCount\} warning\(s\)\.\s*This is a quick summary from generation; run full validation on the label detail screen for the\s*field-by-field report\./;
content = content.replace(regex, `Validation: {genSummary.validation.passed ? "passed" : "failed"} —{" "}
                {genSummary.validation.errorCount} error(s), {genSummary.validation.warningCount} warning(s).`);

fs.writeFileSync("src/pages/LabelGenerator.jsx", content);
console.log("Updated LabelGenerator.jsx");

