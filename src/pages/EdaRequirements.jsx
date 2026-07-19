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
  const [editFormData, setEditFormData] = useState({ id: "", country: "", extractedData: [] });

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
      extractedData: Array.isArray(req.extractedData) ? [...req.extractedData] : []
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsUpdating(true);
      await updateEdaRequirement(editFormData.id, {
        country: editFormData.country,
        extractedData: editFormData.extractedData
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

  const handleEditSectionChange = (index, field, value) => {
    const newData = [...editFormData.extractedData];
    newData[index] = { ...newData[index], [field]: value };
    setEditFormData({ ...editFormData, extractedData: newData });
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
                <th className="px-6 py-4">Structured Sections</th>
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
                        {Array.isArray(req.extractedData) ? req.extractedData.length : 0} Sections
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
                
                {Array.isArray(viewReq.extractedData) ? (
                  <div className="space-y-4">
                    {viewReq.extractedData.map((rule, idx) => {
                      if (rule.section && rule.content) {
                        const isExpanded = expandedSection === idx;
                        return (
                          <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                            <button 
                              onClick={() => setExpandedSection(isExpanded ? null : idx)}
                              className="w-full px-5 py-4 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
                            >
                              <span className="font-bold text-slate-800 text-left">{rule.section}</span>
                              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                            </button>
                            {isExpanded && (
                              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                                {rule.content}
                              </div>
                            )}
                          </div>
                        )
                      }
                      return (
                        <div key={idx} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${rule.severity === 'CRITICAL' ? 'border-red-200' : 'border-blue-200'}`}>
                          <div className={`px-5 py-3 border-b flex justify-between items-center ${rule.severity === 'CRITICAL' ? 'bg-red-50' : 'bg-blue-50'}`}>
                             <div className="flex items-center gap-2">
                               <span className={`px-2 py-0.5 rounded text-xs font-bold ${rule.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{rule.severity}</span>
                               <span className="text-sm font-semibold text-slate-700">{rule.ruleType}</span>
                             </div>
                             <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border shadow-sm">Target: {rule.targetProductType}</span>
                          </div>
                          <div className="px-5 py-4 text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                            {rule.ruleDescription}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-6 bg-orange-50 text-orange-800 rounded-xl border border-orange-200 text-sm">
                    No structured data found. The AI might not have been able to categorize this document correctly.
                  </div>
                )}
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
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-semibold text-gray-700">Structured Rules</label>
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setEditFormData({
                        ...editFormData,
                        extractedData: [...editFormData.extractedData, { targetProductType: "All Products", ruleType: "General Rule", ruleDescription: "", severity: "WARNING" }]
                      })}
                      className="text-xs py-1"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Rule
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {editFormData.extractedData.map((rule, index) => {
                      if (rule.section !== undefined) {
                        return (
                          <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                            <button 
                              type="button" 
                              onClick={() => {
                                const newData = [...editFormData.extractedData];
                                newData.splice(index, 1);
                                setEditFormData({ ...editFormData, extractedData: newData });
                              }}
                              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            
                            <div className="mb-3 pr-8">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Section Title</label>
                              <input
                                type="text"
                                value={rule.section}
                                onChange={(e) => handleEditSectionChange(index, "section", e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
                              <textarea
                                value={rule.content}
                                onChange={(e) => handleEditSectionChange(index, "content", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[100px] whitespace-pre-wrap"
                              />
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div key={index} className={`bg-white p-4 rounded-xl border shadow-sm relative ${rule.severity === 'CRITICAL' ? 'border-red-200' : 'border-blue-200'}`}>
                          <button 
                            type="button" 
                            onClick={() => {
                              const newData = [...editFormData.extractedData];
                              newData.splice(index, 1);
                              setEditFormData({ ...editFormData, extractedData: newData });
                            }}
                            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3 pr-8">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Target Product</label>
                              <input
                                type="text"
                                value={rule.targetProductType}
                                onChange={(e) => handleEditSectionChange(index, "targetProductType", e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Rule Type</label>
                              <select
                                value={rule.ruleType}
                                onChange={(e) => handleEditSectionChange(index, "ruleType", e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              >
                                <option value="Mandatory Field">Mandatory Field</option>
                                <option value="Prohibited Claim">Prohibited Claim</option>
                                <option value="Formatting Rule">Formatting Rule</option>
                                <option value="Storage Condition">Storage Condition</option>
                                <option value="General Rule">General Rule</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Severity</label>
                              <select
                                value={rule.severity}
                                onChange={(e) => handleEditSectionChange(index, "severity", e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              >
                                <option value="WARNING">WARNING</option>
                                <option value="CRITICAL">CRITICAL</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Rule Description</label>
                            <textarea
                              value={rule.ruleDescription}
                              onChange={(e) => handleEditSectionChange(index, "ruleDescription", e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[80px] whitespace-pre-wrap"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
