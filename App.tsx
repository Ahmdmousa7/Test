
import React, { useState, useEffect, useRef } from 'react';
import { FileData, LogEntry } from './types';
import { readExcelFile, fetchGoogleSheet } from './services/excelService';
import { getStoredApiKeys, setStoredApiKeys, verifyGeminiKey, verifyGroqKey } from './services/geminiService';
import { TRANSLATIONS, Language } from './utils/translations';
import LogViewer from './components/LogViewer';
import { useVoiceControl } from './hooks/useVoiceControl';

// ... tool imports ...
import HomeTab from './components/HomeTab';
import TranslateTab from './components/TranslateTab';
import DuplicatesTab from './components/DuplicatesTab';
import CompositeTab from './components/CompositeTab';
import SallaTab from './components/SallaTab';
import ZidTab from './components/ZidTab';
import VariableBalanceTab from './components/VariableBalanceTab';
import MergeImagesTab from './components/MergeImagesTab';
import PdfToolsTab from './components/PdfToolsTab';
import ImageToPdfTab from './components/ImageToPdfTab';
import ImageCompressorTab from './components/ImageCompressorTab';
import QrCodeTab from './components/QrCodeTab';
import CsvConverterTab from './components/CsvConverterTab';
import PacksTab from './components/PacksTab';
import WebScraperTab from './components/WebScraperTab';
import OcrTab from './components/OcrTab';
import QcCheckTab from './components/QcCheckTab';
import SupportChat from './components/SupportChat';
import { 
  FileSpreadsheet, Layers, Copy, ShoppingCart, UploadCloud, Key, X, Check, ShieldPlus, 
  Image as ImageIcon, Scissors, FileImage, Zap, QrCode, FileText, RefreshCw, AlertTriangle, 
  Package, Globe, ScanText, ChevronRight, Hexagon, Palette, ChevronLeft, Info, HelpCircle, RotateCcw,
  Languages, PanelBottomOpen, PanelBottomClose, Terminal, Store, Network, ClipboardCheck, Workflow, Link as LinkIcon, ArrowRight, UserPlus, LogOut, Lock, LayoutDashboard, Settings, Home, Mic, MicOff, MousePointerClick
} from 'lucide-react';

declare var google: any;

// --- THEME DEFINITIONS ---
const THEMES = {
  light: {
    name: 'Modern Light',
    colors: {
      '--sidebar-bg': '#ffffff',
      '--sidebar-border': '#e2e8f0',
      '--sidebar-text': '#475569',
      '--sidebar-hover': '#f1f5f9',
      '--sidebar-active-bg': '#eff6ff',
      '--sidebar-active-text': '#2563eb', 
      '--sidebar-icon': '#94a3b8',
      '--sidebar-icon-active': '#2563eb',
      '--logo-bg': '#2563eb',
      '--logo-text': '#ffffff',
    }
  },
  dark: {
    name: 'Midnight',
    colors: {
      '--sidebar-bg': '#0f172a',
      '--sidebar-border': '#1e293b',
      '--sidebar-text': '#94a3b8',
      '--sidebar-hover': '#1e293b',
      '--sidebar-active-bg': '#2563eb',
      '--sidebar-active-text': '#ffffff',
      '--sidebar-icon': '#64748b',
      '--sidebar-icon-active': '#ffffff',
      '--logo-bg': '#3b82f6',
      '--logo-text': '#ffffff',
    }
  },
  forest: {
    name: 'Forest Pro',
    colors: {
      '--sidebar-bg': '#064e3b',
      '--sidebar-border': '#065f46',
      '--sidebar-text': '#a7f3d0',
      '--sidebar-hover': '#065f46',
      '--sidebar-active-bg': '#10b981',
      '--sidebar-active-text': '#ffffff',
      '--sidebar-icon': '#6ee7b7',
      '--sidebar-icon-active': '#ffffff',
      '--logo-bg': '#34d399',
      '--logo-text': '#064e3b',
    }
  }
};

type ThemeKey = keyof typeof THEMES;

