import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { LogEntry, ProcessingStatus } from '../types';
import { readExcelFile, getSheetData } from '../services/excelService';
import { TRANSLATIONS, Language } from '../utils/translations';
import ProgressBar from './ProgressBar';
import { 
  QrCode, Download, Settings, UploadCloud, Link, Mail, 
  Phone, Wifi, MessageSquare, Globe, Share2, Layers, 
  Palette, RefreshCw, FileText, Copy
} from 'lucide-react';

interface Props {
  addLog: (msg: string, type?: LogEntry['type']) => void;
  onReset: () => void;
  language?: Language;
}

type TemplateType = 'text' | 'url' | 'email' | 'wifi' | 'phone' | 'sms' | 'whatsapp';

const COLORS = {
  classic: { fg: '#000000', bg: '#ffffff' },
  ocean:   { fg: '#1e40af', bg: '#eff6ff' }, 
  forest:  { fg: '#166534', bg: '#f0fdf4' }, 
  sunset:  { fg: '#c2410c', bg: '#fff7ed' }, 
  royal:   { fg: '#6b21a8', bg: '#faf5ff' }, 
  fire:    { fg: '#dc2626', bg: '#ffffff' }, 
};

const QrCodeTab: React.FC<Props> = ({ addLog, onReset, language = 'en' }) => {
  const t = TRANSLATIONS[language];
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [template, setTemplate] = useState<TemplateType>('url');

  const [inputValue, setInputValue] = useState('https://example.com');
  const [emailFields, setEmailFields] = useState({ to: '', subject: '', body: '' });
  const [wifiFields, setWifiFields] = useState({ ssid: '', password: '', type: 'WPA' });
  const [phoneNum, setPhoneNum] = useState('');
  
  const [size, setSize] = useState(300);
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [level, setLevel] = useState<'L'|'M'|'Q'|'H'>('M');
  const [margin, setMargin] = useState(4);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  
  const [bulkStatus, setBulkStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [bulkProgress, setBulkProgress] = useState(0);

  useEffect(() => {
    generateQr();
  }, [inputValue, emailFields, wifiFields, phoneNum, template, size, fgColor, bgColor, level, margin]);

  const getEffectiveText = () => {
    switch (template) {
      case 'email':
        return `mailto:${emailFields.to}?subject=${encodeURIComponent(emailFields.subject)}&body=${encodeURIComponent(emailFields.body)}`;
      case 'wifi':
        return `WIFI:T:${wifiFields.type};S:${wifiFields.ssid};P:${wifiFields.password};;`;
      case 'phone':
        return `tel:${phoneNum}`;
      case 'sms':
        return `smsto:${phoneNum}:${inputValue}`; 
      case 'whatsapp':
        return `https://wa.me/${phoneNum}?text=${encodeURIComponent(inputValue)}`;
      case 'url':
      case 'text':
      default:
        return inputValue;
    }
  };

  const generateQr = async () => {
    try {
      const text = getEffectiveText();
      if (!text) return;

      const url = await QRCode.toDataURL(text, {
        width: size,
        margin: margin,
        color: {
          dark: fgColor,
          light: bgColor
        },
        errorCorrectionLevel: level
      });
      setQrDataUrl(url);
    } catch (e) {
      console.error(e);
    }
  };

  const applyColorScheme = (name: keyof typeof COLORS) => {
    setFgColor(COLORS[name].fg);
    setBgColor(COLORS[name].bg);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `qrcode_${Date.now()}.png`;
    link.click();
    addLog(t.common.completed, 'success');
  };

  const handleCopy = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        addLog("Copied!", 'success');
      } else {
        addLog("Clipboard API error", 'error');
      }
    } catch (e: any) {
      console.error(e);
      addLog(`Failed to copy: ${e.message}`, 'error');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBulkStatus(ProcessingStatus.PROCESSING);
      setBulkProgress(0);
      addLog(`${t.common.processing} ${file.name}`, 'info');

      const data = await readExcelFile(file);
      const firstSheet = data.sheets[0];
      const rows = getSheetData(data.workbook, firstSheet);
      
      const zip = new JSZip();
      let count = 0;
      
      const opts: any = {
        width: size,
        margin: margin,
        color: { dark: fgColor, light: bgColor },
        errorCorrectionLevel: level
      };

      const total = rows.length;
      
      for (let i = 0; i < total; i++) {
        const row = rows[i];
        const content = row[0] ? String(row[0]).trim() : '';
        
        if (content) {
          const url = await QRCode.toDataURL(content, opts);
          const base64Data = url.split(',')[1];
          
          let filename = `qr_${i + 1}`;
          if (row[1]) filename = String(row[1]).trim().replace(/[^a-z0-9]/gi, '_');
          
          zip.file(`${filename}.png`, base64Data, { base64: true });
          count++;
        }

        if (i % 10 === 0) {
           setBulkProgress(Math.round((i / total) * 100));
           await new Promise(r => setTimeout(r, 0));
        }
      }

      addLog(t.common.processing, 'info');
      const content = await zip.generateAsync({ type: 'blob' });
      const dlUrl = URL.createObjectURL(content);
      
      const link = document.createElement('a');
      link.href = dlUrl;
      link.download = `Bulk_QR_Codes_${Date.now()}.zip`;
      link.click();

      addLog(t.common.completed, 'success');
      setBulkProgress(100);

    } catch (err: any) {
      addLog(`${t.common.error}: ${err.message}`, 'error');
    } finally {
      setBulkStatus(ProcessingStatus.COMPLETED);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('single')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <QrCode size={16} />
          <span>{t.qr.single}</span>
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'bulk' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Layers size={16} />
          <span>{t.qr.bulk}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-1 space-y-6">
           
           {mode === 'single' ? (
             <div className="bg-white p-4 rounded-lg border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4">{t.qr.content}</h3>
                
                <div className="grid grid-cols-4 gap-2 mb-6">
                   {[
                     { id: 'url', icon: Link, label: t.qr.labels.url },
                     { id: 'text', icon: FileText, label: t.qr.labels.text },
                     { id: 'email', icon: Mail, label: t.qr.labels.email },
                     { id: 'wifi', icon: Wifi, label: t.qr.labels.wifi },
                     { id: 'phone', icon: Phone, label: t.qr.labels.phone },
                     { id: 'sms', icon: MessageSquare, label: t.qr.labels.sms },
                     { id: 'whatsapp', icon: Share2, label: t.qr.labels.whatsapp },
                   ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTemplate(t.id as any)}
                        className={`flex flex-col items-center justify-center p-2 rounded border text-xs transition-colors
                          ${template === t.id 
                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold' 
                            : 'hover:bg-slate-50 border-slate-100 text-slate-600'}`}
                      >
                         <t.icon size={18} className="mb-1" />
                         {t.label}
                      </button>
                   ))}
                </div>

                <div className="space-y-3">
                   {template === 'email' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                         <input 
                           type="email" placeholder={t.qr.placeholders.email} 
                           className="w-full p-2 border rounded text-sm"
                           value={emailFields.to} onChange={e => setEmailFields({...emailFields, to: e.target.value})}
                         />
                         <input 
                           type="text" placeholder={t.qr.placeholders.subject} 
                           className="w-full p-2 border rounded text-sm"
                           value={emailFields.subject} onChange={e => setEmailFields({...emailFields, subject: e.target.value})}
                         />
                         <textarea 
                           placeholder={t.qr.placeholders.body} 
                           className="w-full p-2 border rounded text-sm" rows={3}
                           value={emailFields.body} onChange={e => setEmailFields({...emailFields, body: e.target.value})}
                         />
                      </div>
                   )}

                   {template === 'wifi' && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                         <input 
                           type="text" placeholder={t.qr.placeholders.ssid} 
                           className="w-full p-2 border rounded text-sm"
                           value={wifiFields.ssid} onChange={e => setWifiFields({...wifiFields, ssid: e.target.value})}
                         />
                         <input 
                           type="text" placeholder={t.qr.placeholders.password} 
                           className="w-full p-2 border rounded text-sm"
                           value={wifiFields.password} onChange={e => setWifiFields({...wifiFields, password: e.target.value})}
                         />
                         <select 
                           className="w-full p-2 border rounded text-sm"
                           value={wifiFields.type} onChange={e => setWifiFields({...wifiFields, type: e.target.value})}
                         >
                            <option value="WPA">WPA/WPA2</option>
                            <option value="WEP">WEP</option>
                            <option value="nopass">No Password</option>
                         </select>
                      </div>
                   )}

                   {(template === 'phone' || template === 'sms' || template === 'whatsapp') && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                         <input 
                           type="tel" placeholder={t.qr.placeholders.phone} 
                           className="w-full p-2 border rounded text-sm"
                           value={phoneNum} onChange={e => setPhoneNum(e.target.value)}
                         />
                         {(template === 'sms' || template === 'whatsapp') && (
                            <textarea 
                              placeholder={t.qr.placeholders.message} 
                              className="w-full p-2 border rounded text-sm" rows={2}
                              value={inputValue} onChange={e => setInputValue(e.target.value)}
                            />
                         )}
                      </div>
                   )}

                   {(template === 'url' || template === 'text') && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                         <textarea 
                           placeholder={template === 'url' ? "https://example.com" : t.qr.placeholders.text}
                           className="w-full p-3 border rounded text-sm min-h-[100px]"
                           value={inputValue} onChange={e => setInputValue(e.target.value)}
                         />
                      </div>
                   )}
                </div>
             </div>
           ) : (
             <div className="bg-white p-6 rounded-lg border border-dashed border-slate-300 text-center">
                <label className="cursor-pointer block">
                  <UploadCloud size={32} className="mx-auto text-blue-500 mb-2" />
                  <span className="text-lg font-semibold text-slate-700 block">{t.actions.uploadFile}</span>
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls"
                    onChange={handleBulkUpload} 
                    className="hidden" 
                  />
                </label>
             </div>
           )}

           <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center">
                <Settings size={18} className="mr-2" />
                {t.common.config}
              </h3>

              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">{t.qr.color}</label>
                    <div className="flex space-x-2">
                       {Object.entries(COLORS).map(([key, val]) => (
                          <button
                            key={key}
                            onClick={() => applyColorScheme(key as any)}
                            className="w-6 h-6 rounded-full border border-slate-200 shadow-sm hover:scale-110 transition-transform"
                            style={{ backgroundColor: val.fg }}
                            title={key}
                          />
                       ))}
                       <div className="w-px bg-slate-300 mx-2"></div>
                       <input 
                         type="color" 
                         value={fgColor} 
                         onChange={e => setFgColor(e.target.value)}
                         className="w-6 h-6 rounded cursor-pointer border-none p-0"
                         title="Custom Foreground"
                       />
                       <input 
                         type="color" 
                         value={bgColor} 
                         onChange={e => setBgColor(e.target.value)}
                         className="w-6 h-6 rounded cursor-pointer border-none p-0"
                         title="Custom Background"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.qr.size}</label>
                       <input 
                         type="number" min="100" max="1000" step="10"
                         value={size} onChange={e => setSize(Number(e.target.value))}
                         className="w-full p-2 border rounded text-sm"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{t.qr.errorLevel}</label>
                       <select 
                         value={level} onChange={e => setLevel(e.target.value as any)}
                         className="w-full p-2 border rounded text-sm"
                       >
                          <option value="L">Low (7%)</option>
                          <option value="M">Medium (15%)</option>
                          <option value="Q">Quartile (25%)</option>
                          <option value="H">High (30%)</option>
                       </select>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-2 flex flex-col">
           <div className="bg-white rounded-lg border border-slate-200 h-full flex flex-col">
              <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-slate-700">
                {t.common.preview}
              </div>
              <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
                 {qrDataUrl ? (
                    <div className="bg-white p-4 shadow-xl border border-slate-100 rounded-xl">
                       <img src={qrDataUrl} alt="QR Code" style={{ maxWidth: '100%', height: 'auto' }} />
                    </div>
                 ) : (
                    <p className="text-slate-400">{t.common.noData}</p>
                 )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-between items-center">
                 <div className="text-xs text-slate-400">
                    {mode === 'single' ? t.qr.hints.instant : t.qr.hints.bulkStyle}
                 </div>
                 {mode === 'single' && (
                   <div className="flex space-x-2">
                     <button
                       onClick={handleCopy}
                       className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold transition-colors border border-slate-300"
                     >
                        <Copy size={18} />
                     </button>
                     <button
                       onClick={handleDownload}
                       className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
                     >
                        <Download size={18} />
                        <span>{t.common.download} PNG</span>
                     </button>
                   </div>
                 )}
              </div>
           </div>
        </div>

      </div>

      {bulkStatus === ProcessingStatus.PROCESSING && <ProgressBar progress={bulkProgress} label={t.common.processing} />}
    </div>
  );
};

export default QrCodeTab;