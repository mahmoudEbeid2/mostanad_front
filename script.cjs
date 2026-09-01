const fs = require("fs");
const path = "src/components/VerdictList.jsx";
let content = fs.readFileSync(path, "utf8");
content = content.replace("<p className=\"text-xs font-mono text-gray-400\">-> {action}</p>", "<p className=\"text-xs font-mono text-gray-400\">{\"->\"} {action}</p>");
fs.writeFileSync(path, content);
console.log("Fixed JSX syntax error");

