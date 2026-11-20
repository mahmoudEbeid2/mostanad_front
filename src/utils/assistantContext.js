// The page the assistant was opened from (/assistant?from=<type>:<id>) and the
// routes of the entities an answer links to.

const UUID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
const FROM_ROUTES = [
  ["invoice", new RegExp(`^/invoices/${UUID}`, "i")],
  ["template", new RegExp(`^/certificates/templates/${UUID}`, "i")],
  ["certificate", new RegExp(`^/certificates/${UUID}`, "i")],
  ["label", new RegExp(`^/labels/detail/${UUID}`, "i")],
  ["catalogue", new RegExp(`^/catalogues/versions/${UUID}`, "i")],
];
export const FROM_TYPES = ["invoice", "product", "certificate", "catalogue", "template", "label"];

/** "<type>:<id>" for the page at this location, or null. */
export function fromOf(pathname, search = "") {
  for (const [type, re] of FROM_ROUTES) {
    const id = re.exec(pathname)?.[1];
    if (id) return `${type}:${id}`;
  }
  const productId = new URLSearchParams(search).get("productId");
  if (pathname.startsWith("/products") && productId && new RegExp(`^${UUID}$`, "i").test(productId)) return `product:${productId}`;
  return null;
}

/** "invoice:<id>" → { type, id } or null. */
export function parseFrom(from) {
  const m = new RegExp(`^([a-z]+):${UUID}$`, "i").exec(from || "");
  return m && FROM_TYPES.includes(m[1]) ? { type: m[1], id: m[2] } : null;
}

/** The route of an entity, for "Back to …" and answer links. */
export function entityRoute(type, id) {
  switch (type) {
    case "invoice":
      return `/invoices/${id}`;
    case "certificate":
      return `/certificates/${id}`;
    case "template":
      return `/certificates/templates/${id}`;
    case "label":
      return `/labels/detail/${id}`;
    case "product":
      return `/products?productId=${id}`;
    case "catalogue":
      return `/catalogues/versions/${id}`; // opened from a catalogue edition page
    case "company":
      return "/companies";
    default:
      return null;
  }
}

/** The page context sent with a message. A catalogue page is a catalogue edition. */
export const pageOf = (ctx) => (ctx ? { route: entityRoute(ctx.type, ctx.id), entityType: ctx.type === "catalogue" ? "catalogue_version" : ctx.type, entityId: ctx.id } : { route: "/assistant" });

export const isArabic = (s) => /[؀-ۿ]/.test(String(s || ""));
