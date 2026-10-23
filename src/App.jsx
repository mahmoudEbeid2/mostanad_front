import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Roles from "./pages/Roles";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Labels from "./pages/Labels";
import LabelsList from "./pages/LabelsList";
import LabelDetail from "./pages/LabelDetail";
import LabelGenerator from "./pages/LabelGenerator";
import Catalogs from "./pages/Catalogs";
import Catalogues from "./pages/Catalogues";
import CatalogueVersion from "./pages/CatalogueVersion";
import Users from "./pages/Users";
import Companies from "./pages/Companies";
import Account from "./pages/Account";
import Processing from "./pages/Processing";
import BulkProcessing from "./pages/BulkProcessing";
import Brands from "./pages/Brands";
import EdaRequirements from "./pages/EdaRequirements";
import RegulatoryDocuments from "./pages/RegulatoryDocuments";
import ReferenceLabels from "./pages/ReferenceLabels";
import CertificateTypes from "./pages/CertificateTypes";
import CertificateTemplates from "./pages/CertificateTemplates";
import CertificateTemplateWizard from "./pages/CertificateTemplateWizard";
import Invoices from "./pages/Invoices";
import InvoiceReview from "./pages/InvoiceReview";
import CertificateAi from "./pages/CertificateAi";
import CertificatesList from "./pages/CertificatesList";
import CertificateEditor from "./pages/CertificateEditor";

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
            {/* Product catalogues as source documents (backend plan.md §15, A6) */}
            <Route path="/catalogues" element={<RequirePermission permission="read_products"><Catalogues /></RequirePermission>} />
            <Route path="/catalogues/versions/:id" element={<RequirePermission permission="read_products"><CatalogueVersion /></RequirePermission>} />
            <Route path="/labels" element={<Labels />} />
            <Route path="/labels/browse" element={<RequirePermission permission="read_labels"><LabelsList /></RequirePermission>} />
            <Route path="/labels/detail/:id" element={<RequirePermission permission="read_labels"><LabelDetail /></RequirePermission>} />
            <Route path="/labels/generator" element={<LabelGenerator />} />
            {/* Certificates V2 (CERTIFICATES_V2_PLAN.md §13.1) */}
            <Route path="/certificates/types" element={<RequirePermission permission="read_certificate_types"><CertificateTypes /></RequirePermission>} />
            <Route path="/certificates/templates" element={<RequirePermission permission="read_certificate_templates"><CertificateTemplates /></RequirePermission>} />
            <Route path="/certificates/templates/new" element={<RequirePermission permission="create_certificate_templates"><CertificateTemplateWizard /></RequirePermission>} />
            <Route path="/certificates/templates/:templateId" element={<RequirePermission permission="read_certificate_templates"><CertificateTemplateWizard /></RequirePermission>} />
            <Route path="/certificates/templates/:templateId/versions/:versionId" element={<RequirePermission permission="update_certificate_templates"><CertificateTemplateWizard /></RequirePermission>} />
            <Route path="/invoices" element={<RequirePermission permission="read_invoices"><Invoices /></RequirePermission>} />
            <Route path="/invoices/new" element={<RequirePermission permission="read_invoices"><Invoices /></RequirePermission>} />
            <Route path="/invoices/:id" element={<RequirePermission permission="read_invoices"><InvoiceReview /></RequirePermission>} />
            <Route path="/certificate-ai" element={<RequirePermission permission="read_certificate_templates"><CertificateAi /></RequirePermission>} />
            <Route path="/certificates" element={<RequirePermission permission="read_certificates"><CertificatesList /></RequirePermission>} />
            <Route path="/certificates/:id" element={<RequirePermission permission="read_certificates"><CertificateEditor /></RequirePermission>} />
            <Route path="/users" element={<RequirePermission permission="read_users"><Users /></RequirePermission>} />
            <Route path="/companies" element={<RequirePermission permission="read_companies"><Companies /></RequirePermission>} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/regulatory-documents" element={<RequirePermission permission="read_eda_requirements"><RegulatoryDocuments /></RequirePermission>} />
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
