
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileData, ProcessingStatus, LogEntry } from '../types';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { ShoppingBag, LayoutGrid, Layers, Settings2, Download, ArrowRight, Wand2, Map, Database, ExternalLink, Link, CheckCircle2, RefreshCw, Server, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface Props {
  fileData: FileData | null;
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

type ProductType = 'simple' | 'variable' | 'composite';

const RewaaTab: React.FC<Props> = ({ fileData, addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  
  const [productType, setProductType] = useState<ProductType>('simple');
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Mapping State: Key = Rewaa Field, Value = User Column Index
  const [mapping, setMapping] = useState<Record<string, number>>({});
  
  // Location Settings
  const [unifiedPricing, setUnifiedPricing] = useState<boolean>(true);
  const [branches, setBranches] = useState<string>('default');

  // Magic Link State
  const [magicLink, setMagicLink] = useState('');
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'warning'>('idle');

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  // Field Definitions based on Product Type AND Branches
  const getFields = () => {
    const branchList = branches.split(',').map(b => b.trim()).filter(b => b && b.toLowerCase() !== 'default');
    // If unified, we ignore branch list for fields. If not unified, we need at least one branch or 'default' placeholder
    const effectiveBranches = branchList.length > 0 ? branchList : ['Branch 1'];
    const isUnified = unifiedPricing;

    // Helper for dynamic price/tax/cost fields
    const getPricingFields = () => {
        if (isUnified) {
            return [
                { key: 'cost', label: t.rewaa.fields.cost },
                { key: 'price', label: t.rewaa.fields.price },
                { key: 'tax', label: t.rewaa.fields.tax },
            ];
        } else {
            const dynamic: {key: string, label: string}[] = [];
            effectiveBranches.forEach(branch => {
                dynamic.push(
                    { key: `cost_${branch}`, label: `${branch} - ${t.rewaa.fields.cost}` },
                    { key: `price_${branch}`, label: `${branch} - ${t.rewaa.fields.price}` },
                    { key: `tax_${branch}`, label: `${branch} - ${t.rewaa.fields.tax}` }
                );
            });
            return dynamic;
        }
    };

    const common = [
      { key: 'name', label: t.rewaa.fields.name },
      { key: 'sku', label: t.rewaa.fields.sku },
      { key: 'barcode', label: t.rewaa.fields.barcode },
      { key: 'category', label: t.rewaa.fields.category },
      { key: 'supplier', label: t.rewaa.fields.supplier },
      ...getPricingFields()
    ];

    if (productType === 'simple') return common;
    
    if (productType === 'variable') return [
      { key: 'parent_sku', label: t.rewaa.fields.parent },
      { key: 'name', label: t.rewaa.fields.varName },
      { key: 'sku', label: t.rewaa.fields.varSku },
      { key: 'barcode', label: t.rewaa.fields.barcode },
      { key: 'option1_name', label: t.rewaa.fields.opt1Name },
      { key: 'option1_value', label: t.rewaa.fields.opt1Val },
      ...getPricingFields()
    ];

    if (productType === 'composite') return [
      { key: 'composite_sku', label: t.rewaa.fields.compSku },
      { key: 'item_sku', label: t.rewaa.fields.itemSku },
      { key: 'qty', label: t.rewaa.fields.qty },
    ];

    return [];
  };

  useEffect(() => {
    if (fileData && fileData.sheets.length > 0) {
      if (!selectedSheet) setSelectedSheet(fileData.sheets[0]);
    }
  }, [fileData]);

  useEffect(() => {
    if (fileData && selectedSheet) {
      const data = getSheetData(fileData.workbook, selectedSheet, false);
      if (data.length > 0) {
        setHeaders(data[0] as string[]);
        setMapping({}); // Reset mapping on sheet change
      }
    }
  }, [fileData, selectedSheet]);

  const handleAutoMap = () => {
    const fields = getFields();
    const newMapping: Record<string, number> = {};
    
    fields.forEach(field => {
       // Simple fuzzy match
       const matchIdx = headers.findIndex(h => {
          const hLower = String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
          const fLower = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
          const kLower = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          return hLower.includes(kLower) || hLower.includes(fLower) || kLower.includes(hLower);
       });
       
       if (matchIdx !== -1) {
          newMapping[field.key] = matchIdx;
       }
    });
    
    setMapping(newMapping);
    addLog("Auto-mapped columns based on header names.", 'info');
  };

  const handleFetchRewaaData = async () => {
    if (!magicLink) {
        addLog("Please enter a Magic Link or Token first.", 'warning');
        return;
    }
    
    setIsFetchingInfo(true);
    addLog("Connecting to Rewaa platform internally...", 'info');

    try {
        let targetUrl = magicLink.trim();
        // If the user pasted just the token (e.g. jb20...), construct the full URL
        if (!targetUrl.startsWith('http')) {
            targetUrl = `https://platform.rewaatech.com/inventory/products/import-products/add?token=${targetUrl}`;
        }

        // Use CORS Proxy
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Failed to access platform (Status: ${response.status})`);
        }

        const htmlText = await response.text();
        
        // Parse HTML to find branch/location information
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        // Strategy 1: Look for <option> tags (SSR or static)
        const allOptions = Array.from(doc.querySelectorAll('option'))
            .map(opt => opt.textContent?.trim())
            .filter(text => text && text.length > 0 && !text.includes('Select') && !text.includes('Choose'));
            
        let uniqueBranches = Array.from(new Set(allOptions))
            .filter(b => b && b.length < 50);

        // Strategy 2: Look for JSON in scripts (CSR/SPA)
        if (uniqueBranches.length === 0) {
            // Regex to find "name":"BranchName" patterns commonly found in JSON payloads
            const scriptMatches = htmlText.match(/"name"\s*:\s*"([^"]+)"/g);
            if (scriptMatches) {
                const candidates = scriptMatches
                    .map(s => s.split(':')[1].replace(/"/g, '').trim())
                    .filter(s => s.length > 2 && !['id', 'key', 'value', 'label', 'english', 'arabic'].includes(s.toLowerCase()));
                
                // Heuristic: If we find 1-10 items, assume they might be branches
                if (candidates.length > 0 && candidates.length < 20) {
                    uniqueBranches = Array.from(new Set(candidates));
                }
            }
        }

        if (uniqueBranches.length > 0) {
            setBranches(uniqueBranches.join(', '));
            setUnifiedPricing(false); 
            setConnectionStatus('connected');
            addLog(`Success! Extracted locations: ${uniqueBranches.join(', ')}`, 'success');
        } else {
            // Soft Fallback: Connection OK, but no data parsed.
            setConnectionStatus('warning');
            setUnifiedPricing(false); // Enable input box
            addLog("Connected successfully, but branch names were not auto-detected. Please enter them below.", 'warning');
        }

    } catch (e: any) {
        console.error(e);
        addLog(`Connection Failed: ${e.message}`, 'error');
        setConnectionStatus('idle');
    } finally {
        setIsFetchingInfo(false);
    }
  };

  const handleDownloadTemplate = () => {
      try {
          const activeFields = getFields();
          const templateHeaders = activeFields.map(f => f.label);
          
          const newWb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
          
          // Auto-width columns
          ws['!cols'] = templateHeaders.map(() => ({ wch: 20 }));
          
          XLSX.utils.book_append_sheet(newWb, ws, "Rewaa Template");
          saveWorkbook(newWb, `Rewaa_Import_Template_${productType}_${Date.now()}.xlsx`);
          
          addLog("Template downloaded successfully.", 'success');
      } catch (e: any) {
          addLog(`Template Error: ${e.message}`, 'error');
      }
  };

  const handleProcess = async () => {
    if (!fileData || !selectedSheet) return;
    
    // Use dynamic fields
    const activeFields = getFields();
    
    // Validate mandatory mappings (basic check)
    // We check if ANY field is mapped, not necessarily all
    const mappedCount = Object.keys(mapping).length;
    if (mappedCount === 0) {
       addLog("Please map at least one column.", 'warning');
       return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      await new Promise(r => setTimeout(r, 100));
      
      const rawRows = getSheetData(fileData.workbook, selectedSheet, false).slice(1);
      
      // Generate Headers dynamically from field definitions
      const outputHeader = activeFields.map(f => f.label);
      const outputRows: any[][] = [outputHeader];

      for (let i = 0; i < rawRows.length; i++) {
         const row = rawRows[i];
         const newRow: any[] = [];
         
         // Map fields based on configuration
         activeFields.forEach(f => {
            const sourceIdx = mapping[f.key];
            let val = (sourceIdx !== undefined && sourceIdx !== -1) ? row[sourceIdx] : "";
            newRow.push(val);
         });

         outputRows.push(newRow);
         
         if (i % 500 === 0) {
            setProgress(Math.round((i / rawRows.length) * 90));
            await new Promise(r => setTimeout(r, 0));
         }
      }

      const newWb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(outputRows);
      XLSX.utils.book_append_sheet(newWb, ws, "Rewaa Import");
      
      saveWorkbook(newWb, `Rewaa_${productType}_Import.xlsx`);
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
       
       {/* Rewaa Connection Card (Internal Fetch) */}
       <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Server size={18} className="text-cyan-600"/> Rewaa Connection
             </h3>
             {connectionStatus === 'connected' && (
                 <span className="text-xs font-bold text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-100">
                    <CheckCircle2 size={12}/> Connected
                 </span>
             )}
             {connectionStatus === 'warning' && (
                 <span className="text-xs font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                    <AlertCircle size={12}/> Check Branches
                 </span>
             )}
          </div>
          <div className="p-5 space-y-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paste Magic Link / Token</label>
                <div className="flex flex-col md:flex-row gap-3">
                   <div className="flex flex-1 gap-2">
                       <input 
                          type="text" 
                          value={magicLink}
                          onChange={(e) => setMagicLink(e.target.value)}
                          placeholder="e.g. jb20... or full URL"
                          className="flex-1 p-2.5 border rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-cyan-500 outline-none font-mono"
                       />
                       <button 
                          onClick={handleFetchRewaaData}
                          disabled={isFetchingInfo || !magicLink}
                          className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2 transition-colors justify-center whitespace-nowrap"
                       >
                          {isFetchingInfo ? <RefreshCw size={18} className="animate-spin"/> : <Download size={18}/>}
                          <span>Get Data</span>
                       </button>
                   </div>
                   
                   {(connectionStatus === 'connected' || connectionStatus === 'warning') && (
                       <button 
                          onClick={handleDownloadTemplate}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 transition-colors justify-center whitespace-nowrap animate-in fade-in slide-in-from-left-2"
                       >
                          <FileSpreadsheet size={18} />
                          <span>Download Template</span>
                       </button>
                   )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                   1. Get Data (Fetches config). 2. Download Template (with correct columns). 3. Fill and Upload below.
                </p>
             </div>
          </div>
       </div>

       {/* Main Config */}
       <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-2 text-slate-800">
                 <div className="bg-cyan-100 p-2 rounded text-cyan-700">
                    <Database size={24} />
                 </div>
                 <h3 className="text-xl font-bold">{t.rewaa.title}</h3>
             </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             
             {/* Left: Settings */}
             <div className="space-y-4">
                
                {/* Product Type */}
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.rewaa.prodType}</label>
                   <div className="space-y-2">
                      <label className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors ${productType==='simple' ? 'bg-white border-cyan-500 shadow-sm' : 'border-transparent hover:bg-slate-100'}`}>
                         <input type="radio" checked={productType==='simple'} onChange={() => setProductType('simple')} className="text-cyan-600"/>
                         <span className="text-sm font-medium">{t.rewaa.simple}</span>
                      </label>
                      <label className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors ${productType==='variable' ? 'bg-white border-cyan-500 shadow-sm' : 'border-transparent hover:bg-slate-100'}`}>
                         <input type="radio" checked={productType==='variable'} onChange={() => setProductType('variable')} className="text-cyan-600"/>
                         <span className="text-sm font-medium">{t.rewaa.variable}</span>
                      </label>
                      <label className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors ${productType==='composite' ? 'bg-white border-cyan-500 shadow-sm' : 'border-transparent hover:bg-slate-100'}`}>
                         <input type="radio" checked={productType==='composite'} onChange={() => setProductType('composite')} className="text-cyan-600"/>
                         <span className="text-sm font-medium">{t.rewaa.composite}</span>
                      </label>
                   </div>
                </div>

                {/* Locations */}
                {productType !== 'composite' && (
                    <div className="bg-slate-50 p-3 rounded border border-slate-200">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                          <Map size={12}/> {t.rewaa.locations}
                       </label>
                       
                       <label className="flex items-start gap-2 mb-3 cursor-pointer">
                          <input type="checkbox" checked={unifiedPricing} onChange={e => setUnifiedPricing(e.target.checked)} className="mt-1 rounded text-cyan-600"/>
                          <span className="text-xs text-slate-700 leading-tight">{t.rewaa.unify}</span>
                       </label>

                       {!unifiedPricing && (
                          <div className="animate-in fade-in slide-in-from-top-1">
                             <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.rewaa.branches}</label>
                             <input 
                               type="text" 
                               value={branches}
                               onChange={e => setBranches(e.target.value)}
                               placeholder={t.rewaa.branchesPlace}
                               className="w-full p-2 text-xs border rounded"
                             />
                          </div>
                       )}
                    </div>
                )}

                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">{t.common.selectSheet}</label>
                   <select 
                      className="w-full p-2 border rounded text-sm bg-white"
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                   >
                      {fileData?.sheets.map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>

             </div>

             {/* Right: Mapping */}
             <div className="lg:col-span-2 flex flex-col h-full bg-slate-50 rounded border border-slate-200 overflow-hidden">
                <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center">
                   <h4 className="font-bold text-slate-700 flex items-center gap-2"><Map size={16}/> {t.rewaa.mapping}</h4>
                   <button 
                      onClick={handleAutoMap}
                      className="text-xs bg-cyan-50 text-cyan-700 px-2 py-1 rounded hover:bg-cyan-100 font-bold flex items-center gap-1 transition-colors"
                   >
                      <Wand2 size={12}/> {t.rewaa.autoMap}
                   </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                   <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase mb-1 px-2">
                      <div className="col-span-4">{t.rewaa.rewaaField}</div>
                      <div className="col-span-1 text-center"><ArrowRight size={12}/></div>
                      <div className="col-span-7">{t.rewaa.yourCol}</div>
                   </div>

                   {getFields().map((field) => (
                      <div key={field.key} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-slate-100 shadow-sm">
                         <div className="col-span-4 text-xs font-bold text-slate-700 flex items-center gap-2" title={field.label}>
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"></div>
                            <span className="truncate">{field.label}</span>
                         </div>
                         <div className="col-span-1 text-center text-slate-300"><ArrowRight size={14}/></div>
                         <div className="col-span-7">
                            <select 
                               className="w-full p-1.5 text-xs border rounded bg-slate-50 focus:ring-1 focus:ring-cyan-500 outline-none"
                               value={mapping[field.key] ?? -1}
                               onChange={(e) => setMapping(prev => ({...prev, [field.key]: Number(e.target.value)}))}
                            >
                               <option value="-1">-- {t.common.selectCols} --</option>
                               {headers.map((h, i) => (
                                  <option key={i} value={i}>{h || `Col ${i+1}`}</option>
                               ))}
                            </select>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

          </div>

          <button 
             onClick={handleProcess}
             disabled={status === ProcessingStatus.PROCESSING || !fileData}
             className="w-full mt-6 py-4 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
             {status === ProcessingStatus.PROCESSING ? <span className="animate-spin">⏳</span> : <Download size={20}/>}
             {t.rewaa.generate}
          </button>

          {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing} />}
       </div>

    </div>
  );
};

export default RewaaTab;
