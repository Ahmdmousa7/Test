import React, { useState, useRef, useEffect } from 'react';
import { LogEntry, ProcessingStatus } from '../types';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { Image as ImageIcon, UploadCloud, X, ArrowUp, ArrowDown, MoveVertical, MoveHorizontal, Download, Trash2, Settings2, Palette } from 'lucide-react';

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

const MergeImagesTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [images, setImages] = useState<ImageItem[]>([]);
  const [direction, setDirection] = useState<'vertical' | 'horizontal'>('vertical');
  const [gap, setGap] = useState<number>(0);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [useTransparent, setUseTransparent] = useState<boolean>(false);
  const [alignment, setAlignment] = useState<'start' | 'center' | 'end'>('center');
  const [uniformScale, setUniformScale] = useState<boolean>(true); 
  
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files: File[] = Array.from(event.target.files);
      addLog(`${t.common.processing} ${files.length} images...`, 'info');

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
        setResultUrl(null); 
      });
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
    setResultUrl(null);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages(prev => {
      const newArr = [...prev];
      const temp = newArr[index];
      newArr[index] = newArr[index + direction];
      newArr[index + direction] = temp;
      return newArr;
    });
    setResultUrl(null);
  };

  const handleMerge = async () => {
    if (images.length === 0) {
      addLog(t.common.noData, 'warning');
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    addLog(t.common.processing, 'info');
    
    await new Promise(r => setTimeout(r, 100));

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      let totalWidth = 0;
      let totalHeight = 0;
      
      const targetDimension = uniformScale 
        ? Math.max(...images.map(i => direction === 'vertical' ? i.width : i.height))
        : 0;

      const processedImages = images.map(img => {
        let drawW = img.width;
        let drawH = img.height;

        if (uniformScale) {
          if (direction === 'vertical') {
            const scale = targetDimension / img.width;
            drawW = targetDimension;
            drawH = img.height * scale;
          } else {
            const scale = targetDimension / img.height;
            drawH = targetDimension;
            drawW = img.width * scale;
          }
        }
        return { ...img, drawW, drawH };
      });

      if (direction === 'vertical') {
        totalWidth = Math.max(...processedImages.map(i => i.drawW));
        totalHeight = processedImages.reduce((sum, i) => sum + i.drawH, 0) + (gap * (images.length - 1));
      } else {
        totalWidth = processedImages.reduce((sum, i) => sum + i.drawW, 0) + (gap * (images.length - 1));
        totalHeight = Math.max(...processedImages.map(i => i.drawH));
      }

      canvas.width = totalWidth;
      canvas.height = totalHeight;

      if (!useTransparent) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
      }

      let currentX = 0;
      let currentY = 0;

      for (const imgItem of processedImages) {
        const img = new Image();
        img.src = imgItem.previewUrl;
        await new Promise(r => { if (img.complete) r(null); else img.onload = () => r(null); });

        let drawX = currentX;
        let drawY = currentY;

        if (direction === 'vertical') {
          if (alignment === 'center') drawX = (totalWidth - imgItem.drawW) / 2;
          if (alignment === 'end') drawX = totalWidth - imgItem.drawW;
        } else {
          if (alignment === 'center') drawY = (totalHeight - imgItem.drawH) / 2;
          if (alignment === 'end') drawY = totalHeight - imgItem.drawH;
        }

        ctx.drawImage(img, drawX, drawY, imgItem.drawW, imgItem.drawH);

        if (direction === 'vertical') {
          currentY += imgItem.drawH + gap;
        } else {
          currentX += imgItem.drawW + gap;
        }
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setResultUrl(url);
          addLog(t.common.completed, 'success');
          setStatus(ProcessingStatus.COMPLETED);
        }
      }, 'image/png');

    } catch (e: any) {
      addLog(`${t.common.error}: ${e.message}`, 'error');
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleResetInternal = () => {
    setImages([]);
    setResultUrl(null);
    setStatus(ProcessingStatus.IDLE);
    onReset();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center">
              <Settings2 size={18} className="mr-2" />
              {t.common.config}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.direction}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setDirection('vertical')}
                    className={`flex items-center justify-center p-2 rounded border text-sm ${direction === 'vertical' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'hover:bg-slate-50 border-slate-200'}`}
                  >
                    <MoveVertical size={16} className="mr-2" /> {t.image.vertical}
                  </button>
                  <button 
                    onClick={() => setDirection('horizontal')}
                    className={`flex items-center justify-center p-2 rounded border text-sm ${direction === 'horizontal' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'hover:bg-slate-50 border-slate-200'}`}
                  >
                    <MoveHorizontal size={16} className="mr-2" /> {t.image.horizontal}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.gap}</label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">px</span>
                    <input 
                      type="number" 
                      min="0"
                      value={gap}
                      onChange={(e) => setGap(Number(e.target.value))}
                      className="w-20 p-1 border rounded text-sm text-center"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{t.image.uniform}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={uniformScale} onChange={(e) => setUniformScale(e.target.checked)} />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.bg}</label>
                <div className="flex items-center space-x-3">
                   <div className="relative">
                     <div className="w-8 h-8 rounded border border-slate-300 overflow-hidden shadow-sm" style={{ backgroundColor: useTransparent ? 'white' : backgroundColor }}>
                       {useTransparent && (
                         <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%), linear-gradient(-45deg, #000 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #000 75%), linear-gradient(-45deg, transparent 75%, #000 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px' }}></div>
                       )}
                     </div>
                     <input 
                      type="color" 
                      value={backgroundColor}
                      onChange={(e) => { setBackgroundColor(e.target.value); setUseTransparent(false); }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      disabled={useTransparent}
                     />
                   </div>
                   
                   <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useTransparent} 
                        onChange={(e) => setUseTransparent(e.target.checked)}
                        className="rounded text-blue-600" 
                      />
                      <span className="text-sm text-slate-600">{t.image.transparent}</span>
                   </label>
                </div>
              </div>
            </div>
          </div>
          
           <div className="flex flex-col gap-3">
              <button
                onClick={handleMerge}
                disabled={images.length === 0 || status === ProcessingStatus.PROCESSING}
                className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
                  ${images.length === 0 || status === ProcessingStatus.PROCESSING
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                 {status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}
              </button>

              <button
                onClick={handleResetInternal}
                className="w-full py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50"
              >
                {t.common.reset}
              </button>
           </div>
        </div>

        <div className="lg:col-span-2 flex flex-col h-full space-y-6">
          
          <div className="bg-white p-6 rounded-lg border border-dashed border-slate-300 hover:bg-slate-50 transition-colors text-center">
            <label className="cursor-pointer block">
              <UploadCloud size={32} className="mx-auto text-blue-500 mb-2" />
              <span className="text-lg font-semibold text-slate-700 block">{t.actions.uploadFile}</span>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-96">
               <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700 flex justify-between items-center">
                 <span>{t.common.files} ({images.length})</span>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-2">
                 {images.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                     <ImageIcon size={48} className="mb-2" />
                     <p>{t.common.noData}</p>
                   </div>
                 )}
                 {images.map((img, idx) => (
                   <div key={img.id} className="flex items-center p-2 bg-slate-50 border border-slate-200 rounded group hover:border-blue-300 transition-colors">
                      <div className="w-12 h-12 bg-slate-200 rounded overflow-hidden shrink-0 border border-slate-300">
                        <img src={img.previewUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="ml-3 flex-1 min-w-0">
                         <p className="text-sm font-medium text-slate-700 truncate">{img.file.name}</p>
                         <p className="text-xs text-slate-500">{img.width} x {img.height}</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => moveImage(idx, -1)} 
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button 
                          onClick={() => moveImage(idx, 1)} 
                          disabled={idx === images.length - 1}
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button 
                          onClick={() => removeImage(img.id)}
                          className="p-1 text-slate-400 hover:text-red-600 ml-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-96">
               <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700">
                 {t.common.preview}
               </div>
               <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-50">
                 {resultUrl ? (
                   <img src={resultUrl} alt="Merged Result" className="max-w-full max-h-full shadow-lg border border-slate-300" />
                 ) : (
                   <p className="text-slate-400 text-sm italic">{t.common.noData}</p>
                 )}
               </div>
               {resultUrl && (
                 <div className="p-3 border-t border-slate-100 flex justify-center">
                    <a 
                      href={resultUrl} 
                      download={`merged_image_${Date.now()}.png`}
                      className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 transition-colors"
                    >
                      <Download size={18} />
                      <span>{t.common.download} PNG</span>
                    </a>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeImagesTab;