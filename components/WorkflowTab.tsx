
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { readExcelFile, getSheetData, saveWorkbook } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  Play, Plus, Save, UploadCloud, Trash2, ArrowRight, Settings, 
  Filter, Type, Scissors, Replace, FileSpreadsheet, ArrowDown
} from 'lucide-react';
import { LogEntry, ProcessingStatus } from '../types';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

type StepType = 'deleteCol' | 'filter' | 'replace' | 'format' | 'dedupe';

interface Step {
  id: string;
  type: StepType;
  params: any;
}

const WorkflowTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [steps, setSteps] = useState<Step[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState(0);

  const addStep = (type: StepType) => {
    setSteps([...steps, { id: Math.random().toString(36).substr(2,9), type, params: {} }]);
  };

  const updateStep = (id: string, params: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, params: { ...s.params, ...params } } : s));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const saveWorkflow = () => {
    const name = prompt("Enter workflow name:", "My Workflow");
    if (name) {
      localStorage.setItem(`workflow_${name}`, JSON.stringify(steps));
      addLog(`Workflow '${name}' saved.`, 'success');
    }
  };

  const loadWorkflow = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('workflow_'));
    if (keys.length === 0) {
      alert("No saved workflows found.");
      return;
    }
    const name = prompt(`Available workflows:\n${keys.map(k => k.replace('workflow_', '')).join('\n')}\n\nEnter name to load:`);
    if (name) {
      const data = localStorage.getItem(`workflow_${name}`);
      if (data) {
        setSteps(JSON.parse(data));
        addLog(`Workflow '${name}' loaded.`, 'success');
      } else {
        alert("Workflow not found.");
      }
    }
  };

  const runWorkflow = async () => {
    if (!file || steps.length === 0) return;
    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog("Starting workflow...", 'info');

    try {
      const data = await readExcelFile(file);
      const sheetName = data.sheets[0];
      let rows = getSheetData(data.workbook, sheetName, false);
      let headers = rows[0] as string[];
      let body = rows.slice(1);

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        addLog(`Running Step ${i+1}: ${t.workflow.steps[step.type]}`, 'info');
        
        switch (step.type) {
          case 'deleteCol':
            const colIdx = parseInt(step.params.colIndex) - 1;
            if (!isNaN(colIdx) && colIdx >= 0) {
              headers = headers.filter((_, idx) => idx !== colIdx);
              body = body.map(r => r.filter((_, idx) => idx !== colIdx));
            }
            break;

          case 'filter':
            const fCol = parseInt(step.params.colIndex) - 1;
            const fVal = (step.params.value || "").toLowerCase();
            const cond = step.params.condition || 'contains';
            if (!isNaN(fCol) && fCol >= 0) {
               body = body.filter(r => {
                  const cell = String(r[fCol] || "").toLowerCase();
                  if (cond === 'contains') return cell.includes(fVal);
                  if (cond === 'equals') return cell === fVal;
                  if (cond === 'notContains') return !cell.includes(fVal);
                  return true;
               });
            }
            break;

          case 'format':
            const fmtCol = parseInt(step.params.colIndex) - 1;
            const action = step.params.action || 'trim';
            if (!isNaN(fmtCol) && fmtCol >= 0) {
               body = body.map(r => {
                  let val = String(r[fmtCol] || "");
                  if (action === 'trim') val = val.trim();
                  if (action === 'upper') val = val.toUpperCase();
                  if (action === 'lower') val = val.toLowerCase();
                  if (action === 'title') val = val.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                  const newRow = [...r];
                  newRow[fmtCol] = val;
                  return newRow;
               });
            }
            break;
            
          case 'replace':
             const rCol = parseInt(step.params.colIndex) - 1;
             const findText = step.params.find || "";
             const replaceText = step.params.replace || "";
             if (!isNaN(rCol) && rCol >= 0) {
                body = body.map(r => {
                   let val = String(r[rCol] || "");
                   val = val.split(findText).join(replaceText);
                   const newRow = [...r];
                   newRow[rCol] = val;
                   return newRow;
                });
             }
             break;

          case 'dedupe':
             const dCol = parseInt(step.params.colIndex) - 1;
             if (!isNaN(dCol) && dCol >= 0) {
                const seen = new Set();
                body = body.filter(r => {
                   const val = String(r[dCol] || "").trim();
                   if (seen.has(val)) return false;
                   seen.add(val);
                   return true;
                });
             }
             break;
        }
        
        setProgress(Math.round(((i + 1) / steps.length) * 100));
        await new Promise(r => setTimeout(r, 50));
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
      XLSX.utils.book_append_sheet(wb, ws, "Processed");
      saveWorkbook(wb, `Workflow_Result_${Date.now()}.xlsx`);
      addLog(t.common.completed, 'success');

    } catch (e: any) {
      addLog(`Error: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Builder Sidebar */}
          <div className="md:col-span-1 bg-white p-4 rounded-lg border border-slate-200 h-fit">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Settings size={18}/> {t.workflow.title}
             </h3>
             
             <div className="space-y-2 mb-6">
                <p className="text-xs text-slate-500 font-bold uppercase">{t.workflow.addStep}</p>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => addStep('deleteCol')} className="p-2 border rounded text-xs hover:bg-red-50 hover:text-red-600 flex flex-col items-center gap-1 transition-colors">
                      <Scissors size={16}/> {t.workflow.steps.deleteCol}
                   </button>
                   <button onClick={() => addStep('filter')} className="p-2 border rounded text-xs hover:bg-blue-50 hover:text-blue-600 flex flex-col items-center gap-1 transition-colors">
                      <Filter size={16}/> {t.workflow.steps.filter}
                   </button>
                   <button onClick={() => addStep('format')} className="p-2 border rounded text-xs hover:bg-green-50 hover:text-green-600 flex flex-col items-center gap-1 transition-colors">
                      <Type size={16}/> {t.workflow.steps.format}
                   </button>
                   <button onClick={() => addStep('replace')} className="p-2 border rounded text-xs hover:bg-orange-50 hover:text-orange-600 flex flex-col items-center gap-1 transition-colors">
                      <Replace size={16}/> {t.workflow.steps.replace}
                   </button>
                </div>
                <button onClick={() => addStep('dedupe')} className="w-full p-2 border rounded text-xs hover:bg-purple-50 hover:text-purple-600 flex items-center justify-center gap-2 mt-2 transition-colors">
                   <FileSpreadsheet size={16}/> {t.workflow.steps.dedupe}
                </button>
             </div>

             <div className="border-t pt-4 space-y-2">
                <button onClick={saveWorkflow} className="w-full py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded hover:bg-slate-200 flex items-center justify-center gap-2">
                   <Save size={14}/> {t.workflow.save}
                </button>
                <button onClick={loadWorkflow} className="w-full py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded hover:bg-slate-200 flex items-center justify-center gap-2">
                   <UploadCloud size={14}/> {t.workflow.load}
                </button>
             </div>
          </div>

          {/* Workflow Canvas */}
          <div className="md:col-span-2 flex flex-col gap-4">
             <div className="bg-white p-4 rounded-lg border-2 border-dashed border-slate-300 min-h-[100px] flex items-center justify-center">
                <label className="cursor-pointer flex flex-col items-center gap-2 w-full">
                   <UploadCloud size={32} className="text-slate-400"/>
                   <span className="text-sm font-bold text-slate-600">{file ? file.name : t.actions.uploadFile}</span>
                   <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
             </div>

             <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex-1 min-h-[400px] flex flex-col">
                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                   Recipe Steps ({steps.length})
                </h4>
                
                <div className="flex-1 space-y-3 overflow-y-auto">
                   {steps.length === 0 && <p className="text-center text-slate-400 text-sm mt-10">{t.workflow.noSteps}</p>}
                   
                   {steps.map((step, idx) => (
                      <div key={step.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 flex flex-col gap-2 relative group animate-in slide-in-from-left-2">
                         <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-blue-600 flex items-center gap-2">
                               <span className="bg-blue-100 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">{idx + 1}</span>
                               {t.workflow.steps[step.type]}
                            </span>
                            <button onClick={() => removeStep(step.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                               <label className="block text-slate-400 mb-1">{t.workflow.colIndex}</label>
                               <input 
                                 type="number" className="w-full p-1 border rounded" placeholder="1" 
                                 value={step.params.colIndex || ''}
                                 onChange={(e) => updateStep(step.id, { colIndex: e.target.value })}
                               />
                            </div>
                            
                            {step.type === 'filter' && (
                               <>
                                 <div>
                                    <label className="block text-slate-400 mb-1">{t.workflow.condition}</label>
                                    <select 
                                      className="w-full p-1 border rounded"
                                      value={step.params.condition || 'contains'}
                                      onChange={(e) => updateStep(step.id, { condition: e.target.value })}
                                    >
                                       <option value="contains">{t.workflow.actions.contains}</option>
                                       <option value="equals">{t.workflow.actions.equals}</option>
                                       <option value="notContains">{t.workflow.actions.notContains}</option>
                                    </select>
                                 </div>
                                 <div className="col-span-2">
                                    <input 
                                      type="text" className="w-full p-1 border rounded" placeholder={t.workflow.value}
                                      value={step.params.value || ''}
                                      onChange={(e) => updateStep(step.id, { value: e.target.value })}
                                    />
                                 </div>
                               </>
                            )}

                            {step.type === 'format' && (
                               <div>
                                  <label className="block text-slate-400 mb-1">Action</label>
                                  <select 
                                    className="w-full p-1 border rounded"
                                    value={step.params.action || 'trim'}
                                    onChange={(e) => updateStep(step.id, { action: e.target.value })}
                                  >
                                     <option value="trim">{t.workflow.actions.trim}</option>
                                     <option value="upper">{t.workflow.actions.upper}</option>
                                     <option value="lower">{t.workflow.actions.lower}</option>
                                     <option value="title">{t.workflow.actions.title}</option>
                                  </select>
                               </div>
                            )}

                            {step.type === 'replace' && (
                               <>
                                 <input 
                                   type="text" className="w-full p-1 border rounded" placeholder="Find..."
                                   value={step.params.find || ''}
                                   onChange={(e) => updateStep(step.id, { find: e.target.value })}
                                 />
                                 <input 
                                   type="text" className="w-full p-1 border rounded" placeholder="Replace..."
                                   value={step.params.replace || ''}
                                   onChange={(e) => updateStep(step.id, { replace: e.target.value })}
                                 />
                               </>
                            )}
                         </div>
                         
                         {idx < steps.length - 1 && (
                            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 z-10 text-slate-300">
                               <ArrowDown size={16}/>
                            </div>
                         )}
                      </div>
                   ))}
                </div>

                <button 
                   onClick={runWorkflow}
                   disabled={!file || steps.length === 0 || status === ProcessingStatus.PROCESSING}
                   className="mt-4 w-full py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   {status === ProcessingStatus.PROCESSING ? <span className="animate-spin">⏳</span> : <Play size={18}/>}
                   {t.workflow.run}
                </button>
                {status === ProcessingStatus.PROCESSING && <ProgressBar progress={progress} label={t.common.processing}/>}
             </div>
          </div>
       </div>
    </div>
  );
};

export default WorkflowTab;
