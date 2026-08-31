const fs = require("fs");
const lines = fs.readFileSync("src/pages/LabelDetail.jsx", "utf8").split("\n");
let seen = false;
const newLines = lines.filter(line => {
  if (line.includes("const [showOnlyEstimated, setShowOnlyEstimated]")) {
    if (seen) return false;
    seen = true;
  }
  return true;
});
fs.writeFileSync("src/pages/LabelDetail.jsx", newLines.join("\n"));
console.log("Fixed duplicates properly.");

