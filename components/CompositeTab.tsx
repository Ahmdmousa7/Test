
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook, cloneWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  ShieldCheck, CheckCircle2, AlertCircle, AlignLeft, SearchCode, 
  DollarSign, Calculator, TrendingUp, Percent, TreeDeciduous, 
  ChevronRight, X, CircleDollarSign, AlertTriangle, Layers, Coins, Tag, FileWarning
} from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

// --- TYPES ---
interface Ingredient {
  sku: string;
  qty: number;
  unitCost: number;
  name?: string;
}

interface BomProduct {
  rowIdx: number;
  sku: string;
  name: string;
  retailPrice: number;
  ingredients: Ingredient[];
  baseTotalCost: number;
}

interface SimulationResult {
  sku: string;
  name: string;
  retailPrice: number;
  adjustedCost: number;
  marginPercent: number;
  profit: number;
  isRisk: boolean;
}

// Simple Levenshtein Distance Algorithm
const getEditDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const CompositeTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'validate' | 'analysis'>('validate');
  
  const [selectedCols, setSelectedCols] = useState<number[]>([]);
  const [compositeSheet, setCompositeSheet] = useState<string>('');
  const [rawSheet, setRawSheet] = useState<string>('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  
  const [summary, setSummary] = useState<{ total: number; errors: number } | null>(null);
  
  // Validation Settings
  const [autoAlign, setAutoAlign] = useState<boolean>(true);
  const [fixedColCount, setFixedColCount] = useState<number>(4); // Default to 4 fixed columns
  const [strictEmptyCheck, setStrictEmptyCheck] = useState<boolean>(false);
  
  const [enableFuzzy, setEnableFuzzy] = useState<boolean>(false);
  const [fuzzyThreshold, setFuzzyThreshold] = useState<number>(2);

  // Cost Logic State
  const [rawSkuCol, setRawSkuCol] = useState<number>(-1);
  const [costCol, setCostCol] = useState<number>(-1);
  const [rawNameCol, setRawNameCol] = useState<number>(-1); // New Name Mapping
  const [retailPriceCol, setRetailPriceCol] = useState<number>(-1);

  // Simulator State
  const [bomData, setBomData] = useState<BomProduct[]>([]);
  const [targetMargin, setTargetMargin] = useState<number>(30); // 30% default
  const [costFluctuation, setCostFluctuation] = useState<number>(0); // 0% increase
  const [visualizerItem, setVisualizerItem] = useState<BomProduct | null>(null);

  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      setRawSheet(fileData.sheets[0]);
      if (fileData.sheets.length > 1) {
        setCompositeSheet(fileData.sheets[1]);
      } else {
        setCompositeSheet('');
      }
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && compositeSheet) {
      const data = getSheetData(fileData.workbook, compositeSheet);
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
      }
    }
  }, [fileData, compositeSheet]);

  useEffect(() => {
    if (fileData && rawSheet) {
        const data = getSheetData(fileData.workbook, rawSheet);
        if (data.length > 0) {
            setRawHeaders(data[0] as string[]);
            setRawSkuCol(-1);
            setCostCol(-1);
            setRawNameCol(-1);
        }
    }
  }, [fileData, rawSheet]);

  const toggleColumn = (idx: number) => {
    setSelectedCols(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSelectAll = () => {
    if (selectedCols.length === headers.length) {
      setSelectedCols([]);
      setSummary(null);
    } else {
      setSelectedCols(headers.map((_, idx) => idx));
      setSummary(null);
    }
  };

  const handleProcess = async () => {
    if (!fileData) return;
    if (!compositeSheet || !rawSheet) {
      addLog("Please select both Composite and Raw sheets.", 'error');
      return;
    }
    
    // Validation specifics
    if (activeTab === 'validate' && selectedCols.length === 0) {
      addLog("Select columns to validate.", 'warning');
      return;
    }

    // Analysis specifics
    if (activeTab === 'analysis') {
        if (rawSkuCol === -1 || costCol === -1) {
            addLog("Please map Raw SKU and Cost columns.", 'warning');
            return;
        }
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    setSummary(null);
    setBomData([]); // Clear previous analysis
    addLog(activeTab === 'validate' ? t.common.processing : "Analyzing Financials...", 'info');

    try {
      await new Promise(r => setTimeout(r, 50));

      const compData = getSheetData(fileData.workbook, compositeSheet);
      const rawData = getSheetData(fileData.workbook, rawSheet);

      const rawMaterialsSet = new Set<string>();
      const rawMaterialsArr: string[] = [];
      const skuCostMap = new Map<string, number>();
      const skuNameMap = new Map<string, string>(); // New Map for Names

      // 1. Build Lookup Maps (Existence, Cost, Name)
      rawData.slice(1).forEach(row => {
        if (rawSkuCol !== -1) {
            // Precise SKU lookup
            const val = String(row[rawSkuCol] || "").trim();
            if (val) {
                rawMaterialsSet.add(val);
                if (enableFuzzy) rawMaterialsArr.push(val);
                
                // Capture data if in analysis mode
                if (activeTab === 'analysis') {
                    if (costCol !== -1) {
                        const costVal = String(row[costCol] || "0").replace(/[^0-9.]/g, '');
                        skuCostMap.set(val, parseFloat(costVal) || 0);
                    }
                    if (rawNameCol !== -1) {
                        const nameVal = String(row[rawNameCol] || "").trim();
                        skuNameMap.set(val, nameVal);
                    }
                }
            }
        } else {
            // Loose lookup (scan all) - Legacy Mode for Validation
            row.forEach(cell => {
                if (cell) {
                    const val = String(cell).trim();
                    rawMaterialsSet.add(val);
                    if (enableFuzzy) rawMaterialsArr.push(val);
                }
            });
        }
      });

      const compHeader = compData[0];
      let compRows = compData.slice(1);
      
      // Auto Align Logic (Only for Validation Mode usually, but helpful generally)
      if (activeTab === 'validate' && autoAlign) {
         compRows = compRows.map(row => {
            const fixedCount = fixedColCount;
            const fixed = row.slice(0, fixedCount);
            // Ensure fixed part exists
            while(fixed.length < fixedCount) fixed.push("");

            const dynamic = row.slice(fixedCount);
            const pairs: any[] = [];
            
            for (let i = 0; i < dynamic.length; i += 2) {
               const sku = dynamic[i];
               const qty = dynamic[i+1];
               const isSkuEmpty = sku === undefined || sku === null || String(sku).trim() === "";
               const isQtyEmpty = qty === undefined || qty === null || String(qty).trim() === "";
               
               if (!isSkuEmpty || !isQtyEmpty) {
                   pairs.push(sku !== undefined ? sku : "", qty !== undefined ? qty : "");
               }
            }
            return [...fixed, ...pairs];
         });
      }
      
      const errorRows: { rowData: any[], errors: string[], locations: string[], rowIndex: number }[] = [];
      const errorRowIndices = new Set<number>();
      const parsedBomProducts: BomProduct[] = [];
      
      // Prepare Final Output Header
      if (activeTab === 'analysis') {
          compHeader.push("Calculated Cost");
      }

      const totalRows = compRows.length;
      const chunkSize = 100;
      
      for (let i = 0; i < totalRows; i += chunkSize) {
         const end = Math.min(i + chunkSize, totalRows);
         const chunk = compRows.slice(i, end);
         
         chunk.forEach((row, cIdx) => {
            const idx = i + cIdx;
            const rowErrors: string[] = [];
            const rowLocations: string[] = [];

            // Helper to get Excel cell ref
            // Note: idx is 0-based index in compRows. compRows starts at row 2 (index 1) of sheet.
            // So Excel Row = idx + 2. (Row 1 is header).
            const getCellRef = (colIdx: number) => XLSX.utils.encode_cell({ r: idx + 1, c: colIdx });
            
            // --- ANALYSIS MODE LOGIC ---
            if (activeTab === 'analysis') {
                let rowTotalCost = 0;
                const rowIngredients: Ingredient[] = [];
                
                // Assume ingredients start at fixedColCount (standard structure assumption for BOM sheets)
                const startIdx = fixedColCount;
                
                for (let k = startIdx; k < row.length; k += 2) {
                    const sku = String(row[k] || "").trim();
                    const qty = parseFloat(row[k+1]) || 0;
                    if (sku) {
                        const unitCost = skuCostMap.get(sku) || 0;
                        const ingName = skuNameMap.get(sku) || "";
                        rowTotalCost += unitCost * qty;
                        rowIngredients.push({ sku, qty, unitCost, name: ingName });
                    }
                }
                
                row.push(rowTotalCost); // Append Cost to Row

                // Capture for Simulator
                const prodName = String(row[0] || `Product ${idx+1}`).trim(); 
                const prodSku = String(row[1] || "").trim(); 
                let retailPrice = 0;
                if (retailPriceCol !== -1) {
                    const priceStr = String(row[retailPriceCol] || "0").replace(/[^0-9.]/g, '');
                    retailPrice = parseFloat(priceStr) || 0;
                }
                
                parsedBomProducts.push({
                    rowIdx: idx,
                    sku: prodSku,
                    name: prodName,
                    retailPrice: retailPrice,
                    ingredients: rowIngredients,
                    baseTotalCost: rowTotalCost
                });
            }

            // --- VALIDATION MODE LOGIC ---
            if (activeTab === 'validate') {
                const rowVals: {col: number, val: string}[] = [];
                selectedCols.forEach(colIdx => {
                   const val = String(row[colIdx] || "").trim();
                   rowVals.push({col: colIdx, val});
                });

                // STRICT EMPTY CHECK
                if (strictEmptyCheck) {
                    // A. Check Fixed Columns (Row Header Integrity)
                    // Usually Name is col 0, SKU is col 1
                    const pName = String(row[0] || "").trim();
                    const pSku = String(row[1] || "").trim();
                    
                    if (fixedColCount >= 2 && (!pName || !pSku)) {
                        rowErrors.push("Missing Product Definition (Name or SKU in Col 1/2)");
                        if(!pName) rowLocations.push(getCellRef(0));
                        if(!pSku) rowLocations.push(getCellRef(1));
                    } else if (fixedColCount >= 1 && !pName) {
                        rowErrors.push("Missing Product Name (Col 1)");
                        rowLocations.push(getCellRef(0));
                    }

                    // B. Check Ingredient Pair Integrity
                    for (let k = fixedColCount; k < row.length; k += 2) {
                        const iSku = String(row[k] || "").trim();
                        const iQty = String(row[k+1] || "").trim();
                        
                        if (iSku && !iQty) {
                            rowErrors.push(`Missing Qty for Ingredient '${iSku}'`);
                            rowLocations.push(getCellRef(k+1));
                        }
                        if (!iSku && iQty) {
                            rowErrors.push(`Missing SKU for Qty '${iQty}'`);
                            rowLocations.push(getCellRef(k));
                        }
                    }
                }

                // Numeric Check
                rowVals.forEach(item => {
                   if (item.val && isNaN(Number(item.val))) {
                      if (item.col >= fixedColCount) { // Assumes dynamic cols start at fixedColCount
                         rowErrors.push(`Non-numeric value '${item.val}'`);
                         rowLocations.push(getCellRef(item.col));
                      }
                   }
                });

                // Missing SKU Check
                rowVals.forEach(item => {
                   // Check only SKU columns (even indices in dynamic part relative to start)
                   if (item.col >= fixedColCount && (item.col - fixedColCount) % 2 === 0) { 
                       if (item.val && !rawMaterialsSet.has(item.val)) {
                          let errorMsg = `SKU '${item.val}' missing`;

                          if (enableFuzzy && rawMaterialsArr.length > 0) {
                            let bestMatch = "";
                            let minDist = Infinity;
                            
                            if (item.val.length > 2) {
                               for (const rawSku of rawMaterialsArr) {
                                  if (Math.abs(rawSku.length - item.val.length) > fuzzyThreshold) continue;
                                  const dist = getEditDistance(item.val, rawSku);
                                  if (dist < minDist) {
                                     minDist = dist;
                                     bestMatch = rawSku;
                                  }
                                  if (minDist === 1) break; 
                               }
                            }

                            if (minDist <= fuzzyThreshold) {
                               errorMsg = `Possible Typo: '${item.val}'? Did you mean '${bestMatch}'?`;
                            }
                          }
                          rowErrors.push(errorMsg);
                          rowLocations.push(getCellRef(item.col));
                       }
                   }
                });
                
                // Duplicate Check
                const seenInRow = new Set<string>();
                 rowVals.forEach(item => {
                   if (item.col >= fixedColCount && (item.col - fixedColCount) % 2 === 0 && item.val) { 
                     if (seenInRow.has(item.val)) {
                        rowErrors.push(`Duplicate SKU '${item.val}'`);
                        rowLocations.push(getCellRef(item.col));
                     }
                     seenInRow.add(item.val);
                   }
                });

                if (rowErrors.length > 0) {
                  errorRows.push({
                    rowData: row,
                    errors: rowErrors,
                    locations: rowLocations,
                    rowIndex: idx
                  });
                  errorRowIndices.add(idx);
                }
            }
         });

         const currentProgress = Math.round((end / totalRows) * 100);
         setProgress(currentProgress);
         await new Promise(r => setTimeout(r, 0));
      }

      if (activeTab === 'analysis') {
          setBomData(parsedBomProducts);
          addLog("Cost Analysis Complete. Dashboard Updated.", 'success');
      }

      if (activeTab === 'validate') {
          setSummary({
            total: compRows.length,
            errors: errorRows.length
          });

          // Generate Result File
          const newWb = cloneWorkbook(fileData.workbook);
          const finalData = [compHeader, ...compRows];
          const newWs = XLSX.utils.aoa_to_sheet(finalData);
          
          if (errorRowIndices.size > 0) {
            const range = XLSX.utils.decode_range(newWs['!ref'] || "A1");
            errorRowIndices.forEach(rowIndex => {
                 const actualRowIdx = rowIndex + 1;
                 for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: actualRowIdx, c: C });
                    if (!newWs[cellRef]) newWs[cellRef] = { v: "", t: "s" }; 
                    if (!newWs[cellRef].s) newWs[cellRef].s = {};
                    newWs[cellRef].s.fill = { fgColor: { rgb: "FFC7CE" } };
                    newWs[cellRef].s.font = { color: { rgb: "9C0006" } };
                 }
             });
          }

          newWb.Sheets[compositeSheet] = newWs;

          if (errorRows.length > 0) {
            const errorHeader = [...compHeader, "Error Description", "Error Location"];
            const errorSheetData = [errorHeader];
            errorRows.forEach(err => {
               const newRow = [...err.rowData];
               while(newRow.length < compHeader.length) newRow.push("");
               newRow.push(err.errors.join(", "));
               newRow.push(err.locations.join(", "));
               errorSheetData.push(newRow);
            });
            const errorWs = XLSX.utils.aoa_to_sheet(errorSheetData);
            let errSheetName = "Validation Errors";
            let counter = 1;
            while (newWb.SheetNames.includes(errSheetName)) {
               errSheetName = `Validation Errors (${counter++})`;
            }
            XLSX.utils.book_append_sheet(newWb, errorWs, errSheetName);
          }
          
          saveWorkbook(newWb, `Validated_${fileData.name}`);
          addLog(errorRows.length > 0 ? `Found ${errorRows.length} errors.` : t.common.completed, errorRows.length > 0 ? 'warning' : 'success');
      }
      
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  // --- SIMULATION CALCULATOR ---
  const simulationResults: SimulationResult[] = useMemo(() => {
      return bomData.map(product => {
          let adjustedCost = 0;
          product.ingredients.forEach(ing => {
              const adjustedUnitCost = ing.unitCost * (1 + costFluctuation / 100);
              adjustedCost += adjustedUnitCost * ing.qty;
          });

          if (product.ingredients.length === 0) adjustedCost = product.baseTotalCost * (1 + costFluctuation / 100);

          const retail = product.retailPrice || 0;
          const profit = retail - adjustedCost;
          const marginPercent = retail > 0 ? (profit / retail) * 100 : 0;
          
          return {
              sku: product.sku,
              name: product.name,
              retailPrice: retail,
              adjustedCost,
              profit,
              marginPercent,
              isRisk: marginPercent < targetMargin
          };
      });
  }, [bomData, targetMargin, costFluctuation]);

  const stats = useMemo(() => {
      const risky = simulationResults.filter(r => r.isRisk);
      const profitable = simulationResults.filter(r => !r.isRisk);
      return {
          riskyCount: risky.length,
          safeCount: profitable.length,
          avgMargin: simulationResults.length > 0 
            ? simulationResults.reduce((sum, r) => sum + r.marginPercent, 0) / simulationResults.length 
            : 0
      };
  }, [simulationResults]);

  return (
    <div className="space-y-6">
      
      {/* 1. TOP CONFIGURATION (COMMON) */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
         <h3 className="font-bold text-slate-700 mb-4">{t.common.config}</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.composite.compSheet}</label>
                <select 
                  className="w-full p-2 border rounded text-sm bg-slate-50"
                  value={compositeSheet}
                  onChange={(e) => {
                    setCompositeSheet(e.target.value);
                    setSelectedCols([]);
                    setSummary(null);
                    setBomData([]);
                  }}
                >
                  <option value="">{t.common.selectSheet}...</option>
                  {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.composite.rawSheet}</label>
                <select 
                  className="w-full p-2 border rounded text-sm bg-slate-50"
                  value={rawSheet}
                  onChange={(e) => {
                    setRawSheet(e.target.value);
                    setSummary(null);
                    setBomData([]);
                  }}
                >
                  <option value="">{t.common.selectSheet}...</option>
                  {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
         </div>
      </div>

      {/* 2. MODE TABS */}
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('validate')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'validate' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShieldCheck size={16} />
          <span>Structure Validator</span>
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Coins size={16} />
          <span>Cost & Profit Analyzer</span>
        </button>
      </div>

      {/* 3. MODE SPECIFIC CONTENT */}
      {activeTab === 'validate' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Validation Settings */}
                  <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <label className="block text-sm font-bold text-slate-700 mb-2">Validation Settings</label>
                          <div className="space-y-3">
                             <div className="flex items-start space-x-2">
                                <label className="flex items-center space-x-2 cursor-pointer mt-1">
                                    <input 
                                      type="checkbox" 
                                      checked={autoAlign} 
                                      onChange={(e) => setAutoAlign(e.target.checked)}
                                      className="text-teal-600 rounded"
                                    />
                                </label>
                                <div className="text-sm flex-1">
                                  <span className="font-semibold flex items-center gap-1">
                                    <AlignLeft size={16} /> 
                                    {t.composite.autoAlign}
                                  </span>
                                  <p className="text-xs text-slate-500 mb-2">Remove empty columns to compact data.</p>
                                  
                                  {/* Config for Fixed Columns */}
                                  {autoAlign && (
                                      <div className="flex items-center gap-2 mt-1 animate-in fade-in">
                                          <label className="text-xs font-bold text-slate-600">Fixed Header Cols:</label>
                                          <input 
                                            type="number" 
                                            min="1" 
                                            max="20" 
                                            className="w-12 p-1 border rounded text-xs text-center font-bold"
                                            value={fixedColCount}
                                            onChange={(e) => setFixedColCount(Math.max(1, parseInt(e.target.value) || 4))}
                                          />
                                      </div>
                                  )}
                                </div>
                             </div>

                             {/* STRICT EMPTY CHECK */}
                             <div className="flex items-start space-x-2 mt-1">
                                <label className="flex items-center space-x-2 cursor-pointer mt-1">
                                    <input 
                                      type="checkbox" 
                                      checked={strictEmptyCheck} 
                                      onChange={(e) => setStrictEmptyCheck(e.target.checked)}
                                      className="text-red-600 rounded focus:ring-red-500"
                                    />
                                </label>
                                <div className="text-sm flex-1">
                                  <span className="font-semibold flex items-center gap-1 text-red-800">
                                    <FileWarning size={16} /> 
                                    Strict Empty Check
                                  </span>
                                  <p className="text-xs text-slate-500">Flag rows with missing Name/SKU or incomplete ingredient pairs.</p>
                                </div>
                             </div>

                             <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 mt-2">
                               <label className="flex items-start space-x-2 cursor-pointer mb-2">
                                  <input 
                                    type="checkbox" 
                                    checked={enableFuzzy} 
                                    onChange={(e) => setEnableFuzzy(e.target.checked)}
                                    className="mt-1 text-indigo-600 rounded"
                                  />
                                  <div className="text-sm">
                                    <span className="font-semibold flex items-center gap-1 text-indigo-800">
                                      <SearchCode size={16} /> 
                                      {t.composite.fuzzy}
                                    </span>
                                  </div>
                               </label>
                               
                               {enableFuzzy && (
                                  <div className="ml-6 flex items-center space-x-2">
                                     <span className="text-xs font-semibold text-indigo-700">{t.composite.tolerance}:</span>
                                     <select 
                                       value={fuzzyThreshold}
                                       onChange={(e) => setFuzzyThreshold(Number(e.target.value))}
                                       className="p-1 border border-indigo-200 rounded text-xs bg-white"
                                     >
                                        <option value={1}>1</option>
                                        <option value={2}>2</option>
                                        <option value={3}>3</option>
                                     </select>
                                  </div>
                               )}
                             </div>
                          </div>
                      </div>
                      
                      {/* Mapping for Validation (Basic Raw SKU) */}
                      <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Required Mapping</label>
                          <div className="mb-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Raw Sheet SKU Column</label>
                            <select 
                                className="w-full p-2 border rounded text-xs bg-white"
                                value={rawSkuCol}
                                onChange={(e) => setRawSkuCol(Number(e.target.value))}
                            >
                                <option value="-1">Auto-Detect / All Columns</option>
                                {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                            </select>
                          </div>
                      </div>
                  </div>

                  {/* Right: Column Selector */}
                  <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col h-80">
                       <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-slate-700">{t.common.selectCols}</h3>
                         <button
                           onClick={handleSelectAll}
                           disabled={headers.length === 0}
                           className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
                         >
                           {selectedCols.length === headers.length && headers.length > 0 ? t.common.reset : t.common.selected}
                         </button>
                       </div>
                       <div className="flex-1 overflow-y-auto border border-slate-100 rounded p-2 bg-slate-50">
                         {headers.map((header, idx) => (
                           <label key={idx} className="flex items-center space-x-2 p-1 hover:bg-slate-100 rounded cursor-pointer">
                             <input 
                                type="checkbox"
                                checked={selectedCols.includes(idx)}
                                onChange={() => { toggleColumn(idx); setSummary(null); }}
                                className="rounded text-blue-600"
                             />
                             <span className="text-sm text-slate-700 truncate" title={String(header)}>
                               {idx + 1}. {header || `(Empty)`}
                             </span>
                           </label>
                         ))}
                       </div>
                  </div>
              </div>

              {/* Action */}
              <div className="flex items-center gap-4">
                  <button
                    onClick={handleProcess}
                    disabled={!fileData || status === ProcessingStatus.PROCESSING}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-bold text-white shadow-sm transition-colors
                      ${status === ProcessingStatus.PROCESSING 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-teal-600 hover:bg-teal-700'}`}
                  >
                    <ShieldCheck size={18} />
                    <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.composite.validateBtn}</span>
                  </button>

                  {summary && (
                    <div className={`p-3 rounded-lg border flex items-center gap-3 ${summary.errors > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                        {summary.errors > 0 ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
                        <div className="text-sm font-bold">
                            {summary.errors > 0 ? `Found ${summary.errors} errors in ${summary.total} rows.` : `All ${summary.total} rows valid!`}
                        </div>
                    </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'analysis' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
              
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Calculator size={20}/> Financial Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      
                      <div className="p-3 bg-blue-50 rounded border border-blue-100">
                          <label className="block text-xs font-bold text-blue-800 mb-2 uppercase">Raw Sheet: SKU Column</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={rawSkuCol}
                              onChange={(e) => setRawSkuCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Select SKU --</option>
                              {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>

                      <div className="p-3 bg-green-50 rounded border border-green-100">
                          <label className="block text-xs font-bold text-green-800 mb-2 uppercase">Raw Sheet: Cost Column</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={costCol}
                              onChange={(e) => setCostCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Select Cost --</option>
                              {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>

                      <div className="p-3 bg-purple-50 rounded border border-purple-100">
                          <label className="block text-xs font-bold text-purple-800 mb-2 uppercase">Raw Sheet: Name Column</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={rawNameCol}
                              onChange={(e) => setRawNameCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Optional --</option>
                              {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>

                      <div className="p-3 bg-amber-50 rounded border border-amber-100">
                          <label className="block text-xs font-bold text-amber-800 mb-2 uppercase">Composite: Retail Price</label>
                          <select 
                              className="w-full p-2 border rounded text-sm bg-white"
                              value={retailPriceCol}
                              onChange={(e) => setRetailPriceCol(Number(e.target.value))}
                          >
                              <option value="-1">-- Optional --</option>
                              {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                      </div>
                  </div>

                  <button
                    onClick={handleProcess}
                    disabled={!fileData || status === ProcessingStatus.PROCESSING}
                    className={`mt-6 w-full py-4 rounded-lg font-bold text-white shadow-sm transition-colors flex justify-center items-center gap-2
                      ${status === ProcessingStatus.PROCESSING 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    <DollarSign size={20} />
                    <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : "Analyze Cost & Profit"}</span>
                  </button>
              </div>

              {/* --- PROFIT SIMULATOR DASHBOARD --- */}
              {bomData.length > 0 && (
                  <div className="mt-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                      <div className="bg-slate-900 text-white p-4 rounded-t-xl flex justify-between items-center shadow-lg">
                          <h3 className="font-bold text-lg flex items-center gap-2"><Calculator size={20} className="text-teal-400"/> Profit Simulator</h3>
                          <div className="text-xs bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                              Average Margin: <span className={stats.avgMargin > targetMargin ? "text-green-400 font-bold" : "text-amber-400 font-bold"}>{stats.avgMargin.toFixed(1)}%</span>
                          </div>
                      </div>
                      
                      <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl p-6 shadow-sm">
                          {/* Controls */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center">
                                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Percent size={16}/> Target Margin</label>
                                      <span className="text-lg font-bold text-blue-600">{targetMargin}%</span>
                                  </div>
                                  <input 
                                    type="range" min="0" max="90" step="5" 
                                    value={targetMargin} 
                                    onChange={(e) => setTargetMargin(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                  />
                                  <p className="text-xs text-slate-500">Products below this margin will be flagged as risk.</p>
                              </div>

                              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center">
                                      <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><TrendingUp size={16}/> "What-If" Material Cost Increase</label>
                                      <span className="text-lg font-bold text-amber-600">+{costFluctuation}%</span>
                                  </div>
                                  <input 
                                    type="range" min="0" max="50" step="1" 
                                    value={costFluctuation} 
                                    onChange={(e) => setCostFluctuation(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                  />
                                  <p className="text-xs text-slate-500">Simulate inflation on raw material costs globally.</p>
                              </div>
                          </div>

                          {/* KPI Cards */}
                          <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-4">
                                  <div className="p-3 bg-green-100 text-green-600 rounded-full"><CheckCircle2 size={24}/></div>
                                  <div>
                                      <p className="text-2xl font-bold text-slate-800">{stats.safeCount}</p>
                                      <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Profitable Products</p>
                                  </div>
                              </div>
                              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-4">
                                  <div className="p-3 bg-red-100 text-red-600 rounded-full"><AlertTriangle size={24}/></div>
                                  <div>
                                      <p className="text-2xl font-bold text-slate-800">{stats.riskyCount}</p>
                                      <p className="text-xs font-bold text-red-700 uppercase tracking-wider">At Risk Products</p>
                                  </div>
                              </div>
                          </div>

                          {/* Data Table */}
                          <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="max-h-80 overflow-y-auto">
                                  <table className="w-full text-sm text-left">
                                      <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                                          <tr>
                                              <th className="p-3 border-b">Product Name</th>
                                              <th className="p-3 border-b">Retail Price</th>
                                              <th className="p-3 border-b">Projected Cost</th>
                                              <th className="p-3 border-b">Profit</th>
                                              <th className="p-3 border-b">Margin %</th>
                                              <th className="p-3 border-b text-center">BOM</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {simulationResults.map((item, idx) => (
                                              <tr key={idx} className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${item.isRisk ? 'bg-red-50/30' : ''}`}>
                                                  <td className="p-3 font-medium text-slate-700">
                                                      <div className="flex flex-col">
                                                          <span>{item.name}</span>
                                                          <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                                                      </div>
                                                  </td>
                                                  <td className="p-3 font-mono">{item.retailPrice.toFixed(2)}</td>
                                                  <td className="p-3 font-mono text-slate-600">{item.adjustedCost.toFixed(2)}</td>
                                                  <td className={`p-3 font-mono font-bold ${item.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>{item.profit.toFixed(2)}</td>
                                                  <td className="p-3">
                                                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.isRisk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                          {item.marginPercent.toFixed(1)}%
                                                      </span>
                                                  </td>
                                                  <td className="p-3 text-center">
                                                      <button 
                                                        onClick={() => setVisualizerItem(bomData.find(b => b.sku === item.sku) || null)}
                                                        className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-full transition-colors"
                                                        title="View BOM Tree"
                                                      >
                                                          <TreeDeciduous size={18}/>
                                                      </button>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}

      {/* BOM VISUALIZER MODAL */}
      {visualizerItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-teal-500/20 rounded-lg"><TreeDeciduous size={20} className="text-teal-400"/></div>
                          <div>
                              <h3 className="font-bold text-lg">{visualizerItem.name}</h3>
                              <p className="text-xs text-slate-400 font-mono">{visualizerItem.sku}</p>
                          </div>
                      </div>
                      <button onClick={() => setVisualizerItem(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                      <div className="flex flex-col items-center">
                          {/* Root Node */}
                          <div className="bg-white border-2 border-teal-500 p-4 rounded-xl shadow-md min-w-[200px] text-center relative z-10">
                              <p className="font-bold text-slate-800 text-sm">{visualizerItem.name}</p>
                              <div className="mt-2 flex justify-center gap-4 text-xs">
                                  <span className="text-slate-500">Retail: <strong>{visualizerItem.retailPrice}</strong></span>
                                  <span className="text-slate-500">Cost: <strong>{visualizerItem.baseTotalCost.toFixed(2)}</strong></span>
                              </div>
                              {/* Connector Line Down */}
                              <div className="absolute top-full left-1/2 w-0.5 h-6 bg-slate-300 -translate-x-1/2"></div>
                          </div>

                          {/* Ingredient Grid */}
                          <div className="mt-6 w-full relative pt-4">
                              {/* Horizontal Bar Connector */}
                              {visualizerItem.ingredients.length > 1 && (
                                  <div className="absolute top-0 left-10 right-10 h-4 border-t-2 border-l-2 border-r-2 border-slate-300 rounded-t-xl"></div>
                              )}
                              
                              <div className="flex flex-wrap justify-center gap-4">
                                  {visualizerItem.ingredients.map((ing, i) => (
                                      <div key={i} className="relative pt-4">
                                          {/* Vertical Line from bar to node */}
                                          <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-slate-300 -translate-x-1/2"></div>
                                          
                                          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm w-40 hover:border-blue-400 hover:shadow-md transition-all group">
                                              <div className="flex items-center gap-2 mb-2">
                                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                      {i+1}
                                                  </div>
                                                  <div className="flex flex-col flex-1 min-w-0">
                                                      <p className="font-mono text-xs font-bold text-slate-700 truncate" title={ing.sku}>{ing.sku}</p>
                                                      {ing.name && <p className="text-[10px] text-slate-500 truncate" title={ing.name}>{ing.name}</p>}
                                                  </div>
                                              </div>
                                              <div className="text-xs space-y-1 text-slate-500">
                                                  <div className="flex justify-between"><span>Qty:</span> <span className="font-mono text-slate-800">{ing.qty}</span></div>
                                                  <div className="flex justify-between"><span>Unit:</span> <span className="font-mono text-slate-800">{ing.unitCost}</span></div>
                                                  <div className="border-t pt-1 mt-1 flex justify-between font-bold text-blue-700">
                                                      <span>Total:</span> <span>{(ing.qty * ing.unitCost).toFixed(2)}</span>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                      <span>Total Ingredients: <strong>{visualizerItem.ingredients.length}</strong></span>
                      <div className="flex gap-4">
                          <span className="flex items-center gap-1"><CircleDollarSign size={14} className="text-teal-500"/> Composite Cost</span>
                          <span className="flex items-center gap-1"><AlertTriangle size={14} className="text-amber-500"/> Raw Material</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default CompositeTab;
