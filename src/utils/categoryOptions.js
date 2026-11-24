// Categories for a picker: the main ones first (sortOrder: Feed Additives,
// Supplement, Injection, Antibiotic, Premix), each followed by the categories
// under it, indented; then any category not under a main one, by name.
// → [{ id, name, label, depth, isMain }]
export function categoryOptions(categories = []) {
  const byParent = new Map();
  for (const c of categories) if (c.parentId) byParent.set(c.parentId, [...(byParent.get(c.parentId) || []), c]);
  const byName = (a, b) => a.name.localeCompare(b.name);
  const mains = categories.filter((c) => c.sortOrder !== null && c.sortOrder !== undefined && !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder || byName(a, b));
  const out = [];
  const seen = new Set();
  const push = (c, depth) => {
    seen.add(c.id);
    out.push({ id: c.id, name: c.name, label: `${depth ? "   — " : ""}${c.name}`, depth, isMain: depth === 0 && mains.includes(c) });
  };
  for (const m of mains) {
    push(m, 0);
    (byParent.get(m.id) || []).sort(byName).forEach((c) => push(c, 1));
  }
  const rest = categories.filter((c) => !seen.has(c.id) && !(c.parentId && categories.some((p) => p.id === c.parentId && seen.has(p.id))));
  for (const c of rest.sort(byName)) {
    if (seen.has(c.id)) continue;
    push(c, c.parentId && categories.some((p) => p.id === c.parentId) ? 1 : 0);
    (byParent.get(c.id) || []).sort(byName).forEach((k) => !seen.has(k.id) && push(k, 1));
  }
  return out;
}
