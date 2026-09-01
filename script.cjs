const fs = require("fs");
const path = "src/components/LabelFieldsPanel.jsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(
  `{isEstimated && onAskAssistant && (
            <IconButton tone="purple" title="Ask assistant to fix this" onClick={() => onAskAssistant(\`I need to correct the \${field.label}. \`)}>
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </IconButton>
          )}`,
  `{onAskAssistant && (
            <IconButton tone="purple" title="Ask assistant to review/edit this" onClick={() => onAskAssistant(\`Please help me update or complete the \${field.label} field.\`)}>
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </IconButton>
          )}`
);

content = content.replace(
  `{isTitleEstimated && onAskAssistant && (
              <IconButton tone="purple" title="Ask assistant to fix this" onClick={() => onAskAssistant(\`I need to correct the \${titleField.label}. \`)}>
                <MessageSquarePlus className="w-3.5 h-3.5" />
              </IconButton>
            )}`,
  `{onAskAssistant && (
              <IconButton tone="purple" title="Ask assistant to review/edit this" onClick={() => onAskAssistant(\`Please help me update or complete the \${titleField.label} field.\`)}>
                <MessageSquarePlus className="w-3.5 h-3.5" />
              </IconButton>
            )}`
);

fs.writeFileSync(path, content);
console.log("Patched LabelFieldsPanel.jsx to enable Ask Assistant for all fields");

