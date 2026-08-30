const fs = require("fs");
// Fix LabelDetail.jsx
let content = fs.readFileSync("src/pages/LabelDetail.jsx", "utf8");

const badBlock = `const [assistantDraft, setAssistantDraft] = useState("");
  const [showOnlyEstimated, setShowOnlyEstimated] = useState(false);

  const handleAskAssistant = (field) => {
    setActiveTab("chat");
    setAssistantDraft(\`I need to correct the \${field.label}. \`);
  };`;

const goodBlock = `const [assistantDraft, setAssistantDraft] = useState("");
  const [showOnlyEstimated, setShowOnlyEstimated] = useState(false);`;

content = content.replace(badBlock, goodBlock);
fs.writeFileSync("src/pages/LabelDetail.jsx", content);

// Fix LabelFieldsPanel.jsx
let content2 = fs.readFileSync("src/components/LabelFieldsPanel.jsx", "utf8");
content2 = content2.replace(
  `onClick={() => onAskAssistant(field)}`,
  `onClick={() => onAskAssistant(\`I need to correct the \${field.label}. \`)}`
);
fs.writeFileSync("src/components/LabelFieldsPanel.jsx", content2);

console.log("Fixed syntax error");

