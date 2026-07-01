import { useState, useEffect, useMemo } from "react";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { uploadCatalog, getTaskStatus } from "../services/apiProducts";
import { io } from "socket.io-client";
import { PDFDocument } from "pdf-lib";
import { UploadCloud, CheckCircle, AlertCircle, FileText, Loader2, PlayCircle, Scissors } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../ui/Button";

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:3000";

export default function Catalogs() {
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  
  // File and Slicing State
  const [file, setFile] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // 'pending', 'processing', 'completed', 'failed'
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobResults, setJobResults] = useState(null);

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
      } catch (error) {
        toast.error("Failed to load brands");
      }
    };
    fetchBrands();
  }, [selectedCompany]);

  // Socket Connection for Job Tracking
  useEffect(() => {
    if (!jobId) return;

    const socket = io(BACKEND_URL);

    socket.on("connect", async () => {
      console.log("Connected to WebSocket, joining job:", jobId);
      socket.emit("join_job", jobId);
      
      // Prevent race condition: Check HTTP status immediately in case it completed before socket connected
      try {
        const res = await getTaskStatus(jobId);
        if (res.status === "success" && res.data) {
          const currentStatus = res.data.status;
          if (currentStatus === "completed" || currentStatus === "failed") {
             setJobStatus(currentStatus);
             if (res.data.results) setJobResults(res.data.results);
             if (res.data.error) setJobMessage(res.data.error);
             
             if (currentStatus === "completed") toast.success("Catalog processed successfully!");
             else toast.error("Catalog processing failed.");
             
             socket.disconnect();
          }
        }
      } catch (err) {
        console.error("Failed to fetch initial task status", err);
      }
    });

    socket.on("job_status_update", (data) => {
      console.log("Job Update:", data);
      setJobStatus(data.status);
      setJobProgress(data.progress || 0);
      if (data.message) setJobMessage(data.message);
      if (data.results) setJobResults(data.results);

      if (data.status === "completed") {
        toast.success("Catalog processed successfully!");
        socket.disconnect();
      } else if (data.status === "failed") {
        toast.error("Catalog processing failed.");
        socket.disconnect();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  const pdfPreviewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    return null;
  }, [file]);

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type !== "application/pdf") {
      toast.error("Please select a valid PDF file");
      e.target.value = null;
      setFile(null);
      return;
    }
    
    setFile(selected);
    
    // Parse PDF to get page count
    if (selected) {
      try {
        setIsParsingPdf(true);
        const arrayBuffer = await selected.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const count = pdfDoc.getPageCount();
        setTotalPages(count);
        setStartPage(1);
        setEndPage(count);
      } catch (err) {
        toast.error("Failed to parse PDF file. It might be corrupted.");
        setFile(null);
      } finally {
        setIsParsingPdf(false);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return toast.error("Please select a company");
    if (!file) return toast.error("Please select a PDF catalog");
    
    const parsedStart = parseInt(startPage);
    const parsedEnd = parseInt(endPage);

    if (parsedStart < 1 || parsedEnd > totalPages || parsedStart > parsedEnd) {
      return toast.error("Invalid page range selected.");
    }

    try {
      setIsUploading(true);
      
      let uploadFile = file;

      // Slice the PDF if range is modified
      if (parsedStart > 1 || parsedEnd < totalPages) {
        toast.loading("Slicing PDF locally...", { id: "slicing" });
        const arrayBuffer = await file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const destDoc = await PDFDocument.create();

        // pdf-lib pages are 0-indexed, UI is 1-indexed
        const indices = [];
        for (let i = parsedStart - 1; i < parsedEnd; i++) {
          indices.push(i);
        }

        const copiedPages = await destDoc.copyPages(srcDoc, indices);
        copiedPages.forEach((page) => destDoc.addPage(page));

        const pdfBytes = await destDoc.save();
        uploadFile = new File([pdfBytes], `sliced_${file.name}`, {
          type: "application/pdf"
        });
        toast.dismiss("slicing");
      }

      // Reset Job State
      setJobId(null);
      setJobStatus(null);
      setJobProgress(0);
      setJobMessage("");
      setJobResults(null);

      const formData = new FormData();
      formData.append("companyId", selectedCompany);
      if (selectedBrand) formData.append("brandId", selectedBrand);
      formData.append("catalog", uploadFile);

      const res = await uploadCatalog(formData);
      if (res.status === "accepted" || res.status === "success") {
        toast.success("Catalog uploaded! Processing started...");
        setJobId(res.data.jobId);
        setJobStatus("pending");
      }
    } catch (error) {
      toast.dismiss("slicing");
      toast.error(error.response?.data?.message || "Failed to upload catalog");
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setJobId(null);
    setFile(null);
    setJobStatus(null);
    setTotalPages(0);
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Catalog Processing</h1>
        <p className="text-gray-500 mt-2">Upload PDF catalogs to automatically extract products and categories using AI.</p>
      </div>

      {!jobId ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <form onSubmit={handleUpload} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company (Required)</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
                  required
                >
                  <option value="">Select a company...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Brand Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand (Optional)</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  disabled={!selectedCompany || brands.length === 0}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 disabled:opacity-50"
                >
                  <option value="">No brand selected...</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File Upload */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">PDF Catalog</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors relative">
                {isParsingPdf && (
                  <div className="absolute inset-0 bg-white/80 rounded-xl flex flex-col items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <span className="text-sm font-medium text-gray-600">Analyzing PDF...</span>
                  </div>
                )}
                <div className="space-y-2 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 px-2">
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" accept=".pdf" className="sr-only" onChange={handleFileChange} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF up to 50MB</p>
                </div>
              </div>
              
              {/* File Info and Slicing */}
              {file && !isParsingPdf && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  
                  {/* Left Column: Slicing Controls */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-blue-800 font-medium text-sm truncate max-w-[70%]">
                        <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" /> 
                        <span className="truncate">{file.name}</span>
                      </div>
                      <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-md shrink-0">
                        {totalPages} Pages
                      </span>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                      <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-700">
                        <Scissors className="w-4 h-4 text-blue-500" /> Page Range
                      </div>
                      <p className="text-xs text-gray-500 mb-4">Save processing time by extracting only the pages you need. Preview the PDF on the right to see the page numbers.</p>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Start Page</label>
                          <input 
                            type="number" 
                            min="1" 
                            max={endPage}
                            value={startPage}
                            onChange={(e) => setStartPage(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        </div>
                        <div className="text-gray-400 mt-5">to</div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">End Page</label>
                          <input 
                            type="number" 
                            min={startPage} 
                            max={totalPages}
                            value={endPage}
                            onChange={(e) => setEndPage(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                        </div>
                      </div>
                      {(parseInt(startPage) !== 1 || parseInt(endPage) !== totalPages) && (
                        <p className="text-xs text-amber-600 mt-3 font-medium bg-amber-50 p-2 rounded border border-amber-100">
                          A new PDF with {parseInt(endPage) - parseInt(startPage) + 1} pages will be generated.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: PDF Preview */}
                  <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 h-64 lg:h-full min-h-[250px]">
                    {pdfPreviewUrl ? (
                      <iframe 
                        src={`${pdfPreviewUrl}#toolbar=0&navpanes=0`} 
                        title="PDF Preview"
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <FileText className="w-8 h-8 opacity-50" />
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <Button type="submit" isLoading={isUploading || isParsingPdf} className="w-full md:w-auto px-8">
                <PlayCircle className="w-5 h-5 mr-1" /> Start AI Extraction
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Catalog</h2>
            <p className="text-gray-500">Job ID: <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{jobId}</span></p>
          </div>

          <div className="max-w-2xl mx-auto space-y-8">
            
            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-4">
              {jobStatus === "pending" || jobStatus === "processing" ? (
                <div className="flex flex-col items-center text-blue-600">
                  <Loader2 className="w-16 h-16 animate-spin mb-4" />
                  <span className="font-semibold text-lg">{jobMessage || "Initializing Worker..."}</span>
                </div>
              ) : jobStatus === "completed" ? (
                <div className="flex flex-col items-center text-green-600">
                  <CheckCircle className="w-16 h-16 mb-4" />
                  <span className="font-semibold text-lg">Extraction Completed!</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-red-600">
                  <AlertCircle className="w-16 h-16 mb-4" />
                  <span className="font-semibold text-lg">Processing Failed</span>
                  <span className="text-sm text-red-500 mt-2">{jobMessage}</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {(jobStatus === "pending" || jobStatus === "processing") && (
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
                <div 
                  className="bg-blue-600 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                  style={{ width: `${jobProgress}%` }}
                >
                  {jobProgress > 10 && <span className="text-[10px] font-bold text-white">{jobProgress}%</span>}
                </div>
              </div>
            )}

            {/* Results Section */}
            {jobStatus === "completed" && jobResults && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <h3 className="text-lg font-bold text-green-800 mb-4">Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100">
                    <p className="text-sm text-gray-500">Products Extracted</p>
                    <p className="text-3xl font-black text-green-600">{jobResults.productsCount || 0}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100">
                    <p className="text-sm text-gray-500">Categories Found</p>
                    <p className="text-3xl font-black text-green-600">{jobResults.categoriesCount || 0}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {(jobStatus === "completed" || jobStatus === "failed") && (
              <div className="flex justify-center mt-8 pt-6 border-t border-gray-100">
                <Button onClick={resetUpload} variant="secondary">
                  Process Another Catalog
                </Button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
