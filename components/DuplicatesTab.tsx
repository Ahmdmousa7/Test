
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  Search, RotateCcw, FileDigit, Wand2, AlignJustify, ArrowRightLeft, 
  Layers, Activity, PieChart, BarChart2, AlertCircle, Fingerprint, 
  GitMerge, CheckCircle, Sliders
} from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

// --- FUZZY MATCHING HELPERS ---
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const calculateSimilarity = (a: string, b: string): number => {
  if (a === b) return 100;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0 || bLen === 0) return 0;
  const maxLen = Math.max(aLen, bLen);
  if (maxLen === 0) return 100;
  
  const dist = getLevenshteinDistance(a, b);
  return (1 - dist / maxLen) * 100;
};

const DuplicatesTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [selectedCols, setSelectedCols] = useState<number[]>([]);
  
  // Modes: composite (rows), individual (cols), cross (compare A vs B)
  const [mode, setMode] = useState<'individual' | 'composite' | 'cross'>('composite');
  
  const [useRawValues, setUseRawValues] = useState<boolean>(false);
  const [autoResolve, setAutoResolve] = useState<boolean>(false);
  const [checkFullRow, setCheckFullRow] = useState<boolean>(false);
  
  // Fuzzy Matching State
  const [enableFuzzy, setEnableFuzzy] = useState<boolean>(false);
  const [fuzzyThreshold, setFuzzyThreshold] = useState<number>(90); // 90% similarity default

  // Cross Sheet Comparison State
  const [compareAcrossSheets, setCompareAcrossSheets] = useState<boolean>(false);
  const [referenceSheet, setReferenceSheet] = useState<string>('');
  const [referenceHeaders, setReferenceHeaders] = useState<string[]>([]);
  const [sourceColIdx, setSourceColIdx] = useState<number>(-1);
  const [refColIdx, setRefColIdx] = useState<number>(-1);

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Stats for Dashboard
  const [columnStats, setColumnStats] = useState<any>(null);

  React.useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      if (!selectedSheet) setSelectedSheet(fileData.sheets[0]);
    }
  }, [fileData]);

  React.useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, false);
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
      }
    }
  }, [fileData, selectedSheet]);

  React.useEffect(() => {
    if (fileData && referenceSheet && compareAcrossSheets) {
        const data = getSheetData(fileData.workbook, referenceSheet, false);
        if (data.length > 0) {
            setReferenceHeaders(data[0] as string[]);
            setRefColIdx(-1);
        }
    }
  }, [fileData, referenceSheet, compareAcrossSheets]);

  // --- HEALTH DASHBOARD CALCULATOR ---
  React.useEffect(() => {
    if (!fileData || !selectedSheet || selectedCols.length === 0) {
        setColumnStats(null);
        return;
    }

    // Debounce for performance
    const timer = setTimeout(() => {
        const rawData = getSheetData(fileData.workbook, selectedSheet, false).slice(1); // skip header
        const totalRows = rawData.length;
        if (totalRows === 0) return;

        let emptyCount = 0;
        const valueCounts = new Map<string, number>();

        // For dashboard, we analyze the composite key of selected columns
        rawData.forEach(row => {
            const keyParts = selectedCols.map(c => String(row[c] || "").trim());
            const compositeKey = keyParts.join(" "); // Space joined for readability in stats
            
            if (compositeKey === "") {
                emptyCount++;
            } else {
                valueCounts.set(compositeKey, (valueCounts.get(compositeKey) || 0) + 1);
            }
        });

        const uniqueValues = valueCounts.size;
        const duplicateValuesCount = Array.from(valueCounts.values()).filter(c => c > 1).length;
        
        // Top 5 Duplicates
        const topDuplicates = Array.from(valueCounts.entries())
            .filter(([_, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([val, count]) => ({ val, count }));

        const uniquenessScore = Math.round((uniqueValues / (totalRows - emptyCount || 1)) * 100);

        setColumnStats({
            totalRows,
            emptyCount,
            uniqueValues,
            duplicateValuesCount,
            uniquenessScore,
            topDuplicates
        });

    }, 500);

    return () => clearTimeout(timer);
  }, [selectedSheet, selectedCols, fileData]);


  const toggleColumn = (idx: number) => {
    if (checkFullRow) return; 
    setSelectedCols(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSelectAll = () => {
    if (checkFullRow) return;
    if (selectedCols.length === headers.length) {
      setSelectedCols([]); 
    } else {
      setSelectedCols(headers.map((_, idx) => idx)); 
      if (mode === 'cross') setMode('composite');
    }
  };

  const normalizeValue = (val: any): string => {
    if (val === null || val === undefined) return "";
    let str = String(val).trim();
    if (str === "") return "";
    if (/^[+-]?\d*\.?\d+[eE][+-]?\d+$/.test(str)) {
        const num = Number(str);
        if (!isNaN(num)) return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
    }
    const num = Number(str);
    if (!isNaN(num)) {
         if (str.length > 15 && !str.includes('.')) return str.replace(/^0+/, '');
         return String(num);
    }
    return str.toLowerCase();
  };

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    
    // Cross mode validation
    if (mode === 'cross') {
        if (compareAcrossSheets && (!referenceSheet || sourceColIdx === -1 || refColIdx === -1)) {
            addLog("Please complete Cross-Compare configuration.", 'warning');
            return;
        }
        if (!compareAcrossSheets && selectedCols.length !== 2) {
            addLog("Select exactly 2 columns for Cross-Compare.", 'warning');
            return;
        }
    } else if (!checkFullRow && selectedCols.length === 0) {
      addLog("Select columns to check.", 'warning');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    setProgressLabel(t.common.processing);
    
    const effectiveMode = checkFullRow ? 'composite' : mode;
    const effectiveCols = checkFullRow ? headers.map((_, i) => i) : selectedCols;

    try {
      await new Promise(r => setTimeout(r, 50));

      const dataRaw = getSheetData(fileData.workbook, selectedSheet, true);
      const dataDisplay = getSheetData(fileData.workbook, selectedSheet, false);

      const rowsRaw = dataRaw.slice(1);
      const rowsOutput = useRawValues ? rowsRaw : dataDisplay.slice(1);
      const header = headers.length > 0 ? headers : dataDisplay[0]; 
      const totalRows = rowsRaw.length;
      
      // --- CROSS CHECK ---
      if (effectiveMode === 'cross') {
          // ... (Cross Check logic same as before, simplified for brevity in this update block) ...
          // Using Fuzzy Match logic inside Cross Check
          let col1Idx, col2Idx, referenceRows;
          if (compareAcrossSheets) {
              col1Idx = sourceColIdx; col2Idx = refColIdx;
              referenceRows = getSheetData(fileData.workbook, referenceSheet, true).slice(1);
          } else {
              col1Idx = selectedCols[0]; col2Idx = selectedCols[1];
              referenceRows = rowsRaw;
          }

          // Build Reference Set (Supports Fuzzy or Exact)
          // For Fuzzy, we store list of strings. For Exact, Set is faster.
          const refValues: string[] = [];
          const refSet = new Set<string>();
          
          referenceRows.forEach(row => {
             const val = normalizeValue(row[col2Idx]);
             if (val) {
                 if (enableFuzzy) refValues.push(val);
                 else refSet.add(val);
             }
          });

          const outputRows = [[...header, "Check Result", "Match Confidence", "Matched Value"]];
          let foundCount = 0;

          for (let i = 0; i < totalRows; i++) {
             const row = rowsRaw[i];
             const valToCheck = normalizeValue(row[col1Idx]);
             let status = "Missing";
             let confidence = 0;
             let matchVal = "";

             if (valToCheck) {
                 if (enableFuzzy) {
                     // Optimisation: First check exact match in case
                     if (refValues.includes(valToCheck)) {
                         status = "Found"; confidence = 100; matchVal = valToCheck;
                     } else {
                         // Fuzzy Scan
                         for (const refVal of refValues) {
                             // Length heuristic optimisation
                             if (Math.abs(refVal.length - valToCheck.length) > 3) continue;
                             
                             const sim = calculateSimilarity(valToCheck, refVal);
                             if (sim >= fuzzyThreshold) {
                                 if (sim > confidence) {
                                     confidence = sim;
                                     matchVal = refVal;
                                 }
                             }
                         }
                         if (confidence >= fuzzyThreshold) status = "Found (Fuzzy)";
                     }
                 } else {
                     if (refSet.has(valToCheck)) {
                         status = "Found"; confidence = 100; matchVal = valToCheck;
                     }
                 }
             }

             if (status.includes("Found")) foundCount++;
             outputRows.push([...rowsOutput[i], status, confidence > 0 ? `${confidence.toFixed(1)}%` : "", matchVal]);
             
             if (i % 500 === 0) setProgress(Math.round((i/totalRows)*100));
             await new Promise(r => setTimeout(r, 0));
          }

          const newWb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(outputRows);
          XLSX.utils.book_append_sheet(newWb, ws, "Result");
          saveWorkbook(newWb, `CrossCheck_${fileData.name}`);
          addLog(`${t.common.completed}. Found ${foundCount} matches.`, 'success');

      } 
      // --- DEDUPLICATION (HIGHLIGHT / RESOLVE) ---
      else {
          const duplicateRowIndices = new Set<number>();
          const resolvedRows = [];
          
          // FUZZY / EXACT LOGIC
          // We map a "Canonical Value" to a list of row indices
          const groups = new Map<string, number[]>(); // Key -> [Row Indices]
          
          // Helper to generate key for a row
          const getRowKey = (r: any[]) => effectiveCols.map(c => normalizeValue(r[c])).join("|||");

          if (!enableFuzzy) {
              // EXACT MATCH
              for (let i = 0; i < totalRows; i++) {
                  const key = getRowKey(rowsRaw[i]);
                  if (key.replace(/\|\|\|/g, '') === "") continue; // Skip empty rows
                  
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(i);
              }
          } else {
              // FUZZY MATCH
              // This is O(N^2) worst case. We optimize by sorting or buckets?
              // Simple greedy approach: 
              // 1. Maintain list of 'canonical' keys seen so far.
              // 2. For each row, check similarity against canonicals.
              // 3. If match found, assign to that group. Else create new group.
              
              const canonicals: { keyStr: string, originalKey: string }[] = []; // originalKey is just for reference
              
              for (let i = 0; i < totalRows; i++) {
                  const keyStr = getRowKey(rowsRaw[i]); // "apple|||red"
                  if (keyStr.replace(/\|\|\|/g, '') === "") continue;

                  let foundCanonical = null;
                  
                  // Optimization: only check last 500 groups to prevent total freeze on huge files
                  // or rely on user knowing fuzzy is slow. Let's limit scan window.
                  // Better: Just check all but handle UI updates.
                  
                  for (const can of canonicals) {
                      // Quick length check
                      if (Math.abs(can.keyStr.length - keyStr.length) > 5) continue;
                      
                      const sim = calculateSimilarity(keyStr, can.keyStr);
                      if (sim >= fuzzyThreshold) {
                          foundCanonical = can.keyStr;
                          break;
                      }
                  }

                  if (foundCanonical) {
                      groups.get(foundCanonical)!.push(i);
                  } else {
                      canonicals.push({ keyStr, originalKey: keyStr });
                      groups.set(keyStr, [i]);
                  }

                  if (i % 100 === 0) {
                      setProgress(Math.round((i/totalRows)*90));
                      await new Promise(r => setTimeout(r, 0));
                  }
              }
          }

          // Identify Duplicates
          groups.forEach((indices) => {
              if (indices.length > 1) {
                  // If Auto Resolve, we handle differently
                  if (!autoResolve) {
                      // Highlight Mode: Mark all duplicates (usually skipping the first occurrence, or marking all? Excel usually highlights all)
                      // Let's mark ALL instances of the duplicate group
                      indices.forEach(idx => duplicateRowIndices.add(idx));
                  } 
              }
          });

          // OUTPUT GENERATION
          const finalData = [header];
          
          if (autoResolve) {
              // RESOLVE LOGIC
              const changesLog = [["Row", "Column", "Old Value", "New Value"]];
              let resolveCount = 0;

              // We need to iterate groups and modify subsequent rows
              groups.forEach((indices, canonicalKey) => {
                  if (indices.length > 1) {
                      // Keep first one as is
                      // Modify others
                      for (let k = 1; k < indices.length; k++) {
                          const rowIdx = indices[k];
                          const row = [...rowsOutput[rowIdx]];
                          const targetCol = effectiveCols[0]; // Modify first selected column
                          
                          const oldVal = row[targetCol];
                          const newVal = `${oldVal}-${k}`;
                          row[targetCol] = newVal;
                          rowsOutput[rowIdx] = row; // Update in place for output
                          
                          changesLog.push([String(rowIdx+2), header[targetCol], oldVal, newVal]);
                          resolveCount++;
                      }
                  }
              });
              
              const newWb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet([header, ...rowsOutput]), "Resolved Data");
              XLSX.utils.book_append_sheet(newWb, XLSX.utils.aoa_to_sheet(changesLog), "Changes");
              saveWorkbook(newWb, `Resolved_${fileData.name}`);
              addLog(`Resolved ${resolveCount} duplicates.`, 'success');

          } else {
              // HIGHLIGHT LOGIC
              const newWb = XLSX.utils.book_new();
              const ws = XLSX.utils.aoa_to_sheet([header, ...rowsOutput]);
              
              if (duplicateRowIndices.size > 0) {
                  const range = XLSX.utils.decode_range(ws['!ref'] || "A1");
                  const fill = { fgColor: { rgb: "FFC7CE" } };
                  const font = { color: { rgb: "9C0006" } };
                  
                  // Apply to all duplicates
                  duplicateRowIndices.forEach(rIdx => {
                      const actualRow = rIdx + 1; // +1 for header
                      for (let C = range.s.c; C <= range.e.c; ++C) {
                          // Only highlight selected cols if individual mode, or all if full row?
                          // Usually highlight selected cols helps identify why
                          const isSelectedCol = effectiveCols.includes(C);
                          if (isSelectedCol || checkFullRow) {
                              const ref = XLSX.utils.encode_cell({r: actualRow, c: C});
                              if (!ws[ref]) ws[ref] = { t: 's', v: '' };
                              if (!ws[ref].s) ws[ref].s = {};
                              ws[ref].s.fill = fill;
                              ws[ref].s.font = font;
                          }
                      }
                  });
              }
              
              XLSX.utils.book_append_sheet(newWb, ws, "Checked Data");
              saveWorkbook(newWb, `Checked_${fileData.name}`);
              addLog(`Found ${duplicateRowIndices.size} duplicate rows.`, 'success');
          }
      }
      
      setProgress(100);

    } catch (error: any) {
      addLog(`${t.common.error}: ${error.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* LEFT: CONFIG (8 Cols) */}
        <div className="md:col-span-8 space-y-6">
            <div className="bg-white p-4 rounded-lg border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-4">{t.common.config}</h3>
            
            {/* Sheet Selector */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 mb-1">
                    {compareAcrossSheets ? t.duplicates.sourceSheet : t.common.selectSheet}
                </label>
                <select 
                className="w-full p-2 border rounded text-sm bg-slate-50"
                value={selectedSheet}
                onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    setSelectedCols([]);
                    setSourceColIdx(-1);
                }}
                >
                {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {/* Mode Selection */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-slate-600 mb-1">{t.duplicates.mode}</label>
                <div className={`space-y-2 transition-opacity ${checkFullRow ? 'opacity-50 pointer-events-none' : ''}`}>
                
                <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center space-x-2 cursor-pointer p-3 border rounded hover:bg-slate-50 transition-all ${mode==='composite' ? 'bg-blue-50 border-blue-200 shadow-sm' : ''}`}>
                        <input 
                        type="radio" 
                        checked={mode === 'composite'} 
                        onChange={() => setMode('composite')}
                        className="text-blue-600"
                        disabled={checkFullRow}
                        />
                        <div className="text-sm">
                        <span className="font-bold block flex items-center gap-2"><Layers size={14}/> {t.duplicates.composite}</span>
                        </div>
                    </label>

                    <label className={`flex items-center space-x-2 cursor-pointer p-3 border rounded hover:bg-slate-50 transition-all ${mode==='individual' ? 'bg-blue-50 border-blue-200 shadow-sm' : ''}`}>
                        <input 
                        type="radio" 
                        checked={mode === 'individual'} 
                        onChange={() => setMode('individual')}
                        className="text-blue-600"
                        disabled={checkFullRow}
                        />
                        <div className="text-sm">
                        <span className="font-bold block flex items-center gap-2"><FileDigit size={14}/> {t.duplicates.individual}</span>
                        </div>
                    </label>
                </div>

                {/* CROSS-COMPARE MODE */}
                <div className={`p-2 border rounded bg-indigo-50 border-indigo-200 transition-all duration-300 ${mode === 'cross' ? 'shadow-sm' : ''}`}>
                    <label className="flex items-start space-x-2 cursor-pointer">
                        <input 
                        type="radio" 
                        checked={mode === 'cross'} 
                        onChange={() => {
                            setMode('cross');
                            if(selectedCols.length > 2) setSelectedCols([]);
                        }}
                        className="mt-1 text-indigo-600"
                        disabled={checkFullRow}
                        />
                        <div className="text-sm">
                        <span className="font-semibold flex items-center gap-1 text-indigo-800">
                            <ArrowRightLeft size={14}/> {t.duplicates.compareAcross || "Compare 2 Columns"}
                        </span>
                        <span className="text-indigo-600 text-xs block mt-1">
                            Find missing items between two lists (A vs B).
                        </span>
                        </div>
                    </label>

                    {/* SUB-OPTION: CROSS SHEET TOGGLE */}
                    {mode === 'cross' && (
                        <div className="ml-6 mt-2 pt-2 border-t border-indigo-100 animate-in fade-in slide-in-from-top-1">
                            <label className="flex items-center space-x-2 cursor-pointer mb-3">
                                <input 
                                    type="checkbox" 
                                    checked={compareAcrossSheets} 
                                    onChange={e => setCompareAcrossSheets(e.target.checked)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-indigo-800 flex items-center gap-1">
                                    <Layers size={12}/> {t.duplicates.compareAcross || "Compare Across Sheets"}
                                </span>
                            </label>

                            {/* Reference Sheet Selector */}
                            {compareAcrossSheets && (
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-indigo-700 uppercase">{t.duplicates.targetSheet}</label>
                                    <select 
                                        className="w-full p-1.5 border border-indigo-200 rounded text-xs bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                        value={referenceSheet}
                                        onChange={(e) => {
                                            setReferenceSheet(e.target.value);
                                            setRefColIdx(-1);
                                        }}
                                    >
                                        <option value="">{t.common.selectSheet}...</option>
                                        {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                </div>
            </div>

            {/* Options */}
            <div className="mb-4 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                <label className={`flex items-start space-x-2 cursor-pointer p-2 border rounded transition-colors 
                ${checkFullRow ? 'bg-yellow-50 border-yellow-200 ring-1 ring-yellow-400' : 'hover:bg-slate-50 border-slate-300'}
                ${mode === 'cross' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                    type="checkbox" 
                    checked={checkFullRow} 
                    onChange={(e) => {
                        setCheckFullRow(e.target.checked);
                        if(e.target.checked) {
                            setAutoResolve(false);
                            if(mode === 'cross') setMode('composite');
                        }
                    }}
                    className="mt-1 text-yellow-600 rounded"
                    disabled={mode === 'cross'}
                    />
                    <div className="text-sm">
                    <span className="font-semibold flex items-center gap-1 text-yellow-800">
                        <AlignJustify size={14} /> 
                        {t.duplicates.fullRow}
                    </span>
                    </div>
                </label>

                <label className={`flex items-start space-x-2 cursor-pointer p-2 border rounded transition-colors 
                ${autoResolve ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-500' : 'hover:bg-slate-50 border-slate-300'} 
                ${checkFullRow || mode === 'cross' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <input 
                    type="checkbox" 
                    checked={autoResolve} 
                    onChange={(e) => setAutoResolve(e.target.checked)}
                    className="mt-1 text-purple-600 rounded"
                    disabled={checkFullRow || mode === 'cross'}
                    />
                    <div className="text-sm">
                    <span className="font-semibold flex items-center gap-1 text-purple-800">
                        <Wand2 size={14} /> 
                        {t.duplicates.autoResolve}
                    </span>
                    </div>
                </label>
            </div>

            {/* FUZZY MATCH CONFIG */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200 mb-4">
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                    <input 
                        type="checkbox" 
                        checked={enableFuzzy} 
                        onChange={(e) => setEnableFuzzy(e.target.checked)}
                        className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <GitMerge size={16} className="text-orange-500"/> Fuzzy Matching (Smart Typo Detect)
                    </span>
                </label>
                
                {enableFuzzy && (
                    <div className="ml-6 animate-in slide-in-from-top-1">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>Similarity Threshold: <strong className="text-orange-600">{fuzzyThreshold}%</strong></span>
                            <span>(Lower = Loose, Higher = Strict)</span>
                        </div>
                        <input 
                            type="range" 
                            min="50" max="100" step="5"
                            value={fuzzyThreshold} 
                            onChange={(e) => setFuzzyThreshold(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                    </div>
                )}
            </div>

            {/* Column Selector */}
            <div className={`bg-white rounded border border-slate-200 flex flex-col transition-opacity ${checkFullRow ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm">{t.common.selectCols}</h3>
                    {!compareAcrossSheets && (
                        <button
                        onClick={handleSelectAll}
                        disabled={headers.length === 0 || checkFullRow || mode === 'cross'}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors disabled:text-slate-400 disabled:hover:bg-transparent"
                        >
                        {t.common.selected}: {selectedCols.length}
                        </button>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-48 border-t border-slate-100 bg-white p-2">
                    {compareAcrossSheets ? (
                        // CROSS SHEET SPLIT VIEW
                        <div className="flex flex-1 min-h-[150px]">
                            {/* Left: Source Cols */}
                            <div className="w-1/2 border-r border-slate-200 flex flex-col pr-1">
                                <div className="text-[10px] font-bold text-blue-800 text-center bg-blue-50 rounded p-1 mb-1">
                                    {t.duplicates.selectSourceCol}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {headers.map((h, i) => (
                                        <label key={i} className={`flex items-center space-x-2 p-1 rounded cursor-pointer hover:bg-slate-100 ${sourceColIdx === i ? 'bg-blue-100 text-blue-800 font-bold' : ''}`}>
                                            <input type="radio" name="sourceCol" checked={sourceColIdx === i} onChange={() => setSourceColIdx(i)} className="text-blue-600"/>
                                            <span className="text-xs truncate" title={h}>{h || `Col ${i+1}`}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Target Cols */}
                            <div className="w-1/2 flex flex-col pl-1">
                                <div className="text-[10px] font-bold text-indigo-800 text-center bg-indigo-50 rounded p-1 mb-1">
                                    {t.duplicates.selectRefCol}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {referenceHeaders.length > 0 ? referenceHeaders.map((h, i) => (
                                        <label key={i} className={`flex items-center space-x-2 p-1 rounded cursor-pointer hover:bg-slate-100 ${refColIdx === i ? 'bg-indigo-100 text-indigo-800 font-bold' : ''}`}>
                                            <input type="radio" name="refCol" checked={refColIdx === i} onChange={() => setRefColIdx(i)} className="text-indigo-600"/>
                                            <span className="text-xs truncate" title={h}>{h || `Col ${i+1}`}</span>
                                        </label>
                                    )) : (
                                        <div className="p-4 text-center text-xs text-slate-400 italic">Select reference sheet first</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // STANDARD LIST VIEW
                        <div className="grid grid-cols-2 gap-1">
                            {headers.map((header, idx) => {
                                let badge = null;
                                if (mode === 'cross' && selectedCols.includes(idx)) {
                                    if (selectedCols[0] === idx) badge = <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1">Src</span>;
                                    if (selectedCols[1] === idx) badge = <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded ml-1">Ref</span>;
                                }

                                return (
                                <label key={idx} className="flex items-center space-x-2 p-1 hover:bg-slate-100 rounded cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={checkFullRow || selectedCols.includes(idx)}
                                        onChange={() => toggleColumn(idx)}
                                        className="rounded text-blue-600"
                                        disabled={checkFullRow || (mode === 'cross' && selectedCols.length >= 2 && !selectedCols.includes(idx))}
                                    />
                                    <span className="text-xs text-slate-700 truncate flex-1" title={String(header)}>
                                    {idx + 1}. {header || `(Empty)`}
                                    </span>
                                    {badge}
                                </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            </div>
        </div>

        {/* RIGHT: DASHBOARD (4 Cols) */}
        <div className="md:col-span-4 flex flex-col space-y-6">
            
            {/* Health Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><Activity size={16}/> Data Health</h3>
                    {columnStats && <span className="text-xs bg-white/10 px-2 py-0.5 rounded">{columnStats.totalRows} Rows</span>}
                </div>
                
                {columnStats ? (
                    <div className="p-4 flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
                        
                        {/* Score Circle */}
                        <div className="flex items-center gap-4">
                            <div className="relative w-20 h-20 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="40" cy="40" r="32" stroke="#e2e8f0" strokeWidth="8" fill="none"/>
                                    <circle cx="40" cy="40" r="32" stroke={columnStats.uniquenessScore > 80 ? "#22c55e" : columnStats.uniquenessScore > 50 ? "#eab308" : "#ef4444"} strokeWidth="8" fill="none" strokeDasharray="200" strokeDashoffset={200 - (200 * columnStats.uniquenessScore / 100)} className="transition-all duration-1000 ease-out"/>
                                </svg>
                                <div className="absolute flex flex-col items-center">
                                    <span className="text-lg font-bold text-slate-700">{columnStats.uniquenessScore}%</span>
                                    <span className="text-[8px] text-slate-400 uppercase">Unique</span>
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Unique Values</span>
                                    <span className="font-bold text-slate-800">{columnStats.uniqueValues}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Duplicates</span>
                                    <span className="font-bold text-red-600">{columnStats.duplicateValuesCount}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">Empty Cells</span>
                                    <span className="font-bold text-amber-600">{columnStats.emptyCount}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-px bg-slate-100"></div>

                        {/* Top Offenders */}
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                <Fingerprint size={12}/> Top Duplicates
                            </h4>
                            {columnStats.topDuplicates.length > 0 ? (
                                <div className="space-y-2">
                                    {columnStats.topDuplicates.map((item: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs border border-slate-100">
                                            <span className="truncate font-medium text-slate-700 flex-1 pr-2" title={item.val}>{item.val || "(Empty)"}</span>
                                            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">{item.count}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center p-4 text-green-600 bg-green-50 rounded border border-green-100">
                                    <CheckCircle size={20} className="mx-auto mb-1"/>
                                    <p className="text-xs font-bold">All values are unique!</p>
                                </div>
                            )}
                        </div>

                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                        <BarChart2 size={40} className="mb-2 opacity-20"/>
                        <p className="text-xs">Select columns to analyze data health instantly.</p>
                    </div>
                )}
            </div>

        </div>

      </div>

      {/* ACTION BAR */}
      <div className="flex space-x-4 items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm sticky bottom-6 z-20">
        <button
          onClick={handleProcess}
          data-action="primary"
          disabled={!fileData || status === ProcessingStatus.PROCESSING}
          className={`flex-1 md:flex-none md:w-64 flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-bold text-white shadow-sm transition-all transform active:scale-95
            ${status === ProcessingStatus.PROCESSING 
              ? 'bg-slate-400 cursor-not-allowed' 
              : autoResolve ? 'bg-purple-600 hover:bg-purple-700' 
              : mode === 'cross' ? 'bg-indigo-600 hover:bg-indigo-700' 
              : checkFullRow ? 'bg-yellow-600 hover:bg-yellow-700' 
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {autoResolve ? <Wand2 size={18} /> : mode === 'cross' ? <ArrowRightLeft size={18}/> : <Search size={18} />}
          <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}</span>
        </button>
        
        <button
          onClick={() => {
            setSelectedCols([]);
            setCheckFullRow(false);
            setAutoResolve(false);
            setMode('composite');
            setCompareAcrossSheets(false);
            setSourceColIdx(-1);
            setRefColIdx(-1);
            setStatus(ProcessingStatus.IDLE);
            onReset();
          }}
          className="flex items-center space-x-2 px-6 py-3 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw size={18} />
          <span>{t.common.reset}</span>
        </button>
      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={progressLabel} />}
    </div>
  );
};

export default DuplicatesTab;
