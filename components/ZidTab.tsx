
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Store, ListTree, Scissors, Trash2, Merge } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

const COLUMNS_TO_DELETE = [
  "description_ar", "description_en", "short_description_ar", "short_description_en",
  "product_page_title_ar", "product_page_title_en", "product_page_description_ar", "product_page_description_en",
  "product_page_url", "categories_ar", "categories_en", "categories_description_ar", "categories_description_en",
  "categories_images", "keywords", "weight", "weight_unit", "published", "images", "images_alt_text_ar", "images_alt_text_en",
  "has_dropdown", "is_dropdown_required", "dropdown_name_ar", "dropdown_name_en",
  "dropdown_choice1_ar", "dropdown_choice1_en", "dropdown_choice1_price",
  "dropdown_choice2_ar", "dropdown_choice2_en", "dropdown_choice2_price",
  "dropdown_choice3_ar", "dropdown_choice3_en", "dropdown_choice3_price",
  "dropdown_choice4_ar", "dropdown_choice4_en", "dropdown_choice4_price",
  "dropdown_choice5_ar", "dropdown_choice5_en", "dropdown_choice5_price",
  "dropdown_choice6_ar", "dropdown_choice6_en", "dropdown_choice6_price",
  "dropdown_choice7_ar", "dropdown_choice7_en", "dropdown_choice7_price",
  "dropdown_choice8_ar", "dropdown_choice8_en", "dropdown_choice8_price",
  "dropdown_choice9_ar", "dropdown_choice9_en", "dropdown_choice9_price",
  "dropdown_choice10_ar", "dropdown_choice10_en", "dropdown_choice10_price",
  "dropdown_choice11_ar", "dropdown_choice11_en", "dropdown_choice11_price",
  "dropdown_choice12_ar", "dropdown_choice12_en", "dropdown_choice12_price",
  "dropdown_choice13_ar", "dropdown_choice13_en", "dropdown_choice13_price",
  "has_multiple_options", "is_multiple_options_required", "multiple_options_name_ar", "multiple_options_name_en",
  "has_text_input", "is_text_input_required", "text_input_name_ar", "text_input_name_en", "text_input_price",
  "has_numerical_input", "is_numerical_input_required", "numerical_input_name_ar", "numerical_input_name_en", "numerical_input_price",
  "has_date", "is_date_required", "date_name_ar", "date_name_en",
  "has_time", "is_time_required", "time_name_ar", "time_name_en",
  "has_image_upload", "is_image_upload_required", "image_upload_name_ar", "image_upload_name_en",
  "has_file_upload", "is_file_upload_required", "file_upload_name_ar", "file_upload_name_en"
];

const ZidTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [variantColIdx, setVariantColIdx] = useState<number>(-1);
  const [nameColIdx, setNameColIdx] = useState<number>(-1);
  const [removeExtraCols, setRemoveExtraCols] = useState<boolean>(true);
  const [deleteParentRows, setDeleteParentRows] = useState<boolean>(true); 
  const [concatenateOptions, setConcatenateOptions] = useState<boolean>(true);

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      if (!selectedSheet) setSelectedSheet(fileData.sheets[0]);
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, false);
      if (data.length > 0) {
        const head = data[0] as string[];
        setHeaders(head);
        
        // Auto-detect columns
        const vIdx = head.findIndex(h => h && (h.includes('هل يوجد خيارات') || h.toLowerCase().includes('has variant') || h.toLowerCase().includes('option')));
        const nIdx = head.findIndex(h => h && (h.includes('اسم') || h.toLowerCase().includes('name') || h.toLowerCase().includes('product')));
        
        if (vIdx !== -1) setVariantColIdx(vIdx);
        if (nIdx !== -1) setNameColIdx(nIdx);
      }
    }
  }, [fileData, selectedSheet]);

  const removeEmptyColumns = (data: any[][]) => {
    if (!data || data.length <= 1) return { cleanedData: data };
    const headers = data[0];
    const numCols = headers.length;
    const keepIndices: number[] = [];
    
    for (let c = 0; c < numCols; c++) {
        let hasData = false;
        for (let r = 1; r < data.length; r++) {
            const cell = data[r][c];
            if (cell !== null && cell !== undefined && String(cell).trim() !== "") {
                hasData = true;
                break;
            }
        }
        if (hasData) keepIndices.push(c);
    }
    const cleanedData = data.map(row => keepIndices.map(i => row[i]));
    return { cleanedData };
  };

  const filterBlacklistedColumns = (data: any[][]) => {
    if (!data || data.length === 0) return data;
    const header = data[0];
    const indicesToKeep: number[] = [];
    
    header.forEach((colName, idx) => {
        const name = String(colName).trim().toLowerCase();
        if (!COLUMNS_TO_DELETE.includes(name)) {
            indicesToKeep.push(idx);
        }
    });
    
    return data.map(row => indicesToKeep.map(i => row[i]));
  };

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    if (variantColIdx === -1 || nameColIdx === -1) {
        addLog("Please select required columns.", 'warning');
        return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));

      const rawData = getSheetData(fileData.workbook, selectedSheet, false); // Get strings
      if (rawData.length <= 1) throw new Error("Sheet is empty.");

      const header = rawData[0];
      const rows = rawData.slice(1);
      
      // 1. Auto-detect Option Name columns to fill down
      const optionNameCols: number[] = [];
      header.forEach((h, idx) => {
          if (typeof h === 'string') {
              const lower = h.toLowerCase();
              if (lower.includes('option') && lower.includes('name')) {
                  optionNameCols.push(idx);
              }
          }
      });
      if (optionNameCols.length > 0) {
          addLog(`Auto-filling ${optionNameCols.length} option name columns...`, 'info');
      }

      // 2. Auto-detect Option Value columns for Concatenation
      // Also map them to their corresponding Option Name column if exists
      const optionValueCols: { idx: number, nameIdx: number, lang: 'ar' | 'en' | 'unknown' }[] = [];
      
      header.forEach((h, i) => {
         const hStr = String(h).toLowerCase();
         if (hStr.includes('value') && (hStr.includes('option') || hStr.includes('variant'))) {
            let lang: 'ar' | 'en' | 'unknown' = 'unknown';
            if (hStr.includes('_ar') || hStr.includes('arabic')) lang = 'ar';
            else if (hStr.includes('_en') || hStr.includes('english')) lang = 'en';
            
            // Try to find corresponding name column (e.g. option1_value_ar -> option1_name_ar)
            let nameIdx = -1;
            const expectedNameHeader = hStr.replace('value', 'name');
            const foundIdx = header.findIndex(x => String(x).toLowerCase() === expectedNameHeader);
            if (foundIdx !== -1) {
                nameIdx = foundIdx;
            } else {
                // Heuristic: check adjacent previous column
                if (i > 0) {
                    const prev = String(header[i-1]).toLowerCase();
                    if (prev.includes('name') && prev.includes('option')) nameIdx = i-1;
                }
            }

            optionValueCols.push({ idx: i, nameIdx, lang });
         }
      });

      // New Header: Insert "Parent Product Name" after "Has Variant"
      const newHeader = [...header];
      newHeader.splice(variantColIdx + 1, 0, "Parent Product Name"); 

      const allProcessedRows: any[][] = [newHeader];
      const simpleRows: any[][] = [newHeader];
      const variableRows: any[][] = [newHeader];

      let currentParentName = "";
      let currentParentRowData: any[] = [];
      let isInsideVariableGroup = false;

      for (let i = 0; i < rows.length; i++) {
          // Clone row to modify safely
          const row = [...rows[i]];
          const rawVariantVal = row[variantColIdx] ? String(row[variantColIdx]).trim().toLowerCase() : "";
          const nameVal = row[nameColIdx] ? String(row[nameColIdx]).trim() : "";
          
          let rowIsVariable = false;
          let rowIsParent = false;
          
          let processedVariantVal = row[variantColIdx]; 

          if (rawVariantVal === 'yes' || rawVariantVal === 'نعم') {
              // Parent of a variable product
              currentParentName = nameVal;
              currentParentRowData = [...row]; 
              isInsideVariableGroup = true;
              rowIsVariable = true;
              rowIsParent = true;
          } else if (rawVariantVal === 'no' || rawVariantVal === 'لا') {
              // Simple product
              currentParentName = ""; 
              currentParentRowData = [];
              isInsideVariableGroup = false;
              rowIsVariable = false;
          } else if (rawVariantVal === "") {
              // Empty
              if (isInsideVariableGroup) {
                  // It's a variant child
                  rowIsVariable = true;
                  processedVariantVal = "Yes"; 
              } else {
                  currentParentName = "";
                  currentParentRowData = [];
                  rowIsVariable = false;
              }
          } else {
              currentParentName = "";
              currentParentRowData = [];
              isInsideVariableGroup = false;
              rowIsVariable = false;
          }

          // --- LOGIC: Fill Option Names from Parent ---
          if (isInsideVariableGroup && !rowIsParent && currentParentRowData.length > 0) {
              optionNameCols.forEach(colIdx => {
                  const val = row[colIdx];
                  const parentVal = currentParentRowData[colIdx];
                  if ((val === undefined || val === null || String(val).trim() === "") && parentVal) {
                      row[colIdx] = parentVal;
                  }
              });
          }

          // --- LOGIC: Concatenate Options to Name (for child variants) ---
          let filledName = rowIsVariable ? currentParentName : nameVal;

          if (concatenateOptions && isInsideVariableGroup && !rowIsParent) {
             const extras = new Set<string>(); // Use Set to prevent exact duplicates
             optionValueCols.forEach(ov => {
                const val = row[ov.idx];
                if (val && String(val).trim()) {
                   // Get Option Name if available
                   let prefix = "";
                   if (ov.nameIdx !== -1) {
                       const optName = row[ov.nameIdx];
                       if (optName && String(optName).trim()) {
                           prefix = String(optName).trim() + ": ";
                       }
                   }
                   extras.add(`${prefix}${String(val).trim()}`);
                }
             });
             
             if (extras.size > 0) {
                 filledName = `${filledName} - ${Array.from(extras).join(' - ')}`;
             }
          }
          
          // Determine the value for "Parent Product Name" column
          let parentNameValue = "";
          if (rowIsVariable) {
             parentNameValue = rowIsParent ? nameVal : currentParentName;
          }
          // For Simple products, we usually leave it empty (or it doesn't matter since we delete the column)

          // Update Name Column with filled name
          row[nameColIdx] = filledName;

          // Construct new row with inserted column
          const prePart = row.slice(0, variantColIdx + 1);
          // ensure variant val is normalized if needed, here we use original or processed
          prePart[variantColIdx] = processedVariantVal; 
          
          const postPart = row.slice(variantColIdx + 1);
          const newRow = [...prePart, parentNameValue, ...postPart];
          
          // Rule: Delete Parent Row if configured
          if (!deleteParentRows || !rowIsParent) {
              allProcessedRows.push(newRow);
              if (rowIsVariable) {
                  variableRows.push(newRow);
              } else {
                  simpleRows.push(newRow);
              }
          }

          if (i % 500 === 0) {
             setProgress(Math.round((i / rows.length) * 80));
             await new Promise(r => setTimeout(r, 0));
          }
      }

      // Filter Blacklisted columns if enabled
      let processedAll = allProcessedRows;
      let processedSimple = simpleRows;
      let processedVariable = variableRows;

      // Remove "Parent Product Name" from Simple Products
      // The inserted column is at index: variantColIdx + 1
      if (processedSimple.length > 0) {
          const colToRemove = variantColIdx + 1;
          processedSimple = processedSimple.map(row => {
             const r = [...row];
             if (r.length > colToRemove) r.splice(colToRemove, 1);
             return r;
          });
      }

      if (removeExtraCols) {
          processedAll = filterBlacklistedColumns(processedAll);
          processedSimple = filterBlacklistedColumns(processedSimple);
          processedVariable = filterBlacklistedColumns(processedVariable);
          addLog("Removed extra Zid columns.", 'info');
      }

      // Clean columns
      setProgress(90);
      const { cleanedData: finalAllData } = removeEmptyColumns(processedAll);
      const { cleanedData: finalSimpleData } = removeEmptyColumns(processedSimple);
      const { cleanedData: finalVariableData } = removeEmptyColumns(processedVariable);

      const newWb = XLSX.utils.book_new();
      
      if (finalAllData.length > 0) {
          const wsAll = XLSX.utils.aoa_to_sheet(finalAllData);
          XLSX.utils.book_append_sheet(newWb, wsAll, "Zid All Products");
      }
      if (finalVariableData.length > 1) {
          const wsVar = XLSX.utils.aoa_to_sheet(finalVariableData);
          XLSX.utils.book_append_sheet(newWb, wsVar, "Variable Products");
      }
      if (finalSimpleData.length > 1) {
          const wsSim = XLSX.utils.aoa_to_sheet(finalSimpleData);
          XLSX.utils.book_append_sheet(newWb, wsSim, "Simple Products");
      }

      const baseName = fileData.name.replace(/\.[^/.]+$/, "");
      saveWorkbook(newWb, `Zid_Organized_${baseName}.xlsx`);
      
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
            <Store className="mr-2" size={20}/>
            {t.zid.title}
         </h3>
         
         <div className="mb-6">
            <label className="block text-sm font-medium text-slate-600 mb-2">{t.common.selectSheet}</label>
            <select 
              className="w-full p-2.5 border rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
            >
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">{t.zid.colVariant}</label>
                <select 
                  className="w-full p-2.5 border rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={variantColIdx}
                  onChange={(e) => setVariantColIdx(Number(e.target.value))}
                >
                  <option value="-1">{t.common.selectCols}...</option>
                  {headers.map((h, i) => <option key={i} value={i}>{i+1}. {h}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">{t.zid.colName}</label>
                <select 
                  className="w-full p-2.5 border rounded-lg text-sm bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={nameColIdx}
                  onChange={(e) => setNameColIdx(Number(e.target.value))}
                >
                  <option value="-1">{t.common.selectCols}...</option>
                  {headers.map((h, i) => <option key={i} value={i}>{i+1}. {h}</option>)}
                </select>
            </div>
         </div>

         {/* Configuration Option */}
         <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={removeExtraCols}
                    onChange={(e) => setRemoveExtraCols(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
                <span className="text-sm font-medium text-slate-700 flex items-center">
                    <Scissors size={16} className="mr-2 text-slate-500" />
                    {language === 'ar' ? 'حذف الأعمدة الإضافية (الوصف، الخيارات القديمة، الصور...)' : 'Remove Extra Zid Columns (Desc, Old Options, Images...)'}
                </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={deleteParentRows}
                    onChange={(e) => setDeleteParentRows(e.target.checked)}
                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                />
                <span className="text-sm font-medium text-slate-700 flex items-center">
                    <Trash2 size={16} className="mr-2 text-slate-500" />
                    {language === 'ar' ? 'حذف صف الأب للمنتجات المتغيرة (إبقاء الخيارات فقط)' : 'Delete Parent Row for Variable Products (Keep Variants Only)'}
                </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={concatenateOptions}
                    onChange={(e) => setConcatenateOptions(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                />
                <span className="text-sm font-medium text-slate-700 flex items-center">
                    <Merge size={16} className="mr-2 text-slate-500" />
                    {language === 'ar' ? 'دمج اسم وقيم الخيارات مع اسم المنتج (يشمل جميع اللغات)' : 'Concatenate Option Name + Values (Include both AR/EN if exist)'}
                </span>
            </label>
         </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
            <h4 className="text-blue-800 font-bold text-sm mb-2">{t.zid.howItWorks}</h4>
            <ul className="list-disc list-inside text-xs text-blue-700 space-y-1">
                <li>{t.zid.point1}</li>
                <li>{t.zid.point2}</li>
                <li>{t.zid.point3}</li>
                <li><strong>Auto-Fill:</strong> Fills empty "Option Name" columns from parent rows.</li>
            </ul>
          </div>
          
          <div className="flex items-center justify-between">
             <button
                onClick={handleProcess}
                disabled={!fileData || status === ProcessingStatus.PROCESSING}
                className={`w-full flex justify-center items-center space-x-2 px-6 py-4 rounded-lg font-bold text-white shadow-md transition-all transform active:scale-95
                ${status === ProcessingStatus.PROCESSING 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
            >
                {status === ProcessingStatus.PROCESSING ? (
                    <>
                        <span className="animate-spin mr-2">⏳</span>
                        <span>{t.common.processing}</span>
                    </>
                ) : (
                    <>
                        <ListTree size={20} />
                        <span>{t.zid.analyzeBtn}</span>
                    </>
                )}
            </button>
          </div>
       </div>

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default ZidTab;
