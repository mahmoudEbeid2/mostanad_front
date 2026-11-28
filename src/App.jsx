import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

import Login from "./pages/Login";
import Home from "./pages/Home";
import AdminOverview from "./pages/AdminOverview";
import Assistant from "./pages/Assistant";
import Intake from "./pages/Intake";
import Roles from "./pages/Roles";
import Categories from "./pages/Categories";
import Products from "./pages/Products";
import Labels from "./pages/Labels";
import LabelsList from "./pages/LabelsList";
import LabelDetail from "./pages/LabelDetail";
import LabelGenerator from "./pages/LabelGenerator";
import Catalogs from "./pages/Catalogs";
import ProductImport from "./pages/ProductImport";
import ExpressReview from "./pages/ExpressReview";
import Catalogues from "./pages/Catalogues";
import CatalogueVersion from "./pages/CatalogueVersion";
import CatalogueReview from "./pages/CatalogueReview";
import CataloguePages from "./pages/CataloguePages";
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
import NumberingAndTypes from "./pages/NumberingAndTypes";
import Uploads from "./pages/Uploads";
import ProductPage from "./pages/ProductPage";
import AiUsage from "./pages/AiUsage";
import SystemHealth from "./pages/SystemHealth";
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
import CertificateRequest from "./pages/CertificateRequest";
import CertificateRequests from "./pages/CertificateRequests";
import AdminExperiment from "./pages/AdminExperiment";
import { ProductConflicts } from "./pages/Placeholders";

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
            <Route path="/assistant" element={<Assistant />} />
            {/* "ارفع ملفاتك": drop any files, recognised and filed on one card */}
            <Route path="/intake" element={<RequirePermission permission="read_products"><Intake /></RequirePermission>} />
            <Route path="/intake/:batchId" element={<RequirePermission permission="read_products"><Intake /></RequirePermission>} />
            <Route path="/dashboard" element={<Home />} />
            <Route path="/roles" element={<Navigate to="/admin/roles" replace />} />
            <Route path="/categories" element={<RequirePermission permission="read_categories"><Categories /></RequirePermission>} />
            <Route path="/products" element={<RequirePermission permission="read_products"><Products /></RequirePermission>} />
            {/* UI plan, Phase D: "Urgent orders" retired — its content is the "needs review" filter on Requests */}
            <Route path="/express" element={<Navigate to="/certificates/requests?filter=review" replace />} />
            <Route path="/express/items" element={<RequirePermission permission="read_products"><ExpressReview /></RequirePermission>} />
            <Route path="/uploads" element={<RequirePermission permission="read_products"><Uploads /></RequirePermission>} />
            <Route path="/products/:id" element={<RequirePermission permission="read_products"><ProductPage /></RequirePermission>} />
            <Route path="/products/conflicts" element={<RequirePermission permission="read_products"><ProductConflicts /></RequirePermission>} />
            <Route path="/products/import" element={<RequirePermission permission="create_products"><ProductImport /></RequirePermission>} />
            <Route path="/products/import/:id" element={<RequirePermission permission="read_products"><ProductImport /></RequirePermission>} />
            <Route path="/products/catalog-upload" element={<RequirePermission permission="create_products"><Catalogs /></RequirePermission>} />
            {/* Product catalogues as source documents (backend plan.md §15, A6) */}
            <Route path="/catalogues" element={<RequirePermission permission="read_products"><Catalogues /></RequirePermission>} />
            <Route path="/catalogues/versions/:id" element={<RequirePermission permission="read_products"><CatalogueVersion /></RequirePermission>} />
            <Route path="/catalogues/versions/:id/pages" element={<RequirePermission permission="read_products"><CataloguePages /></RequirePermission>} />
            <Route path="/catalogues/versions/:id/review" element={<RequirePermission permission="read_products"><CatalogueReview /></RequirePermission>} />
            <Route path="/labels" element={<Labels />} />
            <Route path="/labels/browse" element={<RequirePermission permission="read_labels"><LabelsList /></RequirePermission>} />
            <Route path="/labels/detail/:id" element={<RequirePermission permission="read_labels"><LabelDetail /></RequirePermission>} />
            <Route path="/labels/generator" element={<LabelGenerator />} />
            {/* Certificates V2 (CERTIFICATES_V2_PLAN.md §13.1) */}
            <Route path="/certificates/types" element={<Navigate to="/certificates/numbering" replace />} />
            <Route path="/certificates/numbering" element={<RequirePermission permission="read_certificate_types"><NumberingAndTypes /></RequirePermission>} />
            <Route path="/certificates/templates" element={<RequirePermission permission="read_certificate_templates"><CertificateTemplates /></RequirePermission>} />
            <Route path="/certificates/templates/new" element={<RequirePermission permission="create_certificate_templates"><CertificateTemplateWizard /></RequirePermission>} />
            <Route path="/certificates/templates/:templateId" element={<RequirePermission permission="read_certificate_templates"><CertificateTemplateWizard /></RequirePermission>} />
            <Route path="/certificates/templates/:templateId/versions/:versionId" element={<RequirePermission permission="update_certificate_templates"><CertificateTemplateWizard /></RequirePermission>} />
            <Route path="/invoices" element={<RequirePermission permission="read_invoices"><Invoices /></RequirePermission>} />
            <Route path="/invoices/new" element={<RequirePermission permission="read_invoices"><Invoices /></RequirePermission>} />
            <Route path="/invoices/:id" element={<RequirePermission permission="read_invoices"><InvoiceReview /></RequirePermission>} />
            <Route path="/certificate-ai" element={<Navigate to="/admin/certificate-ai" replace />} />
            <Route path="/certificates/requests" element={<RequirePermission permission="read_certificates"><CertificateRequests /></RequirePermission>} />
            <Route path="/certificates/requests/new" element={<RequirePermission permission="create_certificates"><CertificateRequest /></RequirePermission>} />
            <Route path="/certificates/requests/:id" element={<RequirePermission permission="read_certificates"><CertificateRequest /></RequirePermission>} />
            <Route path="/certificates" element={<RequirePermission permission="read_certificates"><CertificatesList /></RequirePermission>} />
            <Route path="/certificates/:id" element={<RequirePermission permission="read_certificates"><CertificateEditor /></RequirePermission>} />
            <Route path="/users" element={<Navigate to="/admin/users" replace />} />
            <Route path="/companies" element={<RequirePermission permission="read_companies"><Companies /></RequirePermission>} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/regulatory-documents" element={<RequirePermission permission="read_eda_requirements"><RegulatoryDocuments /></RequirePermission>} />
            <Route path="/eda-requirements" element={<RequirePermission permission="read_eda_requirements"><EdaRequirements /></RequirePermission>} />
            <Route path="/reference-labels" element={<RequirePermission permission="read_eda_requirements"><ReferenceLabels /></RequirePermission>} />
            <Route path="/processing/:jobId" element={<Processing />} />
            <Route path="/processing-bulk" element={<BulkProcessing />} />
            <Route path="/account" element={<Account />} />
            {/* Admin (owner / super-admin), UI plan Phase D */}
            <Route path="/admin" element={<RequirePermission permission="read_users"><AdminOverview /></RequirePermission>} />
            <Route path="/admin/users" element={<RequirePermission permission="read_users"><Users /></RequirePermission>} />
            <Route path="/admin/roles" element={<RequirePermission permission="read_roles"><Roles /></RequirePermission>} />
            <Route path="/admin/experiment" element={<RequirePermission permission="read_users"><AdminExperiment /></RequirePermission>} />
            <Route path="/admin/ai-usage" element={<RequirePermission permission="read_users"><AiUsage /></RequirePermission>} />
            <Route path="/admin/health" element={<RequirePermission permission="read_users"><SystemHealth /></RequirePermission>} />
            <Route path="/admin/certificate-ai" element={<RequirePermission permission="read_certificate_templates"><CertificateAi /></RequirePermission>} />
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
