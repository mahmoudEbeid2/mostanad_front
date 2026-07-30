import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, FileText, Upload, X, Trash2, CheckCircle2, ChevronDown, ChevronUp, FileCode2, Edit2 } from "lucide-react";
import Select from "react-select";
import countryList from "react-select-country-list";
import toast from "react-hot-toast";
import { getEdaRequirements, uploadEdaRequirement, deleteEdaRequirement, updateEdaRequirement } from "../services/apiEdaRequirements";
import Button from "../ui/Button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function EdaRequirements() {
  const { user } = useAuth();
  const assignedSlugs = user?.role?.permissions?.map(p => typeof p === 'string' ? p : p?.permission?.slug).filter(Boolean) || [];
  const canCreate = assignedSlugs.includes("create_eda_requirements");
  const canUpdate = assignedSlugs.includes("update_eda_requirements");
  const canDelete = assignedSlugs.includes("delete_eda_requirements");

  const navigate = useNavigate();
  const [requirements, setRequirements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const countryOptions = useMemo(() => countryList().getData(), []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({ country: "Egypt", file: null });

  // View Modal State
  const [viewReq, setViewReq] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({ id: "", country: "", extractedText: "" });

  useEffect(() => {
    fetchRequirements();
  }, []);

  const fetchRequirements = async () => {
    try {
      setIsLoading(true);
      const res = await getEdaRequirements();
      setRequirements(res.data || []);
    } catch (err) {
      toast.error("Failed to fetch EDA Requirements");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!formData.file) {
      return toast.error("Please upload a document.");
    }

    const payload = new FormData();
    payload.append("country", formData.country);
    payload.append("file", formData.file);

    try {
      setIsUploading(true);
      
      const res = await uploadEdaRequirement(payload);
      
      if (res?.jobId) {
        // Navigate to dedicated processing page
        navigate(`/processing/${res.jobId}?type=eda_requirement`);
      } else {
        // Fallback if returned synchronously
        toast.success("Document analyzed successfully! 🎉");
        setIsUploading(false);
        setIsModalOpen(false);
        setFormData({ country: "Egypt", file: null });
        fetchRequirements();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
      setIsUploading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this requirement?")) return;
    try {
      await deleteEdaRequirement(id);
      toast.success("Requirement deleted");
      fetchRequirements();
    } catch (err) {
      toast.error("Failed to delete requirement");
    }
  };

  const handleEditClick = (req, e) => {
    e.stopPropagation();
    setEditFormData({
      id: req.id,
      country: req.country,
      extractedText: req.extractedText || ""
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsUpdating(true);
      await updateEdaRequirement(editFormData.id, {
        country: editFormData.country,
        extractedText: editFormData.extractedText
      });
      toast.success("Requirement updated successfully!");
      setIsEditModalOpen(false);
      fetchRequirements();
      if (viewReq?.id === editFormData.id) {
        setViewReq(null);
      }
    } catch (err) {
      toast.error("Failed to update requirement");
    } finally {
      setIsUpdating(false);
    }
  };



  const filteredReqs = requirements.filter(req => 
    req.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto pb-12 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileCode2 className="w-8 h-8 text-blue-600" />
            Regulatory Requirements
          </h1>
          <p className="text-gray-500 mt-1">Upload and manage AI-structured requirements for EDA and other authorities.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-t-2xl border-x border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-b-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Document Content</th>
                <th className="px-6 py-4">Date Added</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin inline-block"></span>
                  </td>
                </tr>
              ) : filteredReqs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">No requirements found</p>
                  </td>
                </tr>
              ) : (
                filteredReqs.map(req => (
                  <tr key={req.id} onClick={() => setViewReq(req)} className="hover:bg-blue-50/50 cursor-pointer transition-colors group">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        {req.country}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md text-xs font-mono">
                        {req.extractedText ? "Full Text Available" : "Empty"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      {canUpdate && (
                        <button onClick={(e) => handleEditClick(req, e)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-5 h-5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={(e) => handleDelete(req.id, e)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" /> Upload Requirement Doc
              </h2>
              <button onClick={() => !isUploading && setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="p-6 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
                <Select
                  options={countryOptions}
                  value={countryOptions.find(c => c.label === formData.country) || { label: formData.country, value: formData.country }}
                  onChange={option => setFormData({ ...formData, country: option.label })}
                  className="react-select-container text-sm"
                  classNamePrefix="react-select"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Upload File (PDF / DOCX) *</label>
                <div className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
                  <input 
                    type="file" 
                    accept=".pdf,.docx" 
                    onChange={e => setFormData({ ...formData, file: e.target.files[0] })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    required
                  />
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">
                    {formData.file ? formData.file.name : "Click or drag file to upload"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF or Word files only</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isUploading}>Cancel</Button>
                <Button type="submit" isLoading={isUploading}>
                  {isUploading ? "AI Processing..." : "Upload & Parse"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Regulatory Document ({viewReq.country})</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {viewReq.country}
                  </span>
                  <span className="text-xs text-gray-500">
                    Processed on {new Date(viewReq.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <button onClick={() => setViewReq(null)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  AI Structured Insights
                </h3>
                
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="whitespace-pre-wrap leading-relaxed text-sm text-slate-700 font-medium font-mono">
                    {viewReq.extractedText || "No text available for this document."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" /> Regulatory Document ({editFormData.country})
              </h2>
              <button onClick={() => !isUpdating && setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
                    <Select
                      options={countryOptions}
                      value={countryOptions.find(c => c.label === editFormData.country) || { label: editFormData.country, value: editFormData.country }}
                      onChange={option => setEditFormData({ ...editFormData, country: option.label })}
                      className="react-select-container text-sm"
                      classNamePrefix="react-select"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">Document Content (Full Text)</label>
                  </div>
                  
                  <textarea
                    value={editFormData.extractedText}
                    onChange={(e) => setEditFormData({ ...editFormData, extractedText: e.target.value })}
                    className="w-full px-4 py-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[400px] whitespace-pre-wrap font-mono leading-relaxed"
                    placeholder="Enter or paste the full legal text here..."
                  />
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-3 shrink-0">
                <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={isUpdating}>Cancel</Button>
                <Button type="submit" isLoading={isUpdating}>
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
