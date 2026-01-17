
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Network, ArrowRight, Eraser, CheckSquare, Layers, Tag, Type, Grid3X3, List, Search, AlertCircle, CheckCircle2, LayoutGrid, X, Ban, BarChart3, TrendingUp, Edit, Save, MoreHorizontal } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface VisualGroup {
  key: string;
  status: 'Balanced' | 'Unbalanced';
  dimensions: { name: string, values: string[] }[];
  hits: Set<string>; 
  missingCount: number;
  missingValues: string[];
}

interface GlobalStats {
  totalProducts: number;
  balancedCount: number;
  unbalancedCount: number;
  missingFrequency: { name: string, count: number }[];
}

interface CellEdit {
    price: string;
    qty: string;
}

const VariableBalanceTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [groupCol, setGroupCol] = useState<number>(-1);
  const [optionCols, setOptionCols] = useState<number[]>([]);
  const [clearCols, setClearCols] = useState<number[]>([]);
  
  const [catCol, setCatCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  const [visualResults, setVisualResults] = useState<VisualGroup[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  
  const [selectedVisualGroup, setSelectedVisualGroup] = useState<VisualGroup | null>(null);
  const [visualFilter, setVisualFilter] = useState<'All' | 'Unbalanced'>('Unbalanced');
  const [visualSearch, setVisualSearch] = useState<string>('');
  
  // Interactive Matrix State
  const [markedCells, setMarkedCells] = useState<Set<string>>(new Set());
  const [cellEdits, setCellEdits] = useState<Map<string, CellEdit>>(new Map());
  
  // Context Menu & Modal State
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, key: string} | null>(null);
  const [editModal, setEditModal] = useState<{isOpen: boolean, key: string, price: string, qty: string} | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        setGroupCol(-1);
        setOptionCols([]);
        
        const idKeywords = ['id', 'sku', 'barcode', 'code', 'ref', 'كود', 'بار코드', 'رقم'];
        const autoClearIndices: number[] = [];
        head.forEach((h, i) => {
            if (h && idKeywords.some(k => h.toLowerCase().includes(k))) {
                autoClearIndices.push(i);
            }
        });
        setClearCols(autoClearIndices);

        setCatCol(-1);
        setNameCol(-1);
        setVisualResults([]);
        setGlobalStats(null);
        setSelectedVisualGroup(null);
        setMarkedCells(new Set());
        setCellEdits(new Map());
      }
    }
  }, [fileData, selectedSheet]);

  const toggleOptionCol = (idx: number) => {
    if (groupCol === idx) return;
    setOptionCols(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const toggleClearCol = (idx: number) => {
    setClearCols(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const cartesian = (args: any[][]): any[][] => {
    const limit = 50000;
    let result: any[][] = [[]];
    
    for (const arg of args) {
        const nextResult: any[][] = [];
        for (const r of result) {
            for (const el of arg) {
                nextResult.push([...r, el]);
                if (nextResult.length > limit) throw new Error("Safety Limit Exceeded: Too many variant combinations.");
            }
        }
        result = nextResult;
    }
    return result;
  };

  const normalize = (val: any) => String(val || "").trim().toLowerCase();
  const cleanStr = (val: string) => String(val || "").replace(/-/g, '').trim();

  // --- Right Click Handler ---
  const handleCellContextMenu = (e: React.MouseEvent, uniqueId: string) => {
      e.preventDefault();
      // Only allow editing if it's missing (not existing)
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          key: uniqueId
      });
  };

  const openEditModal = () => {
      if (!contextMenu) return;
      const existingEdit = cellEdits.get(contextMenu.key);
      setEditModal({
          isOpen: true,
          key: contextMenu.key,
          price: existingEdit?.price || "",
          qty: existingEdit?.qty || ""
      });
      setContextMenu(null);
  };

  const saveEdit = () => {
      if (!editModal) return;
      setCellEdits(prev => {
          const newMap = new Map(prev);
          if (editModal.price || editModal.qty) {
              newMap.set(editModal.key, { price: editModal.price, qty: editModal.qty });
              // Auto-mark cell if edited
              setMarkedCells(prevMarked => new Set(prevMarked).add(editModal.key));
          } else {
              newMap.delete(editModal.key);
          }
          return newMap;
      });
      setEditModal(null);
  };

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    if (groupCol === -1) {
        addLog("Please select a grouping column (Product ID/SKU).", 'warning');
        return;
    }
    if (optionCols.length === 0) {
        addLog("Please select at least one option column (e.g. Size).", 'warning');
        return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    // Don't clear visual results immediately if we are re-processing with edits
    if (visualResults.length === 0) {
        setVisualResults([]);
        setGlobalStats(null);
        setSelectedVisualGroup(null);
        setMarkedCells(new Set());
    }
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));

      const displayData = getSheetData(fileData.workbook, selectedSheet, false); 
      const header = displayData[0];
      const rows = displayData.slice(1);
      
      const priceColIdx = headers.findIndex(h => /price|cost|سعر|مبلغ/i.test(String(h)));
      const qtyColIdx = headers.findIndex(h => /qty|quantity|stock|كمية|مخزون/i.test(String(h)));

      const sortedOptionCols = [...optionCols].sort((a, b) => a - b);

      // --- CHECK CATEGORY CONSISTENCY ---
      const categoryErrors = new Set<string>(); 
      if (catCol !== -1 && nameCol !== -1) {
          const nameToCats = new Map<string, Set<string>>();
          rows.forEach(row => {
              const name = cleanStr(String(row[nameCol] || ""));
              const cat = String(row[catCol] || "").trim();
              if (name && cat) {
                  if (!nameToCats.has(name)) nameToCats.set(name, new Set());
                  nameToCats.get(name)!.add(cat);
              }
          });
          nameToCats.forEach((cats, name) => {
              if (cats.size > 1) categoryErrors.add(name);
          });
      }

      // --- GROUPING ---
      const groups = new Map<string, { rows: any[][], indices: number[] }>();
      rows.forEach((row, idx) => {
          const key = String(row[groupCol] || "").trim();
          if (key) {
              if (!groups.has(key)) groups.set(key, { rows: [], indices: [] });
              const g = groups.get(key)!;
              g.rows.push(row);
              g.indices.push(idx); 
          }
      });

      const balancedRows: any[][] = [header]; 
      const fixedActionRows: any[][] = [[...header, t.balance.action]]; 
      const summaryRows: any[][] = [t.balance.summaryHeaders]; 
      const finalReadyRows: any[][] = [header]; 

      const visualDataBuffer: VisualGroup[] = [];
      const missingStats = new Map<string, number>();

      let processedCount = 0;
      const totalGroups = groups.size;

      // ----------------------------------------------------
      // PASS 1
      // ----------------------------------------------------
      groups.forEach((group, key) => {
          // Sanitize
          group.rows.forEach(r => {
              if (nameCol !== -1) r[nameCol] = cleanStr(String(r[nameCol] || ""));
              sortedOptionCols.forEach(c => r[c] = cleanStr(String(r[c] || "")));
          });

          // Static Check
          let hasStaticError = false;
          let staticColName = "";
          const optionsMap = sortedOptionCols.map((colIdx, index) => {
              const uniqueValuesMap = new Map<string, string>(); 
              group.rows.forEach(r => {
                  const val = String(r[colIdx] || "").trim();
                  if (val) uniqueValuesMap.set(val.toLowerCase(), val);
              });
              const vals = Array.from(uniqueValuesMap.values()).sort();
              
              if (group.rows.length > 1 && vals.length === 1) {
                  if (index === sortedOptionCols.length - 1) {
                      hasStaticError = true;
                      staticColName = headers[colIdx];
                  }
              }
              return vals;
          });

          if (hasStaticError) {
              group.rows.forEach(r => {
                  fixedActionRows.push([...r, `Error: Static Option '${staticColName}' - Should Vary`]);
                  balancedRows.push(r);
              });
              const opt1Values = optionsMap[0] || [];
              const opt2Values = optionsMap[1] || []; 
              const allValuesStr = (sortedOptionCols.length >= 2 ? opt2Values : opt1Values).join(", ");
              summaryRows.push([key, opt1Values.length, sortedOptionCols.length > 1 ? opt2Values.length : "-", `Error: Static ${staticColName}`, "ERROR", allValuesStr]);
              
              visualDataBuffer.push({
                  key, status: 'Unbalanced', dimensions: [], hits: new Set(), missingCount: 0, missingValues: []
              });
              processedCount++;
              return;
          }

          let hasCatError = false;
          if (nameCol !== -1) {
              hasCatError = group.rows.some(r => categoryErrors.has(cleanStr(String(r[nameCol] || ""))));
          }

          if (optionsMap.some(opts => opts.length === 0)) {
              balancedRows.push(...group.rows);
              group.rows.forEach(r => fixedActionRows.push([...r, "Skipped (No Options)"]));
              summaryRows.push([key, 0, "-", "No Options Detected", "SKIPPED", ""]);
              processedCount++;
              return;
          }

          let combinations: any[][] = [];
          try {
             combinations = optionsMap.length === 1 
               ? optionsMap[0].map(v => [v])
               : cartesian(optionsMap);
          } catch(e: any) {
             addLog(`Skipped group ${key}: ${e.message}`, 'error');
             balancedRows.push(...group.rows);
             group.rows.forEach(r => fixedActionRows.push([...r, "Error: Too Many Combos"]));
             summaryRows.push([key, 0, "-", "Error: Too Many Combos", "ERROR", ""]);
             return;
          }

          const missingCombos: any[][] = [];
          const missingValuesForStats: string[] = [];
          const hits = new Set<string>();

          group.rows.forEach(row => {
              const k = sortedOptionCols.map(c => normalize(row[c])).join("|||");
              hits.add(k);
          });

          combinations.forEach(combo => {
              const comboKey = combo.map(v => normalize(v)).join("|||");
              if (!hits.has(comboKey)) {
                  missingCombos.push(combo);
                  combo.forEach(val => missingValuesForStats.push(String(val)));
              }
          });

          // Aggregate Global Stats
          missingValuesForStats.forEach(v => {
              const current = missingStats.get(v) || 0;
              missingStats.set(v, current + 1);
          });

          visualDataBuffer.push({
              key,
              status: missingCombos.length > 0 ? 'Unbalanced' : 'Balanced',
              dimensions: sortedOptionCols.map((c, i) => ({ 
                  name: headers[c] || `Option ${i+1}`, 
                  values: optionsMap[i] 
              })),
              hits,
              missingCount: missingCombos.length,
              missingValues: [...new Set(missingValuesForStats)]
          });

          balancedRows.push(...group.rows);
          group.rows.forEach(r => {
                let action = missingCombos.length > 0 ? t.balance.existing : t.balance.balanced;
                if (hasCatError) action += ` + ${t.balance.catError}`;
                fixedActionRows.push([...r, action]);
          });

          if (missingCombos.length > 0) {
              const templateRow = [...group.rows[0]];
              
              missingCombos.forEach((combo, idx) => {
                  const newRow = [...templateRow];
                  
                  // 1. Set Options
                  sortedOptionCols.forEach((colIdx, i) => newRow[colIdx] = combo[i]);
                  
                  // 2. Clear auto-clear cols
                  clearCols.forEach(colIdx => newRow[colIdx] = ""); 
                  
                  // 3. Keep Original SKU (No Suffix)
                  if (groupCol !== -1) {
                      const originalSku = String(templateRow[groupCol] || "").trim();
                      newRow[groupCol] = originalSku; 
                  }

                  // 4. CHECK FOR MANUAL EDITS (Interactive Matrix)
                  // Construct key same as matrix uniqueId: key_val1|||val2
                  const comboKey = combo.map(v => normalize(v)).join("|||");
                  const uniqueId = `${key}_${comboKey}`;
                  
                  if (cellEdits.has(uniqueId)) {
                      const edit = cellEdits.get(uniqueId)!;
                      if (priceColIdx !== -1 && edit.price) newRow[priceColIdx] = edit.price;
                      if (qtyColIdx !== -1 && edit.qty) newRow[qtyColIdx] = edit.qty;
                  }

                  balancedRows.push(newRow);
                  fixedActionRows.push([...newRow, t.balance.added]);
              });
          }

          const opt1Values = optionsMap[0] || [];
          const opt2Values = optionsMap[1] || []; 
          let statusText = missingCombos.length > 0 ? t.balance.unbalanced : t.balance.balanced;
          let detailsStr = `${opt1Values.length} Variants`;
          if (sortedOptionCols.length >= 2) detailsStr += ` x ${Math.max(...optionsMap.slice(1).map(o=>o.length))} options`;
          
          const allValuesStr = (sortedOptionCols.length >= 2 ? opt2Values : opt1Values).join(", ");
          summaryRows.push([key, opt1Values.length, sortedOptionCols.length > 1 ? opt2Values.length : "-", detailsStr, statusText, allValuesStr]);

          processedCount++;
          if (processedCount % 50 === 0) setProgress(Math.round((processedCount / totalGroups) * 80));
      });

      // Stats Calculation
      const unbalancedCount = visualDataBuffer.filter(g => g.status === 'Unbalanced').length;
      const topMissing = Array.from(missingStats.entries())
          .sort((a,b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

      setGlobalStats({
          totalProducts: visualDataBuffer.length,
          balancedCount: visualDataBuffer.length - unbalancedCount,
          unbalancedCount,
          missingFrequency: topMissing
      });

      // ----------------------------------------------------
      // PASS 2: Generate "Final Ready File"
      // ----------------------------------------------------
      groups.forEach((group, key) => {
          const isStaticError = fixedActionRows.some(r => r[groupCol] === key && String(r[r.length-1]).includes("Static Option"));
          if (isStaticError) {
              finalReadyRows.push(...group.rows);
              return;
          }

          const catBuckets = new Map<string, any[][]>();
          if (catCol !== -1) {
              group.rows.forEach(r => {
                  const cVal = String(r[catCol] || "Uncategorized").trim();
                  if (!catBuckets.has(cVal)) catBuckets.set(cVal, []);
                  catBuckets.get(cVal)!.push(r);
              });
          } else {
              catBuckets.set("Default", group.rows);
          }

          let catIndex = 0;
          catBuckets.forEach((rowsInCat) => {
              const currentSku = catIndex === 0 ? key : `${key}${catIndex}`; 
              const partitionRows = rowsInCat.map(r => {
                  const newR = [...r];
                  if (groupCol !== -1) newR[groupCol] = currentSku;
                  return newR;
              });

              const uniqueRowsMap = new Map<string, any[]>();
              partitionRows.forEach(row => {
                  const optsKey = sortedOptionCols.map(c => normalize(row[c])).join("|||");
                  const nameVal = nameCol !== -1 ? normalize(row[nameCol]) : "";
                  const priceVal = priceColIdx !== -1 ? String(row[priceColIdx]).trim() : "";
                  const qtyVal = qtyColIdx !== -1 ? String(row[qtyColIdx]).trim() : "";
                  const dedupKey = `${optsKey}_NAME:${nameVal}_PRICE:${priceVal}_QTY:${qtyVal}`;
                  if (!uniqueRowsMap.has(dedupKey)) uniqueRowsMap.set(dedupKey, row);
              });

              const dedupedRows = Array.from(uniqueRowsMap.values());
              const partitionOptionsMap = sortedOptionCols.map(colIdx => {
                  const vals = new Set<string>();
                  dedupedRows.forEach(r => {
                      const val = String(r[colIdx] || "").trim();
                      if (val) vals.add(val);
                  });
                  return Array.from(vals).sort();
              });

              if (partitionOptionsMap.every(o => o.length > 0)) {
                  let partitionCombos: any[][] = [];
                  try { partitionCombos = cartesian(partitionOptionsMap); } catch (e) { partitionCombos = []; }

                  const partitionHits = new Set<string>();
                  dedupedRows.forEach(r => {
                      const k = sortedOptionCols.map(c => normalize(r[c])).join("|||");
                      partitionHits.add(k);
                  });

                  finalReadyRows.push(...dedupedRows);

                  if (dedupedRows.length > 0) {
                      const templateR = [...dedupedRows[0]];
                      
                      partitionCombos.forEach(combo => {
                          const k = combo.map(v => normalize(v)).join("|||");
                          if (!partitionHits.has(k)) {
                              const newR = [...templateR];
                              sortedOptionCols.forEach((c, i) => newR[c] = combo[i]);
                              clearCols.forEach(c => newR[c] = ""); 
                              
                              if (groupCol !== -1) {
                                  newR[groupCol] = currentSku; 
                              }

                              // Apply Edits here too if key matches
                              // Note: Logic here is a bit tricky if category splits SKU. 
                              // For now we assume edits apply to main SKU logic.
                              const uniqueId = `${key}_${k}`;
                              if (cellEdits.has(uniqueId)) {
                                  const edit = cellEdits.get(uniqueId)!;
                                  if (priceColIdx !== -1 && edit.price) newR[priceColIdx] = edit.price;
                                  if (qtyColIdx !== -1 && edit.qty) newR[qtyColIdx] = edit.qty;
                              }

                              finalReadyRows.push(newR);
                          }
                      });
                  }
              } else {
                  finalReadyRows.push(...dedupedRows);
              }
              catIndex++;
          });
      });

      // Update visual results only if not merely refreshing edits
      if (visualResults.length === 0) {
          visualDataBuffer.sort((a, b) => {
              if (a.status === 'Unbalanced' && b.status === 'Balanced') return -1;
              if (a.status === 'Balanced' && b.status === 'Unbalanced') return 1;
              return a.key.localeCompare(b.key);
          });
          setVisualResults(visualDataBuffer);
          if (visualDataBuffer.length > 0) {
              const firstUnbalanced = visualDataBuffer.find(g => g.status === 'Unbalanced');
              setSelectedVisualGroup(firstUnbalanced || visualDataBuffer[0]);
          }
      }

      const newWb = XLSX.utils.book_new();
      const wsBalanced = XLSX.utils.aoa_to_sheet(balancedRows);
      XLSX.utils.book_append_sheet(newWb, wsBalanced, t.balance.balancedSheet); 

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      const rangeSum = XLSX.utils.decode_range(wsSummary['!ref'] || "A1");
      const statusIdx = 4;
      for (let R = 1; R <= rangeSum.e.r; ++R) {
          const cellRef = XLSX.utils.encode_cell({r: R, c: statusIdx});
          const cell = wsSummary[cellRef];
          if (cell) {
              const val = String(cell.v).toUpperCase();
              let color = null;
              if (val.includes('UNBALANCED') || val.includes('ERROR')) color = { rgb: "FFCCCC" }; 
              else if (val.includes('BALANCED')) color = { rgb: "CCFFCC" }; 
              else if (val.includes('SKIPPED')) color = { rgb: "EEEEEE" };
              if (color && !wsSummary[cellRef].s) {
                  wsSummary[cellRef].s = { fill: { fgColor: color } };
              }
          }
      }
      XLSX.utils.book_append_sheet(newWb, wsSummary, t.balance.summarySheet);

      const wsReport = XLSX.utils.aoa_to_sheet(fixedActionRows);
      XLSX.utils.book_append_sheet(newWb, wsReport, "Detailed Action Report");

      const wsFinal = XLSX.utils.aoa_to_sheet(finalReadyRows);
      XLSX.utils.book_append_sheet(newWb, wsFinal, "Final Ready File");

      const baseName = fileData.name.replace(/\.[^/.]+$/, "");
      saveWorkbook(newWb, `Balanced_${baseName}.xlsx`);
      
      addLog(t.common.completed, 'success');
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  const filteredVisualResults = visualResults.filter(g => {
      const matchFilter = visualFilter === 'All' || g.status === visualFilter;
      const matchSearch = g.key.toLowerCase().includes(visualSearch.toLowerCase());
      return matchFilter && matchSearch;
  });

  const toggleCellMark = (key: string) => {
      setMarkedCells(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
      });
  };

  return (
    <div className="space-y-6 relative">
       
       {/* Configuration Card */}
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
         {/* ... (Existing configuration UI preserved) ... */}
         <h3 className="font-bold text-slate-700 mb-4 flex items-center">
            <Network className="mr-2" size={20}/>
            {t.tabs.balance}
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

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1 border rounded-lg p-3 bg-slate-50">
                <h4 className="font-bold text-xs text-slate-700 uppercase mb-2 flex items-center">
                    <Layers size={14} className="mr-1"/> {t.balance.groupCol}
                </h4>
                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {headers.map((h, i) => (
                        <label key={i} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${groupCol === i ? 'bg-blue-100 text-blue-800 font-bold' : 'hover:bg-slate-200 text-slate-600'}`}>
                            <input 
                                type="radio" 
                                name="groupCol"
                                checked={groupCol === i}
                                onChange={() => { setGroupCol(i); if(optionCols.includes(i)) toggleOptionCol(i); }}
                                className="text-blue-600"
                            />
                            <span className="truncate">{h || `Col ${i+1}`}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-1 border rounded-lg p-3 bg-slate-50">
                <h4 className="font-bold text-xs text-slate-700 uppercase mb-2 flex items-center">
                    <CheckSquare size={14} className="mr-1"/> {t.balance.optionCols}
                </h4>
                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {headers.map((h, i) => (
                        <label key={i} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${optionCols.includes(i) ? 'bg-green-100 text-green-800 font-bold' : 'hover:bg-slate-200 text-slate-600'} ${groupCol === i ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input 
                                type="checkbox" 
                                checked={optionCols.includes(i)}
                                onChange={() => toggleOptionCol(i)}
                                disabled={groupCol === i}
                                className="text-green-600 rounded"
                            />
                            <span className="truncate">{h || `Col ${i+1}`}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-1 border rounded-lg p-3 bg-slate-50">
                <h4 className="font-bold text-xs text-slate-700 uppercase mb-2 flex items-center">
                    <Eraser size={14} className="mr-1"/> {t.balance.clearCols}
                </h4>
                <div className="text-[10px] text-slate-500 mb-2">Auto-selected IDs/SKUs to prevent duplication.</div>
                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {headers.map((h, i) => (
                        <label key={i} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs ${clearCols.includes(i) ? 'bg-red-100 text-red-800 font-bold' : 'hover:bg-slate-200 text-slate-600'} ${groupCol === i ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input 
                                type="checkbox" 
                                checked={clearCols.includes(i)}
                                onChange={() => toggleClearCol(i)}
                                disabled={groupCol === i}
                                className="text-red-600 rounded"
                            />
                            <span className="truncate">{h || `Col ${i+1}`}</span>
                        </label>
                    ))}
                </div>
            </div>
         </div>

         <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
             <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center">
                 Validation Checks (Optional)
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                        <Type size={12}/> {t.balance.nameCol}
                    </label>
                    <select 
                        className="w-full p-2 border rounded text-xs bg-white"
                        value={nameCol}
                        onChange={(e) => setNameCol(Number(e.target.value))}
                    >
                        <option value="-1">-- None --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                        <Tag size={12}/> {t.balance.catCol}
                    </label>
                    <select 
                        className="w-full p-2 border rounded text-xs bg-white"
                        value={catCol}
                        onChange={(e) => setCatCol(Number(e.target.value))}
                    >
                        <option value="-1">-- None --</option>
                        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                 </div>
             </div>
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
                        <Network size={20} />
                        <span>{cellEdits.size > 0 ? "Regenerate with Edits" : t.common.start}</span>
                    </>
                )}
            </button>
          </div>
       </div>

       {/* GLOBAL ANALYTICS DASHBOARD */}
       {globalStats && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4">
               <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                   <div className="bg-blue-100 p-3 rounded-full text-blue-600"><BarChart3 size={24}/></div>
                   <div>
                       <p className="text-xs font-bold text-slate-500 uppercase">Product Health</p>
                       <p className="text-2xl font-bold text-slate-800">
                           {Math.round((globalStats.balancedCount / globalStats.totalProducts) * 100)}%
                       </p>
                       <p className="text-xs text-slate-400">Balanced</p>
                   </div>
               </div>
               
               <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                   <div className="bg-red-100 p-3 rounded-full text-red-600"><AlertCircle size={24}/></div>
                   <div>
                       <p className="text-xs font-bold text-slate-500 uppercase">Action Needed</p>
                       <p className="text-2xl font-bold text-red-600">
                           {globalStats.unbalancedCount}
                       </p>
                       <p className="text-xs text-slate-400">Unbalanced Groups</p>
                   </div>
               </div>

               <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                   <div className="bg-amber-100 p-3 rounded-full text-amber-600"><TrendingUp size={24}/></div>
                   <div className="flex-1">
                       <p className="text-xs font-bold text-slate-500 uppercase mb-1">Top Missing Variants</p>
                       <div className="space-y-1">
                           {globalStats.missingFrequency.slice(0, 2).map((item, idx) => (
                               <div key={idx} className="flex justify-between text-xs">
                                   <span className="font-medium text-slate-700">{item.name}</span>
                                   <span className="bg-slate-100 px-1.5 rounded text-slate-500">{item.count}</span>
                               </div>
                           ))}
                           {globalStats.missingFrequency.length === 0 && <span className="text-xs text-green-600">All Good!</span>}
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* VISUAL MATRIX GRID */}
       {visualResults.length > 0 && (
           <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
               <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                   <h3 className="font-bold flex items-center gap-2"><LayoutGrid size={18}/> Visual Matrix Grid</h3>
                   <div className="flex items-center gap-2 text-xs">
                       <span className="bg-green-500/20 px-2 py-1 rounded text-green-300 border border-green-500/30">Balanced: {visualResults.filter(r => r.status==='Balanced').length}</span>
                       <span className="bg-red-500/20 px-2 py-1 rounded text-red-300 border border-red-500/30">Unbalanced: {visualResults.filter(r => r.status==='Unbalanced').length}</span>
                   </div>
               </div>
               
               <div className="flex h-[500px]">
                   {/* Left Sidebar List */}
                   <div className="w-1/4 min-w-[200px] border-r border-slate-200 flex flex-col bg-slate-50">
                       <div className="p-2 border-b border-slate-200 space-y-2">
                           <div className="relative">
                               <Search size={14} className="absolute left-2 top-2.5 text-slate-400"/>
                               <input 
                                   type="text" 
                                   placeholder="Search SKU..." 
                                   className="w-full pl-8 pr-2 py-1.5 text-xs border rounded bg-white"
                                   value={visualSearch}
                                   onChange={e => setVisualSearch(e.target.value)}
                               />
                           </div>
                           <div className="flex gap-1 text-[10px]">
                               <button onClick={() => setVisualFilter('Unbalanced')} className={`flex-1 py-1 rounded border ${visualFilter==='Unbalanced' ? 'bg-red-50 border-red-200 text-red-700 font-bold' : 'bg-white text-slate-600'}`}>Unbalanced</button>
                               <button onClick={() => setVisualFilter('All')} className={`flex-1 py-1 rounded border ${visualFilter==='All' ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white text-slate-600'}`}>All</button>
                           </div>
                       </div>
                       
                       <div className="flex-1 overflow-y-auto">
                           {filteredVisualResults.map(group => (
                               <button 
                                   key={group.key}
                                   onClick={() => setSelectedVisualGroup(group)}
                                   className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-100 transition-colors flex justify-between items-center
                                      ${selectedVisualGroup?.key === group.key ? 'bg-white border-l-4 border-l-blue-500 shadow-sm' : 'bg-transparent border-l-4 border-l-transparent'}`}
                               >
                                   <span className="font-mono text-xs font-bold text-slate-700 truncate pr-2">{group.key}</span>
                                   {group.status === 'Unbalanced' && <AlertCircle size={14} className="text-red-500 shrink-0"/>}
                                   {group.status === 'Balanced' && <CheckCircle2 size={14} className="text-green-500 shrink-0"/>}
                               </button>
                           ))}
                           {filteredVisualResults.length === 0 && <p className="p-4 text-xs text-slate-400 text-center">No matches.</p>}
                       </div>
                   </div>

                   {/* Right Matrix View */}
                   <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
                       {selectedVisualGroup ? (
                           <div className="flex-1 flex flex-col">
                               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                   <div>
                                       <h4 className="font-bold text-lg text-slate-800">{selectedVisualGroup.key}</h4>
                                       <p className="text-xs text-slate-500">
                                           {selectedVisualGroup.dimensions.length} Dimension(s) • {selectedVisualGroup.status === 'Unbalanced' ? `${selectedVisualGroup.missingCount} Missing` : 'Fully Balanced'}
                                       </p>
                                   </div>
                               </div>
                               
                               <div className="flex-1 overflow-auto p-6 flex items-start justify-center bg-slate-50/30">
                                   {/* RENDER MATRIX */}
                                   {selectedVisualGroup.dimensions.length === 0 ? (
                                       // Error State (e.g. Static Option)
                                       <div className="flex flex-col items-center justify-center p-10 bg-red-50 border border-red-200 rounded-lg text-red-800">
                                           <Ban size={48} className="mb-4 text-red-400"/>
                                           <h3 className="font-bold text-lg">Static Option Error Detected</h3>
                                           <p className="text-sm mt-2 text-center">
                                               One or more option columns have only a single value for this product.<br/>
                                               Variants cannot be generated because options must vary.
                                           </p>
                                       </div>
                                   ) : selectedVisualGroup.dimensions.length === 1 ? (
                                       // 1D View
                                       <div className="grid grid-cols-4 gap-4 w-full max-w-2xl">
                                           {selectedVisualGroup.dimensions[0].values.map(val => {
                                               const normVal = val.toLowerCase().trim();
                                               const exists = selectedVisualGroup.hits.has(normVal);
                                               const fullKey = normVal;
                                               const uniqueId = `${selectedVisualGroup.key}_${fullKey}`;
                                               const isMarked = markedCells.has(uniqueId);
                                               const hasEdit = cellEdits.has(uniqueId);
                                               
                                               return (
                                                   <div 
                                                      key={val} 
                                                      onClick={() => !exists && toggleCellMark(uniqueId)}
                                                      onContextMenu={(e) => !exists && handleCellContextMenu(e, uniqueId)}
                                                      className={`p-4 rounded-lg border text-center transition-all cursor-pointer relative overflow-hidden group
                                                        ${exists 
                                                            ? 'bg-green-50 border-green-200 text-green-800 cursor-default' 
                                                            : isMarked 
                                                                ? 'bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-200' 
                                                                : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'}`}
                                                   >
                                                       <span className="font-bold block text-lg mb-1">{val}</span>
                                                       <span className="text-[10px] uppercase font-bold tracking-wider">{exists ? 'Exists' : (isMarked ? 'Create' : 'Missing')}</span>
                                                       {hasEdit && <div className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></div>}
                                                   </div>
                                               );
                                           })}
                                       </div>
                                   ) : (
                                       // 2D Matrix (Pivot)
                                       <div className="border rounded-lg shadow-sm overflow-hidden bg-white">
                                           <table className="text-sm border-collapse">
                                               <thead>
                                                   <tr>
                                                       <th className="p-3 bg-slate-100 border text-slate-500 font-mono text-xs text-left">
                                                           {selectedVisualGroup.dimensions[0].name} ↓ <br/> 
                                                           {selectedVisualGroup.dimensions.slice(1).map(d => d.name).join(' / ')} →
                                                       </th>
                                                       {/* Flatten Columns if dim > 2 */}
                                                       {cartesian(selectedVisualGroup.dimensions.slice(1).map(d => d.values)).map((combo, i) => (
                                                           <th key={i} className="p-3 bg-slate-50 border font-bold text-slate-700 min-w-[80px] text-center">
                                                               {combo.join(' / ')}
                                                           </th>
                                                       ))}
                                                   </tr>
                                               </thead>
                                               <tbody>
                                                   {selectedVisualGroup.dimensions[0].values.map(rowVal => (
                                                       <tr key={rowVal}>
                                                           <th className="p-3 bg-slate-50 border font-bold text-slate-700 text-left min-w-[100px] sticky left-0">{rowVal}</th>
                                                           {cartesian(selectedVisualGroup.dimensions.slice(1).map(d => d.values)).map((colCombo, j) => {
                                                               // Normalized check
                                                               const fullKey = [rowVal, ...colCombo].map(v => String(v).trim().toLowerCase()).join('|||');
                                                               const exists = selectedVisualGroup.hits.has(fullKey);
                                                               const uniqueId = `${selectedVisualGroup.key}_${fullKey}`;
                                                               const isMarked = markedCells.has(uniqueId);
                                                               const hasEdit = cellEdits.has(uniqueId);

                                                               return (
                                                                   <td 
                                                                      key={j} 
                                                                      onClick={() => !exists && toggleCellMark(uniqueId)}
                                                                      onContextMenu={(e) => !exists && handleCellContextMenu(e, uniqueId)}
                                                                      className={`p-3 border text-center transition-colors relative
                                                                        ${exists 
                                                                            ? 'bg-green-50 text-green-600 cursor-default' 
                                                                            : isMarked 
                                                                                ? 'bg-blue-100 text-blue-600 cursor-pointer ring-inset ring-2 ring-blue-300'
                                                                                : 'bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer'}`}
                                                                   >
                                                                       {exists ? <CheckSquare size={20} className="mx-auto"/> : <X size={20} className="mx-auto opacity-50"/>}
                                                                       {hasEdit && <div className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full"></div>}
                                                                       {hasEdit && !exists && (
                                                                           <div className="absolute bottom-0 left-0 w-full text-[8px] bg-purple-100 text-purple-800 font-bold truncate">
                                                                               Edited
                                                                           </div>
                                                                       )}
                                                                   </td>
                                                               );
                                                           })}
                                                       </tr>
                                                   ))}
                                               </tbody>
                                           </table>
                                       </div>
                                   )}
                               </div>
                           </div>
                       ) : (
                           <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                               <Grid3X3 size={48} className="mb-4 opacity-20"/>
                               <p>Select a product to visualize</p>
                           </div>
                       )}
                   </div>
               </div>
           </div>
       )}

       {/* CONTEXT MENU */}
       {contextMenu && (
           <div 
             ref={contextMenuRef}
             style={{ top: contextMenu.y, left: contextMenu.x }}
             className="fixed bg-white border border-slate-200 shadow-xl rounded-md z-50 py-1 w-40 animate-in fade-in zoom-in-95 duration-100"
           >
               <button 
                 onClick={openEditModal}
                 className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
               >
                   <Edit size={14}/> Edit Variant Details
               </button>
           </div>
       )}

       {/* EDIT MODAL */}
       {editModal && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in zoom-in-95">
                   <h3 className="font-bold text-lg mb-4 text-slate-800">Edit Missing Variant</h3>
                   <div className="space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price Override</label>
                           <input 
                             type="text" 
                             className="w-full p-2 border rounded"
                             placeholder="e.g. 150"
                             value={editModal.price}
                             onChange={e => setEditModal({...editModal, price: e.target.value})}
                           />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity Override</label>
                           <input 
                             type="text" 
                             className="w-full p-2 border rounded"
                             placeholder="e.g. 10"
                             value={editModal.qty}
                             onChange={e => setEditModal({...editModal, qty: e.target.value})}
                           />
                       </div>
                   </div>
                   <div className="flex justify-end gap-2 mt-6">
                       <button onClick={() => setEditModal(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                       <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex items-center gap-2">
                           <Save size={16}/> Save
                       </button>
                   </div>
               </div>
           </div>
       )}

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default VariableBalanceTab;
