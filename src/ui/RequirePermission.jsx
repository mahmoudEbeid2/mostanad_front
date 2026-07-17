import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequirePermission({ children, permission }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-white flex justify-center items-center">
        <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  // user.role.permissions is an array of RolePermission objects, e.g. { permission: { slug: '...' } }
  // wait, from Roles.jsx I saw: const assignedSlugs = role.permissions?.map(p => p.permission.slug) || [];
  let assignedSlugs = [];
  if (user?.role?.permissions) {
    // some queries return strings directly, let's handle both
    assignedSlugs = user.role.permissions.map(p => typeof p === 'string' ? p : p?.permission?.slug).filter(Boolean);
  }

  const hasAccess = assignedSlugs.includes(permission);

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
