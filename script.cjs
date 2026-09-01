const fs = require("fs");
const path = "src/components/VerdictList.jsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  `if (v.remediation?.suggested) return \`Fix \${fieldName} by using "\${v.remediation.suggested}".\`;`,
  `if (v.path === "_localized_text") return \`Fix \${fieldName} by ensuring that for each listed field, the language code specified in the "primary" property is also present as a key in the "translations" object with the corresponding text. Do not remove any existing translation keys. \${v.message}\`;\n  if (v.remediation?.suggested) return \`Fix \${fieldName} by using "\${v.remediation.suggested}".\`;`
);

fs.writeFileSync(path, content);
console.log("Patched assistantPrompt in VerdictList.jsx");

