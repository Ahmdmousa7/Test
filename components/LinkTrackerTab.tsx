
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { LogEntry, ProcessingStatus } from '../types';
import { saveWorkbook } from '../services/excelService';
import { extractStructuredData } from '../services/geminiService';
import { TRANSLATIONS, Language } from '../utils/translations';
import { 
  Link, Search, User, FileText, Plus, Download, Trash2, 
  Settings, RefreshCw, Briefcase, ExternalLink, Save, 
  Users, UserCheck, FileEdit, ClipboardPaste, Database, Key
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface TrackerRow {
  id: string;
  date: string;
  accountNumber: string;
  salesOwner: string;
  csmOwner: string;
  owner: string; 
  note: string;
  sourceUrl: string;
}

const LinkTrackerTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  // Input State
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [manualText, setManualText] = useState('');
  
  // Fields
  const [accountNumber, setAccountNumber] = useState('');
  const [owner, setOwner] = useState(''); // Main/AccountSetup Owner
  const [salesOwner, setSalesOwner] = useState('');
  const [csmOwner, setCsmOwner] = useState('');
  const [note, setNote] = useState('');
  
  // Settings State
  const [defaultNote, setDefaultNote] = useState(language === 'ar' ? 'متابعة الفاتورة' : 'Follow up on invoice');
  const [savedOwners, setSavedOwners] = useState<string[]>([]);
  const [zohoToken, setZohoToken] = useState('');
  const [zohoDomain, setZohoDomain] = useState('www.zohoapis.com');
  const [showSettings, setShowSettings] = useState(false);

  // Data State
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  
  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem('tracker_settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if(parsed.defaultNote) setDefaultNote(parsed.defaultNote);
            if(parsed.savedOwners) setSavedOwners(parsed.savedOwners);
            if(parsed.zohoToken) setZohoToken(parsed.zohoToken);
            if(parsed.zohoDomain) setZohoDomain(parsed.zohoDomain);
        } catch(e) {}
    }
    setNote(defaultNote);
  }, []);

  // Save settings
  const saveSettings = () => {
      localStorage.setItem('tracker_settings', JSON.stringify({ defaultNote, savedOwners, zohoToken, zohoDomain }));
      addLog("Configuration saved.", 'success');
      setShowSettings(false);
  };

  // URL Parser for ID
  const parseUrlForId = (link: string) => {
      // Zoho Pattern: .../tab/ModuleName/ID
      // Example: .../tab/CustomModule41/4412475001169802918
      const zohoMatch = link.match(/\/tab\/([^/]+)\/(\d+)/);
      if (zohoMatch) {
          return { module: zohoMatch[1], id: zohoMatch[2] };
      }
      return null;
  };

  const fetchZohoApi = async (module: string, id: string) => {
      if (!zohoToken) throw new Error("No Zoho Access Token provided.");
      
      addLog(`Connecting to Zoho API (${module} / ${id})...`, 'info');
      
      const apiUrl = `https://${zohoDomain}/crm/v2/${module}/${id}`;
      // Use proxy to avoid CORS if calling from browser to Zoho API directly (often blocked)
      // However, usually Zoho API requires server-to-server. Let's try direct first, then proxy.
      // NOTE: Standard CORS proxy removes Auth headers sometimes. We will try a robust one or direct fetch if allowed.
      
      // Attempt 1: Direct (will likely fail CORS on localhost, but good for production with proxy setup)
      // Attempt 2: Via corsproxy
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
      
      const res = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
              'Authorization': `Zoho-oauthtoken ${zohoToken}`,
              'Content-Type': 'application/json'
          }
      });

      if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Zoho API Error: ${res.status} ${res.statusText} - ${errText.substring(0, 100)}`);
      }

      const json = await res.json();
      if (json.data && json.data[0]) {
          return json.data[0];
      }
      throw new Error("No data found in Zoho response.");
  };

  const fetchContentHTML = async (targetUrl: string): Promise<string> => {
     const proxies = [
        { url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` },
        { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}` }
     ];

     for (const proxy of proxies) {
        try {
           const res = await fetch(proxy.url);
           if (res.ok) {
               const text = await res.text();
               if (text.trim().startsWith('{') && text.includes('"contents"')) {
                   try { return JSON.parse(text).contents; } catch(e) { return text; }
               }
               return text;
           }
        } catch (e) {}
     }
     throw new Error("Could not fetch page content. Auth required?");
  };

  const handleFetch = async () => {
    setStatus(ProcessingStatus.PROCESSING);
    
    try {
        let extractedData: any = {};
        let fetchMethod = "none";

        // 1. ZOHO API STRATEGY (Best for Private Data)
        if (inputMode === 'url' && url) {
            const zohoInfo = parseUrlForId(url);
            
            if (zohoInfo) {
                setAccountNumber(zohoInfo.id); // Set ID immediately
                addLog(`Detected Zoho ID: ${zohoInfo.id}`, 'success');

                if (zohoToken) {
                    try {
                        const record = await fetchZohoApi(zohoInfo.module, zohoInfo.id);
                        extractedData = {
                            account_number: record.id,
                            owner: record.Owner?.name || record.AccountSetup_DataUpload_Owner?.name || "",
                            sales_owner: record.Sales_Owner?.name || "",
                            csm_owner: record.CSM_Owner?.name || ""
                        };
                        fetchMethod = "api";
                        addLog("Fetched data via Zoho API!", 'success');
                    } catch (e: any) {
                        addLog(`API Fetch Failed: ${e.message}. Falling back to page scan.`, 'warning');
                    }
                } else {
                    addLog("No Zoho Token found. Extracted ID from URL only. Add Token in settings for full data.", 'warning');
                }
            }
        }

        // 2. PAGE TEXT / AI STRATEGY (Fallback)
        if (fetchMethod === "none") {
            let textContent = "";
            if (inputMode === 'url') {
                if (!url) throw new Error("URL is empty");
                addLog("Fetching page HTML...", 'info');
                try {
                    const rawHtml = await fetchContentHTML(url);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(rawHtml, 'text/html');
                    textContent = (doc.body.innerText || "").replace(/\s+/g, ' ').slice(0, 40000); 
                } catch(e) {
                    // If HTML fetch fails (auth), we rely on manual text if provided, or just ID
                    addLog("Could not fetch page (Login Required). Please use 'Paste Page Text' or Zoho API.", 'error');
                }
            } else {
                if (!manualText) throw new Error("Please paste text first");
                textContent = manualText.slice(0, 40000);
            }

            if (textContent) {
                addLog("Analyzing text with AI...", 'info');
                const prompt = `
                  Extract fields from CRM text:
                  1. 'Account Number': Look for "Data Collection Number", "8202" style ID, or "Ticket Id".
                  2. 'Owner': "AccountSetup DataUpload Owner" or "Owner".
                  3. 'Sales Owner': "Sales Owner".
                  4. 'CSM Owner': "CSM Owner".
                  Return JSON: [{"account_number": "...", "owner": "...", "sales_owner": "...", "csm_owner": "..."}]
                `;
                const result = await extractStructuredData(textContent, prompt);
                if (result && result.length > 0) {
                    extractedData = result[0];
                    fetchMethod = "ai";
                }
            }
        }

        // Apply Data
        if (extractedData.account_number) setAccountNumber(String(extractedData.account_number));
        if (extractedData.owner) setOwner(String(extractedData.owner));
        if (extractedData.sales_owner) setSalesOwner(String(extractedData.sales_owner));
        if (extractedData.csm_owner) setCsmOwner(String(extractedData.csm_owner));

        if (fetchMethod === "none" && !extractedData.account_number && !accountNumber) {
             addLog("No data extracted. Try pasting text manually.", 'warning');
        }

    } catch (e: any) {
        addLog(`Error: ${e.message}`, 'error');
    } finally {
        setStatus(ProcessingStatus.IDLE);
    }
  };

  const handleAddRow = () => {
      if (!accountNumber) {
          addLog("Account Number is required.", 'warning');
          return;
      }

      const newRow: TrackerRow = {
          id: Math.random().toString(36).substr(2, 9),
          date: new Date().toLocaleString(),
          accountNumber,
          owner,
          salesOwner,
          csmOwner,
          note,
          sourceUrl: inputMode === 'url' ? url : 'Manual Entry'
      };

      setRows(prev => [newRow, ...prev]);
      
      // Save owners history
      const newOwnersToAdd = [owner, salesOwner, csmOwner].filter(o => o && !savedOwners.includes(o));
      if (newOwnersToAdd.length > 0) {
          const newHistory = [...savedOwners, ...newOwnersToAdd].slice(0, 20); 
          setSavedOwners(newHistory);
          localStorage.setItem('tracker_settings', JSON.stringify({ defaultNote, savedOwners: newHistory, zohoToken, zohoDomain }));
      }

      // Reset
      setAccountNumber('');
      setSalesOwner('');
      setCsmOwner('');
      setManualText('');
      setNote(defaultNote);
      if(inputMode === 'url') setUrl('');
      addLog("Row added.", 'success');
  };

  const handleDeleteRow = (id: string) => {
      setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleExport = () => {
      if (rows.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(rows.map(({id, ...rest}) => rest));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tracker Data");
      saveWorkbook(wb, `Tracker_Export_${Date.now()}.xlsx`);
      addLog(t.common.completed, 'success');
  };

  return (
    <div className="space-y-6">
        
        {/* Top: Input Area */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                    <Link size={20} className="text-blue-600"/> {t.tracker.title}
                </h3>
                <button 
                    onClick={() => setShowSettings(!showSettings)} 
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold ${showSettings ? 'bg-slate-100 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Settings size={16}/> Settings
                </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
                    <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2"><Key size={14}/> Zoho API Integration (Optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Access Token</label>
                            <input 
                                type="password" 
                                value={zohoToken}
                                onChange={(e) => setZohoToken(e.target.value)}
                                placeholder="Zoho OAuth Token..."
                                className="w-full p-2 border rounded text-xs bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">API Domain</label>
                            <select 
                                value={zohoDomain} 
                                onChange={(e) => setZohoDomain(e.target.value)}
                                className="w-full p-2 border rounded text-xs bg-white"
                            >
                                <option value="www.zohoapis.com">US (zohoapis.com)</option>
                                <option value="www.zohoapis.eu">EU (zohoapis.eu)</option>
                                <option value="www.zohoapis.in">IN (zohoapis.in)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-200 pt-3 mb-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.tracker.defaultNote}</label>
                        <input 
                            type="text" 
                            value={defaultNote}
                            onChange={(e) => setDefaultNote(e.target.value)}
                            className="w-full p-2 border rounded text-xs bg-white"
                        />
                    </div>

                    <div className="flex justify-end">
                        <button onClick={saveSettings} className="px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-700 flex items-center gap-2">
                            <Save size={14}/> {t.common.save}
                        </button>
                    </div>
                </div>
            )}

            {/* Input Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit mb-4">
                <button
                    onClick={() => setInputMode('url')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === 'url' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Link size={14}/> URL (Auto-Parse ID)
                </button>
                <button
                    onClick={() => setInputMode('text')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${inputMode === 'text' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ClipboardPaste size={14}/> Paste Text
                </button>
            </div>

            {/* URL Input */}
            {inputMode === 'url' ? (
                <div className="flex gap-2 mb-6 animate-in fade-in">
                    <div className="relative flex-1">
                        <Link size={16} className="absolute left-3 top-3.5 text-slate-400"/>
                        <input 
                            type="text" 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder={t.tracker.urlPlaceholder}
                            className="w-full pl-10 p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                        />
                    </div>
                    <button 
                        onClick={handleFetch}
                        disabled={status === ProcessingStatus.PROCESSING || !url}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-md transition-all active:scale-95"
                    >
                        {status === ProcessingStatus.PROCESSING ? <RefreshCw className="animate-spin" size={18}/> : <Database size={18}/>}
                        <span>{zohoToken ? "Fetch (API)" : "Extract ID"}</span>
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-2 mb-6 animate-in fade-in">
                    <div className="relative">
                        <FileEdit size={16} className="absolute left-3 top-3 text-slate-400"/>
                        <textarea 
                            value={manualText}
                            onChange={(e) => setManualText(e.target.value)}
                            placeholder="Press Ctrl+A then Ctrl+C on your Zoho page, and paste here..."
                            rows={4}
                            className="w-full pl-10 p-3 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none shadow-sm resize-y"
                        />
                    </div>
                    <button 
                        onClick={handleFetch}
                        disabled={status === ProcessingStatus.PROCESSING || !manualText}
                        className="self-end bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-md transition-all active:scale-95"
                    >
                        {status === ProcessingStatus.PROCESSING ? <RefreshCw className="animate-spin" size={18}/> : <Briefcase size={18}/>}
                        <span>Analyze Text</span>
                    </button>
                </div>
            )}

            {/* Smart Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Briefcase size={12}/> {t.tracker.accountNum} (ID)
                    </label>
                    <input 
                        type="text" 
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="e.g. 4412..."
                        className={`w-full p-2.5 border rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none ${accountNumber ? 'border-green-400 bg-green-50' : 'border-slate-300'}`}
                    />
                </div>

                <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <User size={12}/> {t.tracker.owner} (Main)
                    </label>
                    <input 
                        type="text" 
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        list="owners-list"
                        placeholder="Account Setup Owner"
                        className="w-full p-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Users size={12}/> Sales Owner
                    </label>
                    <input 
                        type="text" 
                        value={salesOwner}
                        onChange={(e) => setSalesOwner(e.target.value)}
                        list="owners-list"
                        className="w-full p-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <UserCheck size={12}/> CSM Owner
                    </label>
                    <input 
                        type="text" 
                        value={csmOwner}
                        onChange={(e) => setCsmOwner(e.target.value)}
                        list="owners-list"
                        className="w-full p-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {/* Full Width Note */}
                <div className="space-y-1 md:col-span-2 lg:col-span-4 mt-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <FileText size={12}/> {t.tracker.note}
                    </label>
                    <input 
                        type="text" 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <datalist id="owners-list">
                    {savedOwners.map(o => <option key={o} value={o}/>)}
                </datalist>
            </div>

            <button 
                onClick={handleAddRow}
                disabled={!accountNumber}
                className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                <Plus size={20}/> {t.tracker.add}
            </button>
        </div>

        {/* Bottom: List Area */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h4 className="font-bold text-slate-700 flex items-center gap-2">
                    <Briefcase size={16}/> {t.tracker.list} ({rows.length})
                </h4>
                {rows.length > 0 && (
                    <button 
                        onClick={handleExport}
                        className="text-xs bg-white border border-green-200 text-green-700 px-3 py-1.5 rounded font-bold hover:bg-green-50 flex items-center gap-1 transition-colors"
                    >
                        <Download size={14}/> {t.common.export} Excel
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 shadow-sm">
                        <tr>
                            <th className="p-3 border-b">{t.tracker.date}</th>
                            <th className="p-3 border-b">ID / No.</th>
                            <th className="p-3 border-b">Main Owner</th>
                            <th className="p-3 border-b">Sales</th>
                            <th className="p-3 border-b">CSM</th>
                            <th className="p-3 border-b">{t.tracker.note}</th>
                            <th className="p-3 border-b text-center">{t.common.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-10 text-center text-slate-400">
                                    <div className="flex flex-col items-center">
                                        <Link size={32} className="mb-2 opacity-50"/>
                                        <p>{t.common.noData}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-3 text-slate-500 text-xs whitespace-nowrap">{row.date}</td>
                                    <td className="p-3 font-mono font-bold text-slate-700">{row.accountNumber}</td>
                                    <td className="p-3 text-xs">{row.owner}</td>
                                    <td className="p-3 text-xs text-slate-600">{row.salesOwner}</td>
                                    <td className="p-3 text-xs text-slate-600">{row.csmOwner}</td>
                                    <td className="p-3 text-slate-600 truncate max-w-[200px]" title={row.note}>{row.note}</td>
                                    <td className="p-3 text-center flex justify-center gap-2">
                                        {row.sourceUrl && row.sourceUrl !== 'Manual Entry' && (
                                            <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="p-1 text-blue-400 hover:text-blue-600">
                                                <ExternalLink size={16}/>
                                            </a>
                                        )}
                                        <button onClick={() => handleDeleteRow(row.id)} className="p-1 text-slate-300 hover:text-red-500">
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

    </div>
  );
};

export default LinkTrackerTab;
