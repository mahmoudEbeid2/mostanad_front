import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { getTemplateById, updateTemplate, createTemplate } from "../services/apiTemplates";
import toast from "react-hot-toast";
import { Sparkles, Save, Code, Eye, Loader2, UploadCloud, X, ArrowLeft, CheckCircle2, Settings } from "lucide-react";
import Button from "../ui/Button";
import apiClient from "../services/apiClient";
import { io } from "socket.io-client";

export default function AiTemplateGenerator() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [templateName, setTemplateName] = useState("AI Generated Template");
  const [templateType, setTemplateType] = useState("CERTIFICATE");
  const [isGlobal, setIsGlobal] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [productId, setProductId] = useState("");
  const [templateFields, setTemplateFields] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [brands, setBrands] = useState([]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [generatedTemplateId, setGeneratedTemplateId] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [htmlCode, setHtmlCode] = useState("");
  const [socketInstance, setSocketInstance] = useState(null);
  
  // For Preview Zooming
  const [zoom, setZoom] = useState(0.4);
  const previewContainerRef = useRef(null);

  useEffect(() => {
    const updateZoom = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 64;
        const containerHeight = previewContainerRef.current.clientHeight - 64;
        
        const scaleW = containerWidth / 1000;
        const scaleH = containerHeight / 1414;
        const bestScale = Math.min(scaleW, scaleH);
        
        setZoom(Math.min(Math.max(bestScale, 0.1), 1));
      }
    };
    if (step === 2) {
      setTimeout(updateZoom, 100);
      window.addEventListener("resize", updateZoom);
      return () => window.removeEventListener("resize", updateZoom);
    }
  }, [step]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const compRes = await getCompanies({ limit: 100 });
        if (compRes.status === "success") setCompanies(compRes.data.companies || []);
      } catch (err) {
        toast.error("Failed to load companies");
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedCompany) {
      setBrands([]);
      setSelectedBrand("");
      return;
    }
    const fetchBrands = async () => {
      try {
        const brandRes = await getBrands(selectedCompany);
        if (brandRes.status === "success") setBrands(brandRes.data.brands || []);
      } catch (err) {
        toast.error("Failed to load brands");
      }
    };
    fetchBrands();
  }, [selectedCompany]);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const socketUrl = API_URL.replace("/api/v1", "");
    const socket = io(socketUrl);
    setSocketInstance(socket);

    socket.on("job_status", async (data) => {
      if (data.type === "ai_template_generation") {
        if (data.status === "processing") {
          toast.loading("AI is analyzing and generating your design... Please wait.", { id: "ai-gen" });
        } else if (data.status === "completed") {
          toast.success("AI Template Generated Successfully! 🎉 Loading preview...", { id: "ai-gen", duration: 3000 });
          setIsGenerating(false);
          setCurrentTaskId(null);
          
          if (data.result?.htmlContent) {
            setHtmlCode(data.result.htmlContent);
            setTemplateFields(data.result.fields ? JSON.stringify(data.result.fields, null, 2) : "");
            setStep(2); // Move to step 2
          }
        } else if (data.status === "failed") {
          toast.error("AI Template Generation Failed. ❌ " + (data.error || ""), { id: "ai-gen" });
          setIsGenerating(false);
          setCurrentTaskId(null);
        }
      }
    });

    return () => socket.disconnect();
  }, []);

  const handleGenerateAI = async () => {
    if (!selectedFile) return toast.error("Please upload a design file first");
    if (!selectedCompany) return toast.error("Please select a company");
    if (!templateName) return toast.error("Please enter a template name");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("templateName", templateName);

    try {
      setIsGenerating(true);
      setHtmlCode("");
      setGeneratedTemplateId(null);
      toast.loading("Sending design to AI for processing...", { id: "ai-gen" });
      const res = await apiClient.post(`/companies/${selectedCompany}/templates/generate-ai`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const taskId = res.data?.data?.taskId;
      if (taskId) {
        setCurrentTaskId(taskId);
        if (socketInstance) {
          socketInstance.emit("join_job", taskId);
        }
      }
    } catch(err) {
      toast.error(err.response?.data?.message || "Failed to submit task", { id: "ai-gen" });
      setIsGenerating(false);
    }
  };

  const handleSaveChanges = async () => {
    let finalFields = null;
    if (templateFields.trim()) {
      try { finalFields = JSON.parse(templateFields); } catch(e) { return toast.error("Invalid JSON format in Fields"); }
    }

    const payload = {
      name: templateName,
      type: templateType,
      companyId: selectedCompany,
      brandId: selectedBrand || null,
      isGlobal,
      isActive,
      productId: productId || undefined,
      htmlContent: htmlCode,
      fields: finalFields || {}
    };

    try {
      setIsSaving(true);
      if (generatedTemplateId) {
        await updateTemplate(generatedTemplateId, payload);
        toast.success("Changes saved successfully!");
      } else {
        const res = await createTemplate(payload);
        if (res.status === "success" && res.data?.template?.id) {
          setGeneratedTemplateId(res.data.template.id);
        }
        toast.success("Template created successfully!");
        setTimeout(() => navigate('/templates'), 1500);
      }
    } catch(err) {
      toast.error(err.response?.data?.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = () => {
    setHtmlCode("");
    setStep(1);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm animate-in fade-in duration-500">
      
      {step === 1 && (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 block">
          <div className="max-w-4xl w-full mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-10 text-white text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-200" />
              <h1 className="text-3xl font-bold mb-2">AI Template Generator</h1>
              <p className="text-purple-100 max-w-lg mx-auto">Upload any design (PDF, PNG, JPG, or AI) and our AI will automatically convert it into a fully editable HTML template.</p>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Settings Form */}
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Template Settings</h2>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Template Name (Required)</label>
                  <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Company (Required)</label>
                  <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="">Select a company</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Brand (Optional)</label>
                  <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} disabled={!selectedCompany} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100">
                    <option value="">No Brand</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
                    <select value={templateType} onChange={(e) => setTemplateType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="CERTIFICATE">CERTIFICATE</option>
                      <option value="INVOICE">INVOICE</option>
                      <option value="REPORT">REPORT</option>
                      <option value="ID_CARD">ID_CARD</option>
                      <option value="CONTRACT">CONTRACT</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Product ID</label>
                    <input type="text" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="e.g. prod_123" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                    <span className="text-sm font-medium text-gray-700">Global Template</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              {/* File Upload Area */}
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Design File</h2>
                <div className="flex-1 border-2 border-dashed border-purple-200 rounded-2xl bg-purple-50/50 flex flex-col items-center justify-center p-8 text-center transition-colors hover:bg-purple-50 relative group min-h-[300px]">
                  {!selectedFile && (
                    <input 
                      type="file" 
                      accept=".pdf,image/*,.ai" 
                      onChange={(e) => setSelectedFile(e.target.files[0])} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                  )}
                  {selectedFile ? (
                    <div className="relative z-20 flex flex-col items-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-purple-600">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">{selectedFile.name}</h3>
                      <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedFile(null); }} className="mt-4 text-sm px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition-colors pointer-events-auto">Remove File</button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-purple-600 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">Click or drag file here</h3>
                      <p className="text-sm text-gray-500 max-w-[200px]">Supports PDF, PNG, JPG, or AI format</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-end">
              <button 
                onClick={handleGenerateAI}
                disabled={isGenerating || !selectedFile}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-all transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isGenerating ? "Generating..." : "Generate Template"}
              </button>
            </div>

          </div>
        </div>
      )}

      {step === 2 && (
        <>
          {/* Topbar for Step 2 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-20">
            <div className="flex items-center gap-4">
              <button onClick={handleReject} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors font-medium">
                <ArrowLeft className="w-5 h-5" /> Back to Settings
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h2 className="text-xl font-bold text-gray-900">{templateName}</h2>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => setIsSettingsModalOpen(true)} className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> Verify Settings
              </Button>
              <Button variant="danger" onClick={handleReject} className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 shadow-sm">
                <X className="w-4 h-4" /> Reject & Discard
              </Button>
              <Button onClick={handleSaveChanges} isLoading={isSaving} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none shadow-md">
                <CheckCircle2 className="w-4 h-4" /> Approve & Save
              </Button>
            </div>
          </div>

          {/* Main Workspace: Split View */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left: Code Editor */}
            <div className="w-1/2 flex flex-col border-r border-gray-200 bg-gray-900">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-gray-300 border-b border-gray-700">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Code className="w-4 h-4" /> HTML Code Editor
                </div>
                <div className="text-xs text-gray-500">Auto-updates Preview</div>
              </div>
              <div className="flex-1 relative">
                <textarea
                  className="absolute inset-0 w-full h-full p-4 bg-transparent text-gray-300 font-mono text-sm leading-relaxed focus:outline-none resize-none"
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  placeholder="Your generated HTML will appear here..."
                  spellCheck="false"
                />
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="w-1/2 flex flex-col bg-gray-100 relative">
              <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm z-10">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Eye className="w-4 h-4" /> Live Preview
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Zoom:</span>
                  <input 
                    type="range" 
                    min="0.1" max="1" step="0.1" 
                    value={zoom} 
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-xs font-mono w-8">{Math.round(zoom * 100)}%</span>
                </div>
              </div>

              <div ref={previewContainerRef} className="flex-1 overflow-auto p-8 relative flex justify-center items-start bg-gray-100">
                <div style={{ width: 1000 * zoom, height: 1414 * zoom, position: 'relative', flexShrink: 0 }}>
                  <div 
                    className="shadow-xl bg-white origin-top-left"
                    style={{ 
                      transform: `scale(${zoom})`,
                      width: "1000px", 
                      height: "1414px",
                      overflow: "hidden",
                      position: "absolute",
                      top: 0,
                      left: 0
                    }}
                    dangerouslySetInnerHTML={{ __html: htmlCode }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                Verify Settings & Fields
              </h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company (Required)</label>
                <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                  <option value="">Select a company</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Brand (Optional)</label>
                <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" disabled={!selectedCompany}>
                  <option value="">No Brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Template Type (Required)</label>
                <select value={templateType} onChange={(e) => setTemplateType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                  <option value="CERTIFICATE">CERTIFICATE</option>
                  <option value="INVOICE">INVOICE</option>
                  <option value="REPORT">REPORT</option>
                  <option value="ID_CARD">ID_CARD</option>
                  <option value="CONTRACT">CONTRACT</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-sm font-semibold text-gray-700">Global Template</div>
                  <div className="text-xs text-gray-500">Available across all brands</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <div className="text-sm font-semibold text-gray-700">Active Status</div>
                  <div className="text-xs text-gray-500">Is this template ready for use?</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Product ID (Optional)</label>
                <input 
                  type="text" 
                  value={productId} 
                  onChange={(e) => setProductId(e.target.value)} 
                  placeholder="e.g. prod_123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Dynamic Fields (Generated by AI)</label>
                <textarea 
                  value={templateFields} 
                  onChange={(e) => setTemplateFields(e.target.value)} 
                  placeholder='{"name": "string", "date": "date"}'
                  className="w-full px-3 py-2 border border-blue-300 bg-blue-50/30 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm h-32 resize-none"
                />
                <div className="text-xs text-blue-600 mt-1">Review these extracted fields before saving.</div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <Button onClick={() => setIsSettingsModalOpen(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
