import { useState, useEffect, useMemo } from "react";
import { getCompanies } from "../services/apiCompanies";
import { verifyLabel } from "../services/apiLabels";
import { getTaskStatus } from "../services/apiProducts"; // reuse for checking task status
import { io } from "socket.io-client";
import { CheckCircle, AlertCircle, Image as ImageIcon, Loader2, PlayCircle, ShieldCheck, FileText } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

const COUNTRIES = [
  "Saudi Arabia",
  "United Arab Emirates",
  "Egypt",
  "United States",
  "European Union"
];

export default function Labels() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("Saudi Arabia");
  
  const [file, setFile] = useState(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); 
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobResults, setJobResults] = useState(null);

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

  useEffect(() => {
    if (!jobId) return;

    const socket = io(BACKEND_URL);

    socket.on("connect", async () => {
      console.log("Connected to WebSocket, joining job:", jobId);
      socket.emit("join_job", jobId);
      
      try {
        const res = await getTaskStatus(jobId);
        if (res.status === "success" && res.data) {
          const currentStatus = res.data.status;
          if (currentStatus === "completed" || currentStatus === "failed") {
             setJobStatus(currentStatus);
             if (res.data.result) setJobResults(res.data.result);
             if (res.data.error) setJobMessage(res.data.error);
             
             if (currentStatus === "completed") toast.success("Label verified successfully!");
             else toast.error("Label verification failed.");
             
             socket.disconnect();
          }
        }
      } catch (err) {
        console.error("Failed to fetch initial task status", err);
      }
    });

    socket.on("job_status", (data) => {
      console.log("Job Update:", data);
      setJobStatus(data.status);
      setJobProgress(data.progress || 0);
      if (data.message) setJobMessage(data.message);
      if (data.result) setJobResults(data.result);

      if (data.status === "completed") {
        toast.success("Label verified successfully!");
        socket.disconnect();
      } else if (data.status === "failed") {
        toast.error("Label verification failed.");
        socket.disconnect();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return null;
  }, [file]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
        toast.error("Please select a valid Image or PDF file");
        e.target.value = null;
        setFile(null);
        return;
      }
      setFile(selected);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a label image or PDF");
    if (!selectedCountry) return toast.error("Please select a target country");

    try {
      setIsUploading(true);
      
      setJobId(null);
      setJobStatus(null);
      setJobProgress(0);
      setJobMessage("");
      setJobResults(null);

      const formData = new FormData();
      if (selectedCompany) formData.append("companyId", selectedCompany);
      formData.append("country", selectedCountry);
      formData.append("label", file);

      const res = await verifyLabel(formData);
      if (res.status === "accepted" || res.status === "success") {
        toast.success("Label uploaded! AI Verification started...");
        setJobId(res.data.jobId || res.data.task?.id);
        setJobStatus("pending");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to verify label");
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setJobId(null);
    setFile(null);
    setJobStatus(null);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-blue-600" /> AI Label Verification
        </h1>
        <p className="text-gray-500 mt-2">Upload product labels to verify compliance with country-specific regulations.</p>
      </div>

      {!jobId ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleUpload} className="space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Country Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Target Country (Required)</label>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                  required
                >
                  {COUNTRIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">The AI will check compliance against this country's food & drug regulations.</p>
              </div>

              {/* Company Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Company (Optional)</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                >
                  <option value="">Global Verification (No specific company)</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Label Design (Image or PDF)</label>
              
              {!file ? (
                <div className="flex justify-center px-6 pt-10 pb-12 border-2 border-gray-300 border-dashed rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors relative">
                  <div className="space-y-3 text-center">
                    <ImageIcon className="mx-auto h-16 w-16 text-gray-400" />
                    <div className="flex text-base text-gray-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-bold text-blue-600 hover:text-blue-500 px-3 py-1 shadow-sm border border-gray-200">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" accept="image/*,.pdf" className="sr-only" onChange={handleFileChange} />
                      </label>
                      <p className="pl-2 pt-1">or drag and drop</p>
                    </div>
                    <p className="text-sm text-gray-500">PNG, JPG, or PDF up to 20MB</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-blue-900 font-bold text-lg">
                      <CheckCircle className="w-6 h-6 text-green-500" /> 
                      File Selected
                    </div>
                    <p className="text-blue-800 text-sm font-mono truncate max-w-sm">{file.name}</p>
                    
                    <div className="mt-auto pt-4">
                      <button type="button" onClick={() => setFile(null)} className="text-sm text-red-600 font-semibold hover:underline">
                        Remove and select another
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl overflow-hidden border border-gray-200 h-64 flex items-center justify-center relative shadow-sm">
                    {file.type.startsWith("image/") ? (
                      <img src={previewUrl} alt="Label Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full" title="PDF Preview" />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <Button type="submit" isLoading={isUploading} className="w-full md:w-auto px-10 py-3 text-lg" disabled={!file}>
                <ShieldCheck className="w-6 h-6 mr-2" /> Verify Compliance
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Label</h2>
            <p className="text-gray-500">Job ID: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{jobId}</span></p>
          </div>

          <div className="max-w-3xl mx-auto space-y-8">
            
            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-4">
              {jobStatus === "pending" || jobStatus === "processing" ? (
                <div className="flex flex-col items-center text-blue-600">
                  <div className="relative mb-6 mt-4">
                    <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                    <div className="relative bg-white rounded-full p-4 border shadow-sm">
                       <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                    </div>
                  </div>
                  <span className="font-bold text-xl text-gray-800">Checking Regulations...</span>
                  <span className="text-sm text-gray-500 mt-2 text-center max-w-sm">
                    {jobMessage || "Our AI is analyzing the label against local compliance rules. This takes a few seconds."}
                  </span>
                </div>
              ) : jobStatus === "completed" ? (
                <div className="flex flex-col items-center text-green-600">
                  <ShieldCheck className="w-20 h-20 mb-4" />
                  <span className="font-bold text-2xl text-gray-900">Verification Complete!</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-red-600">
                  <AlertCircle className="w-16 h-16 mb-4" />
                  <span className="font-bold text-xl">Verification Failed</span>
                  <span className="text-sm text-red-500 mt-2 bg-red-50 p-3 rounded-lg border border-red-100">{jobMessage}</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {(jobStatus === "pending" || jobStatus === "processing") && (
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
                <div 
                  className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                  style={{ width: `${jobProgress}%` }}
                ></div>
              </div>
            )}

            {/* Results Section */}
            {jobStatus === "completed" && jobResults && jobResults.validation && (
              <div className="mt-8">
                {/* Compliant or Not */}
                <div className={`p-6 rounded-2xl border-2 text-center mb-8 ${jobResults.validation.compliant ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}`}>
                  <h3 className="text-3xl font-black mb-2 uppercase tracking-wide">
                    {jobResults.validation.compliant ? "Compliant" : "Non-Compliant"}
                  </h3>
                  <p className="text-sm opacity-80 font-medium">
                    According to regulations in {jobResults.validation.country || selectedCountry}
                  </p>
                </div>

                {/* Validation Issues List */}
                {jobResults.validation.results && jobResults.validation.results.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <h4 className="font-bold text-gray-800">Identified Issues ({jobResults.validation.results.length})</h4>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {jobResults.validation.results.map((item, idx) => (
                        <div key={idx} className="p-6 hover:bg-gray-50 transition-colors">
                          <div className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                item.category === 'regulatory' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                                {idx + 1}
                              </span>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                    item.category === 'regulatory' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {item.category === 'regulatory' ? 'Regulatory Rule' : 'Database Mismatch'}
                                  </span>
                                  {item.location && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                      Location: {item.location}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-800 font-medium leading-relaxed">{item.issue}</p>
                              </div>
                              
                              <div className="bg-green-50 rounded-lg p-4 border border-green-100 flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm font-bold text-green-800 mb-1">Recommended Solution</p>
                                  <p className="text-sm text-green-700 leading-relaxed">{item.solution}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Product Info Summary */}
                {jobResults.product && jobResults.product.extractedDetails && (
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 border-b border-gray-200 px-6 py-4">
                      <h4 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500" /> Extracted Label Information
                      </h4>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                      <div><span className="text-gray-500 block mb-1">Product Name</span><span className="font-semibold text-gray-900">{jobResults.product.extractedDetails.name || 'N/A'}</span></div>
                      <div><span className="text-gray-500 block mb-1">Producer</span><span className="font-semibold text-gray-900">{jobResults.product.extractedDetails.producer || 'N/A'}</span></div>
                      <div><span className="text-gray-500 block mb-1">Dosage</span><span className="font-semibold text-gray-900">{jobResults.product.extractedDetails.dosage || 'N/A'}</span></div>
                      <div><span className="text-gray-500 block mb-1">Storage</span><span className="font-semibold text-gray-900">{jobResults.product.extractedDetails.storage || 'N/A'}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {(jobStatus === "completed" || jobStatus === "failed") && (
              <div className="flex justify-center mt-12 pt-6 border-t border-gray-100">
                <Button onClick={resetUpload} variant="secondary" className="px-8 py-3">
                  Verify Another Label
                </Button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
