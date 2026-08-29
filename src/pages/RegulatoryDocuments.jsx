import { useState, useEffect, useCallback } from "react";
import {
  FileText, Upload, Plus, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert,
  Search, RefreshCw, X, ChevronRight, Check, Ban, Pencil, Eye, Link as LinkIcon, Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getDocuments, getDocument, uploadDocument, compileRules, auditCoverage, approveDocument, clearClause
} from "../services/apiRegulatoryDocuments";
import { getRules, updateRule, approveRule, rejectRule } from "../services/apiRegulatoryRules";
import Button from "../ui/Button";

const STATUS_CLASSES = {
  pending_review: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-green-50 text-green-800 border-green-200",
  rejected: "bg-red-50 text-red-800 border-red-200",
  draft: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function RegulatoryDocuments() {
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Selected document detail view
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [docDetail, setDocDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Upload modal
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    authority: "SFDA",
    country: "Saudi Arabia",
    documentVersion: "1.0",
    productScope: "veterinary_medicines",
    sourceUrl: "",
    file: null,
  });

  // Actions loading states
  const [isCompiling, setIsCompiling] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [clearingClauseRef, setClearingClauseRef] = useState(null);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getDocuments();
      setDocuments(res.documents || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.message || "Failed to load regulatory documents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const loadDocDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      setIsDetailLoading(true);
      const doc = await getDocument(id);
      setDocDetail(doc);
    } catch (err) {
      toast.error(err.message || "Failed to load document details");
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      loadDocDetail(selectedDocId);
    } else {
      setDocDetail(null);
    }
  }, [selectedDocId, loadDocDetail]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      toast.error("Please select a PDF document to upload.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("title", uploadForm.title.trim() || uploadForm.file.name);
      formData.append("authority", uploadForm.authority.trim());
      formData.append("country", uploadForm.country.trim());
      formData.append("documentVersion", uploadForm.documentVersion.trim());
      formData.append("productScope", JSON.stringify(uploadForm.productScope.split(",").map((s) => s.trim()).filter(Boolean)));
      if (uploadForm.sourceUrl.trim()) formData.append("sourceUrl", uploadForm.sourceUrl.trim());

      const result = await uploadDocument(formData);
      toast.success("Document uploaded successfully.");
      setIsUploadOpen(false);
      setUploadForm({
        title: "",
        authority: "SFDA",
        country: "Saudi Arabia",
        documentVersion: "1.0",
        productScope: "veterinary_medicines",
        sourceUrl: "",
        file: null,
      });
      await loadDocuments();
      if (result?.document?.id) setSelectedDocId(result.document.id);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCompileRules = async () => {
    if (!selectedDocId) return;
    try {
      setIsCompiling(true);
      const res = await compileRules(selectedDocId);
      toast.success(`Rules compiled successfully. Found ${res?.rules?.length || 0} regulatory rule(s).`);
      await loadDocDetail(selectedDocId);
      await loadDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to compile rules");
    } finally {
      setIsCompiling(false);
    }
  };

  const handleAuditCoverage = async () => {
    if (!selectedDocId) return;
    try {
      setIsAuditing(true);
      const doc = await auditCoverage(selectedDocId);
      setDocDetail(doc);
      toast.success(`Coverage audit completed: ${doc.coveragePercent?.toFixed(1) || 0}%`);
      await loadDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to audit coverage");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleClearClause = async (ref) => {
    if (!selectedDocId) return;
    try {
      setClearingClauseRef(ref);
      const doc = await clearClause(selectedDocId, ref);
      setDocDetail(doc);
      toast.success(`Cleared clause ${ref}. Coverage updated.`);
      await loadDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to clear clause");
    } finally {
      setClearingClauseRef(null);
    }
  };

  const handleApproveDocument = async () => {
    if (!selectedDocId) return;
    try {
      setIsApproving(true);
      const doc = await approveDocument(selectedDocId);
      setDocDetail(doc);
      toast.success("Regulatory Document Approved!");
      await loadDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Approval refused");
    } finally {
      setIsApproving(false);
    }
  };

  const handleApproveRule = async (ruleId) => {
    try {
      await approveRule(ruleId);
      toast.success("Rule approved");
      await loadDocDetail(selectedDocId);
    } catch (err) {
      toast.error(err.message || "Failed to approve rule");
    }
  };

  const handleRejectRule = async (ruleId) => {
    try {
      await rejectRule(ruleId);
      toast("Rule rejected", { icon: "🚫" });
      await loadDocDetail(selectedDocId);
    } catch (err) {
      toast.error(err.message || "Failed to reject rule");
    }
  };

  // Check if approval is blocked (< 95% coverage with uncleared clauses)
  const coveragePercent = docDetail?.coveragePercent ?? 0;
  const isCoverageBelowThreshold = coveragePercent < 95;
  const isApproved = docDetail?.status === "approved";

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" /> Regulatory Ingestion & Rule Review
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Ingest official regulations, compile structured ATS rules with quoted citations, and audit clause coverage.
          </p>
        </div>
        <Button onClick={() => setIsUploadOpen(true)}>
          <Plus className="w-4 h-4" /> Ingest New Regulation (PDF)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Documents List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide px-1">Authority Documents</h3>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block" />
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No regulatory documents</p>
              <p className="text-xs text-gray-400 mt-1">Upload an authority PDF to begin rule compilation.</p>
            </div>
          ) : (
            documents.map((doc) => {
              const isSelected = doc.id === selectedDocId;
              const cov = doc.coveragePercent != null ? doc.coveragePercent.toFixed(1) : "N/A";
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-blue-600 ring-2 ring-blue-100 shadow-md"
                      : "border-gray-200 hover:border-gray-300 shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-gray-900 text-sm line-clamp-1">{doc.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      STATUS_CLASSES[doc.status] || STATUS_CLASSES.draft
                    }`}>
                      {doc.status?.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="font-semibold text-blue-700">{doc.authority}</span>
                    <span>·</span>
                    <span>{doc.country}</span>
                    <span>·</span>
                    <span className="font-mono">v{doc.documentVersion}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Coverage:</span>
                    <span className={`font-bold ${doc.coveragePercent >= 95 ? "text-green-600" : "text-amber-600"}`}>
                      {cov}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Document Details & Rules */}
        <div className="lg:col-span-2">
          {!selectedDocId ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 shadow-sm">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h4 className="text-base font-bold text-gray-700">Select a document to review</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Select an authority document on the left to compile rules, run clause coverage audits, and review cited rules.
              </p>
            </div>
          ) : isDetailLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin inline-block" />
            </div>
          ) : docDetail ? (
            <div className="space-y-6">
              {/* Document Overview Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{docDetail.title}</h2>
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-gray-600">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {docDetail.authority}
                      </span>
                      <span>{docDetail.country}</span>
                      <span>·</span>
                      <span className="font-mono">Version {docDetail.documentVersion}</span>
                      <span>·</span>
                      <span>Scope: {(docDetail.productScope || []).join(", ")}</span>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                    STATUS_CLASSES[docDetail.status] || STATUS_CLASSES.draft
                  }`}>
                    {docDetail.status?.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Coverage Banner (§7.5 Coverage Gate) */}
                <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-700">
                      Clause Coverage Accounting (§7.5)
                    </span>
                    <span className={`text-lg font-black ${coveragePercent >= 95 ? "text-green-600" : "text-amber-600"}`}>
                      {coveragePercent.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mb-2">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        coveragePercent >= 95 ? "bg-green-600" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, coveragePercent))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {docDetail.clauseCoveredCount || 0} covered of {docDetail.clauseTotalCount || 0} total clauses
                    </span>
                    <span>Threshold: 95.0%</span>
                  </div>

                  {isCoverageBelowThreshold && !isApproved && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-800 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        <strong>Approval Blocked:</strong> Document coverage is below 95%. You must clear all uncovered clauses before this document can be approved.
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="mt-5 flex items-center justify-between gap-3 flex-wrap pt-2">
                  <div className="flex items-center gap-2">
                    <Button onClick={handleCompileRules} isLoading={isCompiling} variant="secondary" className="text-xs">
                      <Sparkles className="w-3.5 h-3.5" /> Compile Rules (AI)
                    </Button>
                    <Button onClick={handleAuditCoverage} isLoading={isAuditing} variant="secondary" className="text-xs">
                      <RefreshCw className="w-3.5 h-3.5" /> Audit Coverage
                    </Button>
                  </div>

                  {!isApproved && (
                    <Button
                      onClick={handleApproveDocument}
                      isLoading={isApproving}
                      disabled={isCoverageBelowThreshold}
                      className="text-xs px-4 py-2 font-bold"
                    >
                      <ShieldCheck className="w-4 h-4" /> Formally Approve Document
                    </Button>
                  )}
                </div>
              </div>

              {/* Uncovered Clauses List */}
              {docDetail.uncoveredClauses?.length > 0 && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Uncovered Clauses ({docDetail.uncoveredClauses.length})
                  </h4>
                  <div className="space-y-2">
                    {docDetail.uncoveredClauses.map((clause, idx) => (
                      <div key={idx} className="bg-white rounded-xl p-3 border border-amber-200 flex items-center justify-between gap-3">
                        <div className="text-xs">
                          <p className="font-bold text-gray-900">{clause.reference || `Clause #${idx + 1}`}</p>
                          <p className="text-gray-600 mt-0.5 italic">&ldquo;{clause.text}&rdquo;</p>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => handleClearClause(clause.reference)}
                          isLoading={clearingClauseRef === clause.reference}
                          className="text-xs px-3 py-1 flex-shrink-0"
                        >
                          Clear Clause
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compiled Regulatory Rules */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" /> Compiled Rules ({docDetail.rules?.length || 0})
                  </h3>
                  <span className="text-xs text-gray-500">Every rule must have a quoted citation</span>
                </div>

                {(!docDetail.rules || docDetail.rules.length === 0) ? (
                  <p className="text-sm text-gray-400 italic py-4 text-center">
                    No rules compiled yet. Click &ldquo;Compile Rules (AI)&rdquo; to extract rules from document context.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {docDetail.rules.map((rule) => (
                      <div key={rule.id} className="border border-gray-200 rounded-xl p-4 space-y-2 bg-gray-50/30">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {rule.ruleKey}
                            </span>
                            <span className="text-xs font-mono text-gray-600">{rule.targetPath}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            STATUS_CLASSES[rule.status] || STATUS_CLASSES.draft
                          }`}>
                            {rule.status}
                          </span>
                        </div>

                        <p className="text-xs text-gray-800 font-semibold">{rule.ruleName || rule.description}</p>

                        {/* Quoted Citation */}
                        {rule.citation && (
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200 text-xs text-gray-700 italic flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span>&ldquo;{rule.citation}&rdquo;</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                          <span className="text-gray-500 font-mono">
                            Op: {rule.operator} {rule.expectedValue ? `(${JSON.stringify(rule.expectedValue)})` : ""}
                          </span>

                          <div className="flex items-center gap-2">
                            {rule.status !== "approved" && (
                              <button
                                onClick={() => handleApproveRule(rule.id)}
                                className="flex items-center gap-1 text-[11px] font-bold text-green-700 hover:text-green-900 bg-green-50 px-2 py-1 rounded-md border border-green-200"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                            )}
                            {rule.status !== "rejected" && (
                              <button
                                onClick={() => handleRejectRule(rule.id)}
                                className="flex items-center gap-1 text-[11px] font-bold text-red-700 hover:text-red-900 bg-red-50 px-2 py-1 rounded-md border border-red-200"
                              >
                                <Ban className="w-3 h-3" /> Reject
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Upload Regulation Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" /> Ingest Regulatory Document
              </h3>
              <button onClick={() => setIsUploadOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="e.g. SFDA Executive Regulations for Veterinary Products"
                  className="w-full text-sm rounded-xl border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Authority *</label>
                  <input
                    type="text"
                    required
                    value={uploadForm.authority}
                    onChange={(e) => setUploadForm({ ...uploadForm, authority: e.target.value })}
                    placeholder="e.g. SFDA, EDA"
                    className="w-full text-sm rounded-xl border border-gray-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    value={uploadForm.country}
                    onChange={(e) => setUploadForm({ ...uploadForm, country: e.target.value })}
                    className="w-full text-sm rounded-xl border border-gray-300 p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Document Version</label>
                  <input
                    type="text"
                    value={uploadForm.documentVersion}
                    onChange={(e) => setUploadForm({ ...uploadForm, documentVersion: e.target.value })}
                    className="w-full text-sm rounded-xl border border-gray-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Product Scope</label>
                  <input
                    type="text"
                    value={uploadForm.productScope}
                    onChange={(e) => setUploadForm({ ...uploadForm, productScope: e.target.value })}
                    placeholder="veterinary_medicines, feeds"
                    className="w-full text-sm rounded-xl border border-gray-300 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Source URL (Optional)</label>
                <input
                  type="url"
                  value={uploadForm.sourceUrl}
                  onChange={(e) => setUploadForm({ ...uploadForm, sourceUrl: e.target.value })}
                  placeholder="https://sfda.gov.sa/..."
                  className="w-full text-sm rounded-xl border border-gray-300 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Regulatory PDF File *</label>
                <input
                  type="file"
                  required
                  accept=".pdf"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  className="w-full text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isUploading}>
                  Upload & Ingest
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
