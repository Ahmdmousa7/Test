import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { LogEntry, ProcessingStatus } from '../types';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  Image as ImageIcon, UploadCloud, Download, Trash2, 
  Settings2, Zap, Monitor, HardDrive, 
  CheckCircle2, ArrowRight, FileArchive, RefreshCw 
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

interface CompressedImage {
  id: string;
  originalFile: File;
  previewUrl: string;
  originalSize: number;
  compressedBlob: Blob | null;
  compressedSize: number;
  status: 'idle' | 'processing' | 'done' | 'error';
  width: number;
  height: number;
  newWidth: number;
  newHeight: number;
}

type CompressionPreset = 'balanced' | 'extreme' | 'hq' | 'custom';

const ImageCompressorTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [progress, setProgress] = useState<number>(0);

  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [quality, setQuality] = useState<number>(0.8);
  const [format, setFormat] = useState<'original' | 'image/webp' | 'image/jpeg' | 'image/png'>('image/webp');
  const [maxWidth, setMaxWidth] = useState<number>(0); 

  useEffect(() => {
    if (preset === 'balanced') {
      setQuality(0.8);
      setFormat('image/webp');
      setMaxWidth(0); 
    } else if (preset === 'extreme') {
      setQuality(0.6);
      setFormat('image/webp');
      setMaxWidth(1920); 
    } else if (preset === 'hq') {
      setQuality(0.92);
      setFormat('original'); 
      setMaxWidth(0);
    }
  }, [preset]);

  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files: File[] = Array.from(event.target.files);
      addLog(`${t.common.processing} ${files.length}...`, 'info');

      const newImages: Promise<CompressedImage>[] = files.map(file => {
        return new Promise((resolve) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            resolve({
              id: Math.random().toString(36).substr(2, 9),
              originalFile: file,
              previewUrl: url,
              originalSize: file.size,
              compressedBlob: null,
              compressedSize: 0,
              status: 'idle',
              width: img.width,
              height: img.height,
              newWidth: 0,
              newHeight: 0
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

  const compressSingleImage = async (imgItem: CompressedImage): Promise<CompressedImage> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        if (maxWidth > 0 && w > maxWidth) {
          const ratio = maxWidth / w;
          w = maxWidth;
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve({ ...imgItem, status: 'error' });
            return;
        }

        ctx.drawImage(img, 0, 0, w, h);

        let outFormat = format;
        if (outFormat === 'original') {
            if (imgItem.originalFile.type === 'image/png') outFormat = 'image/png';
            else if (imgItem.originalFile.type === 'image/webp') outFormat = 'image/webp';
            else outFormat = 'image/jpeg';
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                ...imgItem,
                compressedBlob: blob,
                compressedSize: blob.size,
                status: 'done',
                newWidth: w,
                newHeight: h
              });
            } else {
              resolve({ ...imgItem, status: 'error' });
            }
          },
          outFormat,
          quality
        );
      };
      img.onerror = () => resolve({ ...imgItem, status: 'error' });
      img.src = imgItem.previewUrl;
    });
  };

  const handleCompressAll = async () => {
    if (images.length === 0) return;

    setStatus(ProcessingStatus.PROCESSING);
    setProgress(0);
    addLog(`${t.common.processing} (Q: ${(quality*100).toFixed(0)}%)...`, 'info');

    const updatedImages = [...images];
    let processedCount = 0;
    let totalSavedBytes = 0;

    for (let i = 0; i < updatedImages.length; i++) {
        updatedImages[i] = { ...updatedImages[i], status: 'processing' };
        setImages([...updatedImages]); 

        try {
            const result = await compressSingleImage(updatedImages[i]);
            updatedImages[i] = result;
            if (result.compressedBlob) {
                totalSavedBytes += Math.max(0, result.originalSize - result.compressedSize);
            }
        } catch (e) {
            updatedImages[i].status = 'error';
        }
        
        processedCount++;
        setProgress((processedCount / updatedImages.length) * 100);
        
        setImages([...updatedImages]);
        await new Promise(r => setTimeout(r, 10));
    }

    addLog(`${t.common.completed} Saved ${formatSize(totalSavedBytes)}.`, 'success');
    setStatus(ProcessingStatus.COMPLETED);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    let count = 0;

    images.forEach(img => {
      if (img.status === 'done' && img.compressedBlob) {
        let ext = 'jpg';
        if (img.compressedBlob.type.includes('png')) ext = 'png';
        if (img.compressedBlob.type.includes('webp')) ext = 'webp';
        
        const originalName = img.originalFile.name.substring(0, img.originalFile.name.lastIndexOf('.')) || img.originalFile.name;
        
        zip.file(`${originalName}_min.${ext}`, img.compressedBlob);
        count++;
      }
    });

    if (count === 0) {
      addLog(t.common.noData, 'warning');
      return;
    }

    addLog(t.common.processing, 'info');
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `Compressed_Images_${Date.now()}.zip`;
    link.click();
    
    addLog(t.common.completed, 'success');
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

            <div className="mb-6">
               <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.compressMode}</label>
               <div className="grid grid-cols-2 gap-2">
                 <button 
                   onClick={() => setPreset('balanced')}
                   className={`p-2 rounded border text-sm flex flex-col items-center justify-center text-center h-20 transition-all
                     ${preset === 'balanced' ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500' : 'hover:bg-slate-50 border-slate-200'}`}
                 >
                   <Monitor size={18} className="mb-1" />
                   <span className="font-bold">{t.image.balanced}</span>
                 </button>
                 
                 <button 
                   onClick={() => setPreset('extreme')}
                   className={`p-2 rounded border text-sm flex flex-col items-center justify-center text-center h-20 transition-all
                     ${preset === 'extreme' ? 'bg-orange-50 border-orange-500 text-orange-700 ring-1 ring-orange-500' : 'hover:bg-slate-50 border-slate-200'}`}
                 >
                   <Zap size={18} className="mb-1" />
                   <span className="font-bold">{t.image.extreme}</span>
                 </button>

                 <button 
                   onClick={() => setPreset('hq')}
                   className={`p-2 rounded border text-sm flex flex-col items-center justify-center text-center h-20 transition-all
                     ${preset === 'hq' ? 'bg-green-50 border-green-500 text-green-700 ring-1 ring-green-500' : 'hover:bg-slate-50 border-slate-200'}`}
                 >
                   <HardDrive size={18} className="mb-1" />
                   <span className="font-bold">{t.image.hq}</span>
                 </button>

                 <button 
                   onClick={() => setPreset('custom')}
                   className={`p-2 rounded border text-sm flex flex-col items-center justify-center text-center h-20 transition-all
                     ${preset === 'custom' ? 'bg-slate-100 border-slate-400 text-slate-800 ring-1 ring-slate-400' : 'hover:bg-slate-50 border-slate-200'}`}
                 >
                   <Settings2 size={18} className="mb-1" />
                   <span className="font-bold">{t.image.custom}</span>
                 </button>
               </div>
            </div>

            <div className={`space-y-4 transition-all duration-300 ${preset !== 'custom' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
               <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">{t.image.quality}</label>
                    <span className="text-xs font-bold text-blue-600">{Math.round(quality * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1.0" 
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.format}</label>
                  <select 
                    value={format} 
                    onChange={(e) => setFormat(e.target.value as any)}
                    className="w-full p-2 border rounded text-sm bg-slate-50"
                  >
                    <option value="image/webp">{t.image.webp}</option>
                    <option value="image/jpeg">{t.image.jpeg}</option>
                    <option value="image/png">{t.image.png}</option>
                    <option value="original">{t.image.original}</option>
                  </select>
               </div>

               <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.image.resize}</label>
                  <select 
                    value={maxWidth} 
                    onChange={(e) => setMaxWidth(Number(e.target.value))}
                    className="w-full p-2 border rounded text-sm bg-slate-50"
                  >
                    <option value={0}>{t.image.dims.original}</option>
                    <option value={3840}>{t.image.dims.k4}</option>
                    <option value={1920}>{t.image.dims.fhd}</option>
                    <option value={1280}>{t.image.dims.hd}</option>
                    <option value={800}>{t.image.dims.web}</option>
                  </select>
               </div>
            </div>

          </div>

          <button
            onClick={handleCompressAll}
            disabled={images.length === 0 || status === ProcessingStatus.PROCESSING}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex justify-center items-center space-x-2
               ${images.length === 0 || status === ProcessingStatus.PROCESSING
                 ? 'bg-slate-400 cursor-not-allowed' 
                 : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
             {status === ProcessingStatus.PROCESSING 
                ? <RefreshCw size={18} className="animate-spin" /> 
                : <Zap size={18} />}
             <span>{status === ProcessingStatus.PROCESSING ? t.common.processing : t.common.start}</span>
          </button>

          {images.some(i => i.status === 'done') && (
            <button
                onClick={handleDownloadZip}
                className="w-full py-3 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 shadow-sm flex justify-center items-center space-x-2"
            >
                <FileArchive size={18} />
                <span>{t.common.download} (ZIP)</span>
            </button>
          )}

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
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="hidden" 
                />
            </label>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 flex flex-col flex-1 min-h-[400px]">
                <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700 flex justify-between items-center">
                   <span>{t.common.files} ({images.length})</span>
                   {images.some(i => i.status === 'done') && (
                       <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                           Saved: {formatSize(images.reduce((acc, img) => acc + (img.status === 'done' ? Math.max(0, img.originalSize - img.compressedSize) : 0), 0))}
                       </span>
                   )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                   {images.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                         <ImageIcon size={48} className="mb-2" />
                         <p>{t.common.noData}</p>
                      </div>
                   )}

                   {images.map((img) => (
                      <div key={img.id} className="flex items-center p-2 bg-slate-50 border border-slate-200 rounded group animate-in slide-in-from-bottom-1">
                         <div className="w-16 h-16 bg-slate-200 rounded overflow-hidden shrink-0 border border-slate-300 mr-3 relative">
                            <img src={img.previewUrl} className="w-full h-full object-cover" alt="" />
                            {img.status === 'done' && <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center"><CheckCircle2 className="text-white drop-shadow-md" /></div>}
                         </div>
                         
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{img.originalFile.name}</p>
                            
                            <div className="flex items-center text-xs mt-1 space-x-2">
                                <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                                    {formatSize(img.originalSize)}
                                </span>
                                {img.status === 'done' && (
                                    <>
                                        <ArrowRight size={12} className="text-slate-400" />
                                        <span className={`px-1.5 py-0.5 rounded font-mono font-bold
                                            ${img.compressedSize < img.originalSize ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {formatSize(img.compressedSize)}
                                        </span>
                                        {img.compressedSize < img.originalSize && (
                                            <span className="text-green-600 font-bold">
                                                (-{Math.round(((img.originalSize - img.compressedSize) / img.originalSize) * 100)}%)
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                            
                            {img.status === 'done' && (
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    {img.width}x{img.height} → {img.newWidth}x{img.newHeight}
                                </p>
                            )}
                         </div>

                         <div className="flex items-center space-x-2">
                             {img.status === 'done' && img.compressedBlob && (
                                 <a 
                                    href={URL.createObjectURL(img.compressedBlob)}
                                    download={`min_${img.originalFile.name}`}
                                    className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                                    title="Download Single"
                                 >
                                     <Download size={16} />
                                 </a>
                             )}
                             <button 
                                onClick={() => removeImage(img.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                             >
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

export default ImageCompressorTab;