const DEFAULT_GOOGLE_CLIENT_ID = "204867991878-fuucosuoei7mpqhp8m4qre8n9ej3vj7n.apps.googleusercontent.com";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(-1); // Default to Home (-1)
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Theme & Language State
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('light');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [language, setLanguage] = useState<Language>('en');

  // API Key State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [googleClientId, setGoogleClientId] = useState(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('google_client_id') || DEFAULT_GOOGLE_CLIENT_ID;
      }
      return DEFAULT_GOOGLE_CLIENT_ID;
  });
  const [keySaved, setKeySaved] = useState(false);

  // Google Sheets Import State
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [isImportingGSheet, setIsImportingGSheet] = useState(false);

  // Recent Files
  const [recentFiles, setRecentFiles] = useState<{name: string, date: string, type: 'local'|'gsheet', url?: string}[]>([]);

  // Test State
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'valid' | 'invalid' | 'quota'>('idle');
  const [testingGroq, setTestingGroq] = useState(false);
  const [groqStatus, setGroqStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const [resetKey, setResetKey] = useState(0);

  const keyCount = geminiKey.split(/[\n,]+/).filter(k => k.trim().length > 0).length;
  const t = TRANSLATIONS[language]; 

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Load Keys
    const stored = getStoredApiKeys();
    if (stored.gemini) {
      setGeminiKey(stored.gemini);
      setGroqKey(stored.groq);
    }
    
    if (!localStorage.getItem('google_client_id')) {
        localStorage.setItem('google_client_id', DEFAULT_GOOGLE_CLIENT_ID);
        setGoogleClientId(DEFAULT_GOOGLE_CLIENT_ID);
    }

    if (!stored.gemini) {
      setShowKeyModal(true);
    }

    // 2. Load UI Prefs
    const savedTheme = localStorage.getItem('app_theme') as ThemeKey;
    if (savedTheme && THEMES[savedTheme]) {
      setCurrentTheme(savedTheme);
    }
    const savedLang = localStorage.getItem('app_lang') as Language;
    if (savedLang) setLanguage(savedLang);

    // 3. Load Recent Files
    const storedRecents = localStorage.getItem('recent_files');
    if (storedRecents) {
       try { setRecentFiles(JSON.parse(storedRecents)); } catch(e){}
    }
  }, []);

  // --- THEME APPLICATOR ---
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEMES[currentTheme].colors;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, String(value));
    });
    localStorage.setItem('app_theme', currentTheme);
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
    root.lang = language;
    localStorage.setItem('app_lang', language);
  }, [currentTheme, language]);

  // --- VOICE CONTROL ---
  const handleVoiceCommand = (cmd: string, transcript: string) => {
     addLog(`Voice: "${transcript}" -> Command: ${cmd}`, 'info');
     
     if (cmd === 'home') setActiveTab(-1);
     else if (cmd === 'translator') setActiveTab(0);
     else if (cmd === 'duplicates') setActiveTab(1);
     else if (cmd === 'salla') setActiveTab(5);
     else if (cmd === 'zid') setActiveTab(13);
     else if (cmd === 'reset') handleReset();
     else if (cmd === 'toggle_logs') setShowLogs(prev => !prev);
     else if (cmd === 'start') {
        // Trigger Primary Button in active tab
        const primaryBtn = document.querySelector('button[data-action="primary"]') as HTMLButtonElement;
        if (primaryBtn) {
           primaryBtn.click();
           addLog("Voice Command: Starting process...", 'success');
        } else {
           addLog("Voice Command: No start button found in this tab.", 'warning');
        }
     }
  };

  const { isListening, toggleListening, isSupported } = useVoiceControl({ onCommand: handleVoiceCommand });

  // --- APP LOGIC ---

  const addToRecentFiles = (name: string, type: 'local'|'gsheet', url?: string) => {
     const newEntry = {
        name,
        type,
        url,
        date: new Date().toLocaleDateString()
     };
     const updated = [newEntry, ...recentFiles.filter(f => f.name !== name || f.type !== type)].slice(0, 5);
     setRecentFiles(updated);
     localStorage.setItem('recent_files', JSON.stringify(updated));
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  const handleTestGemini = async () => {
    if (!geminiKey) return;
    setTestingGemini(true);
    setGeminiStatus('idle');
    const result = await verifyGeminiKey(geminiKey);
    setTestingGemini(false);
    setGeminiStatus(result);
  };

  const handleTestGroq = async () => {
    if (!groqKey) return;
    setTestingGroq(true);
    setGroqStatus('idle');
    const isValid = await verifyGroqKey(groqKey);
    setTestingGroq(false);
    setGroqStatus(isValid ? 'valid' : 'invalid');
  };

  const handleSaveKey = () => {
    setStoredApiKeys(geminiKey, groqKey);
    localStorage.setItem('google_client_id', googleClientId);
    
    setKeySaved(true);
    setTimeout(() => {
      setKeySaved(false);
      setShowKeyModal(false);
    }, 1000);
    
    let msg = t.actions.saved;
    addLog(msg, 'success');
  };

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const handleReset = () => {
    setFileData(null);
    setGsheetUrl('');
    setLogs([]);
    setResetKey(prev => prev + 1); 
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      addLog(`${t.actions.uploadFile}: ${file.name}...`, 'info');
      const data = await readExcelFile(file);
      setFileData(data);
      addToRecentFiles(file.name, 'local');
      addLog(`${t.system.fileLoaded}. ${t.system.sheets}: ${data.sheets.join(', ')}`, 'success');
    } catch (error: any) {
      addLog(`Error loading file: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleGSheetLoad = async (url: string) => {
      setGsheetUrl(url);
      handleGSheetImport(url);
  };

  const handleGSheetImport = async (targetUrl?: string) => {
    const finalUrl = targetUrl || gsheetUrl;
    if (!finalUrl.trim()) return;
    
    setIsImportingGSheet(true);
    addLog(`Fetching Google Sheet...`, 'info');
    try {
        const data = await fetchGoogleSheet(finalUrl);
        setFileData(data);
        addToRecentFiles(data.name, 'gsheet', finalUrl);
        setGsheetUrl(''); 
        addLog(`${t.system.fileLoaded}: ${data.name}`, 'success');
    } catch (error: any) {
        addLog(`Import Error: ${error.message}`, 'error');
    } finally {
        setIsImportingGSheet(false);
    }
  };

  const tabs = [
    { id: -1, title: 'Home', icon: <Home size={18} />, description: 'Dashboard', instructions: '', component: <HomeTab onNavigate={setActiveTab} recentFiles={recentFiles} onLoadGSheet={handleGSheetLoad} fileData={fileData} /> },
    { id: 0, title: t.tabs.translator, icon: <Layers size={18} />, description: t.toolInfo.translator.desc, instructions: t.toolInfo.translator.instr, component: <TranslateTab fileData={fileData} addLog={addLog} keyCount={keyCount} onReset={handleReset} googleClientId={googleClientId} /> },
    { id: 1, title: t.tabs.duplicates, icon: <Copy size={18} />, description: t.toolInfo.duplicates.desc, instructions: t.toolInfo.duplicates.instr, component: <DuplicatesTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 15, title: t.tabs.qc, icon: <ClipboardCheck size={18} />, description: t.toolInfo.qc.desc, instructions: t.toolInfo.qc.instr, component: <QcCheckTab addLog={addLog} onReset={handleReset} /> },
    { id: 2, title: t.tabs.packs, icon: <Package size={18} />, description: t.toolInfo.packs.desc, instructions: t.toolInfo.packs.instr, component: <PacksTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 14, title: t.tabs.balance, icon: <Network size={18} />, description: t.toolInfo.balance.desc, instructions: t.toolInfo.balance.instr, component: <VariableBalanceTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 5, title: t.tabs.salla, icon: <ShoppingCart size={18} />, description: t.toolInfo.salla.desc, instructions: t.toolInfo.salla.instr, component: <SallaTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 13, title: t.tabs.zid, icon: <Store size={18} />, description: t.toolInfo.zid.desc, instructions: t.toolInfo.zid.instr, component: <ZidTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 4, title: t.tabs.composite, icon: <FileSpreadsheet size={18} />, description: t.toolInfo.composite.desc, instructions: t.toolInfo.composite.instr, component: <CompositeTab fileData={fileData} addLog={addLog} onReset={handleReset} /> },
    { id: 11, title: t.tabs.csv, icon: <FileText size={18} />, description: t.toolInfo.csv.desc, instructions: t.toolInfo.csv.instr, component: <CsvConverterTab addLog={addLog} onReset={handleReset} /> },
    { id: 12, title: t.tabs.ocr, icon: <ScanText size={18} />, description: t.toolInfo.ocr.desc, instructions: t.toolInfo.ocr.instr, component: <OcrTab addLog={addLog} onReset={handleReset} /> },
    { id: 3, title: t.tabs.scraper, icon: <Globe size={18} />, description: t.toolInfo.scraper.desc, instructions: t.toolInfo.scraper.instr, component: <WebScraperTab addLog={addLog} onReset={handleReset} /> },
    { id: 7, title: t.tabs.pdfTools, icon: <Scissors size={18} />, description: t.toolInfo.pdfTools.desc, instructions: t.toolInfo.pdfTools.instr, component: <PdfToolsTab addLog={addLog} onReset={handleReset} /> },
    { id: 8, title: t.tabs.imgPdf, icon: <FileImage size={18} />, description: t.toolInfo.imgPdf.desc, instructions: t.toolInfo.imgPdf.instr, component: <ImageToPdfTab addLog={addLog} onReset={handleReset} /> },
    { id: 6, title: t.tabs.mergeImg, icon: <ImageIcon size={18} />, description: t.toolInfo.mergeImg.desc, instructions: t.toolInfo.mergeImg.instr, component: <MergeImagesTab addLog={addLog} onReset={handleReset} /> },
    { id: 9, title: t.tabs.compressor, icon: <Zap size={18} />, description: t.toolInfo.compressor.desc, instructions: t.toolInfo.compressor.instr, component: <ImageCompressorTab addLog={addLog} onReset={handleReset} /> },
    { id: 10, title: t.tabs.qr, icon: <QrCode size={18} />, description: t.toolInfo.qr.desc, instructions: t.toolInfo.qr.instr, component: <QrCodeTab addLog={addLog} onReset={handleReset} /> },
  ];

  const menuGroups = [
    { title: 'Dashboard', items: [-1] },
    { title: t.menu.excelTools, items: [0, 1, 15, 2, 14, 5, 13, 4, 11] },
    { title: t.menu.aiTools, items: [12, 3] },
    { title: t.menu.mediaTools, items: [7, 8, 6, 9] },
    { title: t.menu.utils, items: [10] }
  ];

  const activeTabObj = tabs.find(t => t.id === activeTab);
  const isExcelTool = [0, 1, 2, 4, 5, 11, 13, 14, 15].includes(activeTab);

  // --- RENDER: MAIN APP (No Login Gate) ---
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ... Sidebar and Header (unchanged logic) ... */}
      <aside 
        className={`flex flex-col shrink-0 transition-all duration-300 z-20 shadow-sm border-e ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}
        style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)', color: 'var(--sidebar-text)' }}
      >
         {/* Logo Area */}
         <div className={`h-16 flex items-center border-b relative ${isSidebarCollapsed ? 'justify-center px-0' : 'px-6'}`} style={{ borderColor: 'var(--sidebar-border)' }}>
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight" style={{ color: currentTheme === 'light' ? '#334155' : 'white' }}>
               <div className="p-1.5 rounded-sm" style={{ backgroundColor: 'var(--logo-bg)' }}>
                  <Hexagon size={20} fill="currentColor" style={{ color: 'var(--logo-text)' }} />
               </div>
               {!isSidebarCollapsed && <span>{t.appTitle}</span>}
            </div>
            
            <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className={`absolute top-1/2 transform -translate-y-1/2 bg-white border border-slate-200 rounded-full p-1 shadow-sm text-slate-500 hover:text-blue-600 z-50 hidden md:flex ${language === 'ar' ? '-left-3' : '-right-3'}`}>
               <ChevronLeft size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? (language === 'ar' ? 'rotate-0' : 'rotate-180') : (language === 'ar' ? 'rotate-180' : 'rotate-0')}`} />
            </button>
         </div>

         {/* Navigation */}
         <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6 custom-scrollbar overflow-x-hidden">
            {menuGroups.map((group, idx) => (
               <div key={idx}>
                  {!isSidebarCollapsed && <h3 className="px-3 text-[10px] font-bold uppercase tracking-wider mb-2 opacity-60 animate-in fade-in duration-300">{group.title}</h3>}
                  {isSidebarCollapsed && <div className="h-px bg-slate-200/10 mx-2 mb-2"></div>}
                  <div className="space-y-0.5">
                     {group.items.map(itemId => {
                        const item = tabs.find(t => t.id === itemId);
                        if (!item) return null;
                        const isActive = activeTab === itemId;
                        return (
                           <button
                              key={itemId}
                              onClick={() => setActiveTab(itemId)}
                              title={isSidebarCollapsed ? item.title : ''}
                              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-sm text-sm font-medium transition-all duration-100 group border border-transparent`}
                              style={{ backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent', color: isActive ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)', borderColor: isActive ? 'var(--sidebar-border)' : 'transparent' }}
                              onMouseEnter={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'; }}
                              onMouseLeave={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                           >
                              <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                 <span style={{ color: isActive ? 'var(--sidebar-icon-active)' : 'var(--sidebar-icon)' }}>{item.icon}</span>
                                 {!isSidebarCollapsed && <span>{item.title}</span>}
                              </div>
                              {!isSidebarCollapsed && isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>}
                           </button>
                        );
                     })}
                  </div>
               </div>
            ))}
         </nav>

         {/* Bottom Action (Theme & Config) */}
         <div className="p-4 border-t space-y-3" style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}>
            
            <div className="relative">
               <button onClick={() => setShowThemeMenu(!showThemeMenu)} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-sm text-xs font-medium border transition-colors hover:bg-slate-50`} style={{ borderColor: 'var(--sidebar-border)', color: 'var(--sidebar-text)' }}>
                  <div className="flex items-center gap-2"><Palette size={14} />{!isSidebarCollapsed && <span>{t.theme[currentTheme as keyof typeof t.theme] || THEMES[currentTheme].name}</span>}</div>
                  {!isSidebarCollapsed && <ChevronRight size={12} className={`transition-transform ${showThemeMenu ? '-rotate-90' : ''} ${language === 'ar' ? 'rotate-180' : ''}`} />}
               </button>
               {showThemeMenu && (
                  <div className="absolute bottom-full start-0 w-full mb-2 bg-white rounded-sm shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-2 z-50 min-w-[200px]">
                     {Object.entries(THEMES).map(([key, theme]) => (
                        <button key={key} onClick={() => { setCurrentTheme(key as ThemeKey); setShowThemeMenu(false); }} className="w-full text-start px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: theme.colors['--sidebar-bg'] }}></div>
                           {t.theme[key as keyof typeof t.theme] || theme.name}
                           {currentTheme === key && <Check size={12} className="ms-auto text-green-600"/>}
                        </button>
                     ))}
                  </div>
               )}
            </div>
            <button onClick={toggleLanguage} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-sm text-xs font-medium border transition-colors hover:bg-slate-50`} style={{ borderColor: 'var(--sidebar-border)', color: 'var(--sidebar-text)' }}>
                <div className="flex items-center gap-2"><Languages size={14} />{!isSidebarCollapsed && <span>{language === 'en' ? 'English' : 'العربية'}</span>}</div>
            </button>
            <button onClick={() => setShowKeyModal(true)} className={`flex w-full h-10 ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-center px-4'} items-center gap-1 rounded-sm bg-primary-600 hover:bg-primary-700 text-white text-base font-medium shadow-sm transition-colors`} title="Configure API Keys">
               <Key size={16} />{!isSidebarCollapsed && <span>{t.actions.configureKey}</span>}{(keyCount > 0 || groqKey) && (<div className={`w-2 h-2 bg-green-400 rounded-full border border-primary-600 ${isSidebarCollapsed ? 'absolute top-1 end-1' : 'ms-1'}`}></div>)}
            </button>
         </div>
      </aside>

      {/* Main Content (same as previous) */}
      <div className="flex-1 flex flex-col min-w-0">
         <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 text-lg font-bold text-slate-800">{activeTabObj?.icon}<span>{activeTabObj?.title}</span></div>
               {activeTabObj && activeTab !== -1 && (
                  <div className="group relative flex items-center">
                     <Info size={16} className="text-slate-400 hover:text-blue-600 cursor-help transition-colors" />
                     <div className="absolute top-full mt-3 w-72 sm:w-80 p-4 bg-slate-800 text-white text-xs rounded-xl shadow-2xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] pointer-events-none group-hover:pointer-events-auto transform translate-y-2 group-hover:translate-y-0 start-0">
                        <div className="absolute -top-1.5 w-3 h-3 bg-slate-800 border-t border-l border-slate-700 transform rotate-45 start-4"></div>
                        <h4 className="font-bold mb-1 text-sm flex items-center gap-2">{activeTabObj.icon} {activeTabObj.title}</h4>
                        <p className="text-slate-300 mb-2 leading-relaxed">{activeTabObj.description}</p>
                        <div className="bg-slate-700/50 p-2 rounded border border-slate-600">
                           <p className="font-semibold text-blue-200 mb-1 flex items-center gap-1"><HelpCircle size={10}/> {t.common.instructions}</p>
                           <p className="text-slate-300 leading-tight">{activeTabObj.instructions}</p>
                        </div>
                     </div>
                  </div>
               )}
            </div>
            <div className="flex items-center gap-3">
               
               {/* Voice Control Indicator */}
               {isSupported && (
                  <button 
                    onClick={toggleListening}
                    className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    title="Voice Control"
                  >
                    {isListening ? <Mic size={18} /> : <MicOff size={18} />}
                  </button>
               )}

               {fileData && isExcelTool && (
                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-sm border border-green-200 text-xs font-medium animate-in fade-in">
                     <FileSpreadsheet size={14} />
                     <span className="truncate max-w-[150px]">{fileData.name}</span>
                     <button onClick={handleReset} className="ms-1 hover:text-green-900"><X size={12}/></button>
                  </div>
               )}
               <button onClick={handleReset} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all active:scale-95" title={t.actions.reset}><RotateCcw size={18} /></button>
               <div className="h-6 w-px bg-slate-200 mx-1"></div>
               <button onClick={() => setShowLogs(!showLogs)} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold transition-colors border ${showLogs ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-transparent hover:bg-slate-50'}`}>
                  {showLogs ? <PanelBottomOpen size={16} /> : <PanelBottomClose size={16} />}<span className="hidden sm:inline">{showLogs ? t.actions.hideLogs : t.actions.showLogs}</span>
               </button>
            </div>
         </header>

         <main className="flex-1 overflow-y-auto p-6 relative scroll-smooth bg-slate-50/50">
            <div className="max-w-7xl mx-auto space-y-6">
               {isExcelTool && activeTab !== -1 && (
                  <div className={`bg-white rounded-sm shadow-sm border border-slate-200 p-6 transition-all duration-300 ${fileData ? 'border-s-4 border-s-green-500' : ''}`}>
                     {!fileData ? (
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                           <div className="flex-1 w-full">
                              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><FileSpreadsheet size={16}/> {t.actions.uploadFile}</label>
                              <label className="flex flex-col h-28 px-4 justify-center items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-slate-50 cursor-pointer transition-all text-slate-500 hover:text-blue-600 bg-slate-50/50">
                                 <UploadCloud size={28} /><div className="text-center"><span className="font-bold text-sm block">Click to Upload Excel / CSV</span><span className="text-xs opacity-70">Drag & Drop supported</span></div>
                                 <input key={resetKey} type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" id="home-upload-trigger" />
                              </label>
                           </div>
                           <div className="hidden md:flex items-center justify-center h-28">
                              <div className="h-full w-px bg-slate-200 relative"><span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-slate-400 font-bold">OR</span></div>
                           </div>
                           <div className="flex-1 w-full">
                              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><LinkIcon size={16}/> Import Google Sheet</label>
                              <div className="flex gap-2 h-12">
                                 <div className="relative flex-1">
                                    <input type="text" value={gsheetUrl} onChange={e => setGsheetUrl(e.target.value)} placeholder="Paste public Google Sheet link..." className="w-full h-full pl-3 pr-3 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 transition-all font-mono" />
                                 </div>
                                 <button onClick={() => handleGSheetImport()} disabled={isImportingGSheet || !gsheetUrl} className="h-full px-5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-2 transition-all shadow-sm">
                                    {isImportingGSheet ? <RefreshCw className="animate-spin" size={18}/> : <ArrowRight size={18}/>}<span className="hidden lg:inline">Load</span>
                                 </button>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><Info size={10}/> Ensure sheet is "Anyone with link" or "Published"</p>
                           </div>
                        </div>
                     ) : (
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="bg-green-100 p-3 rounded-full text-green-600 border border-green-200"><FileSpreadsheet size={24} /></div>
                              <div>
                                 <h3 className="text-lg font-bold text-slate-800">{fileData.name}</h3>
                                 <p className="text-xs text-slate-500 font-medium flex items-center gap-2"><span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">{fileData.sheets.length} Sheets</span><span>Ready for processing</span></p>
                              </div>
                           </div>
                           <button onClick={handleReset} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition-colors flex items-center gap-2 border border-red-100">
                              <X size={16} /><span>Remove File</span>
                           </button>
                        </div>
                     )}
                  </div>
               )}
               
               {/* Invisible input trigger for Home Tab 'Get Started' button */}
               <input key={`home-upload-${resetKey}`} type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" id="home-upload-trigger" />

               <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {activeTabObj?.component && React.cloneElement(activeTabObj.component as React.ReactElement<any>, { key: resetKey, language })}
               </div>
            </div>
         </main>

         {showLogs && (
            <div className="h-64 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex flex-col shrink-0 transition-all duration-300 animate-in slide-in-from-bottom-10">
               <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2 text-slate-600"><Terminal size={14} /><span className="text-[10px] font-bold uppercase tracking-wider">{t.system.logs}</span></div>
                  <button onClick={() => setLogs([])} className="text-[10px] text-slate-400 hover:text-red-500 hover:underline">{t.actions.clearHistory}</button>
               </div>
               <div className="flex-1 overflow-hidden relative">
                  <div className="absolute inset-0"><LogViewer logs={logs} onClear={() => setLogs([])} /></div>
               </div>
            </div>
         )}
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">{t.actions.configureKey}</h3>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            {/* GEMINI SECTION */}
            <div className="mb-6 border-b border-slate-100 pb-6">
                <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                    <div className="flex items-center gap-2">
                      <span>Google Gemini Keys</span>
                      {geminiStatus === 'valid' && <span className="px-2 py-0.5 rounded-sm bg-green-100 text-green-700 text-[10px] border border-green-200 flex items-center gap-1"><Check size={10} /> {t.actions.valid}</span>}
                      {geminiStatus === 'invalid' && <span className="px-2 py-0.5 rounded-sm bg-red-100 text-red-700 text-[10px] border border-red-200 flex items-center gap-1"><X size={10} /> {t.actions.invalid}</span>}
                      {geminiStatus === 'quota' && <span className="px-2 py-0.5 rounded-sm bg-amber-100 text-amber-700 text-[10px] border border-amber-200 flex items-center gap-1"><AlertTriangle size={10} /> {t.actions.quota}</span>}
                    </div>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary-600 hover:underline text-[10px]">{t.actions.getGemini}</a>
                </label>
                <textarea value={geminiKey} onChange={(e) => { setGeminiKey(e.target.value); setGeminiStatus('idle'); }} placeholder="Paste Gemini keys here (one per line for rotation)" rows={3} className={`w-full p-3 border rounded-sm font-mono text-xs focus:ring-1 outline-none mb-2 transition-colors resize-none text-slate-900 placeholder-slate-400 ${geminiStatus === 'valid' ? 'border-green-400 bg-green-50 focus:ring-green-200' : geminiStatus === 'invalid' ? 'border-red-400 bg-red-50 focus:ring-red-200' : geminiStatus === 'quota' ? 'border-amber-400 bg-amber-50 focus:ring-amber-200' : 'border-slate-300 bg-slate-50 focus:ring-primary-500'}`} />
                <div className="flex justify-between items-start">
                   <div className="bg-blue-50 border border-blue-100 p-2 rounded-sm flex items-start space-x-2 flex-1 me-2"><ShieldPlus size={14} className="text-primary-600 mt-0.5 shrink-0" /><div className="text-[10px] text-primary-800 leading-tight">{t.actions.autoRotate}</div></div>
                   <button onClick={handleTestGemini} disabled={!geminiKey || testingGemini} className="flex items-center space-x-1 px-3 py-2 rounded-sm text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">{testingGemini ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}<span>{t.actions.test}</span></button>
                </div>
            </div>

            {/* GOOGLE SHEETS SYNC SECTION */}
            <div className="mb-6 border-b border-slate-100 pb-6">
                <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1"><UserPlus size={14} className="text-green-600"/> Google Client ID (For Sheet Sync)</span>
                    </div>
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px]">Create ID</a>
                </label>
                <div className="flex space-x-2">
                   <input type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="123...apps.googleusercontent.com" className="flex-1 p-2.5 border border-slate-300 bg-slate-50 rounded-sm font-mono text-xs focus:ring-1 focus:ring-green-500 outline-none transition-colors text-slate-900 placeholder-slate-400" />
                </div>
            </div>

            {/* GROQ SECTION */}
            <div className="mb-6">
                <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1"><Zap size={14} className="text-orange-500"/> Groq Key (Fallback)</span>
                      {groqStatus === 'valid' && <span className="px-2 py-0.5 rounded-sm bg-green-100 text-green-700 text-[10px] border border-green-200 flex items-center gap-1"><Check size={10} /> {t.actions.valid}</span>}
                    </div>
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-600 hover:underline text-[10px]">{t.actions.getGroq}</a>
                </label>
                <div className="flex space-x-2">
                   <input type="password" value={groqKey} onChange={(e) => { setGroqKey(e.target.value); setGroqStatus('idle'); }} placeholder="gsk_..." className="flex-1 p-2.5 border border-slate-300 bg-slate-50 rounded-sm font-mono text-xs focus:ring-1 focus:ring-orange-500 outline-none transition-colors text-slate-900 placeholder-slate-400" />
                   <button onClick={handleTestGroq} disabled={!groqKey || testingGroq} className="flex items-center justify-center space-x-1 px-3 rounded-sm text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors min-w-[60px]">{testingGroq ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}</button>
                </div>
            </div>

            <button onClick={handleSaveKey} className={`flex w-full h-10 px-4 justify-center items-center gap-1 rounded-sm text-white text-base font-medium shadow-sm transition-all transform active:scale-95 ${keySaved ? 'bg-green-600 hover:bg-green-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
              {keySaved ? <Check size={18} /> : <Key size={18} />}<span>{keySaved ? t.actions.saved : t.actions.saveKeys}</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Support Chat Widget */}
      <SupportChat language={language} fileData={fileData} />
    </div>
  );
};

export default App;
