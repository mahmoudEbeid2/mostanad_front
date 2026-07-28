import React, { useState, useEffect } from "react";
import { Plus, Search, FileText, X, Trash2, Tag, UploadCloud } from "lucide-react";
import toast from "react-hot-toast";
import { getReferenceLabels, uploadReferenceLabels, deleteReferenceLabel } from "../services/apiReferenceLabels";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import Button from "../ui/Button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ReferenceLabels() {
  const { user } = useAuth();
  const assignedSlugs = user?.role?.permissions?.map(p => typeof p === 'string' ? p : p?.permission?.slug).filter(Boolean) || [];
  const canDelete = assignedSlugs.includes("delete_eda_requirements") || user?.type === "company"; // Assuming reuse of permission for now

  const navigate = useNavigate();
  const [labels, setLabels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingLabel, setViewingLabel] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    fetchLabels();
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      if (user?.type !== "company") {
        const res = await getCompanies({ limit: 100 });
        if (res.status === "success") setCompanies(res.data?.companies || []);
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    }
  };

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        // If user is a company, they don't have companyId state (it is empty), so the backend uses their token automatically.
        // If they are admin, passing companyId filters the brands.
        const res = await getBrands(companyId || undefined);
        if (res.status === "success") setBrands(res.data?.brands || []);
      } catch (error) {
        console.error("Failed to fetch brands:", error);
      }
    };
    fetchBrands();
  }, [companyId]);

  const fetchLabels = async () => {
    try {
      setIsLoading(true);
      const res = await getReferenceLabels();
      setLabels(res || []);
    } catch (err) {
      toast.error("Failed to fetch Reference Labels");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      return toast.error("Please upload at least one document.");
    }

    const payload = new FormData();
    if (companyId) payload.append("companyId", companyId);
    if (brandId) payload.append("brandId", brandId);
    
    Array.from(files).forEach((file) => {
      payload.append("files", file);
    });

    try {
      setIsUploading(true);
      
      const res = await uploadReferenceLabels(payload);
      
      toast.success("Documents queued for AI analysis! 🎉");
      setIsUploading(false);
      setIsModalOpen(false);
      setFiles([]);
      setCompanyId("");
      fetchLabels();
      
      if (res?.tasks && res.tasks.length > 0) {
         navigate(`/processing/${res.tasks[0].taskId}?type=reference_label_extraction`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
      setIsUploading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this reference?")) return;
    try {
      await deleteReferenceLabel(id);
      toast.success("Reference deleted");
      fetchLabels();
    } catch (err) {
      toast.error("Failed to delete reference");
    }
  };

  const filteredLabels = labels.filter((lbl) =>
    lbl.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Reference Labels</h1>
          <p className="text-gray-500 mt-1">Manage approved style guides for the AI engine.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Upload References
        </Button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search references..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredLabels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLabels.map((lbl) => (
              <div
                key={lbl.id}
                onClick={() => setViewingLabel(lbl)}
                className="group relative p-5 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(lbl.id, e);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <h3 className="font-semibold text-gray-900 mb-1 truncate">{lbl.name}</h3>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    <Tag className="w-3.5 h-3.5" />
                    {lbl.companyId ? "Company Specific" : "Global"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No references found</h3>
            <p className="text-gray-500">Upload approved documents to teach the AI.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">Upload Reference Labels</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {user?.type !== "company" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Company (Optional)
                      </label>
                      <select
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="">Global (All Companies)</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brand (Optional)
                    </label>
                    <select
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="">Global (All Brands)</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Documents (Max 10)
                  </label>
                  <label className="flex justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-xl appearance-none cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 focus:outline-none">
                    <span className="flex items-center space-x-2">
                      <UploadCloud className="w-6 h-6 text-gray-400" />
                      <span className="font-medium text-gray-600">
                        {files.length > 0 ? `${files.length} file(s) selected` : "Drop files to Upload"}
                      </span>
                    </span>
                    <input type="file" name="file_upload" className="hidden" multiple accept="image/*,.pdf" onChange={(e) => setFiles(e.target.files)} />
                  </label>
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading || files.length === 0}>
                  {isUploading ? "Uploading..." : "Upload & Analyze"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewingLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl my-8 animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
              <h2 className="text-xl font-bold text-gray-900 truncate pr-4">{viewingLabel.name}</h2>
              <button onClick={() => setViewingLabel(null)} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {viewingLabel.extractedData ? (
                <div className="space-y-6">
                  <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    This data was automatically extracted by the AI Engine to be used as a style guide for future labels.
                  </p>
                  
                  {Object.entries(viewingLabel.extractedData).map(([key, value]) => (
                    <div key={key} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">
                        {key.replace(/_/g, ' ')}
                      </h4>
                      {typeof value === 'object' ? (
                        <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-gray-200">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-gray-800 whitespace-pre-wrap">{String(value)}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-gray-500">No AI extracted data found for this label.</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <Button variant="secondary" onClick={() => setViewingLabel(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
