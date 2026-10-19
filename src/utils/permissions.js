// user.role.permissions is an array of RolePermission objects, e.g. { permission: { slug: '...' } },
// but some queries return the slug strings directly — handle both.
export function getPermissionSlugs(user) {
  if (!user?.role?.permissions) return [];
  return user.role.permissions
    .map((p) => (typeof p === "string" ? p : p?.permission?.slug))
    .filter(Boolean);
}

// GET /auth/me lists exactly the slugs the API grants — for a company account
// too (its effective permissions on the company-allowed modules), so there is
// no company special case here.
export function hasPermission(user, slug) {
  return getPermissionSlugs(user).includes(slug);
}

// True only for a company-authenticated session. No login flow in this app produces
// one today (LoginForm only calls POST /auth/login, the internal-user login) — this
// exists so behavior is correct if/when a company login flow is added, not because
// it fires today.
export function isCompanyUser(user) {
  return user?.role === "company";
}
