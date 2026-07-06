import { useState, useEffect } from "react";
import { Rnd } from "react-rnd";
import Select from "react-select";
import { getCompanies } from "../services/apiCompanies";
import { getBrands } from "../services/apiBrands";
import { createTemplate } from "../services/apiTemplates";
import toast from "react-hot-toast";
import { 
  Type, Image as ImageIcon, Table as TableIcon, Square, 
  Trash2, Save, Settings, Layers, AlignLeft, AlignCenter, AlignRight, PaintBucket,
  Undo2, Redo2, Sparkles, UploadCloud
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
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [templateName, setTemplateName] = useState("New Certificate");
  
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([[]]); // History starts with empty canvas
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [editingElementId, setEditingElementId] = useState(null);
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
  }, [selectedElementId, elements, history, historyIndex]);

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

  const handleSave = async () => {
    if (!templateName) return toast.error("Please enter a certificate name");
    if (!selectedCompany) return toast.error("Please select a company");

    try {
      setIsSaving(true);
      
      // 1. Extract dynamic fields from text elements that use {{var_name}}
      const extractedFields = {};
      elements.forEach(el => {
        if (el.type === "text") {
          const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
          let match;
          while ((match = regex.exec(el.content)) !== null) {
            extractedFields[match[1]] = "string"; // tell the backend LLM what type to expect
          }
        }
      });

      // 2. Generate HTML representation of the certificate
      const innerHtml = elements.map(el => {
        let commonStyles = `position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.w}px; height: ${el.h}px; z-index: ${el.style.zIndex || 1}; opacity: ${el.style.opacity || 1}; transform: rotate(${el.style.rotation || 0}deg);`;
        
        if (el.type === "text") {
          commonStyles += `font-family: '${el.style.fontFamily || 'Arial'}', sans-serif; font-size: ${el.style.fontSize}px; font-weight: ${el.style.fontWeight || 'normal'}; color: ${el.style.color}; text-align: ${el.style.textAlign || 'left'}; direction: ${el.style.direction || 'ltr'};`;
          return `<div style="${commonStyles}">${el.content.replace(/\n/g, '<br/>')}</div>`;
        } else if (el.type === "image") {
          return `<img src="${el.content}" style="${commonStyles} object-fit: contain;" />`;
        } else if (el.type === "rectangle") {
          commonStyles += `background-color: ${el.style.backgroundColor};`;
          return `<div style="${commonStyles}"></div>`;
        } else if (el.type === "table") {
          let tableHtml = `<table style="${commonStyles} border-collapse: collapse; border: ${el.style.borderWidth}px solid ${el.style.borderColor};"><tbody>`;
          for(let r=0; r < (el.tableConfig?.rows || 3); r++) {
            tableHtml += `<tr>`;
            for(let c=0; c < (el.tableConfig?.cols || 3); c++) {
              const bg = r === 0 ? el.tableConfig.headerBg : el.tableConfig.cellBg;
              const color = r === 0 ? el.tableConfig.headerColor : el.tableConfig.cellColor;
              const fw = r === 0 ? 'bold' : 'normal';
              tableHtml += `<td style="border: ${el.style.borderWidth}px solid ${el.style.borderColor}; padding: 8px; background-color: ${bg}; color: ${color}; font-weight: ${fw};"></td>`;
            }
            tableHtml += `</tr>`;
          }
          tableHtml += `</tbody></table>`;
          return tableHtml;
        }
        return '';
      }).join('\\n');

      const fullHtmlContent = `
        <div class="certificate-wrapper" style="position: relative; width: 1000px; height: 1414px; background: white; overflow: hidden;">
          ${innerHtml}
        </div>
        <!-- CANVA_STATE: ${JSON.stringify(elements).replace(/--/g, '&#45;&#45;')} -->
      `;

      const payload = {
        name: templateName,
        type: "certificate",
        brandId: selectedBrand || null,
        isGlobal: false,
        fields: extractedFields, // Backend LLM needs this exactly to know what to fill
        htmlContent: fullHtmlContent
      };

      await createTemplate(selectedCompany, payload);
      toast.success("Certificate saved successfully!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save certificate");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedElement = elements.find(el => el.id === selectedElementId);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-sm animate-in fade-in duration-500">
      
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="text-xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors px-2 py-1"
            placeholder="Certificate Name"
          />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-r border-gray-200 pr-4 mr-2">
            <button 
              onClick={undo} 
              disabled={historyIndex === 0} 
              className={`p-2 rounded-lg transition-colors ${historyIndex === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button 
              onClick={redo} 
              disabled={historyIndex === history.length - 1} 
              className={`p-2 rounded-lg transition-colors ${historyIndex === history.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 className="w-5 h-5" />
            </button>
          </div>

          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!selectedCompany}
          >
            <option value="">Select Brand (Optional)</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <div className="flex gap-2">
            <Button onClick={handleSave} isLoading={isSaving} className="flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Template
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Toolbar */}
        <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 gap-6 z-20 shadow-sm">
          <button onClick={() => addElement("text")} className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors group flex flex-col items-center gap-1" title="Add Text">
            <Type className="w-6 h-6" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Text</span>
          </button>
          <button onClick={() => addElement("image")} className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors group flex flex-col items-center gap-1" title="Add Image">
            <ImageIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Image</span>
          </button>
          <button onClick={() => addElement("table")} className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors group flex flex-col items-center gap-1" title="Add Table">
            <TableIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Table</span>
          </button>
          <button onClick={() => addElement("rectangle")} className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors group flex flex-col items-center gap-1" title="Add Shape">
            <Square className="w-6 h-6" />
            <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Shape</span>
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-gray-100 overflow-auto relative flex justify-center py-10" onClick={() => { setSelectedElementId(null); setEditingElementId(null); }}>
          <div 
            className="bg-white shadow-xl relative" 
            style={{ width: "1000px", height: "1414px", minHeight: "1414px" }} 
            onClick={() => { setSelectedElementId(null); setEditingElementId(null); }}
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
                <div style={{ transform: `rotate(${el.style.rotation || 0}deg)`, width: '100%', height: '100%' }}>
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
                              className="p-2 border" 
                              style={{ 
                                borderWidth: `${el.style.borderWidth}px`, 
                                borderColor: el.style.borderColor,
                                backgroundColor: rIdx === 0 ? (el.tableConfig.headerBg || "#f3f4f6") : (el.tableConfig.cellBg || "#ffffff"),
                                color: rIdx === 0 ? (el.tableConfig.headerColor || "#000000") : (el.tableConfig.cellColor || "#000000"),
                                fontWeight: rIdx === 0 ? "bold" : "normal"
                              }}
                            >
                              <div contentEditable={editingElementId === el.id} suppressContentEditableWarning className="outline-none min-h-[20px]">{rIdx === 0 ? "Header" : "Cell"}</div>
                            </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Rnd>
            ))}
          </div>
        </div>

        {/* Right Properties Panel */}
        {selectedElement && (
          <div className="w-72 bg-white border-l border-gray-200 flex flex-col z-20 shadow-sm overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-800">Properties</h3>
            </div>
            
            <div className="p-4 space-y-6">
              
              {/* Type specific controls */}
              {selectedElement.type === "image" && (
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

              {selectedElement.type === "text" && (
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

              {(selectedElement.type === "text" || selectedElement.type === "rectangle") && (
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

              {selectedElement.type === "table" && (
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

              {/* Universal controls */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Rotation</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="0" max="360" step="1" 
                      value={selectedElement.style.rotation || 0} 
                      onChange={(e) => updateStyle(selectedElement.id, { rotation: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-8 text-right">{selectedElement.style.rotation || 0}°</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Opacity</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={selectedElement.style.opacity} 
                      onChange={(e) => updateStyle(selectedElement.id, { opacity: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-8 text-right">{Math.round(selectedElement.style.opacity * 100)}%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Z-Index (Layer)</label>
                <input 
                  type="number" 
                  value={selectedElement.style.zIndex} 
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
    </div>
  );
}
