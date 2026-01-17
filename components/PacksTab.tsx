
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Package, Settings2, ArrowUpDown, Key } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl', '5xl'];

const compareValues = (a: any, b: any) => {
  const valA = a !== undefined && a !== null ? String(a).trim() : "";
  const valB = b !== undefined && b !== null ? String(b).trim() : "";

  if (valA === "" && valB === "") return 0;
  if (valA === "") return 1;
  if (valB === "") return -1;

  const numA = parseFloat(valA);
  const numB = parseFloat(valB);
  
  const isNumA = !isNaN(numA) && /^-?\d*(\.\d+)?$/.test(valA);
  const isNumB = !isNaN(numB) && /^-?\d*(\.\d+)?$/.test(valB);

  if (isNumA && isNumB) {
    return numA - numB;
  }

  const sizeA = valA.toLowerCase();
  const sizeB = valB.toLowerCase();
  const idxA = SIZE_ORDER.indexOf(sizeA);
  const idxB = SIZE_ORDER.indexOf(sizeB);

  if (idxA !== -1 && idxB !== -1) {
    return idxA - idxB;
  }

  return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
};

const PacksTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  
  const [keyColIndex, setKeyColIndex] = useState<number | null>(null);
  const [sortColIndex, setSortColIndex] = useState<number | null>(null);
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);

  useEffect(() => {
    if (fileData) {
      if (!selectedSheet && fileData.sheets.length > 0) {
        setSelectedSheet(fileData.sheets[0]);
      }
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, false);
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
        setKeyColIndex(null); 
        setSortColIndex(null);
      }
    }
  }, [fileData, selectedSheet]);

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    if (keyColIndex === null) {
      addLog("Please select a Key Column (e.g., Item ID).", 'warning');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');
    
    try {
      await new Promise(r => setTimeout(r, 100));

      const rawData = getSheetData(fileData.workbook, selectedSheet, true);
      const originalHeaders = rawData[0] as string[];
      const rows = rawData.slice(1);
      const totalRows = rows.length;

      const groups = new Map<string, any[][]>();
      
      rows.forEach((row) => {
        const keyVal = row[keyColIndex];
        const key = keyVal !== undefined && keyVal !== null ? String(keyVal).trim() : "";
        
        if (key) {
           if (!groups.has(key)) {
             groups.set(key, []);
           }
           groups.get(key)!.push(row);
        }
      });

      if (sortColIndex !== null) {
         groups.forEach((groupRows) => {
            groupRows.sort((a, b) => {
                return compareValues(a[sortColIndex], b[sortColIndex]);
            });
         });
      }

      const packGroups = new Map<string, any[][]>();
      const singleRows: any[][] = [];
      const packSourceRows: any[][] = []; 

      groups.forEach((groupRows, key) => {
          if (groupRows.length > 1) {
              packGroups.set(key, groupRows);
              packSourceRows.push(...groupRows);
          } else {
              singleRows.push(groupRows[0]);
          }
      });

      const packOutputRows: any[][] = [];
      let packHeaders: string[] = [];

      if (packGroups.size > 0) {
          let maxRepetitions = 0;
          packGroups.forEach((groupRows) => {
            if (groupRows.length > maxRepetitions) maxRepetitions = groupRows.length;
          });

          packHeaders = [...originalHeaders];
          for (let i = 1; i < maxRepetitions; i++) {
              const suffix = ` #${i + 1}`;
              originalHeaders.forEach(h => packHeaders.push(`${h}${suffix}`));
          }

          let processedCount = 0;
          packGroups.forEach((groupRows) => {
            const baseRow = groupRows[0];
            
            const flatRow = [...baseRow];
            while(flatRow.length < originalHeaders.length) flatRow.push("");

            for (let i = 1; i < maxRepetitions; i++) {
                if (i < groupRows.length) {
                    const nextRow = groupRows[i];
                    const padded = [...nextRow];
                    while(padded.length < originalHeaders.length) padded.push("");
                    flatRow.push(...padded);
                } else {
                    const filler = new Array(originalHeaders.length).fill("");
                    flatRow.push(...filler);
                }
            }
            packOutputRows.push(flatRow);
            
            processedCount++;
            if (processedCount % 50 === 0) setProgress(Math.round((processedCount / packGroups.size) * 80));
          });
      }

      const newWb = XLSX.utils.book_new();

      const wsMain = XLSX.utils.aoa_to_sheet(rawData);
      XLSX.utils.book_append_sheet(newWb, wsMain, "Main (Original)");

      if (packOutputRows.length > 0) {
          const wsPacks = XLSX.utils.aoa_to_sheet([packHeaders, ...packOutputRows]);
          XLSX.utils.book_append_sheet(newWb, wsPacks, "Packs (Merged)");
      }

      if (packSourceRows.length > 0) {
          const wsSource = XLSX.utils.aoa_to_sheet([originalHeaders, ...packSourceRows]);
          XLSX.utils.book_append_sheet(newWb, wsSource, "Packs Source Data");
      }
      
      if (singleRows.length > 0) {
          const wsSingles = XLSX.utils.aoa_to_sheet([originalHeaders, ...singleRows]);
          XLSX.utils.book_append_sheet(newWb, wsSingles, "One Item");
      }

      const baseName = fileData.name.replace(/\.[^/.]+$/, "");
      saveWorkbook(newWb, `Packs_Merged_${baseName}.xlsx`);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-white p-4 rounded-lg border border-slate-200 h-fit">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center">
             <Settings2 size={18} className="mr-2" />
             {t.common.config}
          </h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-600 mb-1">{t.common.selectSheet}</label>
            <select 
              className="w-full p-2 border rounded text-sm bg-slate-50"
              value={selectedSheet}
              onChange={(e) => {
                setSelectedSheet(e.target.value);
                setKeyColIndex(null);
                setSortColIndex(null);
              }}
            >
              {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="mb-6">
             <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center">
                <ArrowUpDown size={14} className="mr-1" /> {t.packs.sortPack}
             </label>
             <select 
              className="w-full p-2 border rounded text-sm bg-slate-50"
              value={sortColIndex !== null ? sortColIndex : ""}
              onChange={(e) => {
                const val = e.target.value;
                setSortColIndex(val === "" ? null : Number(val));
              }}
            >
              <option value="">{t.packs.none}</option>
              {headers.map((h, idx) => (
                 <option key={idx} value={idx}>{idx + 1}. {h}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleProcess}
            disabled={!fileData || keyColIndex === null || status === ProcessingStatus.PROCESSING}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
                ${!fileData || keyColIndex === null || status === ProcessingStatus.PROCESSING
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            <Package size={18} />
            <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}</span>
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col h-[500px]">
           <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
             <div>
                <h3 className="font-bold text-slate-700">{t.common.selectCols}</h3>
                <p className="text-xs text-slate-500">{t.packs.desc}</p>
             </div>
           </div>
           
           <div className="flex-1 overflow-y-auto border border-slate-100 rounded bg-slate-50">
             <div className="flex items-center px-3 py-2 bg-slate-200 text-xs font-bold text-slate-600 sticky top-0 z-10">
                 <div className="w-8 text-center">Key</div>
                 <div className="flex-1 px-2">{t.common.selected}</div>
             </div>

             {headers.map((header, idx) => (
               <div 
                 key={idx} 
                 className={`flex items-center px-3 py-2 border-b border-slate-100 last:border-0 hover:bg-white transition-colors
                    ${keyColIndex === idx ? 'bg-indigo-50' : ''}`}
               >
                 <div className="w-8 flex justify-center">
                    <button 
                        onClick={() => setKeyColIndex(idx)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all
                           ${keyColIndex === idx ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 text-transparent hover:border-indigo-400'}`}
                    >
                        <Key size={10} />
                    </button>
                 </div>
                 
                 <div className="flex-1 px-2 min-w-0">
                     <p className={`text-sm truncate ${keyColIndex === idx ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>
                         {header || `(Col ${idx+1})`}
                     </p>
                     {keyColIndex === idx && <span className="text-[10px] text-indigo-500 font-bold uppercase">{t.packs.groupKey}</span>}
                 </div>
               </div>
             ))}
           </div>
        </div>

      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default PacksTab;
