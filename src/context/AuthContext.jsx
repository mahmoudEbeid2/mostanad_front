import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../services/apiAuth";
import toast from "react-hot-toast";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (storedToken && storedUser) {
        try {
          // Initial fast load from local storage
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
          
          // Fetch fresh data from backend to ensure permissions are up to date
          const res = await getMe();
          if (res.status === "success") {
            setUser(res.data.user);
            localStorage.setItem("user", JSON.stringify(res.data.user));
          }
        } catch (error) {
          console.error("Session expired or failed to fetch fresh user data", error);
          // Only logout if it's a 401/403, otherwise just keep the stored user
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            logout();
          }
        }
      }
      setIsLoading(false);
    };
    
    fetchUser();
  }, []);

  const loginAuth = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setIsAuthenticated(true);
    
    localStorage.setItem("token", userToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("تم تسجيل الخروج بنجاح");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        loginAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
