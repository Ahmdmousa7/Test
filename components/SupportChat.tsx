
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Paperclip, CheckCircle, RefreshCw, BookOpen, Search, Copy, Info, ArrowLeft, PlayCircle, ExternalLink, Lightbulb, LineChart, FileCode, Download, Database, UploadCloud, Trash2 } from 'lucide-react';
import { Language } from '../utils/translations';
import { GoogleGenAI } from "@google/genai";
import { getStoredApiKey } from '../services/geminiService';
import { getSheetData, saveWorkbook } from '../services/excelService';
import { FileData } from '../types';
import * as XLSX from 'xlsx';

interface Props {
  language?: Language;
  fileData?: FileData | null;
}

interface KnowledgeItem {
  category: string;
  titleEn: string;
  titleAr: string;
  code: string;
  descEn: string;
  descAr: string;
  example?: string;
  details?: string[];
  detailsAr?: string[];
  videoUrl?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachment?: string;
  isPython?: boolean;
  isTable?: boolean;
  tableData?: any[][];
}

const KNOWLEDGE_BASE: KnowledgeItem[] = [
  // ... (Keeping existing knowledge base items) ...
  // --- BASICS & CLEANING ---
  {
    category: 'Tip',
    titleEn: 'Remove Duplicates',
    titleAr: 'إزالة التكرار',
    code: 'Data Tab > Remove Duplicates',
    descEn: 'Quickly clean a list by removing repeated rows.',
    descAr: 'تنظيف القائمة بسرعة عن طريق حذف الصفوف المكررة.',
    details: [
      "Select the range of cells or the entire table you want to clean.",
      "Go to the **Data** tab in the Excel ribbon at the top.",
      "Click on the **Remove Duplicates** icon (in the Data Tools section).",
      "A dialog box will appear. Check the columns that define uniqueness (e.g. 'Email' or 'ID').",
      "Click **OK**. Excel will tell you how many duplicates were removed."
    ],
    detailsAr: [
      "حدد نطاق الخلايا أو الجدول الذي تريد تنظيفه.",
      "انتقل إلى علامة التبويب **بيانات (Data)** في الشريط العلوي.",
      "انقر على أيقونة **إزالة التكرارات (Remove Duplicates)**.",
      "اختر الأعمدة التي تحدد التكرار (مثل 'البريد الإلكتروني' أو 'رقم الهوية').",
      "اضغط **موافق**. سيخبرك إكسل بعدد القيم المكررة التي تم حذفها."
    ],
    videoUrl: "https://www.youtube.com/embed/anLg2h11K2E"
  },
  {
    category: 'Tip',
    titleEn: 'Flash Fill',
    titleAr: 'التعبئة السريعة',
    code: 'Ctrl + E',
    descEn: 'Magically fills data patterns (e.g. extracting first names from full names).',
    descAr: 'تعبئة البيانات تلقائياً بناءً على النمط (مثل فصل الأسماء).',
    example: 'Type example in first cell, then press Ctrl+E.',
    details: [
      "Type the desired result in the first cell next to your data.",
      "Move to the cell below it.",
      "Press **Ctrl + E**.",
      "Excel will automatically detect the pattern and fill the rest."
    ],
    detailsAr: [
      "اكتب النتيجة المطلوبة في أول خلية.",
      "انتقل للخلية التي أسفلها.",
      "اضغط **Ctrl + E**.",
      "سيقوم إكسل باكتشاف النمط وتعبئة باقي العمود."
    ],
    videoUrl: "https://www.youtube.com/embed/P8S0jZtJgJI"
  },
  {
    category: 'Tip',
    titleEn: 'Paste Values Only',
    titleAr: 'لصق القيم فقط',
    code: 'Ctrl+Alt+V > V',
    descEn: 'Removes formulas and pastes only the result values.',
    descAr: 'يزيل المعادلات ويقوم بلصق النتائج النهائية فقط.',
  },
  // --- SHORTCUTS ---
  {
    category: 'Shortcut',
    titleEn: 'AutoSum',
    titleAr: 'الجمع التلقائي',
    code: 'Alt + =',
    descEn: 'Insert the SUM formula automatically for adjacent cells.',
    descAr: 'إدراج دالة الجمع SUM تلقائياً للخلايا المجاورة.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Current Date',
    titleAr: 'التاريخ الحالي',
    code: 'Ctrl + ;',
    descEn: 'Enters the current date as a static value.',
    descAr: 'إدراج تاريخ اليوم في الخلية كقيمة ثابتة.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Current Time',
    titleAr: 'الوقت الحالي',
    code: 'Ctrl + Shift + :',
    descEn: 'Enters the current time as a static value.',
    descAr: 'إدراج الوقت الحالي في الخلية كقيمة ثابتة.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Format Cells',
    titleAr: 'تنسيق الخلايا',
    code: 'Ctrl + 1',
    descEn: 'Opens the detailed Format Cells dialog box.',
    descAr: 'فتح نافذة تنسيق الخلايا التفصيلية.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Create Table',
    titleAr: 'إنشاء جدول',
    code: 'Ctrl + T',
    descEn: 'Converts selected range into an official Excel Table.',
    descAr: 'تحويل النطاق المحدد إلى جدول إكسل رسمي.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Line Break in Cell',
    titleAr: 'سطر جديد في الخلية',
    code: 'Alt + Enter',
    descEn: 'Starts a new line within the same cell.',
    descAr: 'بدء سطر جديد داخل نفس الخلية.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Filter Toggle',
    titleAr: 'تشغيل التصفية',
    code: 'Ctrl + Shift + L',
    descEn: 'Toggles the filters on headers on/off.',
    descAr: 'تفعيل أو إيقاف أزرار التصفية (Filter) على العناوين.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Repeat Action',
    titleAr: 'تكرار الإجراء',
    code: 'F4',
    descEn: 'Repeats the last command/action, or toggles absolute reference ($).',
    descAr: 'تكرار آخر أمر قمت به، أو تثبيت المرجع ($).',
  },
  {
    category: 'Shortcut',
    titleEn: 'Select Column',
    titleAr: 'تحديد عمود',
    code: 'Ctrl + Space',
    descEn: 'Selects the entire column.',
    descAr: 'تحديد العمود بالكامل.',
  },
  {
    category: 'Shortcut',
    titleEn: 'Select Row',
    titleAr: 'تحديد صف',
    code: 'Shift + Space',
    descEn: 'Selects the entire row.',
    descAr: 'تحديد الصف بالكامل.',
  },
  // --- LOOKUP ---
  {
    category: 'Formula',
    titleEn: 'XLOOKUP (Modern)',
    titleAr: 'دالة البحث XLOOKUP',
    code: '=XLOOKUP(lookup, source, return, [not_found])',
    descEn: 'Modern replacement for VLOOKUP. Searches any direction.',
    descAr: 'البديل الحديث لـ VLOOKUP. تبحث في أي اتجاه.',
    example: '=XLOOKUP(A2, D:D, E:E, "Not Found")',
    videoUrl: "https://www.youtube.com/embed/KkIgPItQdQA"
  },
  {
    category: 'Formula',
    titleEn: 'VLOOKUP',
    titleAr: 'دالة البحث VLOOKUP',
    code: '=VLOOKUP(lookup, table, col_num, 0)',
    descEn: 'Searches first column, returns value in same row.',
    descAr: 'تبحث في العمود الأول وترجع قيمة من نفس الصف.',
    example: '=VLOOKUP("Apple", A:B, 2, 0)',
    videoUrl: "https://www.youtube.com/embed/XIy-Qp8Q7tE"
  },
  // ... (Using abbreviated list for other formulas to fit, expanding the most important ones) ...
  {
    category: 'Formula',
    titleEn: 'IF Statement',
    titleAr: 'دالة الشرط IF',
    code: '=IF(condition, true_val, false_val)',
    descEn: 'Checks a condition.',
    descAr: 'تتحقق من شرط معين.',
    example: '=IF(A1>50, "Pass", "Fail")',
  },
  {
    category: 'Formula',
    titleEn: 'COUNTIF',
    titleAr: 'العد الشرطي',
    code: '=COUNTIF(range, criteria)',
    descEn: 'Counts cells meeting a condition.',
    descAr: 'عد الخلايا التي تطابق الشرط.',
    example: '=COUNTIF(A:A, ">100")',
  },
  {
    category: 'Formula',
    titleEn: 'TEXTJOIN',
    titleAr: 'دمج النصوص',
    code: '=TEXTJOIN(delimiter, ignore_empty, text1...)',
    descEn: 'Joins text with a delimiter.',
    descAr: 'دمج النصوص مع فاصل.',
    example: '=TEXTJOIN(", ", TRUE, A1:A5)',
  }
];

