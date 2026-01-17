
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ProcessingStatus, LogEntry } from '../types';
import { saveWorkbook, readExcelFile, getSheetData } from '../services/excelService';
import { extractFromMedia } from '../services/geminiService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  ScanText, Download, UploadCloud, FileText, Trash2, 
  Zap, Edit3, Table as TableIcon, X, Plus,
  TableProperties, Split, DollarSign, Type, FileSpreadsheet, ArrowUpDown, Search, Eye, Layers, Box, Boxes
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface MediaFile {
  id: string;
  file: File;
  previewUrl: string;
  base64Data: string;
  mimeType: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  rotation: number; 
  resultData?: any[]; 
}

interface Template {
  id: string;
  label: string;
  icon: any;
  prompt: string;
  schema: {name: string, desc: string}[];
  isCustom?: boolean;
}

const OcrTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [files, setFiles] = useState<MediaFile[]>([]);
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<string>('free');
  const [useSchema, setUseSchema] = useState<boolean>(false);
  const [instruction, setInstruction] = useState<string>("");
  const [schemaFields, setSchemaFields] = useState<{name: string, desc: string}[]>([
     {name: 'SKU', desc: 'Item Code/SKU'},
     {name: 'Item', desc: 'Name (Bilingual)'},
     {name: 'Description', desc: 'Details (Bilingual)'},
     {name: 'Price', desc: 'Price value'},
     {name: 'Enable Stock', desc: 'Yes/No (Default Yes)'},
     {name: 'VariantLabel', desc: 'Category of variant (e.g. Size, Flavor)'},
     {name: 'VariantValue', desc: 'Specific Option (e.g. Small, Spicy)'},
     {name: 'Type', desc: 'Simple or Variable'}
  ]);

  const [autoBilingual, setAutoBilingual] = useState<boolean>(true);
  const [extractSizes, setExtractSizes] = useState<boolean>(true);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);

  const [masterData, setMasterData] = useState<any[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]); // Headers from extraction
  
  const [showSplitView, setShowSplitView] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  // --- MAPPING STATE (DUAL) ---
  const [mappingTab, setMappingTab] = useState<'simple' | 'variable'>('simple');
  
  // Simple Template State
  const [simpleTemplateFile, setSimpleTemplateFile] = useState<File | null>(null);
  const [simpleHeaders, setSimpleHeaders] = useState<string[]>([]);
  const [simpleTemplateRows, setSimpleTemplateRows] = useState<any[][]>([]); // Store full content
  const [simpleMapping, setSimpleMapping] = useState<Record<string, string>>({});

  // Variable Template State
  const [varTemplateFile, setVarTemplateFile] = useState<File | null>(null);
  const [varHeaders, setVarHeaders] = useState<string[]>([]);
  const [varTemplateRows, setVarTemplateRows] = useState<any[][]>([]); // Store full content
  const [varMapping, setVarMapping] = useState<Record<string, string>>({});

  // --- SORT & FILTER STATE ---
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  
  // --- RESULT TABS STATE ---
  const [resultTab, setResultTab] = useState<'all' | 'simple' | 'variable'>('all');

  // Initialize Templates
  useEffect(() => {
    setTemplates([
      { id: 'free', label: t.ocr.labels.free, icon: Edit3, prompt: '', schema: [] },
      { id: 'invoice', label: t.ocr.labels.invoice, icon: FileText, prompt: 'Extract invoice items, qty, price, and total.', schema: [] },
      { id: 'menu', label: t.ocr.labels.menu, icon: Zap, prompt: 'Extract menu items. If items have choices (Spicy/Regular), split them into separate rows with VariantLabel and VariantValue.', schema: [] },
      { id: 'receipt', label: t.ocr.labels.receipt, icon: TableProperties, prompt: 'Extract purchased items and prices from receipt.', schema: [] },
    ]);
  }, [language, t]);

  useEffect(() => {
    return () => {
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  // --- MAPPING HELPERS ---
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'simple' | 'variable') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await readExcelFile(file);
        const firstSheet = data.sheets[0];
        const rows = getSheetData(data.workbook, firstSheet, false); // Get all rows
        
        if (rows.length > 0) {
           const headers = rows[0] as string[];
           
           // Auto-map logic
           const initialMapping: Record<string, string> = {};
           headers.forEach(h => {
              const match = rawHeaders.find(rh => rh.toLowerCase() === String(h).toLowerCase());
              if (match) initialMapping[h] = match;
           });

           if (type === 'simple') {
               setSimpleTemplateFile(file);
               setSimpleHeaders(headers);
               setSimpleTemplateRows(rows); // Save existing content
               setSimpleMapping(initialMapping);
               addLog(`Loaded Simple Template: ${file.name} (${rows.length} rows)`, 'success');
           } else {
               setVarTemplateFile(file);
               setVarHeaders(headers);
               setVarTemplateRows(rows); // Save existing content
               setVarMapping(initialMapping);
               addLog(`Loaded Variable Template: ${file.name} (${rows.length} rows)`, 'success');
           }
        }
      } catch (err: any) {
        addLog(`Template Error: ${err.message}`, 'error');
      }
    }
  };

  const clearTemplate = (type: 'simple' | 'variable') => {
      if (type === 'simple') {
          setSimpleTemplateFile(null);
          setSimpleHeaders([]);
          setSimpleTemplateRows([]);
          setSimpleMapping({});
      } else {
          setVarTemplateFile(null);
          setVarHeaders([]);
          setVarTemplateRows([]);
          setVarMapping({});
      }
  };

  // --- SORT & FILTER HELPERS ---
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const processedData = useMemo(() => {
    let data = [...masterData];

    // 0. Result Tab Filter (Simple/Variable/All)
    if (resultTab === 'simple') {
        data = data.filter(r => {
            const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
            return typeVal.includes('simple') || (!typeVal.includes('variable') && !typeVal.includes('var'));
        });
    } else if (resultTab === 'variable') {
        data = data.filter(r => {
            const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
            return typeVal.includes('variable') || typeVal.includes('var');
        });
    }

    // 1. Column Filter
    Object.keys(filters).forEach(key => {
      const filterVal = filters[key].toLowerCase();
      if (filterVal) {
        data = data.filter(row => String(row[key] || '').toLowerCase().includes(filterVal));
      }
    });

    // 2. Sort
    if (sortConfig) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        const isNum = !isNaN(numA) && !isNaN(numB) && typeof valA !== 'string'; // Rough check

        if (isNum) {
           return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        } else {
           const strA = String(valA || "").toLowerCase();
           const strB = String(valB || "").toLowerCase();
           return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
      });
    }

    return data;
  }, [masterData, filters, sortConfig, resultTab]);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: MediaFile[] = [];
      const files: File[] = Array.from(e.target.files);
      for (const file of files) {
         const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
               const res = ev.target?.result as string;
               resolve(res.split(',')[1]); 
            };
            reader.readAsDataURL(file);
         });

         newFiles.push({
           id: Math.random().toString(36).substr(2, 9),
           file,
           previewUrl: URL.createObjectURL(file),
           base64Data,
           mimeType: file.type,
           status: 'idle',
           rotation: 0
         });
      }
      setFiles(prev => [...prev, ...newFiles]);
      addLog(`${t.common.processing} ${newFiles.length} files...`, 'info');
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const constructPrompt = () => {
    if (useSchema) {
      const schemaDesc = schemaFields.map(f => `${f.name}: ${f.desc}`).join(', ');
      return `Extract data strictly following this schema structure: [${schemaDesc}]. ${instruction}`;
    }
    
    const selectedTmpl = templates.find(t => t.id === activeTemplate);
    let prompt = selectedTmpl?.prompt || instruction || "Extract data into a table.";
    
    if (autoBilingual) prompt += " Translate ALL text fields (Name, Description, VariantValue): Arabic->English (concat) or English->Arabic (concat). If already bilingual, keep as is.";
    if (extractSizes) prompt += " DETECT VARIANTS: If an item has options (Size, Flavor, Type) like 'Spicy/Regular' or 'Small/Large', split it into multiple rows. Set Type='Variable' and fill VariantLabel/VariantValue.";
    
    // Enhanced Prompt for SKU and Stock
    prompt += " MANDATORY COLUMNS: 1. 'SKU': Extract code/ID if visible, otherwise leave empty. 2. 'Enable Stock': Set to 'Yes' or 'No' (Default to 'Yes' if not specified). 3. 'Type': Must be 'Simple' or 'Variable'.";

    return prompt;
  };

  const handleExtract = async () => {
    if (files.length === 0) return;

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    setMasterData([]);
    addLog(t.common.processing, 'info');

    const prompt = constructPrompt();
    const allResults: any[] = [];
    let processedCount = 0;

    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
       const file = updatedFiles[i];
       file.status = 'processing';
       setFiles([...updatedFiles]);

       try {
          const result = await extractFromMedia(
            { data: file.base64Data, mimeType: file.mimeType }, 
            prompt
          );
          
          if (result && result.length > 0) {
             const enriched = result.map(row => ({
               ...row,
               _SourceFile: file.file.name,
               _FileId: file.id
             }));
             allResults.push(...enriched);
             file.resultData = enriched;
             file.status = 'done';
          } else {
             file.status = 'error';
             addLog(`Warning: No data found in ${file.file.name}. Try adjusting the prompt.`, 'warning');
          }

       } catch (err: any) {
          console.error(err);
          file.status = 'error';
          let tips = "Try simplified instruction.";
          if (err.message.includes('JSON')) tips = "AI response format error. Try 'Free Form' mode.";
          if (err.message.includes('429')) tips = "Quota limit. Please wait or check API Key.";
          
          addLog(`Error processing ${file.file.name}: ${err.message}. ${tips}`, 'error');
       }

       processedCount++;
       setProgress(Math.round((processedCount / files.length) * 100));
       setFiles([...updatedFiles]);
    }

    if (allResults.length > 0) {
       const keys = new Set<string>();
       // Ensure SKU and Enable Stock are at the start if possible, or just gather all keys
       keys.add('SKU');
       keys.add('Enable Stock');
       allResults.forEach(r => Object.keys(r).forEach(k => {
          if (!k.startsWith('_')) keys.add(k);
       }));
       const headersList = Array.from(keys);
       setRawHeaders(headersList);
       setMasterData(allResults);
       setStatus(ProcessingStatus.COMPLETED);
       addLog(`${t.common.completed} ${allResults.length} items extracted.`, 'success');
    } else {
       setStatus(ProcessingStatus.ERROR);
       addLog(t.common.noData, 'error');
    }
  };

  const handleCleanPrices = () => {
    if (masterData.length === 0) return;
    const cleaned = masterData.map(row => {
        const newRow = { ...row };
        Object.keys(newRow).forEach(key => {
            const lowerKey = key.toLowerCase();
            const val = newRow[key];
            const strVal = String(val);
            const isPriceCol = lowerKey.includes('price') || lowerKey.includes('cost') || lowerKey.includes('amount') || lowerKey.includes('total') || lowerKey.includes('سعر') || lowerKey.includes('مبلغ');
            const looksLikeCurrency = /[\$£€]|SR|SAR|USD/i.test(strVal);

            if (isPriceCol || looksLikeCurrency) {
                const cleanedVal = strVal.replace(/[^0-9.-]/g, '');
                if (cleanedVal && !isNaN(parseFloat(cleanedVal))) {
                    newRow[key] = parseFloat(cleanedVal);
                }
            }
        });
        return newRow;
    });
    setMasterData(cleaned);
    addLog(t.ocr.cleanPrices + " applied.", 'success');
  };

  const handleCleanText = () => {
    if (masterData.length === 0) return;
    const cleaned = masterData.map(row => {
        const newRow = { ...row };
        Object.keys(newRow).forEach(key => {
            if (typeof newRow[key] === 'string') {
                newRow[key] = newRow[key].replace(/\s+/g, ' ').trim();
            }
        });
        return newRow;
    });
    setMasterData(cleaned);
    addLog("Text cleanup complete.", 'success');
  };

  // Convert array of objects (extracted data) into array of arrays (matching template headers)
  const mapDataToRows = (dataRows: any[], headers: string[], mapping: Record<string, string>) => {
      return dataRows.map(row => {
          return headers.map(header => {
              const sourceKey = mapping[header];
              return sourceKey ? row[sourceKey] : "";
          });
      });
  };

  const handleDownload = () => {
    if (masterData.length === 0) return;
    
    // Split Data
    const simpleData = masterData.filter(r => {
        const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
        return typeVal.includes('simple') || (!typeVal.includes('variable') && !typeVal.includes('var'));
    });
    
    const variableData = masterData.filter(r => {
        const typeVal = String(r['Type'] || r['type'] || '').toLowerCase();
        return typeVal.includes('variable') || typeVal.includes('var');
    });

    const wb = XLSX.utils.book_new();

    // Helper to clean internal keys for export (fallback mode)
    const cleanRowsObj = (rows: any[]) => rows.map(({ _SourceFile, _FileId, ...rest }) => ({
        "Source File": _SourceFile,
        ...rest
    }));

    // --- SIMPLE SHEET ---
    let finalSimple: any[][] = [];
    let simpleSheetName = "Simple Products";
    
    if (simpleTemplateFile && simpleTemplateRows.length > 0) {
        // 1. Existing Template Data (All Rows)
        const existingData = [...simpleTemplateRows];
        
        // 2. New Data mapped to Array of Arrays
        const newMappedData = mapDataToRows(simpleData, simpleHeaders, simpleMapping);
        
        // 3. Combine: Append new data AFTER existing rows
        finalSimple = [...existingData, ...newMappedData];
        simpleSheetName = "Mapped Simple";
        
        const wsSimple = XLSX.utils.aoa_to_sheet(finalSimple);
        XLSX.utils.book_append_sheet(wb, wsSimple, simpleSheetName);
    } else if (simpleData.length > 0) {
        // Fallback: Dump extracted data
        const wsSimple = XLSX.utils.json_to_sheet(cleanRowsObj(simpleData));
        XLSX.utils.book_append_sheet(wb, wsSimple, simpleSheetName);
    }

    // --- VARIABLE SHEET ---
    let finalVar: any[][] = [];
    let varSheetName = "Variable Products";

    if (varTemplateFile && varTemplateRows.length > 0) {
        // 1. Existing Template Data
        const existingData = [...varTemplateRows];
        
        // 2. New Data mapped
        const newMappedData = mapDataToRows(variableData, varHeaders, varMapping);
        
        // 3. Combine
        finalVar = [...existingData, ...newMappedData];
        varSheetName = "Mapped Variable";
        
        const wsVar = XLSX.utils.aoa_to_sheet(finalVar);
        XLSX.utils.book_append_sheet(wb, wsVar, varSheetName);
    } else if (variableData.length > 0) {
        // Fallback
        const wsVar = XLSX.utils.json_to_sheet(cleanRowsObj(variableData));
        XLSX.utils.book_append_sheet(wb, wsVar, varSheetName);
    }

    // Fallback if no specific template used and simple/var splitting didn't output everything (edge case)
    if (!simpleTemplateFile && !varTemplateFile && simpleData.length === 0 && variableData.length === 0) {
        const wsMain = XLSX.utils.json_to_sheet(cleanRowsObj(masterData));
        XLSX.utils.book_append_sheet(wb, wsMain, "Extracted Data");
    }

    saveWorkbook(wb, `OCR_Results_Mapped_${Date.now()}.xlsx`);
  };

  const handleAddField = () => {
    setSchemaFields([...schemaFields, {name: '', desc: ''}]);
  };

  const updateField = (idx: number, key: 'name' | 'desc', val: string) => {
    const newFields = [...schemaFields];
    newFields[idx][key] = val;
    setSchemaFields(newFields);
  };

  const removeField = (idx: number) => {
    setSchemaFields(schemaFields.filter((_, i) => i !== idx));
  };

  // Helper to render mapping table
  const renderMappingUI = (
      type: 'simple' | 'variable', 
      headers: string[], 
      mapping: Record<string, string>, 
      setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
      return (
        <div className="space-y-2 animate-in fade-in slide-in-from-right-2">
            <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-slate-500 font-semibold">{type === 'simple' ? 'Simple' : 'Variable'} Template Columns:</div>
                <button onClick={() => clearTemplate(type)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {headers.map((header, idx) => (
                    <div key={idx} className="flex flex-col gap-1 bg-slate-50 p-2 rounded border border-slate-100">
                        <span className="text-xs font-bold text-slate-700 truncate" title={header}>{header}</span>
                        <select 
                            className="w-full text-xs p-1 border rounded bg-white"
                            value={mapping[header] || ""}
                            onChange={(e) => setMapping({...mapping, [header]: e.target.value})}
                        >
                            <option value="">-- Ignore --</option>
                            {rawHeaders.map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
      );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Configuration Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         
         {/* Left: Inputs */}
         <div className="lg:col-span-4 space-y-4">
            
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
               <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                  <ScanText size={18} className="mr-2" />
                  {t.ocr.template}
               </h3>

               {/* Template Grid */}
               <div className="grid grid-cols-2 gap-2 mb-4">
                  {templates.map(tmpl => (
                     <button
                        key={tmpl.id}
                        onClick={() => {
                           setActiveTemplate(tmpl.id);
                           setUseSchema(false);
                           if (tmpl.prompt) setInstruction(tmpl.prompt);
                        }}
                        className={`p-2 flex flex-col items-center justify-center border rounded transition-all
                           ${activeTemplate === tmpl.id && !useSchema
                             ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold' 
                             : 'hover:bg-slate-50 border-slate-200 text-slate-600'}`}
                     >
                        <tmpl.icon size={20} className="mb-1 opacity-80" />
                        <span className="text-xs">{tmpl.label}</span>
                     </button>
                  ))}
               </div>

               {/* Prompt Input */}
               {!useSchema && (
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t.ocr.prompt}</label>
                    <textarea 
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      className="w-full p-2 border rounded text-sm min-h-[80px] bg-white text-slate-900 placeholder-slate-400"
                      placeholder={language === 'ar' ? 'اكتب تعليمات الاستخراج...' : 'Describe what to extract...'}
                    />
                 </div>
               )}

               {/* Schema Builder Toggle */}
               <div className="mt-4 pt-4 border-t border-slate-100">
                  <button 
                     onClick={() => setUseSchema(!useSchema)}
                     className="flex items-center text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors"
                  >
                     <TableProperties size={14} className="mr-1" />
                     {useSchema ? t.ocr.promptMode : t.ocr.schemaMode}
                  </button>

                  {useSchema && (
                     <div className="mt-3 space-y-2 animate-in slide-in-from-top-2">
                        {schemaFields.map((field, idx) => (
                           <div key={idx} className="flex gap-2 items-center">
                              <input 
                                type="text" placeholder={t.ocr.colName} 
                                className="w-1/3 p-1 border rounded text-xs bg-white text-slate-900 placeholder-slate-400"
                                value={field.name} onChange={e => updateField(idx, 'name', e.target.value)}
                              />
                              <input 
                                type="text" placeholder={t.ocr.descType}
                                className="flex-1 p-1 border rounded text-xs bg-white text-slate-900 placeholder-slate-400"
                                value={field.desc} onChange={e => updateField(idx, 'desc', e.target.value)}
                              />
                              <button onClick={() => removeField(idx)} className="text-slate-400 hover:text-red-500">
                                 <X size={14} />
                              </button>
                           </div>
                        ))}
                        <button onClick={handleAddField} className="text-xs text-blue-600 hover:underline flex items-center mt-1">
                           <Plus size={12} className="mr-1"/> {t.ocr.addCol}
                        </button>
                     </div>
                  )}
               </div>
            </div>

            {/* Options */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
               <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                     type="checkbox" 
                     checked={autoBilingual} 
                     onChange={e => setAutoBilingual(e.target.checked)}
                     className="rounded text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{t.ocr.autoBilingual}</span>
               </label>

               <label className="flex items-center space-x-2 cursor-pointer">
                  <input 
                     type="checkbox" 
                     checked={extractSizes} 
                     onChange={e => setExtractSizes(e.target.checked)}
                     className="rounded text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{t.ocr.smartSplit}</span>
               </label>
            </div>
            
            <button
               onClick={handleExtract}
               disabled={files.length === 0 || status === ProcessingStatus.PROCESSING}
               className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
                  ${files.length === 0 || status === ProcessingStatus.PROCESSING
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
               {status === ProcessingStatus.PROCESSING ? <Zap size={18} className="animate-spin" /> : <ScanText size={18} />}
               <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.ocr.extractBtn}</span>
            </button>

            {/* DUAL MAPPING SECTION */}
            {rawHeaders.length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileSpreadsheet size={16}/> Output Mapping</h3>
                    </div>
                    
                    {/* Tabs for Simple / Variable Mapping */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setMappingTab('simple')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all flex items-center justify-center gap-1
                                ${mappingTab === 'simple' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Box size={14}/> Simple
                        </button>
                        <button 
                            onClick={() => setMappingTab('variable')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded transition-all flex items-center justify-center gap-1
                                ${mappingTab === 'variable' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Boxes size={14}/> Variable
                        </button>
                    </div>

                    {/* Simple Template Body */}
                    {mappingTab === 'simple' && (
                        <>
                            {!simpleTemplateFile ? (
                                <label className="flex flex-col items-center gap-2 w-full p-4 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition-colors text-xs text-slate-500 justify-center">
                                    <UploadCloud size={24} className="text-blue-400" />
                                    <span>Upload Simple Products Template</span>
                                    <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleTemplateUpload(e, 'simple')} className="hidden" />
                                </label>
                            ) : (
                                renderMappingUI('simple', simpleHeaders, simpleMapping, setSimpleMapping)
                            )}
                        </>
                    )}

                    {/* Variable Template Body */}
                    {mappingTab === 'variable' && (
                        <>
                            {!varTemplateFile ? (
                                <label className="flex flex-col items-center gap-2 w-full p-4 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition-colors text-xs text-slate-500 justify-center">
                                    <UploadCloud size={24} className="text-purple-400" />
                                    <span>Upload Variable Products Template</span>
                                    <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => handleTemplateUpload(e, 'variable')} className="hidden" />
                                </label>
                            ) : (
                                renderMappingUI('variable', varHeaders, varMapping, setVarMapping)
                            )}
                        </>
                    )}
                </div>
            )}
         </div>

         {/* Right: Upload & Results */}
         <div className="lg:col-span-8 flex flex-col min-h-[500px]">
            
            {/* Upload Area */}
            {masterData.length === 0 ? (
               <div className="flex-1 bg-white p-6 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-slate-50 transition-all text-center flex flex-col items-center justify-center">
                  <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                     <UploadCloud size={48} className="text-blue-500 mb-4" />
                     <span className="text-xl font-bold text-slate-700 mb-2">{t.ocr.uploadTitle}</span>
                     <span className="text-sm text-slate-400 mb-6">{t.ocr.browserMemory}</span>
                     <input 
                        type="file" 
                        multiple 
                        accept="image/*,application/pdf" 
                        onChange={handleFileUpload} 
                        className="hidden" 
                     />
                  </label>
                  
                  {files.length > 0 && (
                     <div className="mt-6 w-full max-w-lg grid grid-cols-4 gap-2">
                        {files.map(f => (
                           <div key={f.id} className="relative group aspect-square bg-slate-100 rounded border overflow-hidden">
                              {f.mimeType.includes('image') ? (
                                 <img src={f.previewUrl} className="w-full h-full object-cover" alt="preview" />
                              ) : (
                                 <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <FileText size={24} />
                                 </div>
                              )}
                              <button 
                                 onClick={() => removeFile(f.id)}
                                 className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:bg-white"
                              >
                                 <X size={12} />
                              </button>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            ) : (
               // Results View
               <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
                     <div className="flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2">
                            <TableIcon size={16}/> {t.common.results} ({processedData.length})
                        </h4>
                        <div className="flex gap-2">
                            <button 
                            onClick={handleCleanPrices}
                            className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-50"
                            title={t.ocr.cleanPrices}
                            >
                            <DollarSign size={14} /> <span className="hidden sm:inline">{t.ocr.cleanPrices}</span>
                            </button>
                            <button 
                            onClick={handleCleanText}
                            className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-50"
                            title="Clean Text"
                            >
                            <Type size={14} /> <span className="hidden sm:inline">Clean</span>
                            </button>
                            <div className="w-px bg-slate-300 mx-1"></div>
                            <button 
                            onClick={() => setShowSplitView(!showSplitView)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold border transition-colors ${showSplitView ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-slate-600 border-slate-300'}`}
                            title="Toggle Split View"
                            >
                            <Eye size={14} /> {showSplitView ? 'Hide Source' : 'View Source'}
                            </button>
                            <button 
                            onClick={handleDownload}
                            className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-700"
                            >
                            <Download size={14} /> {t.common.download}
                            </button>
                        </div>
                     </div>

                     {/* Result Tabs */}
                     <div className="flex bg-slate-100 p-1 rounded-lg self-start">
                        <button 
                            onClick={() => setResultTab('all')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${resultTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            All ({masterData.length})
                        </button>
                        <button 
                            onClick={() => setResultTab('simple')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${resultTab === 'simple' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Simple
                        </button>
                        <button 
                            onClick={() => setResultTab('variable')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${resultTab === 'variable' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Variable
                        </button>
                     </div>
                  </div>
                  
                  <div className="flex-1 flex overflow-hidden">
                     {/* Data Table */}
                     <div className={`flex-1 overflow-auto ${showSplitView ? 'w-1/2 border-r border-slate-200' : 'w-full'}`}>
                        <table className="w-full text-left text-sm border-collapse">
                           <thead className="bg-slate-100 sticky top-0 z-10">
                              <tr>
                                 <th className="p-2 border-b border-slate-200 w-10">#</th>
                                 {rawHeaders.map(h => (
                                    <th key={h} className="p-2 border-b border-slate-200 font-semibold text-slate-600 whitespace-nowrap min-w-[150px]">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between cursor-pointer hover:text-blue-600 select-none" onClick={() => handleSort(h)}>
                                                {h}
                                                <ArrowUpDown size={12} className={`ml-1 ${sortConfig?.key === h ? 'text-blue-600' : 'text-slate-300'}`} />
                                            </div>
                                            <div className="relative">
                                                <Search size={10} className="absolute left-1.5 top-1.5 text-slate-400" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Filter..." 
                                                    className="w-full pl-5 pr-1 py-0.5 text-[10px] border border-slate-300 rounded bg-white focus:border-blue-400 outline-none"
                                                    value={filters[h] || ''}
                                                    onChange={(e) => handleFilterChange(h, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </th>
                                 ))}
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {processedData.length === 0 ? (
                                <tr>
                                    <td colSpan={rawHeaders.length + 1} className="p-8 text-center text-slate-400 italic">
                                        No items found in this category.
                                    </td>
                                </tr>
                              ) : (
                                processedData.map((row, idx) => (
                                    <tr 
                                        key={idx} 
                                        onClick={() => setActiveRowIndex(idx)}
                                        className={`cursor-pointer hover:bg-blue-50 transition-colors ${activeRowIndex === idx ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}
                                    >
                                        <td className="p-2 text-center text-slate-400 text-xs font-mono border-r border-slate-100">{idx + 1}</td>
                                        {rawHeaders.map(h => (
                                        <td key={h} className="p-2 border-r border-slate-100 last:border-0 max-w-[200px] truncate" title={String(row[h])}>
                                            {String(row[h] || '')}
                                        </td>
                                        ))}
                                    </tr>
                                ))
                              )}
                           </tbody>
                        </table>
                     </div>

                     {/* Image Viewer (Split Mode) */}
                     {showSplitView && (
                        <div className="w-1/2 bg-slate-900 flex items-center justify-center relative p-4">
                           {activeRowIndex !== null && processedData[activeRowIndex] ? (
                              (() => {
                                 const fileId = processedData[activeRowIndex]._FileId;
                                 const file = files.find(f => f.id === fileId);
                                 return file ? (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <img 
                                           src={file.previewUrl} 
                                           className="max-w-full max-h-full object-contain shadow-2xl border border-white/10" 
                                           alt="Source" 
                                        />
                                        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                            {file.file.name}
                                        </div>
                                    </div>
                                 ) : <span className="text-white/50">File not found</span>;
                              })()
                           ) : (
                              <div className="text-white/50 text-sm flex flex-col items-center">
                                  <TableIcon size={32} className="mb-2 opacity-50"/>
                                  {t.ocr.selectRow}
                              </div>
                           )}
                        </div>
                     )}
                  </div>
               </div>
            )}
         </div>
      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default OcrTab;
