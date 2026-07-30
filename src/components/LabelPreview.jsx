import React from "react";
import { Copy, Dna, Info, Syringe, Settings, PackageOpen, Scale, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

const copyToClipboard = (text, section) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  toast.success(`Copied ${section} to clipboard!`);
};

const Section = ({ titleEn, titleAr, icon: Icon, en, ar }) => {
  if (!en && !ar) return null;
  return (
    <div className="border-t border-blue-900/10 py-6 px-6 bg-gray-50/50">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* English Column */}
        <div className="flex-1 group relative bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
          <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
            <Icon className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-sm tracking-wide uppercase">{titleEn}</h4>
          </div>
          <div className="text-sm text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">{en}</div>
          <button 
            onClick={() => copyToClipboard(en, titleEn)}
            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-700 p-1.5 rounded-lg hover:bg-blue-100"
            title={`Copy ${titleEn}`}
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

        {/* Arabic Column */}
        <div className="flex-1 group relative bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
          <div className="flex items-center justify-start gap-2 mb-3 border-b border-gray-100 pb-3" dir="rtl">
            <Icon className="w-5 h-5 text-blue-600" />
            <h4 className="font-bold text-blue-900 text-base">{titleAr}</h4>
          </div>
          <div className="text-sm text-gray-800 leading-relaxed font-bold whitespace-pre-wrap text-right" dir="rtl">{ar}</div>
          <button 
            onClick={() => copyToClipboard(ar, titleAr)}
            className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-700 p-1.5 rounded-lg hover:bg-blue-100"
            title={`Copy ${titleAr}`}
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default function LabelPreview({ data }) {
  if (!data) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-6 text-white flex justify-between items-end relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <Dna className="w-48 h-48 -mr-10 -mt-10" />
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-black tracking-tight mb-1">{data.productName?.en || "PRODUCT NAME"}</h2>
          <h3 className="text-xl font-medium text-blue-200">{data.feedClassification?.en || "Classification"} | {data.targetAnimalSpecies?.en || "Target Species"}</h3>
        </div>
        <div className="relative z-10 text-right">
          <h2 className="text-4xl font-black tracking-tight mb-1" dir="rtl">{data.productName?.target || "اسم المنتج"}</h2>
          <h3 className="text-xl font-medium text-blue-200" dir="rtl">{data.feedClassification?.target || "التصنيف"} | {data.targetAnimalSpecies?.target || "الحيوانات المستهدفة"}</h3>
        </div>
      </div>

      {/* Ingredients */}
      <div className="p-6 relative group">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-blue-900 text-xl flex items-center gap-2">
            <PackageOpen className="w-6 h-6" /> Ingredients / المكونات
          </h4>
          <button 
            onClick={() => copyToClipboard(
              data.ingredients.map(i => `${i.en} | ${i.target} | ${i.amount}`).join("\n"),
              "Ingredients"
            )}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Table
          </button>
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
                  <td className="px-4 py-3 font-medium text-gray-900">{ing.en}</td>
                  <td className="px-4 py-3 font-bold text-gray-900 text-right" dir="rtl">{ing.target}</td>
                  <td className="px-4 py-3 text-gray-700">{ing.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sections */}
      <div className="bg-gray-50/50">
        <Section 
          titleEn="Aim of Use"
          titleAr="دواعي الاستعمال" 
          icon={Info}
          en={data.aimOfUse?.en} 
          ar={data.aimOfUse?.target} 
        />
        <Section 
          titleEn="Direction of Use"
          titleAr="الجرعة وطريقة الاستخدام"
          icon={Syringe}
          en={data.directionOfUse?.en} 
          ar={data.directionOfUse?.target} 
        />
        <Section 
          titleEn="Storage"
          titleAr="ظروف التخزين"
          icon={Settings}
          en={data.storage?.en} 
          ar={data.storage?.target} 
        />
        <Section 
          titleEn="Net Weight"
          titleAr="الوزن الصافي"
          icon={Scale}
          en={data.netWeight?.en} 
          ar={data.netWeight?.target} 
        />
      </div>

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
