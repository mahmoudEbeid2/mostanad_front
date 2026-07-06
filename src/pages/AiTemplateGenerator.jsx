import { useState, useEffect } from "react";
import { getCompanies } from "../services/apiCompanies";
import { getTemplateById, updateTemplate } from "../services/apiTemplates";
import toast from "react-hot-toast";
import { Sparkles, Save, Code, Eye, Loader2 } from "lucide-react";
import Button from "../ui/Button";
import apiClient from "../services/apiClient";
import { io } from "socket.io-client";

export default function AiTemplateGenerator() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [templateName, setTemplateName] = useState("AI Generated Template");

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [generatedTemplateId, setGeneratedTemplateId] = useState(null);
  const [htmlCode, setHtmlCode] = useState("");
  
  // For Preview Zooming
  const [zoom, setZoom] = useState(0.4); // Scale to fit screen

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
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const socketUrl = API_URL.replace("/api/v1", "");
    const socket = io(socketUrl);

    socket.on("job_status_update", async (data) => {
      if (data.type === "ai_template_generation") {
        if (data.status === "processing") {
          toast.loading("AI is analyzing and generating your design... Please wait.", { id: "ai-gen" });
        } else if (data.status === "completed") {
          toast.success("AI Template Generated Successfully! 🎉 Loading preview...", { id: "ai-gen", duration: 3000 });
          setIsGenerating(false);
          
          if (data.result?.templateId) {
            setGeneratedTemplateId(data.result.templateId);
            await fetchTemplateCode(data.result.templateId);
          }
        } else if (data.status === "failed") {
          toast.error("AI Template Generation Failed. ❌ " + (data.error || ""), { id: "ai-gen" });
          setIsGenerating(false);
        }
      }
    });

    return () => socket.disconnect();
  }, []);

  const fetchTemplateCode = async (id) => {
    try {
      const res = await getTemplateById(id);
      if (res.status === "success" && res.data.template) {
        setHtmlCode(res.data.template.htmlContent);
      }
    } catch(err) {
      toast.error("Failed to load generated template code");
    }
  };

  const handleGenerateAI = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!selectedCompany) return toast.error("Please select a company first");
    if (!templateName) return toast.error("Please enter a template name");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("templateName", templateName);

    try {
      setIsGenerating(true);
      setHtmlCode("");
      setGeneratedTemplateId(null);
      toast.loading("Sending design to AI for processing...", { id: "ai-gen" });
      await apiClient.post(`/companies/${selectedCompany}/templates/generate-ai`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch(err) {
      toast.error(err.response?.data?.message || "Failed to submit task", { id: "ai-gen" });
      setIsGenerating(false);
    } finally {
      e.target.value = null; // reset input
    }
  };

  const handleSaveChanges = async () => {
    if (!generatedTemplateId) return;
    try {
      setIsSaving(true);
      await updateTemplate(generatedTemplateId, { htmlContent: htmlCode });
      toast.success("Changes saved successfully!");
    } catch(err) {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm animate-in fade-in duration-500">
      
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="text-xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors px-2 py-1"
            placeholder="Template Name"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="flex gap-2">
            <label className="relative flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-lg shadow-sm hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 cursor-pointer transition-all disabled:opacity-50">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate AI Template
              <input type="file" accept=".pdf,image/*,.ai" className="hidden" onChange={handleGenerateAI} disabled={isGenerating} />
            </label>
            
            {generatedTemplateId && (
              <Button onClick={handleSaveChanges} isLoading={isSaving} className="flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Edits
              </Button>
            )}
          </div>
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

          <div className="flex-1 overflow-auto p-8 relative flex justify-center items-start">
            {htmlCode ? (
              <div 
                className="shadow-xl bg-white transition-transform origin-top"
                style={{ 
                  transform: `scale(${zoom})`,
                  width: "1000px", 
                  height: "1414px",
                  overflow: "hidden",
                  position: "relative"
                }}
                dangerouslySetInnerHTML={{ __html: htmlCode }}
              />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                <p>Upload a design to generate an HTML template.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
