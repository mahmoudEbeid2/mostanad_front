import { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { verifyLabel } from "../services/apiLabels";
import { getTaskStatus } from "../services/apiProducts"; // reuse for checking task status
import { io } from "socket.io-client";
import { CheckCircle, AlertCircle, Image as ImageIcon, Loader2, PlayCircle, ShieldCheck, FileText, MapPin, Database, Cpu, CloudUpload, Search, FileCheck, Scan, ShieldAlert, FlaskConical } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

export default function Labels() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  
  const countryOptions = useMemo(() => [
    { label: "Global", value: "Global" },
    ...countryList().getData()
  ], []);
  const [selectedCountry, setSelectedCountry] = useState(countryOptions[0]);
  
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  
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
    if (!selectedCompany) {
      setBrands([]);
      setSelectedBrand("");
      return;
    }
    const fetchBrands = async () => {
      try {
        const res = await getBrands(selectedCompany);
        if (res.status === "success") {
          setBrands(res.data.brands || []);
        }
      } catch (error) {}
    };
    fetchBrands();
  }, [selectedCompany]);

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
      if (selectedBrand) formData.append("brandId", selectedBrand);
      formData.append("country", selectedCountry.label);
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Country Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Food and Drug Authority (Country)</label>
                <Select
                  options={countryOptions}
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  className="react-select-container text-sm"
                  classNamePrefix="react-select"
                />
                <p className="text-[10px] text-gray-500 mt-2 leading-tight">AI will check compliance against the selected country's FDA regulations.</p>
              </div>

              {/* Company Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Company (Optional)</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-4 py-[9px] bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700"
                >
                  <option value="">Global Verification</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Brand Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Brand (Optional)</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  disabled={!selectedCompany || brands.length === 0}
                  className="w-full px-4 py-[9px] bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-700 disabled:opacity-50"
                >
                  <option value="">Global Verification</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File Upload Area */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Label Design (Image or PDF)</label>
              
              {!file ? (
                <label 
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center px-6 pt-10 pb-12 border-2 border-gray-300 border-dashed rounded-2xl bg-gray-50 hover:bg-gray-100 transition-colors relative cursor-pointer"
                >
                  <div className="space-y-3 text-center">
                    <ImageIcon className="mx-auto h-16 w-16 text-gray-400" />
                    <div className="flex text-base text-gray-600 justify-center">
                      <span className="font-bold text-blue-600 hover:text-blue-500 px-1">
                        Upload a file
                      </span>
                      <input id="file-upload" name="file-upload" type="file" accept="image/*,.pdf" className="sr-only" onChange={handleFileChange} />
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-sm text-gray-500">PNG, JPG, or PDF up to 20MB</p>
                  </div>
                </label>
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
                <div className="flex flex-col w-full max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
                  {/* Decorative Background */}
                  <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-60"></div>
                  <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60"></div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="font-extrabold text-2xl text-gray-900 tracking-tight">AI Analysis in Progress</h3>
                        <p className="text-sm text-gray-500 mt-1.5 font-medium">Please wait while the AI verifies compliance.</p>
                      </div>
                      <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full font-black text-sm shadow-sm">
                        {jobProgress}%
                      </div>
                    </div>
                    
                    {/* Dynamic Icon & Message Stage */}
                    <div className="flex items-center gap-5 p-5 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-100/50 mb-8">
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-30"></div>
                        <div className="relative bg-white p-3.5 rounded-full shadow-sm border border-blue-100 text-blue-600">
                          {jobProgress < 20 ? <CloudUpload className="w-7 h-7" /> :
                           jobProgress < 40 ? <Scan className="w-7 h-7" /> :
                           jobProgress < 60 ? <Database className="w-7 h-7" /> :
                           jobProgress < 80 ? <ShieldCheck className="w-7 h-7" /> :
                           <FileCheck className="w-7 h-7" />}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1.5">Current Stage</h4>
                        <p className="text-gray-800 font-bold text-base leading-snug break-words">
                          {jobMessage || "Initializing AI processors..."}
                        </p>
                      </div>
                    </div>
                    
                    {/* Unified Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative shadow-inner">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-700 ease-out relative"
                        style={{ width: `${Math.max(jobProgress, 5)}%` }}
                      >
                        <div className="absolute top-0 right-0 bottom-0 left-0 bg-white/20 w-full overflow-hidden animate-[shimmer_2s_infinite]"></div>
                      </div>
                    </div>
                  </div>
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
                  <div className="mb-8 space-y-4">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-red-100 p-2.5 rounded-xl border border-red-200">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h4 className="text-xl font-extrabold text-gray-900">Actionable Feedback</h4>
                        <p className="text-sm text-gray-500 font-medium">We found {jobResults.validation.results.length} issues that need your attention</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-5">
                      {jobResults.validation.results.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-all duration-300 group">
                          {/* Left Accent Bar */}
                          <div className={`w-2 md:w-3 flex-shrink-0 ${
                            item.category === 'regulatory' ? 'bg-amber-400' :
                            item.category === 'technical_error' ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                          
                          <div className="p-5 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${
                                  item.category === 'regulatory' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 
                                  item.category === 'technical_error' ? 'bg-red-50 text-red-800 border border-red-200' :
                                  'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}>
                                  {item.category === 'regulatory' ? <><ShieldAlert className="w-3.5 h-3.5" /> Regulatory Violation</> : 
                                   item.category === 'technical_error' ? <><FlaskConical className="w-3.5 h-3.5" /> Critical Technical Error</> : 
                                   <><Database className="w-3.5 h-3.5" /> Database Mismatch</>}
                                </span>
                                {item.location && (
                                  <span className="text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {item.location}
                                  </span>
                                )}
                              </div>
                              <h5 className="text-gray-900 font-bold text-lg leading-snug mb-4 group-hover:text-blue-600 transition-colors">
                                {item.issue}
                              </h5>
                            </div>
                            
                            <div className="bg-emerald-50/80 rounded-xl p-4 border border-emerald-100/50 flex items-start gap-3 relative overflow-hidden mt-2">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100 rounded-bl-full opacity-50 -z-10" />
                              <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-1">Recommended Fix</p>
                                <p className="text-sm text-emerald-900 font-medium leading-relaxed">{item.solution}</p>
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
