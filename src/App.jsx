import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roles from "./pages/Roles";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Labels from "./pages/Labels";
import TemplatesList from "./pages/TemplatesList";
import Certificates from "./pages/Certificates";
import Catalogs from "./pages/Catalogs";
import Users from "./pages/Users";
import Companies from "./pages/Companies";
import Account from "./pages/Account";
import AiTemplateGenerator from "./pages/AiTemplateGenerator";
import CertificateGenerator from "./pages/CertificateGenerator";
import Brands from "./pages/Brands";

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
            <Route path="/products/catalog-upload" element={<Catalogs />} />
            <Route path="/labels" element={<Labels />} />
            <Route path="/templates" element={<TemplatesList />} />
            <Route path="/templates/editor" element={<Certificates />} />
            <Route path="/templates/ai" element={<AiTemplateGenerator />} />
            <Route path="/certificates/generate" element={<CertificateGenerator />} />
            <Route path="/users" element={<Users />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/brands" element={<Brands />} />
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
