
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { LogEntry, ProcessingStatus } from '../types';
import { readExcelFile, getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  ClipboardCheck, UploadCloud, FileText, FileSpreadsheet, Eye, 
  Settings2, CheckCircle2, AlertTriangle, X, Download, Split, 
  ArrowRightLeft, Maximize2, Link, Calculator, Filter, Flag, Check, ListFilter, ArrowRight, Table, Inspect
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface QcFile {
  file: File;
  type: 'data' | 'visual';
  data?: any[][]; // For Excel/CSV
  headers?: string[];
  previewUrl?: string; // For Images/PDF
  sheetName?: string;
}

interface Discrepancy {
  rowKey: string;
  colName: string;
  valA: string;
  valB: string;
  rowIdxA: number;
  rowIdxB: number;
  diffType: 'missing' | 'mismatch';
}

// Stores indices of rows that have at least one error
interface MismatchedRowInfo {
  key: string;
  rowIdxA: number;
  rowIdxB: number;
  errors: Set<string>; // Set of column names that have errors
}

interface ColumnMapping {
  colA: number;
  colB: number;
}

type VisualStatus = 'pending' | 'pass' | 'fail' | 'flag';

const QcCheckTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  const [fileA, setFileA] = useState<QcFile | null>(null);
  const [fileB, setFileB] = useState<QcFile | null>(null);
  
  const [keyColA, setKeyColA] = useState<number>(-1);
  const [keyColB, setKeyColB] = useState<number>(-1);
  
  // Enhancement 1: Explicit Column Mapping
  const [colMapping, setColMapping] = useState<ColumnMapping[]>([]);
  
  const [fuzzyMatch, setFuzzyMatch] = useState<boolean>(true);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [mismatchedRows, setMismatchedRows] = useState<MismatchedRowInfo[]>([]);
  
  // Detail View State
  const [inspectRow, setInspectRow] = useState<MismatchedRowInfo | null>(null);

  // Enhancement 3: Visual QC Workflow
  const [activeVisualRow, setActiveVisualRow] = useState<number | null>(null);
  const [visualRowStatus, setVisualRowStatus] = useState<Record<number, VisualStatus>>({});
  const [hideVerified, setHideVerified] = useState<boolean>(false);

  // Auto-detect mode based on files
  const mode = (fileA?.type === 'visual' || fileB?.type === 'visual') ? 'visual' : 'data';

  useEffect(() => {
    return () => {
      if (fileA?.previewUrl) URL.revokeObjectURL(fileA.previewUrl);
      if (fileB?.previewUrl) URL.revokeObjectURL(fileB.previewUrl);
    };
  }, []);

  // Enhancement 4: Smart Auto-Map Logic
  useEffect(() => {
    if (mode === 'data' && fileA?.headers && fileB?.headers && colMapping.length === 0) {
       const newMapping: ColumnMapping[] = [];
       fileA.headers.forEach((hA, iA) => {
          // Exact match or fuzzy match
          const iB = fileB.headers!.findIndex(hB => 
             String(hB).toLowerCase().trim() === String(hA).toLowerCase().trim()
          );
          if (iB !== -1) {
             newMapping.push({ colA: iA, colB: iB });
          }
       });
       if (newMapping.length > 0) setColMapping(newMapping);

       // Auto Key Detection
       if (keyColA === -1) {
          const keyCandidates = ['id', 'sku', 'code', 'number', 'ref'];
          const idxA = fileA.headers.findIndex(h => keyCandidates.some(k => String(h).toLowerCase().includes(k)));
          if (idxA !== -1) setKeyColA(idxA);
       }
       if (keyColB === -1) {
          const keyCandidates = ['id', 'sku', 'code', 'number', 'ref'];
          const idxB = fileB.headers!.findIndex(h => keyCandidates.some(k => String(h).toLowerCase().includes(k)));
          if (idxB !== -1) setKeyColB(idxB);
       }
    }
  }, [fileA, fileB, mode]);

  const processFile = async (file: File): Promise<QcFile> => {
    const isData = file.name.match(/\.(csv|xlsx|xls)$/i);
    if (isData) {
      const data = await readExcelFile(file);
      const sheetName = data.sheets[0];
      const rows = getSheetData(data.workbook, sheetName, false);
      return {
        file,
        type: 'data',
        data: rows,
        headers: rows[0] as string[],
        sheetName
      };
    } else {
      return {
        file,
        type: 'visual',
        previewUrl: URL.createObjectURL(file)
      };
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    addLog(`${t.common.processing} ${file.name}...`, 'info');
    try {
      const processed = await processFile(file);
      if (slot === 'A') setFileA(processed);
      else setFileB(processed);
      
      // Reset logic
      if (slot === 'A' || mode !== 'data') {
         setKeyColA(-1);
         setKeyColB(-1);
         setColMapping([]);
         setDiscrepancies([]);
         setMismatchedRows([]);
         setVisualRowStatus({});
         setInspectRow(null);
      }
      setStatus(ProcessingStatus.IDLE);
      
    } catch (err: any) {
      addLog(err.message, 'error');
    }
  };

  const compareValues = (valA: string, valB: string) => {
    const sA = String(valA).trim();
    const sB = String(valB).trim();

    if (fuzzyMatch) {
      return sA.toLowerCase() === sB.toLowerCase();
    }
    return sA === sB;
  };

  const runDataComparison = async () => {
    if (!fileA?.data || !fileB?.data) return;
    if (keyColA === -1 || keyColB === -1) {
      addLog("Please select Key Columns to align rows.", 'warning');
      return;
    }
    if (colMapping.length === 0) {
      addLog("Please map at least one column to compare.", 'warning');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    setDiscrepancies([]);
    setMismatchedRows([]);
    setInspectRow(null);
    addLog(t.common.processing, 'info');

    await new Promise(r => setTimeout(r, 100));

    const rowsA = fileA.data.slice(1);
    const rowsB = fileB.data.slice(1);
    const headerA = fileA.headers || [];
    
    // Index B for fast lookup: Map<Key, {row, index}>
    const mapB = new Map<string, {row: any[], index: number}>();
    rowsB.forEach((row, idx) => {
      const key = String(row[keyColB]).trim();
      if(key) mapB.set(key, { row, index: idx });
    });

    const diffs: Discrepancy[] = [];
    const problemRows: MismatchedRowInfo[] = [];
    const totalRows = rowsA.length;

    rowsA.forEach((rowA, idxA) => {
       const key = String(rowA[keyColA]).trim();
       if (!key) return;

       const matchB = mapB.get(key);
       
       if (!matchB) {
         // Missing in B
         diffs.push({
           rowKey: key,
           rowIdxA: idxA,
           rowIdxB: -1,
           colName: "Record Status",
           valA: "Exists in A",
           valB: "Missing in B",
           diffType: 'missing'
         });
         problemRows.push({
            key,
            rowIdxA: idxA,
            rowIdxB: -1,
            errors: new Set(["Record Status"])
         });
       } else {
         // Check Columns
         const rowErrors = new Set<string>();
         
         colMapping.forEach(map => {
            const headerName = headerA[map.colA];
            const vA = rowA[map.colA] || "";
            const vB = matchB.row[map.colB] || "";

            if (!compareValues(vA, vB)) {
               diffs.push({
                 rowKey: key,
                 rowIdxA: idxA,
                 rowIdxB: matchB.index,
                 colName: headerName,
                 valA: String(vA),
                 valB: String(vB),
                 diffType: 'mismatch'
               });
               rowErrors.add(headerName);
            }
         });

         if (rowErrors.size > 0) {
            problemRows.push({
                key,
                rowIdxA: idxA,
                rowIdxB: matchB.index,
                errors: rowErrors
            });
         }
       }
       
       if (idxA % 100 === 0) setProgress((idxA / totalRows) * 100);
    });

    setDiscrepancies(diffs);
    setMismatchedRows(problemRows);
    setStatus(ProcessingStatus.COMPLETED);
    setProgress(100);
    
    if (diffs.length === 0) addLog(t.qc.allMatch, 'success');
    else addLog(`Found ${diffs.length} issues in ${problemRows.length} rows.`, 'warning');
  };

  const downloadReport = () => {
    if (mode === 'data') {
       if (mismatchedRows.length === 0 && discrepancies.length === 0) return;
       const wb = XLSX.utils.book_new();

       // Sheet 1: Pivot-Style Comparison Matrix (Interleaved)
       if (mismatchedRows.length > 0 && fileA && fileB) {
          const matrixHeaders = ["Key"];
          colMapping.forEach(m => {
             matrixHeaders.push(`${fileA.headers![m.colA]} (A)`);
             matrixHeaders.push(`${fileB.headers![m.colB]} (B)`);
          });

          const matrixData = [matrixHeaders];
          const stylingInfo: {r: number, c: number}[] = [];

          mismatchedRows.forEach((rowInfo, rIdx) => {
             const rowA = fileA.data![rowInfo.rowIdxA + 1];
             const rowB = rowInfo.rowIdxB !== -1 ? fileB.data![rowInfo.rowIdxB + 1] : null;
             
             const rowValues = [rowInfo.key];
             
             // Add Interleaved Values
             colMapping.forEach((m, cIdx) => {
                 const colName = fileA.headers![m.colA];
                 const isErr = rowInfo.errors.has(colName);
                 const valA = rowA[m.colA];
                 const valB = rowB ? rowB[m.colB] : "MISSING";
                 
                 rowValues.push(valA);
                 rowValues.push(valB);

                 if (isErr) {
                    // Record index for styling. +1 for Header row.
                    const currentRow = rIdx + 1;
                    // Key is col 0. Pairs start at 1.
                    const colAIdx = 1 + (cIdx * 2);
                    const colBIdx = 1 + (cIdx * 2) + 1;
                    stylingInfo.push({r: currentRow, c: colAIdx});
                    stylingInfo.push({r: currentRow, c: colBIdx});
                 }
             });
             
             matrixData.push(rowValues);
          });

          const wsMatrix = XLSX.utils.aoa_to_sheet(matrixData);
          
          // Apply Styles to Excel
          if (wsMatrix['!ref']) {
             const range = XLSX.utils.decode_range(wsMatrix['!ref']);
             
             // Style Headers
             for(let C = range.s.c; C <= range.e.c; ++C) {
                const ref = XLSX.utils.encode_cell({r: 0, c: C});
                if(!wsMatrix[ref].s) wsMatrix[ref].s = {};
                wsMatrix[ref].s = { 
                   font: { bold: true, color: { rgb: "FFFFFF" } },
                   fill: { fgColor: { rgb: "4472C4" } },
                   alignment: { horizontal: "center" }
                };
             }

             // Style Mismatches
             stylingInfo.forEach(({r, c}) => {
                const ref = XLSX.utils.encode_cell({r, c});
                if(!wsMatrix[ref]) wsMatrix[ref] = { t: 's', v: '' };
                if(!wsMatrix[ref].s) wsMatrix[ref].s = {};
                wsMatrix[ref].s = {
                   fill: { fgColor: { rgb: "FFC7CE" } },
                   font: { color: { rgb: "9C0006" } }
                };
             });

             // Auto-width columns
             wsMatrix['!cols'] = matrixHeaders.map(() => ({ wch: 20 }));
          }

          XLSX.utils.book_append_sheet(wb, wsMatrix, "Comparison Matrix");
       }

       // Sheet 2: Detailed List
       const wsList = XLSX.utils.json_to_sheet(discrepancies.map(({rowIdxA, rowIdxB, ...rest}) => rest));
       XLSX.utils.book_append_sheet(wb, wsList, "Discrepancy Log");

       // Sheet 3: Original File A
       if (fileA?.data) {
          const wsA = XLSX.utils.aoa_to_sheet(fileA.data);
          XLSX.utils.book_append_sheet(wb, wsA, "Original File A");
       }

       // Sheet 4: Original File B
       if (fileB?.data) {
          const wsB = XLSX.utils.aoa_to_sheet(fileB.data);
          XLSX.utils.book_append_sheet(wb, wsB, "Original File B");
       }

       saveWorkbook(wb, `QC_Full_Report_${Date.now()}.xlsx`);
    } else {
       // Visual Report
       if (!fileA || !fileB) return;
       const dataFile = fileA.type === 'data' ? fileA : fileB;
       if (!dataFile?.data) return;
       
       const headers = ["QC Status", ...(dataFile.headers || [])];
       const reportData = [headers];
       
       const rows = dataFile.data.slice(1);
       rows.forEach((row, i) => {
          const status = visualRowStatus[i] || 'pending';
          reportData.push([status.toUpperCase(), ...row]);
       });
       
       const ws = XLSX.utils.aoa_to_sheet(reportData);
       const wb = XLSX.utils.book_new();
       XLSX.utils.book_append_sheet(wb, ws, "Visual QC Report");
       saveWorkbook(wb, `QC_Visual_Report_${Date.now()}.xlsx`);
    }
  };

  const toggleVisualStatus = (idx: number, newStatus: VisualStatus) => {
     setVisualRowStatus(prev => ({
        ...prev,
        [idx]: prev[idx] === newStatus ? 'pending' : newStatus
     }));
  };

  // --- RENDERERS ---

  const renderDataInspector = () => {
    if (!inspectRow || !fileA || !fileB) return null;
    
    const rowA = fileA.data![inspectRow.rowIdxA + 1];
    const rowB = inspectRow.rowIdxB !== -1 ? fileB.data![inspectRow.rowIdxB + 1] : null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
         <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-lg flex items-center gap-2">
                  <Inspect size={20} className="text-blue-600"/> 
                  Row Inspection: <span className="font-mono bg-slate-200 px-2 rounded">{inspectRow.key}</span>
               </h3>
               <button onClick={() => setInspectRow(null)} className="p-1 hover:bg-slate-200 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
               <table className="w-full text-sm border-collapse">
                  <thead>
                     <tr className="bg-slate-100 text-slate-600">
                        <th className="p-2 border text-left w-1/3">Column</th>
                        <th className="p-2 border text-left w-1/3 text-blue-700">File A (Reference)</th>
                        <th className="p-2 border text-left w-1/3 text-orange-700">File B (Target)</th>
                     </tr>
                  </thead>
                  <tbody>
                     {/* Mapped Columns First */}
                     {colMapping.map((m, i) => {
                        const colName = fileA.headers![m.colA];
                        const valA = rowA[m.colA];
                        const valB = rowB ? rowB[m.colB] : "MISSING";
                        const isErr = inspectRow.errors.has(colName);
                        
                        return (
                           <tr key={`map-${i}`} className={isErr ? "bg-red-50" : "hover:bg-slate-50"}>
                              <td className="p-2 border font-medium flex items-center justify-between">
                                 {colName}
                                 {isErr && <AlertTriangle size={14} className="text-red-500"/>}
                              </td>
                              <td className="p-2 border font-mono break-all">{String(valA)}</td>
                              <td className="p-2 border font-mono break-all">{String(valB)}</td>
                           </tr>
                        );
                     })}
                     
                     {/* Divider */}
                     <tr>
                        <td colSpan={3} className="bg-slate-100 p-2 text-center text-xs font-bold uppercase text-slate-500 tracking-wider">Other Columns (Unmapped)</td>
                     </tr>

                     {/* Unmapped A */}
                     {fileA.headers!.map((h, i) => {
                        if (colMapping.some(m => m.colA === i)) return null;
                        return (
                           <tr key={`a-${i}`} className="text-slate-500">
                              <td className="p-2 border italic">{h} (A Only)</td>
                              <td className="p-2 border">{String(rowA[i])}</td>
                              <td className="p-2 border bg-slate-50"></td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex justify-end">
               <button onClick={() => setInspectRow(null)} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">Close</button>
            </div>
         </div>
      </div>
    );
  };

  const renderVisualMode = () => {
    const visualFile = fileA?.type === 'visual' ? fileA : fileB;
    const dataFile = fileA?.type === 'data' ? fileA : fileB;
    
    if (!visualFile || !dataFile || !dataFile.data) return null;

    const headers = dataFile.headers || [];
    const rows = dataFile.data.slice(1); 
    
    // Filter logic
    const displayedRows = rows.map((r, i) => ({r, i})).filter(({i}) => {
       if (hideVerified && visualRowStatus[i] === 'pass') return false;
       return true;
    });

    const passCount = Object.values(visualRowStatus).filter(s => s === 'pass').length;
    const failCount = Object.values(visualRowStatus).filter(s => s === 'fail').length;
    const total = rows.length;

    return (
      <div className="space-y-4">
         {/* Visual QC Toolbar */}
         <div className="flex justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
            <div className="flex items-center gap-4 text-sm">
               <span className="font-bold text-slate-700">Progress: {Math.round((passCount + failCount)/total * 100)}%</span>
               <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={14}/> {passCount}</span>
               <span className="text-red-600 flex items-center gap-1"><X size={14}/> {failCount}</span>
            </div>
            <div className="flex items-center gap-2">
               <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={hideVerified} onChange={e => setHideVerified(e.target.checked)} className="rounded text-blue-600"/>
                  <ListFilter size={14}/> Hide Passed
               </label>
               <button onClick={downloadReport} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100 font-bold flex items-center gap-1">
                  <Download size={12}/> Report
               </button>
            </div>
         </div>

         <div className="flex h-[600px] border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
            {/* Left: Visual Viewer */}
            <div className="w-1/2 border-r border-slate-300 flex flex-col">
               <div className="p-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between">
                  <span>{t.common.preview}: {visualFile.file.name}</span>
                  <a href={visualFile.previewUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline"><Maximize2 size={14}/></a>
               </div>
               <div className="flex-1 overflow-auto bg-slate-800 flex items-center justify-center p-4">
                  {visualFile.file.type.includes('pdf') ? (
                    <iframe src={visualFile.previewUrl} className="w-full h-full border-none bg-white" title="PDF Preview" />
                  ) : (
                    <img src={visualFile.previewUrl} alt="Visual" className="max-w-full max-h-full object-contain shadow-lg" />
                  )}
               </div>
            </div>

            {/* Right: Data Table */}
            <div className="w-1/2 flex flex-col bg-white">
               <div className="p-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
                  {t.common.workbench}: {dataFile.file.name}
               </div>
               <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs text-left border-collapse">
                     <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                           <th className="p-2 border-b w-24 text-center">Action</th>
                           <th className="p-2 border-b w-10">#</th>
                           {headers.map((h, i) => (
                              <th key={i} className="p-2 border-b truncate max-w-[100px]" title={h}>{h}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody>
                        {displayedRows.map(({r: row, i: rIdx}) => (
                           <tr 
                              key={rIdx} 
                              className={`border-b border-slate-100 transition-colors 
                                 ${activeVisualRow === rIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}
                                 ${visualRowStatus[rIdx] === 'pass' ? 'bg-green-50/30' : ''}
                                 ${visualRowStatus[rIdx] === 'fail' ? 'bg-red-50/30' : ''}
                              `}
                              onClick={() => setActiveVisualRow(rIdx)}
                           >
                              <td className="p-2 border-r bg-white/50 text-center">
                                 <div className="flex justify-center gap-1">
                                    <button onClick={(e) => {e.stopPropagation(); toggleVisualStatus(rIdx, 'pass')}} className={`p-1 rounded hover:bg-green-100 ${visualRowStatus[rIdx]==='pass'?'text-green-600':'text-slate-300'}`}><CheckCircle2 size={14}/></button>
                                    <button onClick={(e) => {e.stopPropagation(); toggleVisualStatus(rIdx, 'fail')}} className={`p-1 rounded hover:bg-red-100 ${visualRowStatus[rIdx]==='fail'?'text-red-600':'text-slate-300'}`}><X size={14}/></button>
                                    <button onClick={(e) => {e.stopPropagation(); toggleVisualStatus(rIdx, 'flag')}} className={`p-1 rounded hover:bg-amber-100 ${visualRowStatus[rIdx]==='flag'?'text-amber-600':'text-slate-300'}`}><Flag size={14}/></button>
                                 </div>
                              </td>
                              <td className="p-2 border-r bg-white/50 text-slate-400 font-mono text-center w-10">{rIdx + 1}</td>
                              {row.map((cell: any, cIdx: number) => (
                                 <td key={cIdx} className="p-2 border-r truncate max-w-[150px]" title={String(cell)}>{cell}</td>
                              ))}
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
       
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                <ClipboardCheck className="mr-2" size={20}/>
                {t.qc.title}
             </h3>
             <button onClick={onReset} className="text-sm text-slate-500 hover:text-blue-600 underline">Reset All</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* File A Upload */}
             <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:bg-slate-50 transition-colors text-center relative group">
                {fileA ? (
                   <div className="flex flex-col items-center">
                      {fileA.type === 'data' ? <FileSpreadsheet size={32} className="text-blue-500 mb-2"/> : <Eye size={32} className="text-purple-500 mb-2"/>}
                      <span className="font-bold text-slate-700">{fileA.file.name}</span>
                      <span className="text-xs text-slate-400 uppercase font-bold mt-1">{fileA.type === 'data' ? 'Data Source' : 'Visual Source'}</span>
                      <button onClick={() => setFileA(null)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500"><X size={16}/></button>
                   </div>
                ) : (
                   <label className="cursor-pointer flex flex-col items-center w-full h-full">
                      <UploadCloud size={32} className="text-slate-400 mb-2"/>
                      <span className="font-bold text-slate-600">{t.qc.uploadA}</span>
                      <input type="file" className="hidden" onChange={(e) => handleUpload(e, 'A')} />
                   </label>
                )}
             </div>

             {/* File B Upload */}
             <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:bg-slate-50 transition-colors text-center relative group">
                {fileB ? (
                   <div className="flex flex-col items-center">
                      {fileB.type === 'data' ? <FileSpreadsheet size={32} className="text-orange-500 mb-2"/> : <Eye size={32} className="text-purple-500 mb-2"/>}
                      <span className="font-bold text-slate-700">{fileB.file.name}</span>
                      <span className="text-xs text-slate-400 uppercase font-bold mt-1">{fileB.type === 'data' ? 'Data Target' : 'Visual Target'}</span>
                      <button onClick={() => setFileB(null)} className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500"><X size={16}/></button>
                   </div>
                ) : (
                   <label className="cursor-pointer flex flex-col items-center w-full h-full">
                      <UploadCloud size={32} className="text-slate-400 mb-2"/>
                      <span className="font-bold text-slate-600">{t.qc.uploadB}</span>
                      <input type="file" className="hidden" onChange={(e) => handleUpload(e, 'B')} />
                   </label>
                )}
             </div>
          </div>

          {/* Mode Specific Config */}
          {fileA && fileB && mode === 'data' && (
             <div className="mt-6 animate-in fade-in slide-in-from-top-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.qc.keyCol} (File A)</label>
                      <select 
                         className="w-full p-2 border rounded text-sm"
                         value={keyColA}
                         onChange={(e) => setKeyColA(Number(e.target.value))}
                      >
                         <option value="-1">-- Select Key --</option>
                         {fileA.headers?.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.qc.keyCol} (File B)</label>
                      <select 
                         className="w-full p-2 border rounded text-sm"
                         value={keyColB}
                         onChange={(e) => setKeyColB(Number(e.target.value))}
                      >
                         <option value="-1">-- Select Key --</option>
                         {fileB.headers?.map((h, i) => <option key={i} value={i}>{h}</option>)}
                      </select>
                   </div>
                </div>

                <div className="bg-slate-50 p-4 rounded border border-slate-100">
                   <h4 className="font-bold text-xs text-slate-700 uppercase mb-3 flex items-center gap-2">
                      <Split size={14}/> Column Mapping
                   </h4>
                   <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                      {colMapping.length === 0 && <p className="text-xs text-slate-400 italic">Auto-mapping failed. Please select columns manually if needed.</p>}
                      {fileA.headers?.map((hA, iA) => {
                         const currentMap = colMapping.find(m => m.colA === iA);
                         return (
                            <div key={iA} className="flex items-center gap-2 text-sm">
                               <div className="w-1/3 truncate font-medium text-slate-700" title={hA}>{hA}</div>
                               <ArrowRight size={14} className="text-slate-300"/>
                               <select 
                                  className="flex-1 p-1.5 border rounded text-xs"
                                  value={currentMap?.colB ?? -1}
                                  onChange={(e) => {
                                     const val = Number(e.target.value);
                                     if (val === -1) {
                                        setColMapping(prev => prev.filter(m => m.colA !== iA));
                                     } else {
                                        setColMapping(prev => {
                                           const filtered = prev.filter(m => m.colA !== iA);
                                           return [...filtered, { colA: iA, colB: val }];
                                        });
                                     }
                                  }}
                               >
                                  <option value="-1">-- Ignore --</option>
                                  {fileB.headers?.map((hB, iB) => <option key={iB} value={iB}>{hB}</option>)}
                               </select>
                            </div>
                         );
                      })}
                   </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                   <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                      <input 
                         type="checkbox" 
                         checked={fuzzyMatch} 
                         onChange={e => setFuzzyMatch(e.target.checked)} 
                         className="rounded text-blue-600"
                      />
                      {t.qc.fuzzy}
                   </label>
                </div>

                <button 
                   onClick={runDataComparison}
                   disabled={status === ProcessingStatus.PROCESSING}
                   className="w-full py-3 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   {status === ProcessingStatus.PROCESSING ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <ArrowRightLeft size={18}/>}
                   {t.qc.run}
                </button>
             </div>
          )}
       </div>

       {/* Results Area */}
       {mode === 'visual' && fileA && fileB && renderVisualMode()}

       {mode === 'data' && (discrepancies.length > 0 || mismatchedRows.length > 0 || status === ProcessingStatus.COMPLETED) && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
             <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                   <Table size={16}/> Comparison Results
                </h4>
                <div className="flex items-center gap-2">
                   <span className="text-xs font-bold px-2 py-1 rounded bg-red-100 text-red-700">{mismatchedRows.length} Mismatches</span>
                   <button onClick={downloadReport} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-bold flex items-center gap-1">
                      <Download size={12}/> Report
                   </button>
                </div>
             </div>
             
             <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-left text-sm border-collapse">
                   <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
                      <tr>
                         <th className="p-3 border-b">Key</th>
                         <th className="p-3 border-b">Status</th>
                         <th className="p-3 border-b">Issues</th>
                         <th className="p-3 border-b text-center">Action</th>
                      </tr>
                   </thead>
                   <tbody>
                      {mismatchedRows.map((row, i) => (
                         <tr key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                            <td className="p-3 font-mono font-bold text-slate-700">{row.key}</td>
                            <td className="p-3">
                               {row.rowIdxB === -1 ? (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">Missing in B</span>
                               ) : (
                                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">Mismatch</span>
                               )}
                            </td>
                            <td className="p-3 text-xs text-slate-500 max-w-xs truncate">
                               {Array.from(row.errors).join(", ")}
                            </td>
                            <td className="p-3 text-center">
                               {row.rowIdxB !== -1 && (
                                  <button 
                                     onClick={() => setInspectRow(row)}
                                     className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                                     title="Inspect Row"
                                  >
                                     <Inspect size={16}/>
                                  </button>
                               )}
                            </td>
                         </tr>
                      ))}
                      {mismatchedRows.length === 0 && (
                         <tr>
                            <td colSpan={4} className="p-8 text-center text-green-600 font-bold flex flex-col items-center gap-2">
                               <CheckCircle2 size={32}/>
                               {t.qc.allMatch}
                            </td>
                         </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
       )}

       {renderDataInspector()}
       
       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default QcCheckTab;
