
import React from 'react';
import { 
  Layers, Copy, ShoppingCart, Activity, FileSpreadsheet, 
  CheckCircle, AlertCircle, Clock, Zap, ArrowRight, Cloud, ScanText
} from 'lucide-react';
import { FileData } from '../types';

interface RecentFile {
  name: string;
  date: string;
  type: 'local' | 'gsheet';
  url?: string;
}

interface Props {
  onNavigate: (tabId: number) => void;
  recentFiles: RecentFile[];
  onLoadGSheet: (url: string) => void;
  fileData: FileData | null;
}

const HomeTab: React.FC<Props> = ({ onNavigate, recentFiles, onLoadGSheet, fileData }) => {
  
  const hasApiKey = !!localStorage.getItem('gemini_api_key');
  
  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Welcome to X-Tools</h1>
          <p className="text-blue-100 max-w-xl text-lg">
            Your all-in-one workspace for Excel automation, AI translation, and data processing.
          </p>
          {fileData ? (
             <div className="mt-6 flex items-center gap-3 bg-white/20 w-fit px-4 py-2 rounded-lg border border-white/10">
                <FileSpreadsheet size={20} className="text-green-300" />
                <span className="font-medium">Active File: {fileData.name}</span>
             </div>
          ) : (
             <button 
               onClick={() => document.getElementById('home-upload-trigger')?.click()}
               className="mt-6 bg-white text-blue-600 px-6 py-2.5 rounded-lg font-bold hover:bg-blue-50 transition-colors shadow-sm flex items-center gap-2"
             >
               <Zap size={18}/> Get Started
             </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Quick Actions */}
        <div className="md:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <Zap className="text-amber-500" size={20}/> Quick Tools
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <button onClick={() => onNavigate(0)} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group">
              <div className="bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center text-blue-600 mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Layers size={20}/>
              </div>
              <h4 className="font-bold text-slate-800">AI Translator</h4>
              <p className="text-xs text-slate-500 mt-1">Bulk translate columns</p>
            </button>

            <button onClick={() => onNavigate(1)} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-md transition-all text-left group">
              <div className="bg-purple-50 w-10 h-10 rounded-lg flex items-center justify-center text-purple-600 mb-3 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Copy size={20}/>
              </div>
              <h4 className="font-bold text-slate-800">Deduplicator</h4>
              <p className="text-xs text-slate-500 mt-1">Find & resolve duplicates</p>
            </button>

            <button onClick={() => onNavigate(5)} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-green-400 hover:shadow-md transition-all text-left group">
              <div className="bg-green-50 w-10 h-10 rounded-lg flex items-center justify-center text-green-600 mb-3 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <ShoppingCart size={20}/>
              </div>
              <h4 className="font-bold text-slate-800">Salla Organizer</h4>
              <p className="text-xs text-slate-500 mt-1">Split products sheets</p>
            </button>
          </div>

          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mt-8">
            <Activity className="text-blue-500" size={20}/> Recent Activity
          </h3>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {recentFiles.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Clock size={32} className="mx-auto mb-2 opacity-50"/>
                <p>No recent files processed.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentFiles.map((file, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`p-2 rounded-lg ${file.type === 'gsheet' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                        {file.type === 'gsheet' ? <Cloud size={18}/> : <FileSpreadsheet size={18}/>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-700 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">{file.date}</p>
                      </div>
                    </div>
                    {file.type === 'gsheet' && file.url ? (
                      <button 
                        onClick={() => onLoadGSheet(file.url!)}
                        className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                      >
                        Reload <ArrowRight size={12}/>
                      </button>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded">Local File</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Status Sidebar */}
        <div className="space-y-6">
           <div className="bg-white p-5 rounded-xl border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4">System Status</h3>
              <div className="space-y-3">
                 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-600">Gemini API</span>
                    {hasApiKey ? (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle size={12}/> Configured
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded flex items-center gap-1">
                        <AlertCircle size={12}/> Missing
                      </span>
                    )}
                 </div>
                 <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-600">Internet</span>
                    {navigator.onLine ? (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle size={12}/> Online
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded flex items-center gap-1">
                        <AlertCircle size={12}/> Offline
                      </span>
                    )}
                 </div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-xl text-white shadow-lg">
              <h4 className="font-bold mb-2 flex items-center gap-2"><Zap size={16} className="text-yellow-400"/> Pro Tip</h4>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Did you know? You can now use the <strong>OCR Extraction</strong> tool to convert PDF Invoices or Menu images directly into structured Excel tables!
              </p>
              <button 
                onClick={() => onNavigate(12)} // OCR Tab ID
                className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors border border-white/10 flex items-center justify-center gap-2"
              >
                <ScanText size={14}/> Try OCR
              </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default HomeTab;
