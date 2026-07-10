import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Rnd } from "react-rnd";
import Select from "react-select";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { createTemplate, getTemplateById, updateTemplate } from "../services/apiTemplates";
import toast from "react-hot-toast";
import { 
  Type, Image as ImageIcon, Table as TableIcon, Square, 
  Trash2, Save, Settings, Layers, AlignLeft, AlignCenter, AlignRight, PaintBucket,
  Undo2, Redo2, Sparkles, UploadCloud, X, Code
} from "lucide-react";
import Button from "../ui/Button";
import apiClient from "../services/apiClient";
const FONTS = [
  "Cairo", "Tajawal", "Almarai", "Montserrat", "Poppins", "Roboto", "Open Sans",
  "Arial", "Times New Roman", "Courier New", "Georgia", 
  "Verdana", "Tahoma", "Trebuchet MS", "Impact", "Comic Sans MS",
  "system-ui", "sans-serif", "serif", "monospace"
];

const fontOptions = FONTS.map(f => ({ value: f, label: f }));
const formatFontOptionLabel = ({ value, label }) => (
  <div style={{ fontFamily: value }}>{label}</div>
);

export default function Certificates() {
  const location = useLocation();
  const templateIdToLoad = location.state?.templateId;
  const [loadedTemplateId, setLoadedTemplateId] = useState(templateIdToLoad || null);

  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [templateName, setTemplateName] = useState("New Certificate");
  
  const [templateType, setTemplateType] = useState("CERTIFICATE");
  const [isGlobal, setIsGlobal] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [productId, setProductId] = useState("");
  const [templateFields, setTemplateFields] = useState(""); // JSON string
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [isCodeMode, setIsCodeMode] = useState(false);
  const [rawHtmlContent, setRawHtmlContent] = useState("");

  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([[]]); // History starts with empty canvas
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [editingElementId, setEditingElementId] = useState(null);
  const [showLayers, setShowLayers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveHistory = (newElements) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setElements(newElements);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
      setSelectedElementId(null);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
      setSelectedElementId(null);
    }
  };

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
    if (!selectedCompany) {
      setBrands([]);
      setSelectedBrand("");
      return;
    }
    const fetchBrands = async () => {
      try {
        const brandRes = await getBrands(selectedCompany);
        if (brandRes.status === "success") setBrands(brandRes.data.brands || []);
      } catch (err) {
        toast.error("Failed to load brands");
      }
    };
    fetchBrands();
  }, [selectedCompany]);

  useEffect(() => {
    if (templateIdToLoad) {
      const loadTemplate = async () => {
        try {
          const res = await getTemplateById(templateIdToLoad);
          if (res.status === "success") {
            const tmpl = res.data.template;
            setTemplateName(tmpl.name);
            setSelectedCompany(tmpl.companyId || "");
            setTemplateType(tmpl.type || "CERTIFICATE");
            setIsGlobal(tmpl.isGlobal !== undefined ? tmpl.isGlobal : true);
            setIsActive(tmpl.isActive !== undefined ? tmpl.isActive : true);
            setProductId(tmpl.productId || "");
            setTemplateFields(tmpl.fields ? JSON.stringify(tmpl.fields, null, 2) : "");
            
            // Wait for companies/brands effect to catch up, or set directly
            setTimeout(() => {
              setSelectedBrand(tmpl.brandId || "");
            }, 500);

            // Extract canva state from htmlContent
            const stateMatch = tmpl.htmlContent?.match(/<!-- CANVA_STATE:\s*(\[.*\])\s*-->/s);
            if (stateMatch && stateMatch[1]) {
              const jsonStr = stateMatch[1].replace(/&#45;&#45;/g, '--');
              try {
                const parsedElements = JSON.parse(jsonStr);
                setElements(parsedElements);
                setHistory([parsedElements]);
                setHistoryIndex(0);
                setIsCodeMode(false);
              } catch (e) {
                console.error("Failed to parse CANVA_STATE", e);
                const rawHtmlElement = {
                  id: Date.now().toString(),
                  type: "raw_html",
                  x: 0,
                  y: 0,
                  w: 1000,
                  h: 1414,
                  content: tmpl.htmlContent || "",
                  style: { zIndex: 1, opacity: 1, rotation: 0 }
                };
                setElements([rawHtmlElement]);
                setHistory([[rawHtmlElement]]);
                setHistoryIndex(0);
                setIsCodeMode(false);
              }
            } else {
              const rawHtmlElement = {
                id: Date.now().toString(),
                type: "raw_html",
                x: 0,
                y: 0,
                w: 1000,
                h: 1414,
                content: tmpl.htmlContent || "",
                style: { zIndex: 1, opacity: 1, rotation: 0 }
              };
              setElements([rawHtmlElement]);
              setHistory([[rawHtmlElement]]);
              setHistoryIndex(0);
              setIsCodeMode(false);
            }
          }
        } catch (error) {
          toast.error("Failed to load template design");
        }
      };
      loadTemplate();
    }
  }, [templateIdToLoad]);


  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Undo (Ctrl+Z)
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      
      // Redo (Ctrl+Y or Ctrl+Shift+Z)
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Escape') {
        // Auto-save iframe if we were editing it
        if (editingElementId) {
          const activeEl = elements.find(elem => elem.id === editingElementId);
          if (activeEl && activeEl.type === 'raw_html') {
            const iframe = document.getElementById(`iframe-${activeEl.id}`);
            if (iframe && iframe.contentDocument) {
              const doc = iframe.contentDocument;
              let fullHtml = doc.documentElement.outerHTML;
              if (doc.doctype) {
                fullHtml = `<!DOCTYPE ${doc.doctype.name}>\n` + fullHtml;
              } else {
                fullHtml = `<!DOCTYPE html>\n` + fullHtml;
              }
              updateElement(activeEl.id, { content: fullHtml });
            }
          }
        }
        setSelectedElementId(null);
        setEditingElementId(null);
        return;
      }

      // Ignore if typing in an input, textarea, or contentEditable element
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        removeElement(selectedElementId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, editingElementId, elements, history, historyIndex]);

  const addElement = (type) => {
    const newElement = {
      id: Date.now().toString(),
      type,
      x: 50,
      y: 50,
      w: type === "text" ? 200 : type === "table" ? 400 : 150,
      h: type === "text" ? 50 : type === "table" ? 200 : 150,
      content: type === "text" ? "Double click to edit" : type === "image" ? "https://via.placeholder.com/150" : type === "table" ? "Table (3x3)" : "",
      style: {
        fontFamily: "Arial",
        fontSize: 16,
        fontWeight: "normal",
        direction: "ltr",
        color: "#000000",
        backgroundColor: type === "rectangle" ? "#e5e7eb" : "transparent",
        opacity: 1,
        rotation: 0,
        zIndex: elements.length + 1,
        textAlign: "left",
        borderWidth: type === "table" ? 1 : 0,
        borderColor: "#000000",
      },
      tableConfig: type === "table" ? { rows: 3, cols: 3, headerBg: "#f3f4f6", headerColor: "#000000", cellBg: "#ffffff", cellColor: "#000000" } : null
    };
    saveHistory([...elements, newElement]);
    setSelectedElementId(newElement.id);
  };

  const updateElement = (id, updates) => {
    saveHistory(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const updateStyle = (id, styleUpdates) => {
    saveHistory(elements.map(el => el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el));
  };

  const removeElement = (id) => {
    saveHistory(elements.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const generateHtml = () => {
    const innerHtml = elements.map(el => {
      let commonStyles = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.w}px; height: ${el.h}px; z-index: ${el.style?.zIndex || 1}; opacity: ${el.style?.opacity ?? 1}; transform: rotate(${el.style?.rotation || 0}deg);`;
      
      if (el.type === "text") {
        commonStyles += `font-family: ${el.style.fontFamily}; font-size: ${el.style.fontSize}px; font-weight: ${el.style.fontWeight}; color: ${el.style.color}; text-align: ${el.style.textAlign}; direction: ${el.style.direction};`;
        return `<div style="${commonStyles}">${el.content}</div>`;
      } else if (el.type === "image") {
        return `<img src="${el.content}" style="${commonStyles} object-fit: contain;" />`;
      } else if (el.type === "rectangle") {
        commonStyles += `background-color: ${el.style.backgroundColor};`;
        return `<div style="${commonStyles}"></div>`;
      } else if (el.type === "table") {
        let tableHtml = `<table style="${commonStyles} border-collapse: collapse; border: ${el.style?.borderWidth || 0}px solid ${el.style?.borderColor || '#000'};"><tbody>`;
        for(let r=0; r < (el.tableConfig?.rows || 3); r++) {
          tableHtml += `<tr>`;
          for(let c=0; c < (el.tableConfig?.cols || 3); c++) {
            const bg = r === 0 ? el.tableConfig?.headerBg : el.tableConfig?.cellBg;
            const color = r === 0 ? el.tableConfig?.headerColor : el.tableConfig?.cellColor;
            const fw = r === 0 ? 'bold' : 'normal';
            tableHtml += `<td style="border: ${el.style?.borderWidth || 0}px solid ${el.style?.borderColor || '#000'}; padding: 8px; background-color: ${bg}; color: ${color}; font-weight: ${fw};"></td>`;
          }
          tableHtml += `</tr>`;
        }
        tableHtml += `</tbody></table>`;
        return tableHtml;
      } else if (el.type === "raw_html") {
        commonStyles += `background-color: transparent;`;
        return `<div style="${commonStyles}">${el.content}</div>`;
      }
      return '';
    }).join('\n');

    return `
      <div class="certificate-wrapper" style="position: relative; width: 1000px; height: 1414px; background: white; overflow: hidden;">
        ${innerHtml}
      </div>
      <!-- CANVA_STATE: ${JSON.stringify(elements).replace(/--/g, '&#45;&#45;')} -->
    `;
  };

  const handleToggleCodeMode = () => {
    if (!isCodeMode) {
      setRawHtmlContent(generateHtml());
    }
    setIsCodeMode(!isCodeMode);
  };

  const handleSave = async () => {
    if (!templateName) return toast.error("Please enter a certificate name");
    if (!selectedCompany) return toast.error("Please select a company");

    try {
      setIsSaving(true);
      
      // 1. Extract dynamic fields
      let finalFields = null;
      if (templateFields.trim()) {
        try {
          finalFields = JSON.parse(templateFields);
        } catch(e) {
          setIsSaving(false);
          return toast.error("Invalid JSON format in Fields");
        }
      } else {
        const extractedFields = {};
        elements.forEach(el => {
          if (el.type === "text") {
            const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
            let match;
            while ((match = regex.exec(el.content)) !== null) {
              extractedFields[match[1]] = "string";
            }
          }
        });
        if (Object.keys(extractedFields).length > 0) {
          finalFields = extractedFields;
        }
      }

      // 2. Build HTML Content
      let fullHtmlContent = "";
      if (isCodeMode) {
        fullHtmlContent = rawHtmlContent;
      } else {
        fullHtmlContent = generateHtml();
      }

      const payload = {
        name: templateName,
        type: templateType,
        brandId: selectedBrand || null,
        isGlobal: isGlobal,
        productId: isGlobal ? null : (productId || null),
        fields: finalFields,
        htmlContent: fullHtmlContent,
        companyId: selectedCompany || undefined,
        isActive: isActive
      };

      if (loadedTemplateId) {
        await updateTemplate(loadedTemplateId, payload);
        toast.success("Certificate updated successfully!");
      } else {
        const res = await createTemplate(selectedCompany, payload);
        if (res.data?.template?.id) {
          setLoadedTemplateId(res.data.template.id);
        }
        toast.success("Certificate saved successfully!");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save certificate");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200/60 shadow-xl shadow-slate-200/40 animate-in fade-in duration-500">
      
      {/* Topbar */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <PaintBucket className="w-5 h-5 text-white" />
          </div>
          <input 
            type="text" 
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="text-xl font-extrabold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none transition-colors px-2 py-1 w-64"
            placeholder="Certificate Name"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4 mr-2">
            <button 
              onClick={undo} 
              disabled={historyIndex === 0} 
              className={`p-2.5 rounded-xl transition-all ${historyIndex === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600 active:scale-95'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button 
              onClick={redo} 
              disabled={historyIndex === history.length - 1} 
              className={`p-2.5 rounded-xl transition-all ${historyIndex === history.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600 active:scale-95'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleToggleCodeMode} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-bold rounded-xl transition-all shadow-sm">
              <Code className="w-4 h-4 text-slate-500" /> {isCodeMode ? "Visual Mode" : "Code Mode"}
            </Button>
            <Button variant="secondary" onClick={() => setIsSettingsModalOpen(true)} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-bold rounded-xl transition-all shadow-sm">
              <Settings className="w-4 h-4 text-slate-500" /> Settings
            </Button>
            <Button onClick={handleSave} isLoading={isSaving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">
              <Save className="w-4 h-4" /> Save Template
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Toolbar */}
        <div className="w-20 bg-white border-r border-slate-200/60 flex flex-col items-center py-6 gap-4 z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
          <button onClick={() => addElement("text")} className="p-3.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm rounded-2xl transition-all group flex flex-col items-center gap-1.5 relative" title="Add Text">
            <Type className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 text-indigo-600 whitespace-nowrap">Text</span>
          </button>
          <button onClick={() => addElement("image")} className="p-3.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm rounded-2xl transition-all group flex flex-col items-center gap-1.5 relative" title="Add Image">
            <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 text-indigo-600 whitespace-nowrap">Image</span>
          </button>
          <button onClick={() => addElement("table")} className="p-3.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm rounded-2xl transition-all group flex flex-col items-center gap-1.5 relative" title="Add Table">
            <TableIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 text-indigo-600 whitespace-nowrap">Table</span>
          </button>
          <button onClick={() => addElement("rectangle")} className="p-3.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm rounded-2xl transition-all group flex flex-col items-center gap-1.5 relative" title="Add Shape">
            <Square className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 text-indigo-600 whitespace-nowrap">Shape</span>
          </button>
          
          <div className="mt-auto w-full border-t border-slate-100 pt-6 flex flex-col items-center">
            <button onClick={() => setShowLayers(!showLayers)} className={`p-3.5 rounded-2xl transition-all group flex flex-col items-center gap-1.5 relative ${showLayers ? 'text-indigo-600 bg-indigo-50 shadow-sm' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm'}`} title="Layers Panel">
              <Layers className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 text-indigo-600 whitespace-nowrap">Layers</span>
            </button>
          </div>
        </div>

        {/* Layers Panel */}
        {showLayers && (
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-10 shadow-sm overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Layers className="w-4 h-4" /> Layers</h3>
              <button onClick={() => setShowLayers(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {elements.map((el) => (
                <div 
                  key={el.id} 
                  onClick={() => setSelectedElementId(el.id)}
                  className={`p-2 flex items-center gap-3 rounded-lg cursor-pointer text-sm group ${selectedElementId === el.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  {el.type === 'text' && <Type className="w-4 h-4" />}
                  {el.type === 'image' && <ImageIcon className="w-4 h-4" />}
                  {el.type === 'rectangle' && <Square className="w-4 h-4" />}
                  {el.type === 'table' && <TableIcon className="w-4 h-4" />}
                  {el.type === 'raw_html' && <Code className="w-4 h-4" />}
                  <span className="truncate flex-1">
                    {el.type === 'text' ? el.content.substring(0, 15) || 'Text' : 
                     el.type === 'raw_html' ? 'HTML Block' : 
                     el.type.charAt(0).toUpperCase() + el.type.slice(1)}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {elements.length === 0 && <div className="text-center text-xs text-gray-400 mt-10">No layers</div>}
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 bg-slate-100 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] overflow-auto relative flex justify-center py-16" onClick={() => { 
          // Auto-save iframe content if clicking outside while editing
          if (editingElementId) {
            const activeEl = elements.find(e => e.id === editingElementId);
            if (activeEl && activeEl.type === 'raw_html') {
              const iframe = document.getElementById(`iframe-${activeEl.id}`);
              if (iframe && iframe.contentDocument) {
                const doc = iframe.contentDocument;
                let fullHtml = doc.documentElement.outerHTML;
                if (doc.doctype) {
                  fullHtml = `<!DOCTYPE ${doc.doctype.name}>\n` + fullHtml;
                } else {
                  fullHtml = `<!DOCTYPE html>\n` + fullHtml;
                }
                updateElement(activeEl.id, { content: fullHtml });
              }
            }
          }
          setSelectedElementId(null); 
          setEditingElementId(null); 
        }}>
          {isCodeMode ? (
            <div className="w-full max-w-4xl px-4 flex flex-col h-full">
              <div className="bg-gray-800 text-gray-200 px-4 py-3 rounded-t-lg text-sm font-mono flex justify-between items-center shrink-0">
                <span>Raw HTML Editor</span>
                <span className="text-gray-400 text-xs">Variables format: {`{{var_name}}`}</span>
              </div>
              <textarea
                value={rawHtmlContent}
                onChange={(e) => setRawHtmlContent(e.target.value)}
                className="w-full flex-1 bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-6 outline-none rounded-b-lg resize-none shadow-xl"
                placeholder="<!-- Paste your raw HTML Code Here -->"
              />
            </div>
          ) : (
            <div 
              className="bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] relative border border-slate-200/50" 
              style={{ width: "1000px", height: "1414px", minHeight: "1414px" }} 
              onClick={(e) => { 
                e.stopPropagation(); // prevent canvas click from firing if clicking inside the certificate
                setSelectedElementId(null); 
                
                // Auto-save if clicking inside the cert but outside the iframe
                if (editingElementId) {
                  const activeEl = elements.find(elem => elem.id === editingElementId);
                  if (activeEl && activeEl.type === 'raw_html') {
                    const iframe = document.getElementById(`iframe-${activeEl.id}`);
                    if (iframe && iframe.contentDocument) {
                      const doc = iframe.contentDocument;
                      let fullHtml = doc.documentElement.outerHTML;
                      if (doc.doctype) {
                        fullHtml = `<!DOCTYPE ${doc.doctype.name}>\n` + fullHtml;
                      } else {
                        fullHtml = `<!DOCTYPE html>\n` + fullHtml;
                      }
                      updateElement(activeEl.id, { content: fullHtml });
                    }
                  }
                }
                setEditingElementId(null); 
              }}
            >
              {elements.map((el) => (
              <Rnd
                key={el.id}
                size={{ width: el.w, height: el.h }}
                position={{ x: el.x, y: el.y }}
                onDragStop={(e, d) => updateElement(el.id, { x: d.x, y: d.y })}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateElement(el.id, {
                    w: parseInt(ref.style.width, 10),
                    h: parseInt(ref.style.height, 10),
                    ...position,
                  });
                }}
                className={`${selectedElementId === el.id ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-gray-300"} transition-shadow`}
                style={{
                  zIndex: el.style.zIndex,
                  opacity: el.style.opacity,
                  backgroundColor: el.type === "rectangle" ? el.style.backgroundColor : "transparent",
                  color: el.style.color,
                  fontFamily: el.style.fontFamily || "Arial",
                  fontWeight: el.style.fontWeight || "normal",
                  fontSize: `${el.style.fontSize}px`,
                  textAlign: el.style.textAlign,
                  cursor: editingElementId === el.id ? 'text' : 'move',
                  direction: el.style.direction || "ltr",
                }}
                disableDragging={editingElementId === el.id}
                enableUserSelectHack={editingElementId !== el.id}
                onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingElementId(el.id); }}
              >
                <div style={{ transform: `rotate(${el.style?.rotation || 0}deg)`, width: '100%', height: '100%' }}>
                  {el.type === "text" && (
                    <div 
                      className={`w-full h-full p-2 outline-none break-words ${editingElementId === el.id ? 'ring-1 ring-blue-300' : ''}`} 
                      contentEditable={editingElementId === el.id} 
                      suppressContentEditableWarning 
                      onBlur={(e) => { updateElement(el.id, { content: e.currentTarget.textContent }); setEditingElementId(null); }}
                    >
                      {el.content}
                    </div>
                  )}
                  {el.type === "image" && (
                    <div className={`w-full h-full flex items-center justify-center overflow-hidden ${(el.content.startsWith("http") || el.content.startsWith("data:image")) ? '' : 'border-2 border-dashed border-gray-300 bg-gray-50'}`}>
                       {(el.content.startsWith("http") || el.content.startsWith("data:image")) ? <img src={el.content} className="w-full h-full object-contain pointer-events-none select-none" alt="element" /> : <span className="text-xs text-gray-400 p-2 text-center">Image Placeholder<br/>(Upload or set URL)</span>}
                    </div>
                  )}
                  {el.type === "table" && (
                    <table className="w-full h-full border-collapse" style={{ borderWidth: `${el.style.borderWidth}px`, borderColor: el.style.borderColor, borderStyle: 'solid' }}>
                      <tbody>
                        {Array.from({ length: el.tableConfig?.rows || 3 }).map((_, rIdx) => (
                          <tr key={rIdx}>
                            {Array.from({ length: el.tableConfig?.cols || 3 }).map((_, cIdx) => (
                              <td 
                                key={cIdx} 
                                style={{ 
                                  border: `${el.style?.borderWidth || 0}px solid ${el.style?.borderColor || '#000'}`,
                                  backgroundColor: rIdx === 0 ? el.tableConfig?.headerBg : el.tableConfig?.cellBg,
                                  color: rIdx === 0 ? el.tableConfig?.headerColor : el.tableConfig?.cellColor,
                                  fontWeight: rIdx === 0 ? 'bold' : 'normal'
                                }}
                                className={`p-2 outline-none ${editingElementId === el.id ? 'ring-1 ring-blue-300 inset-0' : ''}`}
                                contentEditable={editingElementId === el.id}
                                suppressContentEditableWarning
                                onBlur={() => setEditingElementId(null)}
                              >
                                {rIdx === 0 ? `Header ${cIdx + 1}` : `Data ${cIdx + 1}`}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {el.type === "raw_html" && (
                    <div className="w-full h-full relative">
                      {editingElementId === el.id && (
                        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-4 fade-in duration-300">
                          <button 
                            className="bg-white/90 backdrop-blur-md text-emerald-700 border border-emerald-200/50 px-6 py-2.5 rounded-2xl font-bold shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-emerald-50 hover:shadow-[0_8px_30px_rgb(16,185,129,0.2)] flex items-center gap-2 transition-all hover:-translate-y-1 group"
                            onClick={(e) => {
                              e.stopPropagation();
                              const iframe = document.getElementById(`iframe-${el.id}`);
                              if (iframe && iframe.contentDocument) {
                                const doc = iframe.contentDocument;
                                let fullHtml = doc.documentElement.outerHTML;
                                if (doc.doctype) {
                                  fullHtml = `<!DOCTYPE ${doc.doctype.name}>\n` + fullHtml;
                                } else {
                                  fullHtml = `<!DOCTYPE html>\n` + fullHtml;
                                }
                                updateElement(el.id, { content: fullHtml });
                              }
                              setEditingElementId(null);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                            Save Changes & Close
                          </button>
                        </div>
                      )}
                      <iframe
                        id={`iframe-${el.id}`}
                        className={`w-full h-full outline-none border-none ${editingElementId === el.id ? 'ring-4 ring-emerald-500 rounded-lg' : ''}`}
                        srcDoc={el.content}
                        ref={(node) => {
                          if (node && node.contentDocument) {
                            node.contentDocument.designMode = editingElementId === el.id ? "on" : "off";
                          }
                        }}
                        style={{ pointerEvents: editingElementId === el.id ? 'auto' : 'none' }}
                        title="HTML Editor"
                      />
                    </div>
                  )}
                </div>
              </Rnd>
            ))}
          </div>
          )}
        </div>

        {/* Right Settings Panel (only visible in Visual Mode) */}
        {!isCodeMode && selectedElement && (
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-800">Properties</h3>
            </div>
            
            <div className="p-4 space-y-6">
              
              {/* Type specific controls */}
              {selectedElement?.type === "image" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Upload Image</label>
                    <label className="w-full flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 font-bold border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Select Local File
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              updateElement(selectedElement.id, { content: reader.result });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <span className="text-xs text-gray-400 font-bold uppercase">OR</span>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Image URL</label>
                    <input 
                      type="text" 
                      value={selectedElement.content.startsWith("data:image") ? "" : selectedElement.content} 
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      placeholder="Paste image URL..."
                    />
                  </div>
                </div>
              )}

              {selectedElement?.type === "text" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Font Family</label>
                    <Select
                      options={fontOptions}
                      value={fontOptions.find(o => o.value === (selectedElement.style.fontFamily || "Arial"))}
                      onChange={(selected) => updateStyle(selectedElement.id, { fontFamily: selected.value })}
                      formatOptionLabel={formatFontOptionLabel}
                      className="text-sm"
                      placeholder="Search fonts..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Size (px)</label>
                      <input 
                        type="number" 
                        value={selectedElement.style.fontSize} 
                        onChange={(e) => updateStyle(selectedElement.id, { fontSize: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Weight</label>
                      <select 
                        value={selectedElement.style.fontWeight || "normal"} 
                        onChange={(e) => updateStyle(selectedElement.id, { fontWeight: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                      >
                        <option value="normal">Normal</option>
                        <option value="500">Medium (500)</option>
                        <option value="600">Semi Bold (600)</option>
                        <option value="bold">Bold (700)</option>
                        <option value="800">Extra Bold (800)</option>
                        <option value="900">Black (900)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Direction (RTL/LTR)</label>
                    <div className="flex bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <button 
                        onClick={() => updateStyle(selectedElement.id, { direction: 'ltr' })}
                        className={`flex-1 p-2 flex justify-center transition-colors text-xs font-bold ${selectedElement.style.direction === 'ltr' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        LTR (English)
                      </button>
                      <button 
                        onClick={() => updateStyle(selectedElement.id, { direction: 'rtl' })}
                        className={`flex-1 p-2 flex justify-center border-l border-gray-200 transition-colors text-xs font-bold ${selectedElement.style.direction === 'rtl' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        RTL (Arabic)
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Alignment</label>
                    <div className="flex bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <button 
                        onClick={() => updateStyle(selectedElement.id, { textAlign: 'left' })}
                        className={`flex-1 p-2 flex justify-center transition-colors ${selectedElement.style.textAlign === 'left' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => updateStyle(selectedElement.id, { textAlign: 'center' })}
                        className={`flex-1 p-2 flex justify-center border-l border-r border-gray-200 transition-colors ${selectedElement.style.textAlign === 'center' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => updateStyle(selectedElement.id, { textAlign: 'right' })}
                        className={`flex-1 p-2 flex justify-center transition-colors ${selectedElement.style.textAlign === 'right' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(selectedElement?.type === "text" || selectedElement?.type === "rectangle") && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Color</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={selectedElement.type === "rectangle" ? selectedElement.style.backgroundColor : selectedElement.style.color} 
                      onChange={(e) => updateStyle(selectedElement.id, selectedElement.type === "rectangle" ? { backgroundColor: e.target.value } : { color: e.target.value })}
                      className="w-10 h-10 p-1 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={selectedElement.type === "rectangle" ? selectedElement.style.backgroundColor : selectedElement.style.color}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono"
                    />
                  </div>
                </div>
              )}

              {selectedElement?.type === "table" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rows</label>
                      <input type="number" min="1" value={selectedElement.tableConfig.rows} onChange={(e) => updateElement(selectedElement.id, { tableConfig: { ...selectedElement.tableConfig, rows: Number(e.target.value) }})} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cols</label>
                      <input type="number" min="1" value={selectedElement.tableConfig.cols} onChange={(e) => updateElement(selectedElement.id, { tableConfig: { ...selectedElement.tableConfig, cols: Number(e.target.value) }})} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 mt-2">Header Colors</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Background</label>
                        <input type="color" value={selectedElement.tableConfig.headerBg || "#f3f4f6"} onChange={(e) => updateElement(selectedElement.id, { tableConfig: { ...selectedElement.tableConfig, headerBg: e.target.value }})} className="w-full h-8 cursor-pointer rounded" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Text</label>
                        <input type="color" value={selectedElement.tableConfig.headerColor || "#000000"} onChange={(e) => updateElement(selectedElement.id, { tableConfig: { ...selectedElement.tableConfig, headerColor: e.target.value }})} className="w-full h-8 cursor-pointer rounded" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cell Colors</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Background</label>
                        <input type="color" value={selectedElement.tableConfig.cellBg || "#ffffff"} onChange={(e) => updateElement(selectedElement.id, { tableConfig: { ...selectedElement.tableConfig, cellBg: e.target.value }})} className="w-full h-8 cursor-pointer rounded" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Text</label>
                        <input type="color" value={selectedElement.tableConfig.cellColor || "#000000"} onChange={(e) => updateElement(selectedElement.id, { tableConfig: { ...selectedElement.tableConfig, cellColor: e.target.value }})} className="w-full h-8 cursor-pointer rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedElement?.type === "raw_html" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Edit HTML</label>
                    <textarea 
                      value={selectedElement.content} 
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono h-48"
                    />
                  </div>
                </div>
              )}

              {/* Universal controls */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rotation</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="0" max="360" step="1" 
                      value={selectedElement.style?.rotation || 0} 
                      onChange={(e) => updateStyle(selectedElement.id, { rotation: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-8 text-right">{selectedElement.style?.rotation || 0}°</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Opacity</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={selectedElement.style?.opacity ?? 1} 
                      onChange={(e) => updateStyle(selectedElement.id, { opacity: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-8 text-right">{Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Z-Index (Layer)</label>
                <input 
                  type="number" 
                  value={selectedElement.style?.zIndex || 1} 
                  onChange={(e) => updateStyle(selectedElement.id, { zIndex: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              <div className="pt-6 mt-6 border-t border-red-100">
                <button 
                  onClick={() => removeElement(selectedElement.id)}
                  className="w-full py-2.5 flex items-center justify-center gap-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete Element
                </button>
              </div>

            </div>
          </div>
        )}
        
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Template Settings</h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 text-sm"
                >
                  <option value="">Global Template (No Company)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand (Optional)</label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  disabled={!selectedCompany}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 text-sm disabled:opacity-50"
                >
                  <option value="">No Brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
                <input
                  type="text"
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 text-sm uppercase"
                  placeholder="CERTIFICATE, LABEL, etc."
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="isGlobal"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="isGlobal" className="text-sm font-medium text-gray-700">Is Global Template?</label>
              </div>

              {!isGlobal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID (Optional)</label>
                  <input
                    type="text"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 text-sm font-mono"
                    placeholder="Enter Product UUID"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Is Active?</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fields (JSON array)</label>
                <textarea
                  value={templateFields}
                  onChange={(e) => setTemplateFields(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 font-mono text-sm"
                  rows={3}
                  placeholder='Leave empty to auto-extract from {{var_name}}'
                />
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <Button onClick={() => setIsSettingsModalOpen(false)}>
                Apply Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
