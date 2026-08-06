import { useState, useMemo } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import iso6391 from "iso-639-1";
import LabelPreview from "../components/LabelPreview";
import { generateLabelAi } from "../services/apiReferenceLabels";
import { getTaskStatus } from "../services/apiProducts"; // Reuse existing task polling
import { io } from "socket.io-client";
import { FileText, Copy, CheckCircle, Sparkles, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

export default function LabelGenerator() {
  const [formulationText, setFormulationText] = useState("");
  
  const countryOptions = useMemo(() => [
    ...countryList().getData()
  ], []);
  const [selectedCountry, setSelectedCountry] = useState(countryOptions.find(c => c.label === "Egypt") || countryOptions[0]);
  
  const languageOptions = useMemo(() => {
    return iso6391.getAllNames().map(name => ({ label: name, value: name }));
  }, []);
  const [selectedLanguage, setSelectedLanguage] = useState(languageOptions.find(l => l.value === "Arabic") || languageOptions[0]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [generatedData, setGeneratedData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleFieldChange = (path, value) => {
    setGeneratedData((prev) => {
      const next = structuredClone(prev);
      let cursor = next;
      for (let i = 0; i < path.length - 1; i++) {
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!formulationText.trim()) return toast.error("Please enter the product formulation/details.");
    if (!selectedCountry) return toast.error("Please select a target country.");
    if (!selectedLanguage) return toast.error("Please select a target language.");

    try {
      setIsGenerating(true);
      setGeneratedData(null);
      setJobProgress(0);
      setJobMessage("Starting AI label generation...");

      const payload = {
        formulationText,
        country: selectedCountry.label,
        language: selectedLanguage.value
      };

      const res = await generateLabelAi(payload);
      const taskId = res.data?.taskId || res.taskId;

      toast.success("AI is writing your label... Please wait.");

      // Use Sockets for Real-Time Updates
      const socket = io(BACKEND_URL);

      socket.on("connect", async () => {
        console.log("Connected to WebSocket, joining job:", taskId);
        socket.emit("join_job", taskId);
        
        try {
          const statusRes = await getTaskStatus(taskId);
          const currentStatus = statusRes.data?.task?.status || statusRes.task?.status;
          
          if (currentStatus === "completed" || currentStatus === "failed") {
            setIsGenerating(false);
            if (currentStatus === "completed") {
              const resultData = statusRes.data?.task?.result || statusRes.task?.result;
              setGeneratedData(resultData);
              toast.success("Label generated successfully!");
            } else {
              setJobMessage("AI generation failed.");
              toast.error("Generation failed. Please try again.");
            }
            socket.disconnect();
          }
        } catch (err) {
          console.error("Failed to fetch initial task status", err);
        }
      });

      socket.on("job_status", (data) => {
        console.log("Job Update:", data);
        if (data.progress) setJobProgress(data.progress);
        if (data.message) setJobMessage(data.message);

        if (data.status === "completed") {
          setIsGenerating(false);
          const resultData = data.result;
          setGeneratedData(resultData);
          toast.success("Label generated successfully!");
          socket.disconnect();
        } else if (data.status === "failed") {
          setIsGenerating(false);
          setJobMessage(data.error || "AI generation failed.");
          toast.error("Generation failed. Please try again.");
          socket.disconnect();
        }
      });

    } catch (err) {
      toast.error(err.message || "Failed to start generation");
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedData) return;
    navigator.clipboard.writeText(JSON.stringify(generatedData, null, 2));
    toast.success("Copied to clipboard!");
  };

  if (generatedData) {
    return (
      <div className="max-w-5xl mx-auto pb-12 animate-in fade-in zoom-in-95">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-blue-600" /> Label Preview
            </h1>
            <p className="text-gray-500 mt-2">Your AI-generated label is ready.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsEditing((v) => !v)}
              className={`flex items-center gap-1.5 font-bold px-4 py-2 rounded-xl transition-colors ${
                isEditing ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-50 hover:bg-blue-100 text-blue-600"
              }`}
            >
              {isEditing ? "Done Editing" : "Edit Fields"}
            </button>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors"
            >
              <Copy className="w-5 h-5" /> Copy Raw JSON
            </button>
            <button
              onClick={() => { setGeneratedData(null); setIsEditing(false); }}
              className="bg-gray-800 hover:bg-gray-900 text-white rounded-xl px-5 py-2 font-bold transition-colors"
            >
              Generate Another
            </button>
          </div>
        </div>

        {isEditing && (
          <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2">
            You're editing the generated text directly — no AI call needed, so this costs nothing to fix.
          </p>
        )}

        <LabelPreview data={generatedData} editable={isEditing} onFieldChange={handleFieldChange} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 animate-in fade-in zoom-in-95">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-600" /> AI Label Writer
        </h1>
        <p className="text-gray-500 mt-2">Generate a highly compliant, professional label text for any product by providing its details.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleGenerate} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Product Formulation & Details</label>
              <textarea 
                value={formulationText} 
                onChange={(e) => setFormulationText(e.target.value)} 
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                rows="8" 
                placeholder="e.g., A veterinary liquid supplement containing Vitamin A (1,000,000 IU/L), Vitamin D3 (200,000 IU/L) for poultry. Dose: 1ml per 10 liters of drinking water for 3-5 days."
                disabled={isGenerating}
                required 
              />
              <p className="text-[11px] text-gray-500 mt-1">The more details you provide, the better the AI can construct the label sections.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Target Country (FDA rules)</label>
                <Select
                  options={countryOptions}
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  className="text-sm"
                  isDisabled={isGenerating}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Target Language</label>
                <Select
                  options={languageOptions}
                  value={selectedLanguage}
                  onChange={setSelectedLanguage}
                  className="text-sm"
                  isDisabled={isGenerating}
                />
              </div>
            </div>

            <Button type="submit" isLoading={isGenerating} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" /> {isGenerating ? "Generating Label..." : "Write Label Text"}
            </Button>
          </form>

          {isGenerating && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="flex justify-between text-sm text-blue-700 mb-2 font-medium">
                <span>{jobMessage}</span>
                <span>{jobProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${jobProgress}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
