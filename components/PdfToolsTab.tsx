import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { LogEntry, ProcessingStatus } from '../types';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  FileText, UploadCloud, Scissors, Merge, ArrowUp, ArrowDown, 
  Trash2, Settings2, Layers, GripVertical 
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface PdfFile {
  id: string;
  file: File;
  pageCount: number;
}

const PdfToolsTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [mode, setMode] = useState<'split' | 'merge'>('split');
  
  const [mergeFiles, setMergeFiles] = useState<PdfFile[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const [splitFile, setSplitFile] = useState<PdfFile | null>(null);
  const [splitMethod, setSplitMethod] = useState<'extract_all' | 'by_group' | 'custom_range'>('by_group');
  const [pagesPerGroup, setPagesPerGroup] = useState<number>(1);
  const [customRange, setCustomRange] = useState<string>("");

  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  const getPageCount = async (file: File): Promise<number> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      return pdfDoc.getPageCount();
    } catch (e) {
      console.error(e);
      return 0;
    }
  };

  const handleMergeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files: File[] = Array.from(event.target.files);
      addLog(`${t.common.processing} ${files.length} PDFs...`, 'info');
      
      const newFiles: PdfFile[] = [];
      for (const file of files) {
        if (file.type !== 'application/pdf') continue;
        const count = await getPageCount(file);
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          pageCount: count
        });
      }
      
      setMergeFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleSplitUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      addLog(t.common.processing, 'info');
      const count = await getPageCount(file);
      setSplitFile({
        id: Math.random().toString(36).substr(2, 9),
        file,
        pageCount: count
      });
      addLog(`${t.system.fileLoaded}: ${file.name} (${count})`, 'success');
      if (count > 10) setPagesPerGroup(Math.ceil(count / 2));
    } else {
      addLog(t.common.error, 'error');
    }
  };

  const moveMergeFile = (index: number, direction: -1 | 1) => {
    setMergeFiles(prev => {
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[index + direction];
      newArr[index + direction] = temp;
      return newArr;
    });
  };

  const removeMergeFile = (id: string) => {
    setMergeFiles(prev => prev.filter(f => f.id !== id));
  };

  const executeMerge = async () => {
    if (mergeFiles.length < 2) return;

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      const mergedPdf = await PDFDocument.create();
      
      for (let i = 0; i < mergeFiles.length; i++) {
        const pdfFile = mergeFiles[i];
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        
        const prog = Math.round(((i + 1) / mergeFiles.length) * 90);
        setProgress(prog);
        await new Promise(r => setTimeout(r, 10)); 
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Merged_Document_${Date.now()}.pdf`;
      link.click();
      
      addLog(t.common.completed, 'success');
      setProgress(100);
    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  const executeSplit = async () => {
    if (!splitFile) return;

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      const arrayBuffer = await splitFile.file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const totalPages = sourcePdf.getPageCount();
      const zip = new JSZip();
      
      let fileCounter = 1;
      const baseName = splitFile.file.name.replace('.pdf', '');

      const savePdfToZip = async (pageIndices: number[], suffix: string) => {
         const newPdf = await PDFDocument.create();
         const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
         copiedPages.forEach(p => newPdf.addPage(p));
         const pdfBytes = await newPdf.save();
         zip.file(`${baseName}_${suffix}.pdf`, pdfBytes);
      };

      if (splitMethod === 'extract_all') {
        for (let i = 0; i < totalPages; i++) {
           await savePdfToZip([i], `page_${i + 1}`);
           setProgress(Math.round(((i+1)/totalPages) * 90));
        }

      } else if (splitMethod === 'by_group') {
        const groupSize = Math.max(1, pagesPerGroup);
        for (let i = 0; i < totalPages; i += groupSize) {
           const groupIndices = [];
           for (let j = 0; j < groupSize && (i + j) < totalPages; j++) {
             groupIndices.push(i + j);
           }
           await savePdfToZip(groupIndices, `part_${fileCounter++}`);
           setProgress(Math.round(((i + groupSize)/totalPages) * 90));
        }

      } else if (splitMethod === 'custom_range') {
        const parts = customRange.split(',').map(s => s.trim());
        const indicesToKeep = new Set<number>();
        
        parts.forEach(part => {
           if (part.includes('-')) {
             const [start, end] = part.split('-').map(n => parseInt(n));
             if (!isNaN(start) && !isNaN(end)) {
               for(let k = Math.min(start, end); k <= Math.max(start, end); k++) {
                 if(k > 0 && k <= totalPages) indicesToKeep.add(k - 1);
               }
             }
           } else {
             const num = parseInt(part);
             if (!isNaN(num) && num > 0 && num <= totalPages) indicesToKeep.add(num - 1);
           }
        });

        const sortedIndices = Array.from(indicesToKeep).sort((a,b) => a - b);
        if (sortedIndices.length === 0) throw new Error("Invalid page range.");
        
        await savePdfToZip(sortedIndices, 'extracted');
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}_split.zip`;
      link.click();

      addLog(t.common.completed, 'success');
      setProgress(100);

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
    } finally {
      setStatus(ProcessingStatus.COMPLETED);
    }
  };

  const handleResetInternal = () => {
    setMergeFiles([]);
    setSplitFile(null);
    setSplitMethod('by_group');
    setCustomRange("");
    setStatus(ProcessingStatus.IDLE);
    onReset();
  };

  return (
    <div className="space-y-6">
      
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('split')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'split' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Scissors size={16} />
          <span>{t.pdf.split}</span>
        </button>
        <button
          onClick={() => setMode('merge')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'merge' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Merge size={16} />
          <span>{t.pdf.merge}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center">
              <Settings2 size={18} className="mr-2" />
              {t.common.config}
            </h3>

            {mode === 'split' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.pdf.splitMethod}</label>
                  <div className="space-y-2">
                    <label className="flex items-start space-x-2 cursor-pointer p-2 border rounded hover:bg-slate-50 transition-colors">
                      <input 
                        type="radio" 
                        checked={splitMethod === 'by_group'} 
                        onChange={() => setSplitMethod('by_group')}
                        className="mt-1 text-blue-600"
                      />
                      <div className="text-sm">
                        <span className="font-semibold block">{t.pdf.fixedPage}</span>
                      </div>
                    </label>

                    {splitMethod === 'by_group' && (
                       <div className="ml-6 flex items-center space-x-2 animate-in slide-in-from-top-1">
                          <span className="text-sm text-slate-700">{t.pdf.pagesPerFile}</span>
                          <input 
                            type="number" 
                            min="1"
                            value={pagesPerGroup}
                            onChange={(e) => setPagesPerGroup(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 p-1 border rounded text-center text-sm font-bold"
                          />
                       </div>
                    )}

                    <label className="flex items-start space-x-2 cursor-pointer p-2 border rounded hover:bg-slate-50 transition-colors">
                      <input 
                        type="radio" 
                        checked={splitMethod === 'extract_all'} 
                        onChange={() => setSplitMethod('extract_all')}
                        className="mt-1 text-blue-600"
                      />
                      <div className="text-sm">
                        <span className="font-semibold block">{t.pdf.extractAll}</span>
                      </div>
                    </label>

                    <label className="flex items-start space-x-2 cursor-pointer p-2 border rounded hover:bg-slate-50 transition-colors">
                      <input 
                        type="radio" 
                        checked={splitMethod === 'custom_range'} 
                        onChange={() => setSplitMethod('custom_range')}
                        className="mt-1 text-blue-600"
                      />
                      <div className="text-sm">
                        <span className="font-semibold block">{t.pdf.range}</span>
                      </div>
                    </label>

                    {splitMethod === 'custom_range' && (
                       <div className="ml-6 animate-in slide-in-from-top-1">
                          <input 
                            type="text" 
                            placeholder={language === 'ar' ? "مثال: 1-5, 8, 11-13" : "e.g. 1-5, 8, 11-13"}
                            value={customRange}
                            onChange={(e) => setCustomRange(e.target.value)}
                            className="w-full p-2 border rounded text-sm"
                          />
                       </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                <p>{t.pdf.hint}</p>
              </div>
            )}
          </div>

          <button
            onClick={mode === 'split' ? executeSplit : executeMerge}
            disabled={status === ProcessingStatus.PROCESSING || (mode === 'split' ? !splitFile : mergeFiles.length < 2)}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
              ${status === ProcessingStatus.PROCESSING || (mode === 'split' ? !splitFile : mergeFiles.length < 2)
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
              {mode === 'split' ? <Scissors size={18} /> : <Merge size={18} />}
              <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : (mode === 'split' ? t.pdf.split : t.pdf.merge)}</span>
          </button>
          
          <button
             onClick={handleResetInternal}
             className="w-full py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50"
          >
            {t.common.reset}
          </button>
        </div>

        <div className="md:col-span-2">
          
          <div className="bg-white p-6 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 transition-colors text-center mb-6">
            <label className="cursor-pointer block">
              <UploadCloud size={32} className="mx-auto text-blue-500 mb-2" />
              <span className="text-lg font-semibold text-slate-700 block">
                {mode === 'split' ? t.actions.uploadFile : t.actions.uploadFile}
              </span>
              <input 
                type="file" 
                multiple={mode === 'merge'} 
                accept="application/pdf" 
                onChange={mode === 'split' ? handleSplitUpload : handleMergeUpload} 
                className="hidden" 
              />
            </label>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 min-h-[200px] flex flex-col">
            <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700 flex justify-between items-center">
               <span>{t.common.files}</span>
            </div>
            
            <div className="p-2 space-y-2 flex-1">
              {mode === 'split' && splitFile && (
                <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded">
                   <FileText size={24} className="text-blue-600 mr-3" />
                   <div className="flex-1">
                      <p className="font-bold text-slate-700">{splitFile.file.name}</p>
                      <p className="text-xs text-slate-500">{splitFile.pageCount}</p>
                   </div>
                   <button onClick={() => setSplitFile(null)} className="text-slate-400 hover:text-red-500">
                     <Trash2 size={18} />
                   </button>
                </div>
              )}

              {mode === 'merge' && mergeFiles.map((f, idx) => (
                <div 
                  key={f.id} 
                  className="flex items-center p-2 bg-slate-50 border border-slate-200 rounded group transition-all"
                >
                   <span className="text-slate-400 font-mono text-xs w-6 text-center">{idx + 1}</span>
                   <FileText size={20} className="text-slate-500 mr-3" />
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{f.file.name}</p>
                      <p className="text-[10px] text-slate-400">{f.pageCount}</p>
                   </div>
                   <div className="flex items-center space-x-1">
                      <button onClick={() => moveMergeFile(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                        <ArrowUp size={16} />
                      </button>
                      <button onClick={() => moveMergeFile(idx, 1)} disabled={idx === mergeFiles.length - 1} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                        <ArrowDown size={16} />
                      </button>
                      <button onClick={() => removeMergeFile(f.id)} className="p-1 text-slate-400 hover:text-red-600 ml-1">
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>
              ))}

              {((mode === 'split' && !splitFile) || (mode === 'merge' && mergeFiles.length === 0)) && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 py-10">
                   <Layers size={48} className="mb-2" />
                   <p>{t.common.noData}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {status === ProcessingStatus.PROCESSING && (
        <ProgressBar progress={progress} label={t.common.processing} />
      )}
    </div>
  );
};

export default PdfToolsTab;