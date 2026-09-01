const fs = require("fs");
const path = "src/components/label-detail/ChatTab.jsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  `{m.status === "applied" && (`,
  `{(m.status === "applied" || Boolean(m.resultVersion) || Boolean(m.appliedPatch)) && (`
);

content = content.replace(
  `{getPatchDiffHtml(m.patch)}`,
  `{getPatchDiffHtml(m.appliedPatch || m.patch)}`
);

fs.writeFileSync(path, content);
console.log("Patched ChatTab.jsx for DB loaded applied messages");

