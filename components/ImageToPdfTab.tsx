import React, { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { LogEntry, ProcessingStatus } from '../types';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  FileImage, UploadCloud, FileText, ArrowUp, ArrowDown, 
  Trash2, Download, Settings2, CheckCircle2 
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

const PAGE_SIZES: { [key: string]: [number, number] } = {
  'A4': [595.28, 841.89],
  'Letter': [612.00, 792.00],
  'Legal': [612.00, 1008.00],
};

const MARGINS: { [key: string]: number } = {
  'None': 0,
  'Small': 20,
  'Normal': 40,
  'Large': 72
};

const ImageToPdfTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [images, setImages] = useState<ImageItem[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  const [pageSize, setPageSize] = useState<string>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [marginSize, setMarginSize] = useState<string>('Small');
  const [fitMode, setFitMode] = useState<'fit' | 'fill' | 'original'>('fit');

  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files: File[] = Array.from(event.target.files);
      if (images.length + files.length > 100) {
        addLog("Limit exceeded", 'warning');
        return;
      }

      addLog(`${t.common.processing} ${files.length}...`, 'info');

      const newImages: Promise<ImageItem>[] = files.map(file => {
        return new Promise((resolve) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              file,
              previewUrl: url,
              width: img.width,
              height: img.height
            });
          };
          img.src = url;
        });
      });

      Promise.all(newImages).then(loadedImages => {
        setImages(prev => [...prev, ...loadedImages]);
        addLog(t.common.completed, 'success');
      });
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages(prev => {
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[index + direction];
      newArr[index + direction] = temp;
      return newArr;
    });
  };

  const convertImageToBytes = async (imgItem: ImageItem): Promise<{ bytes: ArrayBuffer; isPng: boolean }> => {
    const isJpg = imgItem.file.type === 'image/jpeg' || imgItem.file.type === 'image/jpg';
    const isPng = imgItem.file.type === 'image/png';

    if (isJpg || isPng) {
      const bytes = await imgItem.file.arrayBuffer();
      return { bytes, isPng };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error("Canvas context failed"));
            return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
             blob.arrayBuffer().then(bytes => resolve({ bytes, isPng: true }));
          } else {
             reject(new Error("Conversion failed"));
          }
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = imgItem.previewUrl;
    });
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      addLog(t.common.noData, 'warning');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(t.common.processing, 'info');

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < images.length; i++) {
        const imgItem = images[i];
        
        try {
          const { bytes, isPng } = await convertImageToBytes(imgItem);
          const pdfImage = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);

          let pageWidth, pageHeight;
          
          if (pageSize === 'Fit to Image') {
             pageWidth = pdfImage.width;
             pageHeight = pdfImage.height;
          } else {
             const dims = PAGE_SIZES[pageSize] || PAGE_SIZES['A4'];
             pageWidth = orientation === 'portrait' ? dims[0] : dims[1];
             pageHeight = orientation === 'portrait' ? dims[1] : dims[0];
          }

          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          
          if (pageSize === 'Fit to Image') {
              page.drawImage(pdfImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
          } else {
              const margin = MARGINS[marginSize] || 0;
              const availableWidth = pageWidth - (margin * 2);
              const availableHeight = pageHeight - (margin * 2);
              
              let drawWidth = pdfImage.width;
              let drawHeight = pdfImage.height;
              
              const scaleW = availableWidth / pdfImage.width;
              const scaleH = availableHeight / pdfImage.height;

              if (fitMode === 'fit') {
                 const scale = Math.min(scaleW, scaleH);
                 drawWidth = pdfImage.width * scale;
                 drawHeight = pdfImage.height * scale;
              } else if (fitMode === 'fill') {
                 const scale = Math.max(scaleW, scaleH);
                 drawWidth = pdfImage.width * scale;
                 drawHeight = pdfImage.height * scale;
              }
              else if (fitMode === 'original') {
                  const scale = Math.min(1, scaleW, scaleH); 
                  drawWidth = pdfImage.width * scale;
                  drawHeight = pdfImage.height * scale;
              }

              const x = margin + (availableWidth - drawWidth) / 2;
              const y = margin + (availableHeight - drawHeight) / 2;

              page.drawImage(pdfImage, { x, y, width: drawWidth, height: drawHeight });
          }
        } catch (err: any) {
            addLog(`${t.common.error}: ${err.message}`, 'error');
        }

        const percent = Math.round(((i + 1) / images.length) * 90);
        setProgress(percent);
        await new Promise(r => setTimeout(r, 0)); 
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `Converted_Images_${Date.now()}.pdf`;
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
    setImages([]);
    setStatus(ProcessingStatus.IDLE);
    onReset();
  };

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
             <div className="bg-white p-4 rounded-lg border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                   <Settings2 size={18} className="mr-2" />
                   {t.common.config}
                </h3>

                <div className="space-y-4">
                   <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.pageSize}</label>
                      <select 
                         value={pageSize}
                         onChange={(e) => setPageSize(e.target.value)}
                         className="w-full p-2 border rounded text-sm bg-slate-50"
                      >
                         <option value="Fit to Image">{t.image.fitToImage}</option>
                         <option value="A4">A4</option>
                         <option value="Letter">Letter</option>
                      </select>
                   </div>

                   {pageSize !== 'Fit to Image' && (
                     <>
                        <div>
                           <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.direction}</label>
                           <div className="grid grid-cols-2 gap-2">
                              <button 
                                 onClick={() => setOrientation('portrait')}
                                 className={`p-2 rounded border text-sm flex items-center justify-center ${orientation === 'portrait' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}
                              >
                                 {t.image.portrait}
                              </button>
                              <button 
                                 onClick={() => setOrientation('landscape')}
                                 className={`p-2 rounded border text-sm flex items-center justify-center ${orientation === 'landscape' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}
                              >
                                 {t.image.landscape}
                              </button>
                           </div>
                        </div>

                        <div>
                           <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.margins}</label>
                           <select 
                              value={marginSize}
                              onChange={(e) => setMarginSize(e.target.value)}
                              className="w-full p-2 border rounded text-sm bg-slate-50"
                           >
                              <option value="None">{t.image.none}</option>
                              <option value="Small">{t.image.small}</option>
                              <option value="Normal">{t.image.normal}</option>
                              <option value="Large">{t.image.large}</option>
                           </select>
                        </div>
                     </>
                   )}
                </div>
             </div>

             <button
               onClick={handleConvert}
               disabled={images.length === 0 || status === ProcessingStatus.PROCESSING}
               className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
                  ${images.length === 0 || status === ProcessingStatus.PROCESSING
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700'}`}
             >
                <FileText size={18} />
                <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.image.genPdf}</span>
             </button>

             <button
               onClick={handleResetInternal}
               className="w-full py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50"
             >
               {t.common.reset}
             </button>
          </div>

          <div className="md:col-span-2 flex flex-col h-full">
             <div className="bg-white p-6 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 transition-colors text-center mb-6">
                <label className="cursor-pointer block">
                   <UploadCloud size={32} className="mx-auto text-blue-500 mb-2" />
                   <span className="text-lg font-semibold text-slate-700 block">{t.actions.uploadFile}</span>
                   <input 
                      type="file" 
                      multiple 
                      accept="image/png, image/jpeg, image/webp" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                   />
                </label>
             </div>

             <div className="bg-white rounded-lg border border-slate-200 flex flex-col flex-1 min-h-[400px]">
                <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700 flex justify-between items-center">
                   <span>{t.common.files} ({images.length})</span>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                   {images.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                         <FileImage size={48} className="mb-2" />
                         <p>{t.common.noData}</p>
                      </div>
                   )}
                   {images.map((img, idx) => (
                      <div key={img.id} className="flex items-center p-2 bg-slate-50 border border-slate-200 rounded group hover:border-blue-300 transition-colors animate-in slide-in-from-bottom-1 duration-200">
                         <div className="text-slate-400 font-mono text-xs w-6 text-center">{idx + 1}</div>
                         <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden shrink-0 border border-slate-300 mx-2">
                            <img src={img.previewUrl} className="w-full h-full object-cover" alt="" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{img.file.name}</p>
                            <p className="text-[10px] text-slate-500">{img.width} x {img.height}</p>
                         </div>
                         
                         <div className="flex items-center space-x-1">
                            <button onClick={() => moveImage(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                               <ArrowUp size={16} />
                            </button>
                            <button onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                               <ArrowDown size={16} />
                            </button>
                            <button onClick={() => removeImage(img.id)} className="p-1 text-slate-400 hover:text-red-600 ml-1">
                               <Trash2 size={16} />
                            </button>
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

export default ImageToPdfTab;