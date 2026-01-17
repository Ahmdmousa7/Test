
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { FileSpreadsheet, Download, Link, AlertTriangle, CheckCircle2, History, Trash2, ExternalLink } from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onFileDataLoaded: (data: FileData) => void;
  language?: Language;
}

const GoogleSheetsTab: React.FC<Props> = ({ addLog, onFileDataLoaded, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [previewData, setPreviewData] = useState<any[][] | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('gsheet_history');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        setHistory([]);
      }
    }
  }, []);

  const addToHistory = (validUrl: string) => {
    const newHist = [validUrl, ...history.filter(u => u !== validUrl)].slice(0, 5);
    setHistory(newHist);
    localStorage.setItem('gsheet_history', JSON.stringify(newHist));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('gsheet_history');
  };

  const extractIdAndGid = (url: string) => {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const gidMatch = url.match(/[#&]gid=([0-9]+)/);
    
    return {
      id: idMatch ? idMatch[1] : null,
      gid: gidMatch ? gidMatch[1] : '0' // Default to first sheet (gid=0)
    };
  };

  const handleImport = async () => {
    if (!url) return;
    
    const { id, gid } = extractIdAndGid(url);
    if (!id) {
      addLog("Invalid Google Sheets URL format.", 'error');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(10);
    addLog(t.gsheets.importing, 'info');

    // Construct CSV Export URL
    const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    
    // Use CORS Proxy
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(csvUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const csvText = await response.text();
      setProgress(50);

      if (csvText.includes("<!DOCTYPE html>") || csvText.includes("Sign in")) {
         throw new Error("Access Denied. Sheet must be Public or Published.");
      }

      // Parse CSV
      const wb = XLSX.read(csvText, { type: 'string' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      setProgress(100);
      setPreviewData(data as any[][]);
      
      // Determine a good name
      const generatedName = `GSheet_${id.substring(0,6)}`;
      setSheetName(generatedName);

      // Create proper FileData object
      const finalWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(finalWb, ws, "Imported Sheet");
      
      const fileData: FileData = {
         name: generatedName + ".xlsx",
         workbook: finalWb,
         sheets: ["Imported Sheet"]
      };

      onFileDataLoaded(fileData);
      addToHistory(url);
      
      setStatus(ProcessingStatus.COMPLETED);
      addLog(t.gsheets.success, 'success');

    } catch (e: any) {
      console.error(e);
      addLog(`${t.gsheets.error} (${e.message})`, 'error');
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleDownload = () => {
    if (!previewData) return;
    const ws = XLSX.utils.aoa_to_sheet(previewData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    saveWorkbook(wb, `${sheetName || 'GoogleSheet'}.xlsx`);
  };

  return (
    <div className="space-y-6">
       
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
             <FileSpreadsheet className="text-green-600"/> {t.tabs.gsheets}
          </h3>

          <div className="mb-4">
             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.gsheets.url}</label>
             <div className="flex gap-2">
                <div className="relative flex-1">
                   <Link size={16} className="absolute left-3 top-3 text-slate-400"/>
                   <input 
                     type="text" 
                     placeholder={t.gsheets.urlPlace}
                     value={url}
                     onChange={(e) => setUrl(e.target.value)}
                     className="w-full pl-9 p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                   />
                </div>
                <button 
                   onClick={handleImport}
                   disabled={status === ProcessingStatus.PROCESSING || !url}
                   className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
                >
                   <Download size={18}/>
                   <span>{t.gsheets.load}</span>
                </button>
             </div>
          </div>

          {/* History Section */}
          {history.length > 0 && (
             <div className="mb-4 animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between items-center mb-2">
                   <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <History size={12}/> {t.gsheets.recent}
                   </h4>
                   <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-1">
                      <Trash2 size={10}/> {t.gsheets.clear}
                   </button>
                </div>
                <div className="space-y-1">
                   {history.map((hUrl, i) => (
                      <button 
                        key={i}
                        onClick={() => setUrl(hUrl)}
                        className="block w-full text-left text-xs text-slate-600 hover:bg-slate-50 p-2 rounded border border-transparent hover:border-slate-200 truncate transition-colors font-mono"
                      >
                        {hUrl}
                      </button>
                   ))}
                </div>
             </div>
          )}

          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-3">
             <AlertTriangle size={18} className="text-blue-600 mt-0.5 shrink-0"/>
             <p className="text-xs text-blue-800 leading-relaxed">
                {t.gsheets.tip}
             </p>
          </div>
       </div>

       {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.gsheets.importing} />}

       {status === ProcessingStatus.COMPLETED && previewData && (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
             <div className="p-3 bg-green-50 border-b border-green-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-green-800 font-bold">
                   <CheckCircle2 size={18}/> {t.gsheets.sheetInfo}
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-xs bg-white px-2 py-1 rounded border border-green-200 text-slate-600">
                      {previewData.length} {t.common.rows}
                   </span>
                   <button 
                      onClick={handleDownload} 
                      className="text-xs bg-white border border-green-200 text-green-700 px-3 py-1 rounded font-bold hover:bg-green-100 transition-colors flex items-center gap-1"
                   >
                      <Download size={12}/> Download
                   </button>
                   <a 
                      href={url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs bg-white border border-green-200 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-100 transition-colors"
                      title="Open in Google Sheets"
                   >
                      <ExternalLink size={12}/>
                   </a>
                </div>
             </div>
             
             <div className="p-4 overflow-auto max-h-60 bg-slate-50">
                <table className="w-full text-xs text-left border-collapse bg-white shadow-sm">
                   <thead>
                      <tr>
                         {previewData[0]?.map((h: any, i: number) => (
                            <th key={i} className="p-2 border bg-slate-100 font-bold text-slate-700">{h}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {previewData.slice(1, 6).map((row, i) => (
                         <tr key={i}>
                            {row.map((c: any, ci: number) => (
                               <td key={ci} className="p-2 border text-slate-600 truncate max-w-[150px]">{c}</td>
                            ))}
                         </tr>
                      ))}
                   </tbody>
                </table>
                {previewData.length > 6 && (
                   <p className="text-center text-xs text-slate-400 mt-2 italic">
                      ... {previewData.length - 6} more rows
                   </p>
                )}
             </div>
          </div>
       )}

    </div>
  );
};

export default GoogleSheetsTab;
