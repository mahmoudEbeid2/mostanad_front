import React from "react";
import { Copy, Dna, Info, Syringe, Settings, PackageOpen, Scale, AlertCircle, FlaskConical, ClipboardCheck } from "lucide-react";
import toast from "react-hot-toast";

const copyToClipboard = (text, section) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  toast.success(`Copied ${section} to clipboard!`);
};

const Section = ({ titleEn, titleAr, icon: Icon, en, ar, editable, onChangeEn, onChangeAr }) => {
  if (!editable && !en && !ar) return null;
  return (
    <div className="border-t border-blue-900/10 py-6 px-6 bg-gray-50/50">
      <div className="flex flex-col md:flex-row gap-8">

        {/* English Column */}
        <div className="flex-1 group relative bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
          <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
            <Icon className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-sm tracking-wide uppercase">{titleEn}</h4>
          </div>
          {editable ? (
            <textarea
              value={en || ""}
              onChange={(e) => onChangeEn(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-800 leading-relaxed font-medium border border-blue-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          ) : (
            <div className="text-sm text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">{en}</div>
          )}
          {!editable && (
            <button
              onClick={() => copyToClipboard(en, titleEn)}
              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-700 p-1.5 rounded-lg hover:bg-blue-100"
              title={`Copy ${titleEn}`}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Arabic Column */}
        <div className="flex-1 group relative bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
          <div className="flex items-center justify-start gap-2 mb-3 border-b border-gray-100 pb-3" dir="rtl">
            <Icon className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-base">{titleAr}</h4>
          </div>
          {editable ? (
            <textarea
              value={ar || ""}
              onChange={(e) => onChangeAr(e.target.value)}
              rows={3}
              dir="rtl"
              className="w-full text-sm text-gray-800 leading-relaxed font-bold text-right border border-blue-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          ) : (
            <div className="text-sm text-gray-800 leading-relaxed font-bold whitespace-pre-wrap text-right" dir="rtl">{ar}</div>
          )}
          {!editable && (
            <button
              onClick={() => copyToClipboard(ar, titleAr)}
              className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-700 p-1.5 rounded-lg hover:bg-blue-100"
              title={`Copy ${titleAr}`}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default function LabelPreview({ data, editable = false, onFieldChange }) {
  if (!data) return null;

  const setField = (path, value) => {
    if (onFieldChange) onFieldChange(path, value);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 text-white flex justify-between items-end relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <Dna className="w-48 h-48 -mr-10 -mt-10" />
        </div>
        <div className="relative z-10">
          {editable ? (
            <>
              <input value={data.productName?.en || ""} onChange={(e) => setField(["productName", "en"], e.target.value)} className="text-4xl font-black tracking-tight mb-1 bg-transparent border-b border-white/40 outline-none w-full placeholder-white/50" placeholder="PRODUCT NAME" />
              <input value={data.feedClassification?.en || ""} onChange={(e) => setField(["feedClassification", "en"], e.target.value)} className="text-xl font-medium text-blue-200 bg-transparent border-b border-white/20 outline-none w-full mt-1 placeholder-blue-200/50" placeholder="Classification" />
              <input value={data.targetAnimalSpecies?.en || ""} onChange={(e) => setField(["targetAnimalSpecies", "en"], e.target.value)} className="text-sm font-medium text-blue-200 bg-transparent border-b border-white/20 outline-none w-full mt-1 placeholder-blue-200/50" placeholder="Target Species" />
            </>
          ) : (
            <>
              <h2 className="text-4xl font-black tracking-tight mb-1">{data.productName?.en || "PRODUCT NAME"}</h2>
              <h3 className="text-xl font-medium text-blue-200">{data.feedClassification?.en || "Classification"} | {data.targetAnimalSpecies?.en || "Target Species"}</h3>
            </>
          )}
        </div>
        <div className="relative z-10 text-right">
          {editable ? (
            <>
              <input dir="rtl" value={data.productName?.target || ""} onChange={(e) => setField(["productName", "target"], e.target.value)} className="text-4xl font-black tracking-tight mb-1 bg-transparent border-b border-white/40 outline-none w-full text-right placeholder-white/50" placeholder="اسم المنتج" />
              <input dir="rtl" value={data.feedClassification?.target || ""} onChange={(e) => setField(["feedClassification", "target"], e.target.value)} className="text-xl font-medium text-blue-200 bg-transparent border-b border-white/20 outline-none w-full mt-1 text-right placeholder-blue-200/50" placeholder="التصنيف" />
              <input dir="rtl" value={data.targetAnimalSpecies?.target || ""} onChange={(e) => setField(["targetAnimalSpecies", "target"], e.target.value)} className="text-sm font-medium text-blue-200 bg-transparent border-b border-white/20 outline-none w-full mt-1 text-right placeholder-blue-200/50" placeholder="الحيوانات المستهدفة" />
            </>
          ) : (
            <>
              <h2 className="text-4xl font-black tracking-tight mb-1" dir="rtl">{data.productName?.target || "اسم المنتج"}</h2>
              <h3 className="text-xl font-medium text-blue-200" dir="rtl">{data.feedClassification?.target || "التصنيف"} | {data.targetAnimalSpecies?.target || "الحيوانات المستهدفة"}</h3>
            </>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div className="p-6 relative group">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-blue-900 text-xl flex items-center gap-2">
            <PackageOpen className="w-6 h-6" /> Ingredients / المكونات
          </h4>
          {!editable && (
            <button
              onClick={() => copyToClipboard(
                data.ingredients.map(i => `${i.en} | ${i.target} | ${i.amount}`).join("\n"),
                "Ingredients"
              )}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Table
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold w-1/3">Ingredient (EN)</th>
                <th className="px-4 py-3 font-bold w-1/3 text-right" dir="rtl">المكون (AR)</th>
                <th className="px-4 py-3 font-bold w-1/3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.ingredients?.map((ing, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  {editable ? (
                    <>
                      <td className="px-2 py-2"><input value={ing.en || ""} onChange={(e) => setField(["ingredients", idx, "en"], e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td className="px-2 py-2"><input dir="rtl" value={ing.target || ""} onChange={(e) => setField(["ingredients", idx, "target"], e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-bold text-gray-900 text-right outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      <td className="px-2 py-2"><input value={ing.amount || ""} onChange={(e) => setField(["ingredients", idx, "amount"], e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-2 focus:ring-blue-500" /></td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-900">{ing.en}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 text-right" dir="rtl">{ing.target}</td>
                      <td className="px-4 py-3 text-gray-700">{ing.amount}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analysis (English only, per official feed labeling rules) */}
      {(data.analysis?.items?.length > 0 || editable) && (
        <div className="px-6 pb-6 relative group">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-blue-900 text-xl flex items-center gap-2">
              <FlaskConical className="w-6 h-6" /> Analysis <span className="text-xs font-normal text-gray-500">(English only)</span>
            </h4>
            {!editable && data.analysis?.items?.length > 0 && (
              <button
                onClick={() => copyToClipboard(
                  `${data.analysis?.basis || ""}\n` + data.analysis.items.map(i => `${i.name}: ${i.value}`).join("\n"),
                  "Analysis"
                )}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            )}
          </div>

          {editable ? (
            <input
              value={data.analysis?.basis || ""}
              onChange={(e) => setField(["analysis", "basis"], e.target.value)}
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Basis, e.g. per 1 kg"
            />
          ) : (
            data.analysis?.basis && <p className="text-sm font-semibold text-gray-600 mb-2">{data.analysis.basis}</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                <tr>
                  <th className="px-4 py-3 font-bold w-1/2">Nutrient / Substance</th>
                  <th className="px-4 py-3 font-bold w-1/2">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.analysis?.items?.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    {editable ? (
                      <>
                        <td className="px-2 py-2"><input value={item.name || ""} onChange={(e) => setField(["analysis", "items", idx, "name"], e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" /></td>
                        <td className="px-2 py-2"><input value={item.value || ""} onChange={(e) => setField(["analysis", "items", idx, "value"], e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-gray-700 outline-none focus:ring-2 focus:ring-blue-500" /></td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-gray-700">{item.value}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="bg-gray-50/50">
        <Section
          titleEn="Aim of Use"
          titleAr="دواعي الاستعمال"
          icon={Info}
          en={data.aimOfUse?.en}
          ar={data.aimOfUse?.target}
          editable={editable}
          onChangeEn={(v) => setField(["aimOfUse", "en"], v)}
          onChangeAr={(v) => setField(["aimOfUse", "target"], v)}
        />
        <Section
          titleEn="Direction of Use"
          titleAr="الجرعة وطريقة الاستخدام"
          icon={Syringe}
          en={data.directionOfUse?.en}
          ar={data.directionOfUse?.target}
          editable={editable}
          onChangeEn={(v) => setField(["directionOfUse", "en"], v)}
          onChangeAr={(v) => setField(["directionOfUse", "target"], v)}
        />
        <Section
          titleEn="Storage"
          titleAr="ظروف التخزين"
          icon={Settings}
          en={data.storage?.en}
          ar={data.storage?.target}
          editable={editable}
          onChangeEn={(v) => setField(["storage", "en"], v)}
          onChangeAr={(v) => setField(["storage", "target"], v)}
        />
        <Section
          titleEn="Net Weight"
          titleAr="الوزن الصافي"
          icon={Scale}
          en={data.netWeight?.en}
          ar={data.netWeight?.target}
          editable={editable}
          onChangeEn={(v) => setField(["netWeight", "en"], v)}
          onChangeAr={(v) => setField(["netWeight", "target"], v)}
        />
      </div>

      {/* Usage Declaration */}
      {(data.usageDeclaration?.length > 0) && (
        <div className="px-6 py-5 border-t border-blue-900/10 bg-white group relative">
          <h4 className="font-bold text-blue-900 text-sm tracking-wide uppercase flex items-center gap-2 mb-3">
            <ClipboardCheck className="w-5 h-5 text-blue-600" /> Usage Declaration
          </h4>
          <div className="space-y-2">
            {data.usageDeclaration.map((line, idx) => (
              editable ? (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={line.en || ""}
                    onChange={(e) => setField(["usageDeclaration", idx, "en"], e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    dir="rtl"
                    value={line.target || ""}
                    onChange={(e) => setField(["usageDeclaration", idx, "target"], e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-right outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div key={idx} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-sm">
                  <span className="font-medium text-gray-800">{line.en}</span>
                  <span className="font-bold text-gray-800" dir="rtl">{line.target}</span>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Mandatory Fields */}
      {data.mandatoryFields && (
        <div className="bg-gray-100 border-t border-gray-200 p-6">
          <h4 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gray-600" /> Mandatory Fields to Include
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.mandatoryFields).map(([key, val]) => val && (
              <div key={key} className="bg-white px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 capitalize shadow-sm">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="bg-blue-900 text-white p-4 text-center text-xs font-medium tracking-wide">
        CONFIDENTIAL & PROPRIETARY — GENERATED BY DOSSIRA AI
      </div>
    </div>
  );
}
