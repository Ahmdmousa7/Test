
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { saveWorkbook, getSheetData } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { ShoppingBag, Eraser, Scissors } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

// Exact headers to remove based on user request
const SALLA_BLACKLIST = [
  "الوصف",
  "هل يتطلب شحن؟",
  "السعر المخفض",
  "تاريخ بداية التخفيض",
  "تاريخ نهاية التخفيض",
  "اقصي كمية لكل عميل",
  "إخفاء خيار تحديد الكمية",
  "اضافة صورة عند الطلب",
  "الوزن",
  "وحدة الوزن",
  "حالة المنتج",
  "العنوان الترويجي",
  "تثبيت المنتج",
  "السعرات الحرارية",
  "MPN",
  "GTIN",
  // Options 1-8 Specifics
  "[1] النوع", "[1] الصورة / اللون",
  "[2] النوع", "[2] الصورة / اللون",
  "[3] النوع", "[3] الصورة / اللون",
  "[4] النوع", "[4] الصورة / اللون",
  "[5] النوع", "[5] الصورة / اللون",
  "[6] النوع", "[6] الصورة / اللون",
  "[7] النوع", "[7] الصورة / اللون",
  "[8] النوع", "[8] الصورة / اللون"
];

const SallaTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [cleanColumns, setCleanColumns] = useState<boolean>(true);

  React.useEffect(() => {
    if (fileData) {
      const salla = fileData.sheets.find(s => s.toLowerCase().includes('salla') || s.toLowerCase().includes('products'));
      setSelectedSheet(salla || fileData.sheets[0] || '');
    }
  }, [fileData]);

  const filterAndCleanData = (data: any[][], blacklist: string[], applyCleaning: boolean) => {
    if (!data || data.length === 0) return { cleanedData: data, removedCount: 0 };
    
    const header = data[0];
    const keepIndices: number[] = [];
    const removedHeaders: string[] = [];

    for (let c = 0; c < header.length; c++) {
        const colName = String(header[c] || "").trim();
        
        // Skip logic if toggle is off
        if (!applyCleaning) {
            keepIndices.push(c);
            continue;
        }

        // Rule 1: Check Blacklist (Remove these columns)
        if (blacklist.includes(colName)) {
            removedHeaders.push(colName);
            continue; // Skip this column
        }

        // Rule 2: Check Empty (Rows 1 to N)
        // If a column has a header but NO data in any row, delete it.
        let hasData = false;
        for (let r = 1; r < data.length; r++) {
            const cell = data[r][c];
            if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
                hasData = true;
                break;
            }
        }
        
        if (hasData) {
            keepIndices.push(c);
        } else {
            if (!removedHeaders.includes(colName)) removedHeaders.push(`${colName} (Empty)`);
        }
    }

    const cleanedData = data.map(row => keepIndices.map(i => row[i]));
    return { cleanedData, removedCount: removedHeaders.length };
  };

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));

      const originalData = getSheetData(fileData.workbook, selectedSheet);
      if (originalData.length === 0) throw new Error("Sheet is empty.");

      let headerRowIndex = 0;
      let typeColIndex = -1;

      // Detect Type Column
      for (let r = 0; r < Math.min(originalData.length, 20); r++) {
          const row = originalData[r] as any[];
          const idx = row.findIndex(cell => cell && (String(cell).trim() === "النوع" || String(cell).trim().toLowerCase() === "type" || String(cell).trim() === "نوع المنتج"));
          if (idx !== -1) {
              headerRowIndex = r;
              typeColIndex = idx;
              break;
          }
      }

      // Fallback detection
      if (typeColIndex === -1) {
          for (let r = 0; r < Math.min(originalData.length, 50); r++) {
               const row = originalData[r] as any[];
               const idx = row.findIndex(cell => cell && (String(cell).trim() === "منتج" || String(cell).trim().toLowerCase() === "product"));
               if (idx !== -1) {
                   typeColIndex = idx;
                   headerRowIndex = Math.max(0, r - 1);
                   break;
               }
           }
      }

      if (typeColIndex === -1) {
           // Hard fallback based on common structure
           const sampleRow = originalData.length > 1 ? originalData[1] : null;
           let foundInC = false;
           for(let k=1; k<Math.min(originalData.length, 5); k++) {
              const row = originalData[k];
              if (row && (row[2] === 'منتج' || row[2] === 'product')) {
                  foundInC = true;
                  break;
              }
           }
           if (foundInC) {
               typeColIndex = 2;
               headerRowIndex = 0;
           } else {
               throw new Error("Could not find the 'Product Type' column.");
           }
      }

      const header = originalData[headerRowIndex] as string[];
      const safeHeader = header || [];
      const newHeader = ["تصنيف البوت", ...safeHeader];
      
      const simpleRows: any[][] = [];
      const variableRows: any[][] = [];
      const allNewRows: any[][] = [newHeader];

      const rows = originalData.slice(headerRowIndex + 1);
      const totalRows = rows.length;
      
      for (let i = 0; i < totalRows; i++) {
          const row = rows[i];
          const rawType = String(row[typeColIndex] || "").trim();
          let category = "";

          // Logic: "منتج" (Product) -> Check next row. If next is "خيار" (Option), it's Variable Parent. Else Simple.
          // Logic: "خيار" (Option) -> It's a Variable Variant.
          
          if (rawType === "منتج" || rawType === "نوع المنتج" || rawType.toLowerCase() === "product") {
              let isVariable = false;
              if (i + 1 < totalRows) {
                  const nextRow = rows[i+1];
                  const nextType = String(nextRow[typeColIndex] || "").trim();
                  if (nextType === "خيار" || nextType.toLowerCase() === "option" || nextType.toLowerCase() === "variant") {
                      isVariable = true;
                  }
              }
              if (isVariable) category = "متعدد"; 
              else category = "نوع واحد"; 
          } else if (rawType === "خيار" || rawType.toLowerCase() === "option" || rawType.toLowerCase() === "variant") {
              category = "متعدد";
          } else {
              category = rawType || "Unknown"; 
          }

          const newRow = [category, ...row];
          allNewRows.push(newRow);

          if (category === "نوع واحد") simpleRows.push(newRow);
          else if (category === "متعدد") variableRows.push(newRow);

          if (i % 500 === 0) {
             setProgress(Math.round((i / totalRows) * 80));
             await new Promise(r => setTimeout(r, 0));
          }
      }

      // --- CLEANING PHASE ---
      setProgress(85);
      
      // Filter All
      const { cleanedData: finalMainData, removedCount: r1 } = filterAndCleanData(allNewRows, SALLA_BLACKLIST, cleanColumns);
      
      // Filter Simple (Re-add header for processing)
      const rawSimpleData = simpleRows.length > 0 ? [newHeader, ...simpleRows] : [];
      const { cleanedData: finalSimpleData, removedCount: r2 } = filterAndCleanData(rawSimpleData, SALLA_BLACKLIST, cleanColumns);

      // Filter Variable
      const rawVariableData = variableRows.length > 0 ? [newHeader, ...variableRows] : [];
      const { cleanedData: finalVariableData, removedCount: r3 } = filterAndCleanData(rawVariableData, SALLA_BLACKLIST, cleanColumns);

      const totalRemoved = Math.max(r1, r2, r3);
      if (totalRemoved > 0 && cleanColumns) addLog(`Removed ${totalRemoved} columns (Blacklisted/Empty).`, 'info');

      // --- SAVING ---
      const newWb = XLSX.utils.book_new();
      const wsMain = XLSX.utils.aoa_to_sheet(finalMainData);
      let mainName = selectedSheet.length > 25 ? "All Products" : selectedSheet;
      XLSX.utils.book_append_sheet(newWb, wsMain, mainName);

      if (finalSimpleData.length > 1) { 
        const wsSimple = XLSX.utils.aoa_to_sheet(finalSimpleData);
        XLSX.utils.book_append_sheet(newWb, wsSimple, "Simple Products");
      }

      if (finalVariableData.length > 1) { 
        const wsVariable = XLSX.utils.aoa_to_sheet(finalVariableData);
        XLSX.utils.book_append_sheet(newWb, wsVariable, "Variable Products");
      }

      const baseName = fileData.name.replace(/\.[^/.]+$/, "");
      saveWorkbook(newWb, `Salla_Analyzed_${baseName}.xlsx`);
      
      addLog(t.common.completed, 'success');
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         <h3 className="font-bold text-slate-700 mb-4 flex items-center">
            <ShoppingBag className="mr-2" size={20}/>
            {t.salla.title}
         </h3>
         
         <div className="mb-6">
            <label className="block text-sm font-medium text-slate-600 mb-2">{t.salla.selectProductSheet}</label>
            <select 
              className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-purple-500 outline-none"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
            >
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>

         {/* Cleaning Toggle */}
         <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label className="flex items-start space-x-3 cursor-pointer">
                <div className="flex items-center h-5">
                    <input 
                      type="checkbox" 
                      checked={cleanColumns}
                      onChange={(e) => setCleanColumns(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                    />
                </div>
                <div className="flex-1 text-sm">
                    <span className="font-bold text-slate-700 flex items-center gap-2">
                        <Eraser size={16}/> Clean & Remove Standard Columns
                    </span>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        If checked, I will delete blacklisted columns (e.g. Description, Weight, Options 1-8) AND any column that is fully empty.
                    </p>
                </div>
            </label>
         </div>

          <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 mb-6">
            <h4 className="text-purple-800 font-bold text-sm mb-2">{t.salla.howItWorks}</h4>
            <ul className="list-disc list-inside text-xs text-purple-700 space-y-1">
                <li>{t.salla.point1}</li>
                <li>{t.salla.point2}</li>
                <li>{t.salla.point3} (Auto-removes empty/blacklisted columns)</li>
            </ul>
          </div>
          
          <div className="flex items-center justify-between">
             <button
                onClick={handleProcess}
                data-action="primary"
                disabled={!fileData || status === ProcessingStatus.PROCESSING}
                className={`w-full flex justify-center items-center space-x-2 px-6 py-4 rounded-lg font-bold text-white shadow-md transition-all transform active:scale-95
                ${status === ProcessingStatus.PROCESSING 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'}`}
            >
                {status === ProcessingStatus.PROCESSING ? (
                    <>
                        <span className="animate-spin mr-2">⏳</span>
                        <span>{t.common.processing}</span>
                    </>
                ) : (
                    <>
                        {cleanColumns ? <Scissors size={20}/> : <ShoppingBag size={20} />}
                        <span>{t.salla.analyzeBtn}</span>
                    </>
                )}
            </button>
          </div>
       </div>

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default SallaTab;
