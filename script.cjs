const fs = require("fs");
const path = "src/components/VerdictList.jsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  `const fieldName = field?.label || v.label?.en || v.path || "this field";`,
  `const isVirtualPath = v.path?.startsWith("_");\n  const fieldName = field?.label || v.label?.en || (isVirtualPath ? "the label" : v.path) || "this field";`
);

fs.writeFileSync(path, content);
console.log("Fixed assistantPrompt in VerdictList.jsx");

