import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roles from "./pages/Roles";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Labels from "./pages/Labels";
import LabelGenerator from "./pages/LabelGenerator";
import TemplatesList from "./pages/TemplatesList";
import Certificates from "./pages/Certificates";
import Catalogs from "./pages/Catalogs";
import Users from "./pages/Users";
import Companies from "./pages/Companies";
import Account from "./pages/Account";
import AiTemplateGenerator from "./pages/AiTemplateGenerator";
import CertificateGenerator from "./pages/CertificateGenerator";
import Processing from "./pages/Processing";
import BulkProcessing from "./pages/BulkProcessing";
import Brands from "./pages/Brands";
import EdaRequirements from "./pages/EdaRequirements";
import ReferenceLabels from "./pages/ReferenceLabels";

import ProtectedRoute from "./ui/ProtectedRoute";
import AppLayout from "./ui/AppLayout";
import RequirePermission from "./ui/RequirePermission";

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
            <Route path="/dashboard" element={<RequirePermission permission="read_dashboard"><Dashboard /></RequirePermission>} />
            <Route path="/roles" element={<RequirePermission permission="read_roles"><Roles /></RequirePermission>} />
            <Route path="/categories" element={<RequirePermission permission="read_categories"><Categories /></RequirePermission>} />
            <Route path="/products" element={<RequirePermission permission="read_products"><Products /></RequirePermission>} />
            <Route path="/products/catalog-upload" element={<RequirePermission permission="create_products"><Catalogs /></RequirePermission>} />
            <Route path="/labels" element={<Labels />} />
            <Route path="/labels/generator" element={<LabelGenerator />} />
            <Route path="/templates" element={<RequirePermission permission="read_templates"><TemplatesList /></RequirePermission>} />
            <Route path="/templates/editor" element={<RequirePermission permission="update_templates"><Certificates /></RequirePermission>} />
            <Route path="/templates/ai" element={<RequirePermission permission="create_templates"><AiTemplateGenerator /></RequirePermission>} />
            <Route path="/certificates/generate" element={<RequirePermission permission="create_certificates"><CertificateGenerator /></RequirePermission>} />
            <Route path="/users" element={<RequirePermission permission="read_users"><Users /></RequirePermission>} />
            <Route path="/companies" element={<RequirePermission permission="read_companies"><Companies /></RequirePermission>} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/eda-requirements" element={<RequirePermission permission="read_eda_requirements"><EdaRequirements /></RequirePermission>} />
            <Route path="/reference-labels" element={<RequirePermission permission="read_eda_requirements"><ReferenceLabels /></RequirePermission>} />
            <Route path="/processing/:jobId" element={<Processing />} />
            <Route path="/processing-bulk" element={<BulkProcessing />} />
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
