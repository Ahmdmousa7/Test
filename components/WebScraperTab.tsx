
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { ProcessingStatus, LogEntry } from '../types';
import { saveWorkbook } from '../services/excelService';
import { extractStructuredData } from '../services/geminiService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Globe, Download, Search, AlertCircle, Table, ExternalLink, Zap, RefreshCw } from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

const WebScraperTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [url, setUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [scrapedData, setScrapedData] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

  const fetchContent = async (targetUrl: string): Promise<{ text: string; source: 'html' | 'markdown' | 'json' }> => {
     try {
        const jinaUrl = `https://r.jina.ai/${targetUrl}`;
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(jinaUrl)}`);
        if (res.ok) {
           const text = await res.text();
           if (text.length > 100 && !text.includes("Jina AI - Access Denied") && !text.includes("403 Forbidden")) {
              return { text: text, source: 'markdown' };
           }
        }
     } catch (e) {
        console.warn("Jina strategy failed", e);
     }

     const proxies = [
        {
           name: "CorsProxy.io",
           fetch: async (u: string) => {
              const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(u)}`);
              if (!res.ok) throw new Error(`Status ${res.status}`);
              return await res.text();
           }
        },
        {
           name: "AllOrigins",
           fetch: async (u: string) => {
              const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`);
              if (!res.ok) throw new Error(`Status ${res.status}`);
              const data = await res.json();
              return data.contents;
           }
        }
     ];

     for (const proxy of proxies) {
        try {
           await new Promise(r => setTimeout(r, 200));
           const html = await proxy.fetch(targetUrl);
           if (html && html.length > 200) {
              return { text: html, source: 'html' };
           }
        } catch (e: any) {
           console.warn(`Proxy ${proxy.name} failed:`, e);
        }
     }
     
     throw new Error("All extraction strategies failed.");
  };

  const handleScrape = async () => {
    if (!url) {
      addLog("Please enter a valid URL.", 'warning');
      return;
    }
    if (!instruction) {
      addLog("Please describe what data to extract.", 'warning');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(5);
    setScrapedData([]);
    addLog(`${t.common.processing} ${url}...`, 'info');

    try {
      const { text: content, source } = await fetchContent(url);
      
      setProgress(40);
      let finalCleanText = "";

      if (source === 'markdown') {
          finalCleanText = content;
      } else {
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'text/html');
          
          const junk = doc.querySelectorAll('script, style, svg, noscript, iframe, footer, nav, header, aside, link, meta, form, button');
          junk.forEach(el => {
             if (el.id === '__NEXT_DATA__') return; 
             el.remove();
          });

          const nextData = doc.getElementById('__NEXT_DATA__');
          if (nextData) {
             finalCleanText = nextData.textContent || "";
             if (finalCleanText.length > 50000) finalCleanText = finalCleanText.slice(0, 50000);
          } else {
             const main = doc.querySelector('main') || doc.querySelector('article') || doc.querySelector('#content') || doc.querySelector('.content') || doc.body;
             finalCleanText = main.innerText || "";
          }
      }

      finalCleanText = finalCleanText.replace(/\s+/g, ' ').trim();

      if (finalCleanText.length < 50) {
         throw new Error("Content too short.");
      }

      setProgress(60);

      const result = await extractStructuredData(finalCleanText, instruction);

      if (!result || result.length === 0) {
        throw new Error("AI analyzed the page but found no data matching your description.");
      }

      setScrapedData(result);
      
      if (result.length > 0) {
        setPreviewHeaders(Object.keys(result[0]));
      }

      addLog(`${t.common.completed} ${result.length} items.`, 'success');
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
      setStatus(ProcessingStatus.ERROR);
    } finally {
      if (status !== ProcessingStatus.ERROR) setStatus(ProcessingStatus.COMPLETED);
    }
  };

  const handleDownload = () => {
    if (scrapedData.length === 0) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(scrapedData);
    XLSX.utils.book_append_sheet(wb, ws, "Scraped Data");
    
    let domain = "web_data";
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (e) {}

    saveWorkbook(wb, `${domain}_extract_${Date.now()}.xlsx`);
    addLog(t.common.completed, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-4">
           <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                 <Globe size={18} className="mr-2" />
                 {t.tabs.scraper}
              </h3>

              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.scraper.url}</label>
                    <input 
                      type="url" 
                      placeholder="https://example.com/products"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                 </div>

                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.scraper.prompt}</label>
                    <textarea 
                      placeholder={language === 'ar' ? "مثال: استخرج قائمة المنتجات مع الاسم والسعر." : "e.g. Extract a list of products with 'Name' and 'Price'."}
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      rows={4}
                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                 </div>

                 <div className="bg-amber-50 border border-amber-100 p-3 rounded text-xs text-amber-800">
                    <div className="flex items-start gap-2">
                       <Zap size={14} className="mt-0.5 shrink-0 text-amber-600"/>
                       <div>
                         <p><strong>{t.scraper.smartMode}</strong></p>
                       </div>
                    </div>
                 </div>

                 <button
                    onClick={handleScrape}
                    disabled={status === ProcessingStatus.PROCESSING}
                    className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
                       ${status === ProcessingStatus.PROCESSING
                         ? 'bg-slate-400 cursor-not-allowed' 
                         : 'bg-indigo-600 hover:bg-indigo-700'}`}
                 >
                    {status === ProcessingStatus.PROCESSING ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                    <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}</span>
                 </button>
              </div>
           </div>
        </div>

        <div className="lg:col-span-2 flex flex-col h-full min-h-[400px]">
           <div className="bg-white rounded-lg border border-slate-200 flex flex-col flex-1 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <h4 className="font-bold text-slate-700 flex items-center">
                    <Table size={16} className="mr-2 text-slate-400" />
                    {t.scraper.preview} ({scrapedData.length})
                 </h4>
                 {scrapedData.length > 0 && (
                    <button 
                       onClick={handleDownload}
                       className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-bold flex items-center gap-1 transition-colors"
                    >
                       <Download size={14} /> {t.common.download}
                    </button>
                 )}
              </div>

              <div className="flex-1 overflow-auto bg-slate-50/30 p-4">
                 {scrapedData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                       <Search size={48} className="mb-2" />
                       <p>{t.common.noData}</p>
                    </div>
                 ) : (
                    <div className="border border-slate-200 rounded overflow-hidden">
                       <table className="w-full text-left text-sm bg-white">
                          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                             <tr>
                                <th className="p-2 w-10 text-center">#</th>
                                {previewHeaders.map(h => (
                                   <th key={h} className="p-2 capitalize">{h}</th>
                                ))}
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {scrapedData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                   <td className="p-2 text-center text-slate-400 text-xs font-mono">{idx + 1}</td>
                                   {previewHeaders.map(h => (
                                      <td key={h} className="p-2 truncate max-w-[200px]" title={String(row[h])}>
                                         {String(row[h] || '')}
                                      </td>
                                   ))}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
    </div>
  );
};

export default WebScraperTab;