// UI Translations
const UI_TEXT = {
  en: {
    contactSupport: 'Need Assistance / Ideas?',
    excelKnowledge: 'Excel Knowledge',
    dataAnalyst: 'Data Analyst (Python)',
    chat: 'Chat',
    tips: 'Excel Tips',
    analyst: 'Analyst',
    messageSent: 'Message Sent!',
    receivedMsg: 'We will email you at',
    shortly: 'shortly.',
    sendAnother: 'Send another message',
    yourEmail: 'Your Email',
    message: 'Message',
    attachFile: 'Attach file (Optional)',
    sending: 'Sending...',
    send: 'Send Message',
    searchPlaceholder: 'Search formulas & shortcuts...',
    noTips: 'No tips found.',
    needHelp: 'Need more help? Switch to the',
    syntax: 'Syntax / Path',
    howToUse: 'How to use',
    back: 'Back',
    attachCurrent: 'Attach Current File',
    analyzePrompt: 'Ask me to analyze your data (e.g. "Find top 5 sales")',
    generating: 'Analyzing data...',
    downloadResult: 'Download Result (Excel)',
    pythonCode: 'Generated Python Code:',
    runPython: 'Run Analysis',
    analystIntro: 'Upload a file or attach the current workspace file. Ask for analysis, cleaning, or summaries. I will generate Python logic to process it.',
    clearChat: 'Clear Chat'
  },
  ar: {
    contactSupport: 'تحتاج مساعدة أو لديك أفكار؟',
    excelKnowledge: 'موسوعة الإكسل',
    dataAnalyst: 'محلل البيانات (بايثون)',
    chat: 'محادثة',
    tips: 'نصائح إكسل',
    analyst: 'المحلل',
    messageSent: 'تم الإرسال!',
    receivedMsg: 'سنتواصل معك عبر البريد',
    shortly: 'قريباً.',
    sendAnother: 'إرسال رسالة أخرى',
    yourEmail: 'بريدك الإلكتروني',
    message: 'الرسالة',
    attachFile: 'إرفاق ملف (اختياري)',
    sending: 'جاري الإرسال...',
    send: 'إرسال الرسالة',
    searchPlaceholder: 'ابحث في الدوال والاختصارات...',
    noTips: 'لم يتم العثور على نتائج.',
    needHelp: 'تحتاج مساعدة؟ انتقل إلى تبويب',
    syntax: 'الصيغة / المسار',
    howToUse: 'طريقة الاستخدام',
    back: 'عودة',
    attachCurrent: 'إرفاق الملف الحالي',
    analyzePrompt: 'اطلب تحليل بياناتك (مثال: "أوجد أعلى 5 مبيعات")',
    generating: 'جاري تحليل البيانات...',
    downloadResult: 'تحميل النتيجة (Excel)',
    pythonCode: 'كود بايثون المولد:',
    runPython: 'تشغيل التحليل',
    analystIntro: 'ارفع ملفاً أو أرفق ملف العمل الحالي. اطلب تحليلاً أو تنظيفاً أو ملخصات. سأقوم بتوليد منطق بايثون لمعالجته.',
    clearChat: 'مسح المحادثة'
  }
};

