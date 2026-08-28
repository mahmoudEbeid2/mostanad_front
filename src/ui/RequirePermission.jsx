import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";

export default function RequirePermission({ children, permission }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-white flex justify-center items-center">
        <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!hasPermission(user, permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
