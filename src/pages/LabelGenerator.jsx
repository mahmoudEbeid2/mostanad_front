import { useState, useMemo } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import iso6391 from "iso-639-1";
import ReactMarkdown from "react-markdown";
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
  const [generatedText, setGeneratedText] = useState("");

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!formulationText.trim()) return toast.error("Please enter the product formulation/details.");
    if (!selectedCountry) return toast.error("Please select a target country.");
    if (!selectedLanguage) return toast.error("Please select a target language.");

    try {
      setIsGenerating(true);
      setGeneratedText("");
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
              const resultText = statusRes.data?.task?.result?.generatedText || statusRes.task?.result?.generatedText;
              setGeneratedText(resultText || "No text was generated.");
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
          const resultText = data.result?.generatedText;
          setGeneratedText(resultText || "No text was generated.");
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
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-in fade-in zoom-in-95">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-blue-600" /> AI Label Writer
        </h1>
        <p className="text-gray-500 mt-2">Generate a highly compliant, professional label text for any product by providing its details.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Inputs */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
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

        {/* Right Side: Output */}
        <div className="bg-white flex flex-col rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[600px]">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" /> Generated Text
            </h3>
            {generatedText && (
              <button 
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" /> Copy All
              </button>
            )}
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 bg-white">
            {generatedText ? (
              <div className="prose prose-sm max-w-none prose-blue prose-headings:font-bold prose-a:text-blue-600">
                <ReactMarkdown>{generatedText}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                {isGenerating ? (
                  <div className="animate-pulse flex flex-col items-center">
                    <Sparkles className="w-12 h-12 text-blue-300 mb-3" />
                    <p>The AI is researching approved references...</p>
                  </div>
                ) : (
                  <>
                    <FileText className="w-12 h-12 mb-3 text-gray-300" />
                    <p>Your generated label text will appear here.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
