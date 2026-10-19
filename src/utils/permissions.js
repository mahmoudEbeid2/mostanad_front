// user.role.permissions is an array of RolePermission objects, e.g. { permission: { slug: '...' } },
// but some queries return the slug strings directly — handle both.
export function getPermissionSlugs(user) {
  if (!user?.role?.permissions) return [];
  return user.role.permissions
    .map((p) => (typeof p === "string" ? p : p?.permission?.slug))
    .filter(Boolean);
}

// A company account works on its own data in these modules: the API lets a
// company token through every route on them (backend authMiddleware
// COMPANY_ALLOWED_MODULES), but GET /auth/me gives it a fixed slug list that
// names none of them — so without this the routes, sidebar and buttons hid
// Certificates V2 from the very accounts it was built for.
const COMPANY_MODULES = ["certificates", "certificate_types", "certificate_templates", "invoices"];

export function hasPermission(user, slug) {
  if (user?.isCompany && COMPANY_MODULES.includes(slug.slice(slug.indexOf("_") + 1))) return true;
  return getPermissionSlugs(user).includes(slug);
}

// True only for a company-authenticated session. No login flow in this app produces
// one today (LoginForm only calls POST /auth/login, the internal-user login) — this
// exists so behavior is correct if/when a company login flow is added, not because
// it fires today.
export function isCompanyUser(user) {
  return user?.role === "company";
}
