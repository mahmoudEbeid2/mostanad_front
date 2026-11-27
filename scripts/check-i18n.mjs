// i18n check (UI plan, Phase A §4) — run by `npm run lint:i18n` and in CI. Fails on:
//   1. text written in JSX (<p>Save</p>) or in a UI attribute (placeholder="…", title, aria-label, alt, label)
//   2. Arabic in any string or template literal outside the locale files
//   3. t("ns.key") / strings("ns") naming a key that isn't in en.json
//   4. an English key with no Arabic (ar.json), unless the English is a technical token (PDF, ZIP, COA…)
// Not UI text, so allowed: numbers, punctuation, symbols, and the tokens in ALLOWED below. A line can opt out
// with `// i18n-ignore` (data shown as is, e.g. a language's own name «العربية» in the switch).
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";

const traverse = _traverse.default ?? _traverse;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const SRC = path.join(ROOT, "src");
const LOC = path.join(SRC, "i18n", "locales");
const en = JSON.parse(fs.readFileSync(path.join(LOC, "en.json"), "utf8"));
const ar = JSON.parse(fs.readFileSync(path.join(LOC, "ar.json"), "utf8"));

const AR = /[؀-ۿ]/;
const LETTER = /\p{L}/u;
// technical identifiers and units that are the same in both languages
const ALLOWED = new Set(["PDF", "ZIP", "COA", "COC", "HC", "FSC", "COO", "AI", "MB", "pH", "GTIN", "TSV", "CSV", "HTML", "Ctrl", "Ctrl K", "Esc", "Enter", "Shift+Enter", "v", "L", "Dossira", "EDA", "SFDA", "ID", "URL", "UTC", "ms", "s", "x", "×", "N/A"]);
const UI_ATTRS = new Set(["placeholder", "title", "aria-label", "alt", "label", "aria-description"]);
const allowed = (s) => {
  const x = s.replace(/\{\w+\}/g, "").trim();
  if (!LETTER.test(x)) return true;
  if (ALLOWED.has(x)) return true;
  // code-like: {{item.batchNo}}, product.name, snake_case lists, URLs
  if (/\{\{|^https?:\/\//.test(x) || /^[a-z]+(\.[a-zA-Z]+)+$/.test(x) || /^[a-z]+(_[a-z]+)+(, [a-z_]+)*$/.test(x)) return true;
  // only allowed tokens + punctuation/numbers
  return x.split(/[\s·,()/:+\-–—.%#]+/).filter(Boolean).every((w) => ALLOWED.has(w) || !LETTER.test(w));
};

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (p !== path.join(SRC, "i18n")) walk(p);
    } else if (/\.(jsx?|mjs)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) files.push(p);
  }
};
walk(SRC);

const problems = [];
const lookup = (obj, key) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const keyExists = (key) => {
  const v = lookup(en, key);
  if (v !== undefined) return true;
  return ["zero", "one", "two", "few", "many", "other"].some((f) => lookup(en, `${key}_${f}`) !== undefined);
};

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  const ignored = (line) => /i18n-ignore/.test(lines[line - 1] || "") || /i18n-ignore-next-line/.test(lines[line - 2] || "");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const report = (node, msg) => {
    const line = node.loc.start.line;
    if (!ignored(line)) problems.push(`${rel}:${line}  ${msg}`);
  };
  let ast;
  try {
    ast = parse(src, { sourceType: "module", plugins: ["jsx"] });
  } catch (e) {
    problems.push(`${rel}  parse error: ${e.message}`);
    continue;
  }
  traverse(ast, {
    JSXText(p) {
      const v = p.node.value.replace(/\s+/g, " ").trim();
      if (v && !allowed(v)) report(p.node, `text in JSX: "${v.slice(0, 60)}"`);
    },
    JSXAttribute(p) {
      const name = typeof p.node.name.name === "string" ? p.node.name.name : "";
      const v = p.node.value;
      if (v?.type === "StringLiteral" && UI_ATTRS.has(name) && !allowed(v.value)) report(v, `text in ${name}="${v.value.slice(0, 60)}"`);
    },
    StringLiteral(p) {
      if (AR.test(p.node.value) && !p.parentPath.isImportDeclaration()) report(p.node, `Arabic literal: "${p.node.value.slice(0, 50)}"`);
    },
    TemplateLiteral(p) {
      const raw = p.node.quasis.map((q) => q.value.cooked).join("");
      if (AR.test(raw)) report(p.node, `Arabic template: \`${raw.slice(0, 50)}\``);
    },
    CallExpression(p) {
      const c = p.node.callee;
      const a = p.node.arguments[0];
      if (c.type !== "Identifier" || a?.type !== "StringLiteral") return;
      if (c.name === "t" && p.scope.getBinding("t")?.kind === "module" && !keyExists(a.value)) report(a, `missing key t("${a.value}")`);
      if (c.name === "strings" && typeof lookup(en, a.value) !== "object") report(a, `missing namespace strings("${a.value}")`);
    },
  });
}

// every English string has its Arabic
const flat = (o, pre = "", out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object") flat(v, `${pre}${k}.`, out);
    else out[`${pre}${k}`] = v;
  }
  return out;
};
const fen = flat(en);
const far = flat(ar);
const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, "");
for (const [k, v] of Object.entries(fen)) {
  if (far[k] !== undefined || allowed(v)) continue;
  if (/_(zero|one|two|few|many)$/.test(k) && far[`${base(k)}_other`] !== undefined) continue; // Arabic: _other covers it
  problems.push(`ar.json  no Arabic for ${k}: "${String(v).slice(0, 60)}"`);
}
for (const [k, v] of Object.entries(far)) if (fen[k] === undefined && fen[`${base(k)}_other`] === undefined) problems.push(`ar.json  key not in en.json: ${k}`);
for (const [k, v] of Object.entries(fen)) if (typeof v === "string" && AR.test(v)) problems.push(`en.json  Arabic in English: ${k}`);

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n✗ i18n: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`✓ i18n: ${files.length} files, ${Object.keys(fen).length} strings, no hard-coded UI text`);
