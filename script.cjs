const fs = require("fs");
const path = "src/pages/LabelGenerator.jsx";
let content = fs.readFileSync(path, "utf8");
content = content.replace("navigate(\`/labels/detail/\\${newLabelId}\`);", "navigate(\`/labels/detail/${newLabelId}\`);");
fs.writeFileSync(path, content);
console.log("Fixed backslash");

