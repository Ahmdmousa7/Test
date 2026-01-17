
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { LogEntry, ProcessingStatus } from '../types';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  FileSpreadsheet, UploadCloud, Download, Trash2, 
  FileText, Settings, Archive, CheckCircle2, AlertCircle, Type, Scissors, Merge, Globe
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface CsvFile {
  id: string;
  file: File;
  previewData: any[][]; 
  rowCount: number;
}

// Simple Levenshtein for Smart Merge
const levenshtein = (a: string, b: string) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
};

const CsvConverterTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [files, setFiles] = useState<CsvFile[]>([]);
  const [outputMode, setOutputMode] = useState<'merge' | 'zip'>('merge');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  // New Enhancements State
  const [encoding, setEncoding] = useState<string>('UTF-8');
  const [delimiter, setDelimiter] = useState<string>(''); // Empty = Auto
  const [forceText, setForceText] = useState<boolean>(false);
  const [splitLarge, setSplitLarge] = useState<boolean>(true);
  const [splitRowLimit, setSplitRowLimit] = useState<number>(1000000);
  const [smartMerge, setSmartMerge] = useState<boolean>(false);

  // Re-preview trigger
  useEffect(() => {
    if (files.length > 0) {
       // Optional: Re-read preview when settings change?
       // For now, settings mostly apply to final process to save resources, 
       // but we could reload previews if needed.
    }
  }, [encoding, delimiter]);

  const readCsvWithSettings = (file: File, previewOnly = false): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      // 1. Read as Text with Encoding
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        
        // 2. Parse with Papa
        Papa.parse(text, {
          delimiter: delimiter,
          preview: previewOnly ? 20 : 0, // Limit rows for preview
          dynamicTyping: !forceText, // If forceText is true, disable dynamic typing (keep strings)
          skipEmptyLines: true,
          complete: (results) => {
             resolve(results.data as any[][]);
          },
          error: (err: any) => {
             reject(err);
          }
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file, encoding);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const uploadedFiles: File[] = Array.from(event.target.files);
      addLog(`${t.common.processing} ${uploadedFiles.length}...`, 'info');

      const newFiles: CsvFile[] = [];

      for (const file of uploadedFiles) {
        if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && !file.type.includes('excel')) {
           // Allow non-standard types if name ends in csv, but warn?
        }

        try {
          // Use PapaParse for robust reading including encoding
          const data = await readCsvWithSettings(file, true); // Preview only
          
          newFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            file,
            previewData: data.slice(0, 5), 
            rowCount: data.length // This is just preview count, real count known at process
          });
        } catch (e: any) {
          addLog(`${t.common.error}: ${e.message}`, 'error');
        }
      }

      setFiles(prev => [...prev, ...newFiles]);
      if (newFiles.length > 0) {
        addLog(t.common.completed, 'success');
      }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const sanitizeSheetName = (name: string): string => {
    return name
      .replace(/[[\]:*?/\\]/g, '') 
      .substring(0, 31)             
      .trim() || "Sheet";
  };

  const processFiles = async () => {
    if (files.length === 0) return;

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    const ROW_LIMIT = splitLarge ? (splitRowLimit > 0 ? splitRowLimit : 1000000) : 1000000000;

    try {
      if (outputMode === 'merge') {
        const wb = XLSX.utils.book_new();
        const usedNames = new Set<string>();
        
        // Smart Merge Preparation
        let masterHeaders: string[] = [];
        const fileDataMap: { name: string, rows: any[][] }[] = [];

        for (let i = 0; i < files.length; i++) {
          const csv = files[i];
          // Read FULL file
          const rows = await readCsvWithSettings(csv.file, false);
          
          if (smartMerge) {
             const fileHeader = rows[0].map(String);
             if (i === 0) masterHeaders = [...fileHeader];
             else {
                // Align headers
                fileHeader.forEach(h => {
                   // Check if h exists in master (fuzzy)
                   const exists = masterHeaders.some(mh => 
                      mh.toLowerCase() === h.toLowerCase() || 
                      (h.length > 3 && levenshtein(mh.toLowerCase(), h.toLowerCase()) < 2)
                   );
                   if (!exists) masterHeaders.push(h);
                });
             }
             fileDataMap.push({ name: csv.file.name, rows });
          } else {
             // Standard Merge (Separate Sheets)
             const chunks = [];
             
             if (splitLarge && rows.length > ROW_LIMIT) {
                 for (let k = 0; k < rows.length; k += ROW_LIMIT) {
                     // Should replicate header for chunks > 0? Standard CSV splitting usually keeps header.
                     // But if just splitting for Excel row limit, maybe yes.
                     // Let's assume user wants header on every sheet if split.
                     const header = rows[0];
                     const dataSlice = rows.slice(k === 0 ? 0 : k, k + ROW_LIMIT);
                     const chunkData = k === 0 ? dataSlice : [header, ...dataSlice]; // Simple append
                     
                     // Correction: if k=0, rows.slice(0, 1000000) includes header. 
                     // if k=1000000, rows.slice(1000000, 2000000) does NOT include header.
                     // So we need to re-add header for chunks > 0.
                     
                     if (k === 0) {
                        chunks.push(rows.slice(0, ROW_LIMIT));
                     } else {
                        // Ensure we don't duplicate header if it's somehow in data (unlikely from slice)
                        const rawSlice = rows.slice(k, k + ROW_LIMIT);
                        if (rawSlice.length > 0) {
                            chunks.push([rows[0], ...rawSlice]);
                        }
                     }
                 }
             } else {
                 chunks.push(rows);
             }

             let baseName = csv.file.name.replace(/\.[^/.]+$/, "");
             let safeName = sanitizeSheetName(baseName);
             
             chunks.forEach((chunk, chunkIdx) => {
                 let sheetName = safeName;
                 if (chunks.length > 1) sheetName += `_${chunkIdx + 1}`;
                 
                 let counter = 1;
                 let tempName = sheetName;
                 while (usedNames.has(tempName.toLowerCase())) {
                    tempName = sheetName.substring(0, 25) + `(${counter++})`;
                 }
                 usedNames.add(tempName.toLowerCase());

                 const ws = XLSX.utils.aoa_to_sheet(chunk);
                 XLSX.utils.book_append_sheet(wb, ws, tempName);
             });
          }
          
          setProgress(Math.round(((i + 1) / files.length) * 50)); // First 50% reading
        }

        // Finalize Smart Merge
        if (smartMerge) {
            const combinedRows = [masterHeaders];
            fileDataMap.forEach((fd) => {
               const localHeader = fd.rows[0].map(String);
               const dataRows = fd.rows.slice(1);
               
               // Map indices
               const mapIndices = masterHeaders.map(mh => {
                  return localHeader.findIndex(lh => 
                     lh.toLowerCase() === mh.toLowerCase() || 
                     (lh.length > 3 && levenshtein(lh.toLowerCase(), mh.toLowerCase()) < 2)
                  );
               });

               dataRows.forEach(row => {
                  const newRow = mapIndices.map(idx => idx !== -1 ? row[idx] : "");
                  combinedRows.push(newRow);
               });
            });
            
            // Chunk if needed
            if (splitLarge && combinedRows.length > ROW_LIMIT) {
                // Header is at index 0
                const header = combinedRows[0];
                const dataBody = combinedRows.slice(1);
                
                // Adjust loop for data body only
                // ROW_LIMIT includes header row usually, so data limit is ROW_LIMIT - 1
                const DATA_LIMIT = ROW_LIMIT - 1;

                for (let k = 0; k < dataBody.length; k += DATA_LIMIT) {
                    const chunkData = dataBody.slice(k, k + DATA_LIMIT);
                    const ws = XLSX.utils.aoa_to_sheet([header, ...chunkData]);
                    XLSX.utils.book_append_sheet(wb, ws, `Merged_Part${Math.floor(k/DATA_LIMIT) + 1}`);
                }
            } else {
                const ws = XLSX.utils.aoa_to_sheet(combinedRows);
                XLSX.utils.book_append_sheet(wb, ws, "Smart Merged");
            }
        }

        const fileName = `Converted_Merge_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, fileName);
        addLog(t.common.completed, 'success');

      } else {
        // ZIP MODE
        const zip = new JSZip();
        
        for (let i = 0; i < files.length; i++) {
           const csv = files[i];
           const rows = await readCsvWithSettings(csv.file, false);
           
           const wb = XLSX.utils.book_new();
           
           if (splitLarge && rows.length > ROW_LIMIT) {
               // Similar logic to merge mode splitting
               const header = rows[0];
               const dataBody = rows.slice(1);
               const DATA_LIMIT = ROW_LIMIT - 1;

               for (let k = 0; k < dataBody.length; k += DATA_LIMIT) {
                   const chunkData = dataBody.slice(k, k + DATA_LIMIT);
                   const ws = XLSX.utils.aoa_to_sheet([header, ...chunkData]);
                   XLSX.utils.book_append_sheet(wb, ws, `Part_${Math.floor(k/DATA_LIMIT) + 1}`);
               }
           } else {
               const ws = XLSX.utils.aoa_to_sheet(rows);
               XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
           }
           
           const xlsxArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
           const blob = new Blob([xlsxArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
           
           const newName = csv.file.name.replace(/\.[^/.]+$/, "") + ".xlsx";
           zip.file(newName, blob);

           setProgress(Math.round(((i + 1) / files.length) * 90));
           await new Promise(r => setTimeout(r, 10));
        }

        addLog(t.common.processing, 'info');
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Batch_Converted_CSVs_${Date.now()}.zip`;
        link.click();
        
        addLog(t.common.completed, 'success');
        setProgress(100);
      }

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  const handleResetInternal = () => {
    setFiles([]);
    setStatus(ProcessingStatus.IDLE);
    onReset();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Left Config Panel */}
        <div className="md:w-1/3 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center">
               <Settings size={18} className="mr-2" />
               {t.csv.settings}
             </h3>

             {/* 1. Import Settings */}
             <div className="mb-4 space-y-3 p-3 bg-slate-50 rounded border border-slate-100">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Globe size={12}/> {t.csv.encoding}</label>
                   <select 
                      className="w-full p-2 text-sm border rounded bg-white"
                      value={encoding}
                      onChange={(e) => setEncoding(e.target.value)}
                   >
                      <option value="UTF-8">UTF-8 (Standard)</option>
                      <option value="Windows-1256">Arabic (Windows-1256)</option>
                      <option value="ISO-8859-1">Western (ISO-8859-1)</option>
                      <option value="UTF-16LE">UTF-16LE</option>
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.csv.delimiter}</label>
                   <select 
                      className="w-full p-2 text-sm border rounded bg-white"
                      value={delimiter}
                      onChange={(e) => setDelimiter(e.target.value)}
                   >
                      <option value="">Auto-Detect</option>
                      <option value=",">Comma (,)</option>
                      <option value=";">Semicolon (;)</option>
                      <option value="\t">Tab (\t)</option>
                      <option value="|">Pipe (|)</option>
                   </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                   <input type="checkbox" checked={forceText} onChange={e => setForceText(e.target.checked)} className="rounded text-blue-600"/>
                   <span className="text-xs text-slate-700 font-medium flex items-center gap-1"><Type size={12}/> {t.csv.forceText}</span>
                </label>
             </div>

             {/* 2. Output Mode */}
             <div>
               <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.csv.outputMode}</label>
               <div className="space-y-2">
                 <label className={`flex items-start space-x-3 cursor-pointer p-3 border rounded-lg transition-all ${outputMode === 'merge' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      checked={outputMode === 'merge'} 
                      onChange={() => setOutputMode('merge')}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet size={16}/> {t.csv.merge}</span>
                      <p className="text-xs text-slate-500 mt-1">{t.csv.mergeDesc}</p>
                      
                      {/* Smart Merge Sub-option */}
                      {outputMode === 'merge' && (
                          <div className="mt-2 pl-1 animate-in fade-in">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={smartMerge} onChange={e => setSmartMerge(e.target.checked)} className="rounded text-indigo-600"/>
                                <span className="text-xs text-indigo-700 font-bold flex items-center gap-1"><Merge size={12}/> {t.csv.smartMerge}</span>
                             </label>
                          </div>
                      )}
                    </div>
                 </label>

                 <label className={`flex items-start space-x-3 cursor-pointer p-3 border rounded-lg transition-all ${outputMode === 'zip' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      checked={outputMode === 'zip'} 
                      onChange={() => setOutputMode('zip')}
                      className="mt-1 text-blue-600"
                    />
                    <div>
                      <span className="font-bold text-slate-800 flex items-center gap-2"><Archive size={16}/> {t.csv.zip}</span>
                      <p className="text-xs text-slate-500 mt-1">{t.csv.zipDesc}</p>
                    </div>
                 </label>
               </div>
             </div>

             {/* 3. Large File Toggle */}
             <div className="mt-4 pt-4 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                   <input type="checkbox" checked={splitLarge} onChange={e => setSplitLarge(e.target.checked)} className="rounded text-orange-500"/>
                   <span className="text-xs text-slate-700 font-medium flex items-center gap-1"><Scissors size={12}/> {t.csv.splitLarge}</span>
                </label>
                
                {/* Configurable Row Limit */}
                {splitLarge && (
                   <div className="mt-2 ml-6 animate-in slide-in-from-top-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t.csv.rowLimit}</label>
                      <input
                         type="number"
                         min="100"
                         max="1048576"
                         step="1000"
                         value={splitRowLimit}
                         onChange={(e) => setSplitRowLimit(Math.max(100, Number(e.target.value)))}
                         className="w-full p-2 border rounded text-sm bg-white text-slate-900 focus:ring-1 focus:ring-orange-500 outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Excel Max: 1,048,576</p>
                   </div>
                )}
             </div>
          </div>

          <button
            onClick={processFiles}
            disabled={files.length === 0 || status === ProcessingStatus.PROCESSING}
            className={`w-full py-4 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
               ${files.length === 0 || status === ProcessingStatus.PROCESSING
                 ? 'bg-slate-400 cursor-not-allowed' 
                 : 'bg-green-600 hover:bg-green-700'}`}
          >
             {status === ProcessingStatus.PROCESSING 
               ? <span className="flex items-center"><span className="animate-spin mr-2">⏳</span> {t.common.processing}</span>
               : <>
                   <Download size={20} />
                   <span>{t.common.start}</span>
                 </>
             }
          </button>

           <button
             onClick={handleResetInternal}
             className="w-full py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50"
          >
            {t.common.reset}
          </button>
        </div>

        {/* Right Preview Panel */}
        <div className="md:w-2/3 flex flex-col h-full">
           <div className="bg-white p-6 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-slate-50 transition-all text-center mb-6">
              <label className="cursor-pointer block w-full h-full">
                 <UploadCloud size={40} className="mx-auto text-blue-500 mb-3" />
                 <span className="text-xl font-bold text-slate-700 block">{t.actions.uploadFile}</span>
                 <input 
                    type="file" 
                    multiple 
                    accept=".csv,text/csv,application/vnd.ms-excel" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                 />
              </label>
           </div>

           <div className="bg-white rounded-lg border border-slate-200 flex-1 flex flex-col min-h-[300px]">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <h4 className="font-bold text-slate-700">{t.common.files} ({files.length})</h4>
                 <span className="text-xs text-slate-400">Previews reflect current settings</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[500px]">
                 {files.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 py-10">
                       <FileText size={48} className="mb-2" />
                       <p>{t.common.noData}</p>
                    </div>
                 )}
                 
                 {files.map((file) => (
                    <div key={file.id} className="border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-shadow bg-white group">
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-3 overflow-hidden">
                             <div className="bg-green-100 p-2 rounded text-green-700 font-bold text-xs shrink-0">CSV</div>
                             <div className="min-w-0">
                                <p className="font-bold text-slate-700 text-sm truncate" title={file.file.name}>{file.file.name}</p>
                                <p className="text-xs text-slate-400">{(file.file.size / 1024).toFixed(1)} KB</p>
                             </div>
                          </div>
                          <button onClick={() => removeFile(file.id)} className="text-slate-400 hover:text-red-500">
                             <Trash2 size={16} />
                          </button>
                       </div>
                       
                       <div className="bg-slate-50 rounded border border-slate-100 p-2 text-[10px] font-mono text-slate-600 overflow-x-auto">
                          <table className="w-full text-left">
                             <tbody>
                                {file.previewData.map((row, rIdx) => (
                                   <tr key={rIdx} className="border-b border-slate-100 last:border-0">
                                      {row.slice(0, 5).map((cell, cIdx) => (
                                         <td key={cIdx} className="p-1 pr-3 truncate max-w-[100px] border-r border-slate-100 last:border-0">
                                            {String(cell)}
                                         </td>
                                      ))}
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default CsvConverterTab;
