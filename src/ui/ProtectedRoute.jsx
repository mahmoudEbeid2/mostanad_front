import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-900 flex justify-center items-center">
        <span className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (isAuthenticated) return children;
}
