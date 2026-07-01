import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roles from "./pages/Roles";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Labels from "./pages/Labels";
import Certificates from "./pages/Certificates";
import Catalogs from "./pages/Catalogs";
import Users from "./pages/Users";
import Companies from "./pages/Companies";
import Account from "./pages/Account";

import ProtectedRoute from "./ui/ProtectedRoute";
import AppLayout from "./ui/AppLayout";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/roles" element={<Roles />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/products" element={<Products />} />
            <Route path="/labels" element={<Labels />} />
            <Route path="/certificates" element={<Certificates />} />
            <Route path="/catalogs" element={<Catalogs />} />
            <Route path="/users" element={<Users />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/account" element={<Account />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster 
        position="top-center" 
        gutter={12} 
        containerStyle={{ margin: "8px" }}
        toastOptions={{
          success: { duration: 3000 },
          error: { duration: 5000 },
          style: {
            fontSize: "16px",
            maxWidth: "500px",
            padding: "16px 24px",
            backgroundColor: "#fff",
            color: "#374151",
            border: "1px solid #e5e7eb"
          }
        }} 
      />
    </AuthProvider>
  );
}

export default App;
