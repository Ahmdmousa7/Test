
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { translateBatch } from '../services/geminiService';
import { initGoogleAuth, updateSheetColumn } from '../services/googleSheetSync';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Play, RotateCcw, Zap, WifiOff, Split, Merge, ArrowRight, Layout, AlertCircle, ArrowDown, BrainCircuit, Globe, Book, Copy, Check, CloudUpload, User, PenTool, Columns, Table, FileOutput, ChevronDown, ChevronUp, Settings2, Plus, Combine, Replace } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  keyCount: number;
  onReset: () => void;
  language?: Language;
  googleClientId?: string;
}

type TranslationMode = 'bilingual' | 'separate' | 'template';

const TranslateTab: React.FC<Props> = ({ fileData, addLog, keyCount, onReset, language = 'en', googleClientId }) => {
  const t = TRANSLATIONS[language];
  
  // --- STATE ---
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedCols, setSelectedCols] = useState<number[]>([]);
  
  // Mode State
  const [mode, setMode] = useState<TranslationMode>('bilingual'); 
  const [separator, setSeparator] = useState<string>(' | '); 
  
  // Bilingual Specific Strategy
  // 'consolidate': Merge all selected cols into ONE output cell.
  // 'inplace': Update EACH selected col individually with bilingual text.
  const [bilingualStrategy, setBilingualStrategy] = useState<'consolidate' | 'inplace'>('consolidate');

  // Multi-Column Logic (Only for consolidate/separate modes)
  const [mergeSource, setMergeSource] = useState<boolean>(false); 

  // Output Config
  const [outputCol, setOutputCol] = useState<number>(1); 
  const [outputMapping, setOutputMapping] = useState<{[key: number]: number}>({}); 
  const [templatePattern, setTemplatePattern] = useState<string>('');

  // AI Config
  const [direction, setDirection] = useState<'ar_en' | 'en_ar' | 'auto'>('auto');
  const [contextCol, setContextCol] = useState<number>(-1);
  const [domain, setDomain] = useState<string>('Restaurant/Food');
  const [glossary, setGlossary] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // System
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [batchSize, setBatchSize] = useState<number>(20); // Higher batch size for deduplicated items
  const [resultData, setResultData] = useState<any[][] | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const cid = googleClientId || localStorage.getItem('google_client_id');
    if (cid) {
       initGoogleAuth(cid, (token) => {
          setIsGoogleConnected(true);
          addLog("Google Account Connected.", 'success');
       });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [googleClientId]);

  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      if (!selectedSheet) setSelectedSheet(fileData.sheets[0]);
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet);
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
        setContextCol(-1);
      }
    }
  }, [fileData, selectedSheet]);

  // --- HELPERS ---
  const toggleColumn = (idx: number) => {
    setSelectedCols(prev => {
      const isSelecting = !prev.includes(idx);
      const newCols = isSelecting ? [...prev, idx] : prev.filter(i => i !== idx);
      
      // Auto-map for Separate Mode
      if (isSelecting) {
         setOutputMapping(prevMap => ({ ...prevMap, [idx]: idx + 2 }));
      }
      return newCols;
    });
  };

  const getExcelColumnName = (colIndex: number) => {
      let temp, letter = '';
      colIndex++; 
      while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = (colIndex - temp - 1) / 26;
      }
      return letter;
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // --- PREVIEW GENERATOR ---
  const getPreviewText = () => {
      if (selectedCols.length === 0) return "Select columns to see preview...";
      
      const col1Name = headers[selectedCols[0]] || "Col A";
      const col2Name = selectedCols.length > 1 ? (headers[selectedCols[1]] || "Col B") : "Col B";
      const ex1 = "Apple";
      const ex2 = "Red";
      const trans1 = "تفاحة";
      const trans2 = "أحمر";
      
      const isMerge = selectedCols.length > 1 && mergeSource;

      if (mode === 'bilingual') {
          if (bilingualStrategy === 'inplace') {
              if (selectedCols.length > 1) {
                  return `Updates In-Place:\n${col1Name} → ${ex1}${separator}${trans1}\n${col2Name} → ${ex2}${separator}${trans2}`;
              }
              return `Updates In-Place:\n${col1Name} → ${ex1}${separator}${trans1}`;
          } 
          else {
              // Consolidate
              if (isMerge) {
                  return `Result Cell (Col ${getExcelColumnName(outputCol-1)}):\n${ex1} ${ex2}${separator}${trans1} ${trans2}`;
              } else {
                  if (selectedCols.length > 1) {
                      return `Result Cell (Col ${getExcelColumnName(outputCol-1)}):\n${ex1}${separator}${trans1}\n${ex2}${separator}${trans2}`;
                  }
                  return `Result Cell (Col ${getExcelColumnName(outputCol-1)}):\n${ex1}${separator}${trans1}`;
              }
          }
      } 
      else if (mode === 'separate') {
          if (isMerge) {
              return `Sources merged into translation:\n"${ex1} ${ex2}" → "${trans1} ${trans2}"\nOutput to Col ${getExcelColumnName(outputCol-1)}`;
          } else {
              return `Col A (${col1Name}): ${ex1}  →  New Col: ${trans1}`;
          }
      } 
      else if (mode === 'template') {
          return templatePattern
            .replace('[Item]', ex1)
            .replace('[Trans]', trans1) || "Define a template pattern above...";
      }
      return "";
  };

  // --- MAIN PROCESS ---
  const handleProcess = async () => {
    if (!isOnline) { addLog("No Internet Connection.", "error"); return; }
    if (!fileData || selectedCols.length === 0) { addLog("Please select columns.", 'warning'); return; }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      const data = getSheetData(fileData.workbook, selectedSheet);
      const outputData = JSON.parse(JSON.stringify(data)); // Deep clone
      
      const summaryData: string[][] = [["Row", "Source Text", "Translated Text", "Final Output"]];
      
      // --- 1. SETUP OUTPUT HEADERS ---
      // Determine if we need a single dedicated output column
      const needsSingleOutput = (mode === 'bilingual' && bilingualStrategy === 'consolidate') || 
                                mode === 'template' || 
                                (mode === 'separate' && mergeSource);

      if (needsSingleOutput) {
         const outputColIdx = outputCol - 1;
         if (!outputData[0]) outputData[0] = [];
         while (outputData[0].length <= outputColIdx) outputData[0].push("");
         
         if (!outputData[0][outputColIdx]) {
             if (mode === 'bilingual') outputData[0][outputColIdx] = "Bilingual Result";
             else if (mode === 'template') outputData[0][outputColIdx] = "Template Output";
             else outputData[0][outputColIdx] = "Merged Translation";
         }
      } 
      else if (mode === 'separate' && !mergeSource) {
         selectedCols.forEach((colIdx) => {
            const targetCol1Based = outputMapping[colIdx] || (colIdx + 2);
            const targetColIdx = targetCol1Based - 1;
            if (!outputData[0]) outputData[0] = [];
            while (outputData[0].length <= targetColIdx) outputData[0].push("");
            if (!outputData[0][targetColIdx]) {
               outputData[0][targetColIdx] = `${headers[colIdx]}_TR`;
            }
         });
      }

      // --- 2. PREPARE UNIQUE LIST (DEDUPLICATION) ---
      // This solves the inconsistency issue.
      // We will collect ALL items to be translated first, deduplicate them, translate them, then apply back.
      
      const uniqueToTranslate = new Map<string, { text: string, context?: string }>();
      const rowToKeyMap = new Map<number, string>(); // Maps RowIndex -> Key used for translation

      // Scan rows to build unique list
      for (let i = 1; i < data.length; i++) {
          const row = data[i] || [];
          const rowTexts: string[] = [];
          
          selectedCols.forEach(colIdx => {
              rowTexts.push(row[colIdx] ? String(row[colIdx]).trim() : "");
          });

          const validTexts = rowTexts.filter(t => t.length > 0);
          
          if (validTexts.length > 0) {
               let textToTranslate = "";
               
               // Construct the "Translation Unit" based on settings
               if (mergeSource && mode !== 'bilingual') { 
                   textToTranslate = validTexts.join(" "); 
               } 
               else if (mode === 'bilingual' && bilingualStrategy === 'consolidate' && mergeSource) {
                   textToTranslate = validTexts.join(" ");
               }
               else {
                   // Standard: maintain separation with delimiter
                   textToTranslate = validTexts.join(" ||| "); 
               }

               let contextVal = contextCol !== -1 ? String(row[contextCol] || "") : "";
               
               // The Unique Key combines Text + Context to ensure context-aware consistency
               // e.g. "Apple" (Fruit) is different from "Apple" (Tech)
               const uniqueKey = `${textToTranslate}_CTX:${contextVal}`;
               
               if (!uniqueToTranslate.has(uniqueKey)) {
                   uniqueToTranslate.set(uniqueKey, { text: textToTranslate, context: contextVal });
               }
               
               rowToKeyMap.set(i, uniqueKey);
          }
      }

      const uniqueItems = Array.from(uniqueToTranslate.values());
      const uniqueKeys = Array.from(uniqueToTranslate.keys());
      const totalUnique = uniqueItems.length;
      
      addLog(`Found ${totalUnique} unique items to translate (Deduplicated from ${data.length} rows).`, 'info');

      // --- 3. BATCH TRANSLATION OF UNIQUES ---
      const translationMap = new Map<string, string>(); // Key -> Translated Result
      const glossaryList = glossary.split(',').map(s => s.trim()).filter(s => s.length > 0);

      let processedUniqueCount = 0;

      for (let i = 0; i < totalUnique; i += batchSize) {
          const batchEnd = Math.min(i + batchSize, totalUnique);
          const currentBatchItems = uniqueItems.slice(i, batchEnd);
          const currentBatchKeys = uniqueKeys.slice(i, batchEnd);

          try {
              const translations = await translateBatch(currentBatchItems, {
                  sourceLang: direction === 'auto' ? 'auto' : (direction === 'ar_en' ? 'ar' : 'en'),
                  targetLang: direction === 'auto' ? 'auto' : (direction === 'ar_en' ? 'en' : 'ar'),
                  domain: domain,
                  glossary: glossaryList
              });

              // Map results back
              translations.forEach((result, idx) => {
                  translationMap.set(currentBatchKeys[idx], result);
              });

              processedUniqueCount += currentBatchItems.length;
              setProgress((processedUniqueCount / totalUnique) * 90); // 90% progress for translation phase
              await delay(200); // Slight delay to be nice to API

          } catch (e: any) {
              console.error(e);
              // Store empty string on error so we don't break the loop logic
              currentBatchKeys.forEach(k => translationMap.set(k, ""));
          }
      }

      // --- 4. APPLY RESULTS TO ROWS ---
      for (let i = 1; i < data.length; i++) {
          const key = rowToKeyMap.get(i);
          if (!key) continue;

          const translationResult = translationMap.get(key) || "";
          
          // Re-construct original parts for mapping logic
          const row = data[i];
          const originalParts: string[] = [];
          selectedCols.forEach(colIdx => {
              originalParts.push(row[colIdx] ? String(row[colIdx]).trim() : "");
          });

          if (!outputData[i]) outputData[i] = [];

          if (mode === 'bilingual') {
              if (bilingualStrategy === 'inplace') {
                  const transParts = translationResult.split("|||");
                  let validIdx = 0;
                  selectedCols.forEach((colIdx, k) => {
                      const orig = originalParts[k];
                      if (orig) {
                          const tText = (transParts[validIdx] || "").trim();
                          if (tText) {
                              outputData[i][colIdx] = `${orig}${separator}${tText}`;
                          }
                          validIdx++;
                      }
                  });
              } 
              else {
                  // Consolidate
                  let finalCellContent = "";
                  if (mergeSource) {
                      const sourceCombined = originalParts.filter(Boolean).join(" ");
                      if (translationResult && sourceCombined) {
                          finalCellContent = `${sourceCombined}${separator}${translationResult}`;
                      } else {
                          finalCellContent = sourceCombined || translationResult;
                      }
                  } else {
                      const transParts = translationResult.split("|||");
                      const lines: string[] = [];
                      let validIdx = 0;
                      originalParts.forEach((origText) => {
                          if (!origText) return;
                          const tText = (transParts[validIdx] || "").trim();
                          if (tText) lines.push(`${origText}${separator}${tText}`);
                          else lines.push(origText);
                          validIdx++;
                      });
                      finalCellContent = lines.join("\n");
                  }
                  const outputColIdx = outputCol - 1;
                  outputData[i][outputColIdx] = finalCellContent;
              }

          } else if (mode === 'separate') {
              if (mergeSource) {
                  const outputColIdx = outputCol - 1;
                  outputData[i][outputColIdx] = translationResult;
              } else {
                  const transParts = translationResult.split("|||");
                  let validIdx = 0;
                  selectedCols.forEach((colIdx, k) => {
                      const orig = originalParts[k];
                      if (orig) {
                          const tText = (transParts[validIdx] || "").trim();
                          const targetColIdx = (outputMapping[colIdx] || (colIdx + 2)) - 1;
                          outputData[i][targetColIdx] = tText;
                          validIdx++;
                      }
                  });
              }
          } else if (mode === 'template') {
              const transParts = translationResult.split("|||");
              let res = templatePattern;
              const tText = transParts[0] || "";
              const orig = originalParts.find(p => p) || "";
              res = res.replace('[Item]', orig).replace('[Trans]', tText);
              
              const outputColIdx = outputCol - 1;
              outputData[i][outputColIdx] = res;
          }

          summaryData.push([String(i + 1), originalParts.join(", "), translationResult, "Processed"]);
      }

      setResultData(outputData);

      // --- 5. EXPORT FILE ---
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(data), "Original File");
      XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(outputData), "Translated File");
      XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(summaryData), "Translation Summary");
      
      saveWorkbook(newWb, `Translated_${fileData.name}`);
      addLog(t.common.completed, 'success');
      setStatus(ProcessingStatus.COMPLETED);
      setProgress(100);

    } catch (e: any) {
        addLog(`Error: ${e.message}`, 'error');
        setStatus(ProcessingStatus.IDLE);
    }
  };

  const handleCopyToClipboard = () => {
    if (!resultData) return;
    const text = resultData.map(r => r.join("\t")).join("\n");
    navigator.clipboard.writeText(text).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. TOP CONFIGURATION AREA */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
         
         {/* LEFT: SETTINGS (4 Cols) */}
         <div className="md:col-span-4 space-y-4">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                    <Settings2 size={18} className="mr-2"/> Configuration
                </h3>

                {/* Sheet Selector */}
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Source Sheet</label>
                    <select 
                        className="w-full p-2 border rounded text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedSheet}
                        onChange={(e) => { setSelectedSheet(e.target.value); setSelectedCols([]); }}
                    >
                        {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* Language Direction */}
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.translate.direction}</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setDirection('auto')} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${direction === 'auto' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Auto ⇄</button>
                        <button onClick={() => setDirection('en_ar')} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${direction === 'en_ar' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>En → Ar</button>
                        <button onClick={() => setDirection('ar_en')} className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${direction === 'ar_en' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Ar → En</button>
                    </div>
                </div>

                {/* Advanced Toggle */}
                <div>
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors w-full justify-between"
                    >
                        <span>Advanced Settings</span>
                        {showAdvanced ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    
                    {showAdvanced && (
                        <div className="mt-3 space-y-3 p-3 bg-slate-50 rounded border border-slate-100 animate-in slide-in-from-top-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Context Column</label>
                                <select 
                                    className="w-full p-1.5 border rounded text-xs"
                                    value={contextCol}
                                    onChange={(e) => setContextCol(Number(e.target.value))}
                                >
                                    <option value="-1">None</option>
                                    {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Domain</label>
                                <select className="w-full p-1.5 border rounded text-xs" value={domain} onChange={e => setDomain(e.target.value)}>
                                    <option value="Restaurant/Food">Restaurant / Menu</option>
                                    <option value="E-commerce">E-commerce / Retail</option>
                                    <option value="Technical">Technical / IT</option>
                                    <option value="General">General</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Run Button */}
            <button
                onClick={handleProcess}
                disabled={status === ProcessingStatus.PROCESSING || selectedCols.length === 0}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
                    ${status === ProcessingStatus.PROCESSING ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
            >
                {status === ProcessingStatus.PROCESSING ? <Zap className="animate-spin" size={20}/> : <Play size={20}/>}
                <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}</span>
            </button>

         </div>

         {/* CENTER: MODE SELECTION (5 Cols) */}
         <div className="md:col-span-5 space-y-4">
             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                 <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Layout size={18}/> Output Mode
                 </h3>
                 
                 <div className="grid grid-cols-1 gap-3 flex-1">
                     
                     {/* Card 1: Bilingual (Default) */}
                     <button 
                        onClick={() => setMode('bilingual')}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all group flex flex-col gap-2
                            ${mode === 'bilingual' 
                                ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                                : 'border-slate-100 hover:border-blue-300 hover:bg-slate-50'}`}
                     >
                         <div className="flex justify-between items-start w-full">
                             <div className={`p-2 rounded-lg ${mode === 'bilingual' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                 <Merge size={20}/>
                             </div>
                             {mode === 'bilingual' && <Check size={18} className="text-blue-600"/>}
                         </div>
                         <div>
                             <h4 className={`font-bold ${mode === 'bilingual' ? 'text-blue-800' : 'text-slate-700'}`}>Bilingual Cell</h4>
                             <p className="text-xs text-slate-500 mt-1">Puts Arabic & English in ONE cell.</p>
                         </div>
                     </button>

                     {/* Card 2: Separate */}
                     <button 
                        onClick={() => setMode('separate')}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all group flex flex-col gap-2
                            ${mode === 'separate' 
                                ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-500' 
                                : 'border-slate-100 hover:border-purple-300 hover:bg-slate-50'}`}
                     >
                         <div className="flex justify-between items-start w-full">
                             <div className={`p-2 rounded-lg ${mode === 'separate' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                 <Columns size={20}/>
                             </div>
                             {mode === 'separate' && <Check size={18} className="text-purple-600"/>}
                         </div>
                         <div>
                             <h4 className={`font-bold ${mode === 'separate' ? 'text-purple-800' : 'text-slate-700'}`}>New Column</h4>
                             <p className="text-xs text-slate-500 mt-1">Places translation in a new column.</p>
                         </div>
                     </button>

                     {/* Card 3: Custom */}
                     <button 
                        onClick={() => setMode('template')}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all group flex flex-col gap-2
                            ${mode === 'template' 
                                ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500' 
                                : 'border-slate-100 hover:border-amber-300 hover:bg-slate-50'}`}
                     >
                         <div className="flex justify-between items-start w-full">
                             <div className={`p-2 rounded-lg ${mode === 'template' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                 <PenTool size={20}/>
                             </div>
                             {mode === 'template' && <Check size={18} className="text-amber-600"/>}
                         </div>
                         <div>
                             <h4 className={`font-bold ${mode === 'template' ? 'text-amber-800' : 'text-slate-700'}`}>Custom Template</h4>
                             <p className="text-xs text-slate-500 mt-1">Use format like [Item] - [Trans].</p>
                         </div>
                     </button>

                 </div>

                 {/* Configuration Inputs */}
                 <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in">
                     
                     {/* MERGE TOGGLE (Available for Separate/Template if > 1 col, but NOT for Bilingual In-Place) */}
                     {selectedCols.length > 1 && !(mode === 'bilingual' && bilingualStrategy === 'inplace') && (
                        <div className="mb-4 p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={mergeSource} 
                                    onChange={e => setMergeSource(e.target.checked)}
                                    className="rounded text-indigo-600 w-4 h-4" 
                                />
                                <span className="text-xs font-bold text-indigo-800 flex items-center gap-1">
                                    <Combine size={14}/> Merge Selected Columns?
                                </span>
                            </label>
                            <p className="text-[10px] text-indigo-600 mt-1 pl-6">
                                {mergeSource 
                                    ? "Combines columns first, then translates as one phrase." 
                                    : "Translates each column independently."}
                            </p>
                        </div>
                     )}

                     {mode === 'bilingual' && (
                         <div className="space-y-3">
                             {/* STRATEGY TOGGLE */}
                             <div className="flex bg-slate-100 p-1 rounded-lg">
                                 <button 
                                    onClick={() => setBilingualStrategy('consolidate')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition-all flex items-center justify-center gap-1
                                        ${bilingualStrategy === 'consolidate' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                 >
                                     <Merge size={12}/> Consolidate Output
                                 </button>
                                 <button 
                                    onClick={() => setBilingualStrategy('inplace')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition-all flex items-center justify-center gap-1
                                        ${bilingualStrategy === 'inplace' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                 >
                                     <Replace size={12}/> Update Each Column
                                 </button>
                             </div>

                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Separator</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={separator} 
                                        onChange={e => setSeparator(e.target.value)}
                                        className="flex-1 p-2 border rounded text-sm bg-slate-50 font-mono text-center"
                                        placeholder=" | "
                                    />
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setSeparator(' | ')} className="p-2 bg-slate-100 rounded hover:bg-slate-200 text-xs font-mono">|</button>
                                        <button onClick={() => setSeparator('\n')} className="p-2 bg-slate-100 rounded hover:bg-slate-200 text-xs font-mono">↵</button>
                                        <button onClick={() => setSeparator(' / ')} className="p-2 bg-slate-100 rounded hover:bg-slate-200 text-xs font-mono">/</button>
                                    </div>
                                </div>
                             </div>
                         </div>
                     )}
                     
                     {mode === 'separate' && !mergeSource && (
                         <div className="p-2 bg-purple-50 rounded text-xs text-purple-800">
                             Auto-maps each source to a new column (Col+1).
                         </div>
                     )}

                     {mode === 'template' && (
                         <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Template Pattern</label>
                             <input 
                                type="text" 
                                value={templatePattern} 
                                onChange={e => setTemplatePattern(e.target.value)}
                                className="w-full p-2 border rounded text-sm bg-slate-50"
                                placeholder="[Item] ([Trans])"
                             />
                         </div>
                     )}
                 </div>
                 
                 {/* Live Preview Box */}
                 <div className="mt-4 bg-slate-800 text-white p-3 rounded-lg shadow-inner">
                     <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Live Output Preview</span>
                     <p className="font-mono text-sm whitespace-pre-wrap leading-relaxed text-green-300">{getPreviewText()}</p>
                 </div>

             </div>
         </div>

         {/* RIGHT: COLUMN SELECTION (3 Cols) */}
         <div className="md:col-span-3">
             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-700 flex items-center gap-2"><Table size={18}/> Columns</h3>
                     <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{selectedCols.length}</span>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg bg-slate-50 p-2">
                     {headers.map((h, i) => (
                         <label key={i} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedCols.includes(i) ? 'bg-white border border-blue-200 shadow-sm' : 'hover:bg-slate-200'}`}>
                             <input 
                                type="checkbox" 
                                checked={selectedCols.includes(i)} 
                                onChange={() => toggleColumn(i)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                             />
                             <span className={`text-xs truncate ${selectedCols.includes(i) ? 'font-bold text-blue-700' : 'text-slate-600'}`}>{h || `Col ${i+1}`}</span>
                         </label>
                     ))}
                 </div>
                 
                 {/* Output Column Selector (For Single Column Output Modes) */}
                 {/* Logic: Show ONLY if NOT doing in-place update */}
                 {!(mode === 'bilingual' && bilingualStrategy === 'inplace') && (mode === 'bilingual' || mode === 'template' || (mode === 'separate' && mergeSource)) && (
                     <div className="mt-4 pt-4 border-t border-slate-100">
                         <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Output Column</label>
                         <div className="flex items-center gap-2">
                             <FileOutput size={16} className="text-slate-400"/>
                             <input 
                                type="number" 
                                min="1" 
                                className="w-16 p-1.5 border rounded text-sm text-center font-bold"
                                value={outputCol}
                                onChange={e => setOutputCol(Number(e.target.value))}
                             />
                             <span className="text-xs text-slate-400">(Col {getExcelColumnName(outputCol - 1)})</span>
                         </div>
                     </div>
                 )}
             </div>
         </div>

      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={`${t.common.processing} (Batch: ${batchSize})`} />}
      
      {resultData && (
          <div className="flex justify-center gap-4 animate-in fade-in slide-in-from-bottom-2">
              <button onClick={handleCopyToClipboard} className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-50 flex items-center gap-2">
                  {copySuccess ? <Check size={18}/> : <Copy size={18}/>}
                  {copySuccess ? "Copied!" : "Copy Output"}
              </button>
              {fileData?.spreadsheetId && (
                  <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-green-700 flex items-center gap-2">
                      <CloudUpload size={18}/> Sync to Google Sheet
                  </button>
              )}
          </div>
      )}

    </div>
  );
};

export default TranslateTab;