const SupportChat: React.FC<Props> = ({ language = 'en', fileData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'knowledge' | 'analyst'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Knowledge Base State
  const [selectedTopic, setSelectedTopic] = useState<KnowledgeItem | null>(null);

  // Hardcoded Target Email
  const TARGET_EMAIL = "a.mousa@rewaatech.com";
  
  // Form State
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Analyst State
  const [analystMessages, setAnalystMessages] = useState<ChatMessage[]>([]);
  const [analystInput, setAnalystInput] = useState('');
  const [attachCurrentFile, setAttachCurrentFile] = useState(false);
  const [analystFile, setAnalystFile] = useState<File | null>(null);
  const analystScrollRef = useRef<HTMLDivElement>(null);

  // UI State
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const t = UI_TEXT[language];

  useEffect(() => {
    if (activeTab === 'analyst' && analystScrollRef.current) {
      analystScrollRef.current.scrollTop = analystScrollRef.current.scrollHeight;
    }
  }, [analystMessages, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    // --- INTEGRATION POINT: EmailJS / Formspree ---
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSuccess(true);
        setEmail('');
        setMessage('');
        setFile(null);
        setTimeout(() => setIsSuccess(false), 5000);
    } catch (error) {
        alert("Failed to send message. Please try again.");
    } finally {
        setIsSending(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredKnowledge = KNOWLEDGE_BASE.filter(item => 
    item.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.titleAr.includes(searchQuery) ||
    item.descEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- ANALYST LOGIC ---
  const handleAnalystSend = async () => {
    if (!analystInput.trim() && !analystFile && !attachCurrentFile) return;

    const userMsg: ChatMessage = { role: 'user', content: analystInput };
    const newHistory = [...analystMessages, userMsg];
    setAnalystMessages(newHistory);
    setAnalystInput('');
    setIsSending(true);

    try {
      const apiKey = getStoredApiKey();
      if (!apiKey) throw new Error("API Key required for analysis");

      const ai = new GoogleGenAI({ apiKey });
      
      let contextData = "";
      let fileName = "data.csv";

      // 1. Get Data Context
      if (analystFile) {
         const ab = await analystFile.arrayBuffer();
         const wb = XLSX.read(ab, { type: 'array' });
         const ws = wb.Sheets[wb.SheetNames[0]];
         const data = XLSX.utils.sheet_to_csv(ws);
         contextData = data.slice(0, 15000); 
         fileName = analystFile.name;
      } else if (attachCurrentFile && fileData) {
         const ws = fileData.workbook.Sheets[fileData.sheets[0]];
         const data = XLSX.utils.sheet_to_csv(ws);
         contextData = data.slice(0, 15000);
         fileName = fileData.name;
      }

      // Build History String to maintain context
      const historyContext = newHistory.slice(-6).map(m => { // Last 6 messages for context
         const snippet = m.content.length > 500 ? m.content.substring(0, 500) + "..." : m.content;
         return `${m.role === 'user' ? 'User' : 'Analyst'}: ${snippet}`;
      }).join('\n');

      const prompt = `
        You are an Expert Data Analyst and Python Programmer.
        
        Dataset Context (${fileName}, first ~50 rows for structure):
        """
        ${contextData}
        """
        
        Recent Conversation History:
        ${historyContext}
        
        Current User Request: "${userMsg.content}"
        
        TASK:
        1. Analyze the request based on the data provided.
        2. If the user asks for a calculation, insight, or summary, provide the answer in text.
        3. If the user asks for a MODIFIED dataset or list (e.g. "clean this", "filter rows", "list top 10"), generate a MARKDOWN TABLE representing the result (limit to 20 rows).
        4. ALWAYS provide the Python (Pandas) code that would perform this operation on the full dataset.
        
        OUTPUT FORMAT:
        - Start with the direct answer/insight.
        - If applicable, output a Markdown Table for data preview.
        - End with a code block labelled 'python' containing the full script.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      const responseText = result.text || "";

      let tableData: any[][] | undefined;
      if (responseText.includes('|---') || responseText.includes('| ---')) {
         const lines = responseText.split('\n').filter(l => l.trim().startsWith('|'));
         if (lines.length > 2) {
            const headers = lines[0].split('|').map(c => c.trim()).filter(c => c);
            const rows = lines.slice(2).map(line => 
               line.split('|').map(c => c.trim()).filter((_, i) => i > 0 && i < line.split('|').length - 1)
            );
            if (headers.length > 0) {
               tableData = [headers, ...rows];
            }
         }
      }

      const botMsg: ChatMessage = { 
        role: 'assistant', 
        content: responseText, 
        isPython: responseText.includes('```python'),
        isTable: !!tableData,
        tableData
      };

      setAnalystMessages(prev => [...prev, botMsg]);

    } catch (e: any) {
      setAnalystMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setIsSending(false);
      // Don't clear file selections to allow follow-up questions on same file
    }
  };

  const downloadTableAsExcel = (data: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analysis Result");
    saveWorkbook(wb, `Analysis_Result_${Date.now()}.xlsx`);
  };

  return (
    <div className={`fixed bottom-6 z-50 flex flex-col items-end font-sans ${language === 'ar' ? 'left-6 items-start' : 'right-6 items-end'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Chat Window */}
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5 duration-300 flex flex-col h-[600px]">
          
          {/* Header */}
          <div className="bg-slate-900 text-white p-3 shrink-0">
            <div className="flex justify-between items-center mb-3">
               <div>
                  <h3 className="font-bold flex items-center gap-2 text-sm">
                    {activeTab === 'chat' && <MessageCircle size={16} />}
                    {activeTab === 'knowledge' && <BookOpen size={16} />}
                    {activeTab === 'analyst' && <LineChart size={16} />}
                    
                    {activeTab === 'chat' ? t.contactSupport : (activeTab === 'knowledge' ? t.excelKnowledge : t.dataAnalyst)}
                  </h3>
               </div>
               <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
               >
                  <X size={18} />
               </button>
            </div>

            {/* Tabs */}
            {!selectedTopic && (
                <div className="flex bg-slate-800 p-1 rounded-md">
                  <button
                      onClick={() => setActiveTab('chat')}
                      className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded transition-all
                      ${activeTab === 'chat' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                      <MessageCircle size={14} /> {t.chat}
                  </button>
                  <button
                      onClick={() => setActiveTab('analyst')}
                      className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded transition-all
                      ${activeTab === 'analyst' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                      <Database size={14} /> {t.analyst}
                  </button>
                  <button
                      onClick={() => setActiveTab('knowledge')}
                      className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded transition-all
                      ${activeTab === 'knowledge' ? 'bg-white text-slate-900 shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                      <BookOpen size={14} /> {t.tips}
                  </button>
                </div>
            )}
          </div>

          {/* Body Content */}
          <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
             
             {/* --- TAB 1: SUPPORT CHAT --- */}
             {activeTab === 'chat' && (
                isSuccess ? (
                    <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 mb-2">{t.messageSent}</h4>
                        <p className="text-sm text-slate-500 mb-6">
                            {t.receivedMsg} <strong>{TARGET_EMAIL}</strong> {t.shortly}
                        </p>
                        <button 
                            onClick={() => setIsSuccess(false)}
                            className="text-primary-600 font-bold text-sm hover:underline"
                        >
                            {t.sendAnother}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 flex-1 h-full overflow-y-auto">
                        <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-100">
                           <Lightbulb size={16} className="inline mr-1 mb-0.5"/>
                           {language === 'ar' ? 'هل لديك فكرة لتحسين التطبيق أو واجهت مشكلة؟ تواصل معنا!' : 'Have an idea to improve the app or facing an issue? Contact us!'}
                        </div>
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">{t.yourEmail}</label>
                            <input 
                            required
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white text-slate-900 placeholder-slate-400"
                            placeholder="name@example.com"
                            disabled={isSending}
                            />
                        </div>
                        <div className="space-y-1 flex-1 flex flex-col">
                            <label className="block text-xs font-bold text-slate-500 uppercase">{t.message}</label>
                            <textarea 
                            required
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full flex-1 p-3 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-white text-slate-900 placeholder-slate-400"
                            placeholder={language === 'ar' ? "كيف يمكننا مساعدتك؟" : "How can we help?"}
                            disabled={isSending}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className={`flex items-center gap-2 w-full p-2 border border-dashed rounded-md transition-colors text-xs text-slate-600
                                ${file ? 'bg-blue-50 border-blue-300' : 'border-slate-300 hover:bg-white cursor-pointer'}`}>
                                <Paperclip size={14} className={file ? 'text-blue-600' : 'text-slate-400'} />
                                <span className="truncate flex-1 font-medium">{file ? file.name : t.attachFile}</span>
                                {file && <button type="button" onClick={() => setFile(null)} className="p-1 hover:text-red-500"><X size={14}/></button>}
                                {!file && <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" disabled={isSending} />}
                            </label>
                        </div>
                        <button 
                        type="submit"
                        disabled={isSending}
                        className={`mt-auto flex items-center justify-center gap-2 w-full py-3 text-white rounded-md text-sm font-bold shadow-md transition-all
                            ${isSending ? 'bg-slate-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 hover:shadow-lg active:scale-95'}`}
                        >
                        {isSending ? <><RefreshCw size={16} className="animate-spin" /><span>{t.sending}</span></> : <><Send size={16} /><span>{t.send}</span></>}
                        </button>
                    </form>
                )
             )}

             {/* --- TAB 2: DATA ANALYST (PYTHON) --- */}
             {activeTab === 'analyst' && (
                <div className="flex flex-col h-full bg-slate-50">
                   {analystMessages.length > 0 && (
                      <div className="p-2 bg-white border-b flex justify-end">
                         <button 
                           onClick={() => setAnalystMessages([])}
                           className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                         >
                           <Trash2 size={12}/> {t.clearChat}
                         </button>
                      </div>
                   )}
                   <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={analystScrollRef}>
                      {analystMessages.length === 0 && (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60 text-center px-4">
                            <LineChart size={48} className="mb-2" />
                            <p className="text-sm">{t.analystIntro}</p>
                         </div>
                      )}
                      
                      {analystMessages.map((msg, idx) => (
                         <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[90%] p-3 rounded-lg text-sm shadow-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'}`}>
                               {/* Simple markdown clean up for display */}
                               {msg.content.replace(/```python|```/g, '').split('\n').slice(0, 15).join('\n') + (msg.content.split('\n').length > 15 ? '...' : '')}
                               {msg.content.length > 500 && !msg.isTable && !msg.isPython ? '...' : ''}
                               
                               {/* Render Tables */}
                               {msg.isTable && msg.tableData && (
                                  <div className="mt-2 bg-slate-50 border rounded p-2 overflow-x-auto">
                                     <table className="w-full text-xs text-left">
                                        <thead>
                                           <tr className="border-b">
                                              {msg.tableData[0].map((h: any, i: number) => <th key={i} className="p-1 font-bold">{h}</th>)}
                                           </tr>
                                        </thead>
                                        <tbody>
                                           {msg.tableData.slice(1, 5).map((row: any, r: number) => (
                                              <tr key={r} className="border-b last:border-0">
                                                 {row.map((c: any, ci: number) => <td key={ci} className="p-1">{c}</td>)}
                                              </tr>
                                           ))}
                                        </tbody>
                                     </table>
                                     {msg.tableData.length > 5 && <p className="text-[10px] text-slate-400 mt-1 italic">... {msg.tableData.length - 5} more rows</p>}
                                     <button 
                                       onClick={() => downloadTableAsExcel(msg.tableData!)}
                                       className="mt-2 w-full flex items-center justify-center gap-1 bg-green-600 text-white py-1.5 rounded text-xs font-bold hover:bg-green-700"
                                     >
                                        <Download size={12} /> {t.downloadResult}
                                     </button>
                                  </div>
                               )}

                               {/* Render Code Block */}
                               {msg.isPython && (
                                  <div className="mt-2 bg-slate-900 text-green-400 p-2 rounded text-[10px] font-mono overflow-x-auto relative group">
                                     <div className="absolute top-1 right-1 text-slate-500 text-[9px] uppercase font-bold">Python</div>
                                     <pre>{msg.content.match(/```python([\s\S]*?)```/)?.[1] || msg.content}</pre>
                                  </div>
                               )}
                            </div>
                         </div>
                      ))}
                      {isSending && (
                         <div className="flex items-center gap-2 text-xs text-slate-400">
                            <RefreshCw size={12} className="animate-spin" /> {t.generating}
                         </div>
                      )}
                   </div>

                   {/* Input Area */}
                   <div className="p-3 bg-white border-t border-slate-200">
                      
                      {/* Attachments */}
                      <div className="flex gap-2 mb-2 overflow-x-auto">
                         {fileData && (
                            <button 
                               onClick={() => setAttachCurrentFile(!attachCurrentFile)}
                               className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors whitespace-nowrap
                                  ${attachCurrentFile ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                            >
                               <Database size={12} /> {t.attachCurrent}
                            </button>
                         )}
                         <label className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors cursor-pointer whitespace-nowrap
                            ${analystFile ? 'bg-green-100 border-green-300 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                            <UploadCloud size={12} /> {analystFile ? analystFile.name : t.attachFile}
                            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => setAnalystFile(e.target.files?.[0] || null)} />
                         </label>
                         {(attachCurrentFile || analystFile) && (
                            <button onClick={() => { setAttachCurrentFile(false); setAnalystFile(null); }} className="text-red-500 hover:bg-red-50 rounded p-1"><X size={12}/></button>
                         )}
                      </div>

                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           className="flex-1 p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500 bg-white text-slate-900 placeholder-slate-400"
                           placeholder={t.analyzePrompt}
                           value={analystInput}
                           onChange={(e) => setAnalystInput(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && handleAnalystSend()}
                           disabled={isSending}
                         />
                         <button 
                           onClick={handleAnalystSend}
                           disabled={isSending || (!analystInput && !analystFile && !attachCurrentFile)}
                           className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                            <Send size={18} />
                         </button>
                      </div>
                   </div>
                </div>
             )}

             {/* --- TAB 3: KNOWLEDGE BASE --- */}
             {activeTab === 'knowledge' && (
                selectedTopic ? (
                    // --- DETAIL VIEW ---
                    <div className="flex flex-col h-full bg-white animate-in slide-in-from-right-10 duration-200">
                        {/* Detail Header */}
                        <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                            <button 
                                onClick={() => setSelectedTopic(null)}
                                className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"
                            >
                                <ArrowLeft size={18} className={`text-slate-600 ${language === 'ar' ? 'rotate-180' : ''}`} />
                            </button>
                            <span className="text-sm font-bold text-slate-700 truncate">{language === 'ar' ? selectedTopic.titleAr : selectedTopic.titleEn}</span>
                        </div>
                        
                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            
                            {/* Video */}
                            {selectedTopic.videoUrl && (
                                <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 bg-black aspect-video relative group">
                                    <iframe 
                                        src={selectedTopic.videoUrl} 
                                        title="Tutorial Video"
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            )}

                            {/* Titles */}
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-lg font-bold text-slate-900">
                                       {language === 'ar' ? selectedTopic.titleAr : selectedTopic.titleEn}
                                    </h2>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                                        ${selectedTopic.category === 'Formula' ? 'bg-blue-100 text-blue-700' : 
                                            selectedTopic.category === 'Shortcut' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                        {selectedTopic.category}
                                    </span>
                                </div>
                                <h3 className="text-sm text-slate-500">
                                   {language === 'ar' ? selectedTopic.titleEn : selectedTopic.titleAr}
                                </h3>
                            </div>

                            {/* Description */}
                            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-sm text-slate-700 mb-2">{language === 'ar' ? selectedTopic.descAr : selectedTopic.descEn}</p>
                            </div>

                            {/* Code / Syntax */}
                            {selectedTopic.code && (
                                <div className="mb-5">
                                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">{t.syntax}</label>
                                    <div className="bg-slate-800 text-green-400 p-3 rounded font-mono text-xs relative group/code" dir="ltr">
                                        <div className="pr-6 break-all">{selectedTopic.code}</div>
                                        <button 
                                            onClick={() => handleCopy(selectedTopic.example || selectedTopic.code, 'code')}
                                            className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                                        >
                                            {copiedId === 'code' ? <CheckCircle size={14}/> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    {selectedTopic.example && (
                                        <p className="text-xs text-slate-500 mt-1 font-mono" dir="ltr">Ex: {selectedTopic.example}</p>
                                    )}
                                </div>
                            )}

                            {/* Steps */}
                            {(selectedTopic.details || selectedTopic.detailsAr) && (
                                <div className="mb-4">
                                    <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                                        <Info size={16} className="text-blue-500"/> {t.howToUse}
                                    </h4>
                                    <ul className="space-y-2">
                                        {(language === 'ar' && selectedTopic.detailsAr ? selectedTopic.detailsAr : selectedTopic.details || []).map((step, idx) => (
                                            <li key={idx} className="text-sm text-slate-600 flex gap-2">
                                                <span className="font-bold text-slate-400 text-xs mt-0.5">{idx + 1}.</span>
                                                <span dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                        </div>
                    </div>
                ) : (
                    // --- LIST VIEW ---
                    <div className="flex flex-col h-full">
                        {/* Search Bar */}
                        <div className="p-3 bg-white border-b border-slate-200 sticky top-0 z-10">
                            <div className="relative">
                                <Search size={14} className={`absolute top-1/2 transform -translate-y-1/2 text-slate-400 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
                                <input 
                                type="text" 
                                placeholder={t.searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={`w-full py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 placeholder-slate-400 ${language === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                            {filteredKnowledge.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                                    <Info size={24} className="mb-2 opacity-50"/>
                                    <p>{t.noTips}</p>
                                </div>
                            ) : (
                                filteredKnowledge.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setSelectedTopic(item)}
                                        className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
                                    >
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">
                                                   {language === 'ar' ? item.titleAr : item.titleEn}
                                                </h4>
                                                {item.videoUrl && <PlayCircle size={12} className="text-red-500 fill-red-100" />}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                               {language === 'ar' ? item.titleEn : item.titleAr}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0
                                            ${item.category === 'Formula' ? 'bg-blue-100 text-blue-700' : 
                                                item.category === 'Shortcut' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                            {item.category}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                       {language === 'ar' ? item.descAr : item.descEn}
                                    </p>
                                    </div>
                                ))
                            )}
                            
                            {/* Footer Tip */}
                            <div className="text-[10px] text-center text-slate-400 mt-4 pb-2">
                                {t.needHelp} <strong>{t.chat}</strong>.
                            </div>
                        </div>
                    </div>
                )
             )}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50
          ${isOpen ? 'bg-slate-100 text-slate-600 rotate-90 scale-90' : 'bg-primary-600 text-white'}`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={28} />}
      </button>
    </div>
  );
};

export default SupportChat;
