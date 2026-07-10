import { useState, useEffect } from "react";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { generateCertificates, getBackgroundTaskStatus } from "../services/apiCertificates";
import { UploadCloud, FileText, CheckCircle, AlertCircle, Download, FileUp, Sparkles, Printer } from "lucide-react";
import Button from "../ui/Button";
import toast from "react-hot-toast";

export default function CertificateGenerator() {
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [formData, setFormData] = useState({
    companyId: "",
    brandId: "",
    transactionType: "shipping",
    invoiceFile: null
  });

  const [isUploading, setIsUploading] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null); // "pending", "processing", "completed", "failed"
  const [certificates, setCertificates] = useState([]);

  // Fetch Companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await getCompanies({ limit: 100 });
        if (res.status === "success") {
          setCompanies(res.data.companies || []);
        }
      } catch (error) {
        toast.error("Failed to load companies");
      }
    };
    fetchCompanies();
  }, []);

  // Fetch Brands when Company changes
  useEffect(() => {
    if (!formData.companyId) {
      setBrands([]);
      setFormData(prev => ({ ...prev, brandId: "" }));
      return;
    }
    const fetchBrandsData = async () => {
      try {
        const res = await getBrands(formData.companyId);
        if (res.status === "success") {
          setBrands(res.data.brands || []);
        }
      } catch (error) {
        console.error("Failed to fetch brands", error);
      }
    };
    fetchBrandsData();
  }, [formData.companyId]);

  // Polling for Task Status
  useEffect(() => {
    let intervalId;

    if (taskId && (taskStatus === "pending" || taskStatus === "processing" || taskStatus === null)) {
      intervalId = setInterval(async () => {
        try {
          const res = await getBackgroundTaskStatus(taskId);
          if (res.status === "success" && res.data) {
            const task = res.data;
            setTaskStatus(task.status);
            
            if (task.status === "completed") {
              if (task.result?.certificates) {
                setCertificates(task.result.certificates);
                toast.success("Certificates generated successfully!");
              }
              setTaskId(null); // stop polling
            } else if (task.status === "failed") {
              toast.error(task.error || "Certificate generation failed.");
              setTaskId(null); // stop polling
            }
          }
        } catch (error) {
          console.error("Failed to fetch task status:", error);
        }
      }, 3000); // Poll every 3 seconds
    }

    return () => clearInterval(intervalId);
  }, [taskId, taskStatus]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
        toast.error("Please upload a PDF or an Image.");
        return;
      }
      setFormData({ ...formData, invoiceFile: file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.companyId) return toast.error("Please select a company.");
    if (!formData.invoiceFile) return toast.error("Please upload an invoice.");

    const payload = new FormData();
    if (formData.brandId) payload.append("brandId", formData.brandId);
    payload.append("transactionType", formData.transactionType);
    payload.append("invoice", formData.invoiceFile);

    try {
      setIsUploading(true);
      setTaskStatus(null);
      setCertificates([]);
      const res = await generateCertificates(formData.companyId, payload);
      
      if (res.status === "accepted" && res.data?.jobId) {
        setTaskId(res.data.jobId);
        setTaskStatus("pending");
        toast.success("Invoice uploaded! Generating certificates...");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to start generation process.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadHtml = (cert) => {
    const blob = new Blob([cert.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate_${cert.productName || "Generated"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = (cert) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print/save as PDF");
      return;
    }
    
    printWindow.document.open();
    
    // Inject CSS to remove browser headers/footers (Date, URL, Page numbers)
    const printStyles = `
      <style>
        @media print {
          @page { margin: 0; size: auto; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
        }
      </style>
    `;
    
    let modifiedHtml = cert.html;
    
    // Inject styles into head if it exists, otherwise prepend
    if (modifiedHtml.includes('</head>')) {
      modifiedHtml = modifiedHtml.replace('</head>', `${printStyles}</head>`);
    } else {
      modifiedHtml = printStyles + modifiedHtml;
    }

    // Inject the print script to trigger the print dialog automatically
    if (modifiedHtml.includes('</body>')) {
      modifiedHtml = modifiedHtml.replace('</body>', `<script>window.onload = () => { setTimeout(() => { window.print(); }, 500); };</script></body>`);
    } else {
      modifiedHtml += `<script>window.onload = () => { setTimeout(() => { window.print(); }, 500); };</script>`;
    }
      
    printWindow.document.write(modifiedHtml);
    printWindow.document.close();
  };

  const handleReset = () => {
    setTaskId(null);
    setTaskStatus(null);
    setCertificates([]);
    setFormData({ ...formData, invoiceFile: null });
  };

  const isGeneratingOrDone = !!taskId || certificates.length > 0;

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>

      {!isGeneratingOrDone ? (
        /* ================= STEP 1: UPLOAD FORM ================= */
        <div className="max-w-3xl mx-auto mt-8">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl mb-5 shadow-sm">
              <FileText className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
              AI Certificate Generator
            </h1>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">Upload your invoice, and our AI will instantly extract product data to generate matching, high-quality certificates.</p>
          </div>

          <div className="bg-white/80 p-10 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
              <UploadCloud className="w-6 h-6 text-indigo-500" />
              Upload Details
            </h2>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Target Company <span className="text-red-500">*</span></label>
                  <select
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-gray-700 font-medium"
                    required
                    disabled={isUploading}
                  >
                    <option value="" disabled>Select Company...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Brand <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <select
                    value={formData.brandId}
                    onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                    className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-gray-700 font-medium disabled:bg-gray-100 disabled:opacity-60"
                    disabled={!formData.companyId || brands.length === 0 || isUploading}
                  >
                    <option value="">No Brand</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Transaction Type <span className="text-red-500">*</span></label>
                <select
                  value={formData.transactionType}
                  onChange={(e) => setFormData({ ...formData, transactionType: e.target.value })}
                  className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-gray-700 font-medium"
                  disabled={isUploading}
                >
                  <option value="shipping">Shipping</option>
                  <option value="registration">Registration</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Invoice Document <span className="text-red-500">*</span></label>
                <label htmlFor="file-upload" className={`mt-2 flex justify-center px-6 pt-10 pb-10 border-2 border-dashed rounded-3xl cursor-pointer group transition-all duration-300 ${
                  formData.invoiceFile 
                    ? 'border-indigo-400 bg-indigo-50/50 shadow-inner' 
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 bg-gray-50/50'
                } relative block w-full`}>
                  <div className="space-y-3 text-center">
                    {formData.invoiceFile ? (
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-4">
                        <FileUp className="h-10 w-10 text-indigo-500" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300">
                        <UploadCloud className="h-10 w-10 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    )}
                    <div className="flex text-base text-gray-600 justify-center">
                      <span className="font-semibold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                        {formData.invoiceFile ? "Change file" : "Click to upload your invoice"}
                      </span>
                      <input 
                        id="file-upload" 
                        name="file-upload" 
                        type="file" 
                        className="sr-only" 
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        disabled={isUploading}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2 font-medium">
                      {formData.invoiceFile ? formData.invoiceFile.name : "PDF or Image up to 10MB"}
                    </p>
                  </div>
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-4 rounded-2xl shadow-xl shadow-indigo-200 font-bold text-lg tracking-wide transition-all hover:-translate-y-1 active:translate-y-0"
                isLoading={isUploading}
              >
                Generate Certificates
              </Button>
            </form>
          </div>
        </div>
      ) : (
        /* ================= STEP 2: STATUS & RESULTS ================= */
        <div className="max-w-5xl mx-auto mt-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Generation Progress</h2>
            <Button variant="secondary" onClick={handleReset} className="text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-5 py-2 font-semibold">
              ← Upload Another
            </Button>
          </div>

          {/* Premium Status Tracker */}
          {taskId && (
            <div className={`p-10 rounded-[2rem] border transition-all duration-700 relative overflow-hidden ${
              taskStatus === 'completed' ? 'bg-green-50/80 border-green-200 shadow-[0_8px_30px_rgba(34,197,94,0.12)]' :
              taskStatus === 'failed' ? 'bg-red-50/80 border-red-200 shadow-[0_8px_30px_rgba(239,68,68,0.12)]' :
              'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200/60 shadow-[0_8px_30px_rgba(99,102,241,0.15)]'
            }`}>
              
              {/* Shimmer Effect */}
              {(taskStatus === "pending" || taskStatus === "processing") && (
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent pointer-events-none" style={{ animation: 'shimmer 2s infinite' }}></div>
              )}
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-5">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-500 ${
                  taskStatus === 'completed' ? 'bg-green-100 text-green-600' :
                  taskStatus === 'failed' ? 'bg-red-100 text-red-600' :
                  'bg-white text-indigo-600 shadow-lg shadow-indigo-100/50 animate-pulse'
                }`}>
                  {taskStatus === 'completed' ? <CheckCircle className="w-10 h-10" /> :
                   taskStatus === 'failed' ? <AlertCircle className="w-10 h-10" /> :
                   <Sparkles className="w-10 h-10 animate-[spin_4s_linear_infinite]" />}
                </div>

                <div>
                  <h3 className={`text-3xl font-extrabold tracking-tight mb-2 ${
                    taskStatus === 'completed' ? 'text-green-800' :
                    taskStatus === 'failed' ? 'text-red-800' :
                    'bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700'
                  }`}>
                    {taskStatus === "completed" ? "Certificates Ready!" :
                     taskStatus === "failed" ? "Generation Failed" :
                     "AI is Generating..."}
                  </h3>
                  <p className={`text-lg font-medium leading-relaxed max-w-lg mx-auto ${
                    taskStatus === 'completed' ? 'text-green-600/90' :
                    taskStatus === 'failed' ? 'text-red-600/90' :
                    'text-indigo-600/80'
                  }`}>
                    {taskStatus === "processing" ? "Analyzing your invoice data and crafting matching templates in the background..." : 
                     taskStatus === "completed" ? "All certificates have been successfully rendered and are ready to download." : 
                     taskStatus === "failed" ? "We encountered an issue analyzing this document. Please try again." : 
                     "Waiting for AI worker to start..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Results Area */}
          {certificates.length > 0 && (
            <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden mt-8">
              <div className="px-10 py-8 border-b border-gray-50 bg-white/50 backdrop-blur-md flex justify-between items-center sticky top-0 z-20">
                <h2 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  Generated Certificates <span className="text-gray-400 font-medium">({certificates.length})</span>
                </h2>
              </div>
              <div className="p-10 space-y-12 bg-[#fbfbfc]">
                {certificates.map((cert, index) => (
                  <div key={index} className="border border-gray-100 rounded-[2rem] overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group">
                    <div className="px-10 py-6 border-b border-gray-50 bg-white flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <span className="font-extrabold text-gray-900 text-2xl tracking-tight">{cert.productId || `Certificate #${index + 1}`}</span>
                        <span className="text-sm font-bold text-indigo-600 bg-indigo-50/50 px-4 py-1.5 rounded-full border border-indigo-100/50">{cert.templateName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          size="md" 
                          variant="secondary" 
                          onClick={() => handlePrint(cert)}
                          className="text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100 font-semibold transition-all rounded-xl px-5 py-2.5"
                        >
                          <Printer className="w-5 h-5 mr-2" />
                          Print / PDF
                        </Button>
                        <Button 
                          size="md" 
                          variant="secondary" 
                          onClick={() => handleDownloadHtml(cert)}
                          className="text-indigo-600 bg-indigo-50/50 border-transparent hover:bg-indigo-100 hover:border-indigo-200 font-semibold transition-all rounded-xl px-5 py-2.5"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Save HTML
                        </Button>
                      </div>
                    </div>
                    {/* Live Preview Wrapper */}
                    <div className="w-full flex justify-center bg-gray-50 p-12 overflow-x-auto border-t border-gray-50 group-hover:bg-indigo-50/10 transition-colors relative">
                      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
                      <div 
                        className="shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-white origin-top rounded-xl border border-gray-200/50 relative z-10"
                        style={{ transform: "scale(0.55)", transformOrigin: "top center", marginBottom: "-600px" }}
                        dangerouslySetInnerHTML={{ __html: cert.html }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
