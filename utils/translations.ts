
export type Language = 'en' | 'ar';

export const TRANSLATIONS = {
  en: {
    appTitle: 'X-Tools',
    common: {
      config: 'Configuration',
      selectSheet: 'Select Sheet',
      selectCols: 'Select Columns',
      start: 'Start Processing',
      processing: 'Processing...',
      reset: 'Reset',
      download: 'Download',
      completed: 'Completed',
      error: 'Error',
      rows: 'rows',
      preview: 'Preview',
      save: 'Save',
      delete: 'Delete',
      template: 'Template',
      noData: 'No data found',
      dragDrop: 'Drag & Drop files here',
      browse: 'or click to browse',
      workbench: 'Workbench',
      results: 'Results',
      export: 'Export',
      batchSize: 'Batch Size',
      files: 'Files',
      selected: 'Selected',
      instructions: 'Instructions:',
      actions: 'Actions'
    },
    menu: {
      excelTools: 'Excel & Data Tools',
      aiTools: 'AI & Extraction',
      mediaTools: 'PDF & Image Tools',
      utils: 'Utilities',
    },
    toolInfo: {
      translator: {
        desc: 'Translate Excel columns in bulk maintaining structure.',
        instr: 'Upload an Excel file, select columns, choose language (AR/EN), and start processing. Use API keys for best performance.'
      },
      duplicates: {
        desc: 'Find and resolve duplicate entries intelligently.',
        instr: 'Select columns to check for uniqueness. Use "Composite Key" to check combinations (e.g. Name + ID). You can highlight or auto-resolve duplicates.'
      },
      packs: {
        desc: 'Group items into packs based on a Key ID.',
        instr: 'Use this to flatten multiple rows with the same ID into a single row with multiple columns (e.g. Size 1, Size 2).'
      },
      balance: {
        desc: 'Ensure all product variants exist (e.g., every Color has every Size).',
        instr: 'Select the Product ID column and Option columns (Color, Size). The tool will generate missing rows for incomplete combinations.'
      },
      salla: {
        desc: 'Format product lists for Salla platform.',
        instr: 'Upload your raw product export. The tool will auto-detect Simple vs Variable products and split them into separate sheets.'
      },
      zid: {
        desc: 'Organize products for Zid platform (Variants & Simple).',
        instr: 'Identifies "Has Variant" column. Fills down parent names for variables, separates Simple/Variable products, and removes empty columns.'
      },
      rewaa: {
        desc: 'Map and format products for Rewaa Platform import.',
        instr: 'Select Product Type (Simple/Variable/Composite). Map your file columns to Rewaa standard fields. Configure location pricing rules.'
      },
      composite: {
        desc: 'Validate composite items against raw materials and calculate costs.',
        instr: 'Requires two sheets: "Composite" and "Raw". Checks if SKUs exist. Optionally calculates total cost based on ingredient prices.'
      },
      csv: {
        desc: 'Convert CSV files to Excel .xlsx format.',
        instr: 'Upload multiple CSVs. You can merge them into one workbook (tabs) or convert them individually into a ZIP.'
      },
      ocr: {
        desc: 'Extract data from images/PDFs to Excel.',
        instr: 'Upload invoices, menus, or receipts. Define a schema or use a prompt. The AI extracts the data into a structured table.'
      },
      scraper: {
        desc: 'Extract structured data from any website.',
        instr: 'Enter a URL and a prompt (e.g. "Extract product prices"). The tool uses AI to parse the page content.'
      },
      pdfTools: {
        desc: 'Split or join PDF documents easily.',
        instr: 'To Merge: Upload multiple PDFs and reorder. To Split: Upload one PDF and choose a page range or split by count.'
      },
      imgPdf: {
        desc: 'Convert multiple images into a single PDF.',
        instr: 'Upload JPG/PNG images. Adjust page size (A4/Letter) and margins, then download.'
      },
      mergeImg: {
        desc: 'Stitch images together vertically or horizontally.',
        instr: 'Upload images. Select direction (Vertical/Horizontal). Useful for creating long screenshots or collages.'
      },
      compressor: {
        desc: 'Compress images to reduce file size.',
        instr: 'Upload images. Choose a preset (Balanced, Extreme, HQ). Processes locally in browser.'
      },
      qr: {
        desc: 'Generate single or bulk QR codes.',
        instr: 'Single Mode: Enter text/URL. Bulk Mode: Upload Excel with data in Column A.'
      },
      qc: {
        desc: 'Compare two files (Data vs Data or Visual vs Data) to ensure accuracy.',
        instr: 'Upload File A and File B. If both are Excel/CSV, select columns to compare. If one is Image/PDF, use the visual reviewer.'
      },
      workflow: {
        desc: 'Automate repetitive tasks like deleting columns, filtering, and formatting.',
        instr: 'Upload a file, add steps (Delete Column, Filter, Format, etc.), and run the workflow. Save workflows for later use.'
      },
      gsheets: {
        desc: 'Import data directly from Google Sheets via URL.',
        instr: 'Paste a Google Sheet URL (must be public or published). The tool imports it as an Excel file for processing.'
      },
      tracker: {
        desc: 'Track account setups, owners, and notes for CRM/Zoho items.',
        instr: 'Paste a Zoho/CRM URL to auto-extract ID, or paste text content. Add owners and notes, then export to Excel.'
      }
    },
    tabs: {
      translator: 'AI Translator',
      duplicates: 'Check Duplicates',
      packs: 'Packs Manager',
      balance: 'Product Variants',
      salla: 'Salla Organizer',
      zid: 'Zid Organizer',
      rewaa: 'Rewaa Manager',
      composite: 'Composite Check',
      csv: 'CSV to Excel',
      ocr: 'OCR Extraction',
      scraper: 'Web Scraper',
      pdfTools: 'PDF Tools',
      imgPdf: 'Images to PDF',
      mergeImg: 'Merge Images',
      compressor: 'Image Compressor',
      qr: 'QR Generator',
      qc: 'QC Check',
      workflow: 'Workflow Automation',
      gsheets: 'Google Sheets Import',
      tracker: 'Link Tracker'
    },
    actions: {
      uploadFile: 'Upload File',
      selectFile: 'Select Source File',
      removeFile: 'Remove',
      reset: 'Reset Tool',
      hideLogs: 'Hide Logs',
      showLogs: 'Show Logs',
      clearHistory: 'Clear History',
      configureKey: 'API Key',
      saveKeys: 'Save Keys',
      saved: 'Configuration Saved',
      test: 'Test',
      autoRotate: 'Auto-rotates keys to bypass rate limits.',
      getGemini: 'Get Gemini Key',
      getGroq: 'Get Groq Key',
      valid: 'Valid',
      invalid: 'Invalid',
      quota: 'Quota',
    },
    system: {
      logs: 'System Logs',
      uploadHint: 'Upload an Excel (.xlsx) or CSV file to begin processing.',
      fileLoaded: 'File Loaded',
      sheets: 'Sheets Detected',
    },
    theme: {
      light: 'Light',
      dark: 'Dark',
      forest: 'Forest',
    },
    translate: {
      mode: 'Processing Mode',
      merge: 'Merge Selected',
      mergeDesc: 'Combines all into one output cell.',
      separate: 'Separate Columns',
      separateDesc: 'Independent output per column.',
      direction: 'Language Direction',
      ar_en: 'Arabic → English',
      en_ar: 'English → Arabic',
      auto: 'Auto-Detect (⇄)',
      speed: 'Performance & Speed',
      safeMode: 'Safe Mode (Slower)',
      turboMode: 'Turbo Mode (Faster)',
      outputCol: 'Output Column',
      mapCols: 'Map Output Columns',
      contextCol: 'Context Column (Optional)',
      contextDesc: 'Helps AI understand ambiguous terms.',
      domain: 'Content Domain',
      glossary: 'Glossary (Ignore List)',
      glossaryPlace: 'e.g. Nike, Apple, LED',
      domains: {
        general: 'General',
        ecommerce: 'E-commerce / Retail',
        technical: 'Technical / IT',
        legal: 'Legal / Official'
      }
    },
    duplicates: {
      mode: 'Check Mode',
      composite: 'Composite Key',
      compositeDesc: 'Checks combination of selected columns.',
      individual: 'Individual Columns',
      individualDesc: 'Checks each column separately.',
      fullRow: 'Check Full Row Duplicates',
      fullRowDesc: 'Highlights entire duplicate rows in Yellow.',
      autoResolve: 'Auto-Resolve Duplicates',
      autoResolveDesc: 'Modifies duplicates (appends -1, -2) instead of highlighting.',
      rawValues: 'Use Raw Values (Fix Scientific Notation)',
      compareAcross: 'Compare Across Different Sheets',
      sourceSheet: 'Source Sheet (To Check)',
      targetSheet: 'Reference Sheet (To Look In)',
      selectSourceCol: 'Select Source Column',
      selectRefCol: 'Select Reference Column',
    },
    balance: {
      groupCol: 'Grouping Column (Product ID/SKU)',
      optionCols: 'Option Columns (Size, Color, etc)',
      clearCols: 'Columns to Clear in New Rows (Price, Qty)',
      catCol: 'Category Column (Optional)',
      nameCol: 'Product Name Column (Optional)',
      analysis: 'Analysis Report',
      balanced: 'Balanced',
      unbalanced: 'Unbalanced',
      action: 'Action Taken',
      added: 'Missing Variant Added',
      existing: 'Existing Variant',
      compareSheet: 'Verification Report',
      compareHeaders: ['Product ID', 'Status', 'Original Variants', 'Added Variants', 'Final Total', 'Expected Total', 'Validation'],
      summarySheet: 'Balance Summary',
      summaryHeaders: ['SKU', 'Option 1 Count', 'Option 2 Max Count', 'Details', 'Balance Status', 'All Values'],
      pass: 'Pass',
      fail: 'Fail',
      catError: 'Error: Name in Multiple Categories',
      emptyOptError: 'Error: Empty Option',
      dupVariantError: 'Error: Duplicate Variant',
      balancedSheet: 'Balanced Product List (Ready)'
    },
    salla: {
      title: 'Salla Product Analyzer',
      selectProductSheet: 'Select Products Sheet',
      howItWorks: 'How it works:',
      point1: "Scans for 'Type' column (النوع) or detects data like 'Product'.",
      point2: "Identifies Simple Products vs Variable Products.",
      point3: "Auto-removes empty columns.",
      analyzeBtn: 'Analyze & Split Products',
    },
    zid: {
      title: 'Zid Product Organizer',
      selectSheet: 'Select Data Sheet',
      colVariant: 'Column: Has Variant (هل يوجد خيارات)',
      colName: 'Column: Product Name (اسم المنتج)',
      howItWorks: 'Logic Flow:',
      point1: 'Checks "Has Variant": Yes = Variable, No = Simple, Empty (under Yes) = Variant.',
      point2: 'Fills down the Parent Name into a new column.',
      point3: 'Separates Simple/Variable products & removes empty columns.',
      analyzeBtn: 'Organize Zid Data',
    },
    rewaa: {
      title: 'Rewaa Platform Manager',
      openPlatform: 'Open Import Page',
      prodType: 'Product Type',
      simple: 'Simple Product',
      variable: 'Variable Product',
      composite: 'Composite Product',
      mapping: 'Field Mapping',
      rewaaField: 'Rewaa Field',
      yourCol: 'Your Column',
      locations: 'Locations & Inventory',
      unify: 'All Locations have the same: Retail Price, Cost, Tax',
      branches: 'Branch Names (comma separated)',
      branchesPlace: 'e.g. Main Branch, Warehouse, Riyadh Outlet',
      generate: 'Generate Rewaa Import File',
      autoMap: 'Auto-Map Columns',
      fields: {
        name: 'Product Name',
        sku: 'SKU',
        barcode: 'Barcode',
        category: 'Category',
        cost: 'Cost Price',
        price: 'Retail Price',
        tax: 'Tax Code',
        supplier: 'Supplier',
        parent: 'Parent SKU',
        varName: 'Variant Name',
        varSku: 'Variant SKU',
        opt1Name: 'Option 1 Name',
        opt1Val: 'Option 1 Value',
        compSku: 'Composite SKU',
        itemSku: 'SKU Item',
        qty: 'Quantity'
      }
    },
    packs: {
      groupKey: 'Grouping Key',
      sortPack: 'Sort Packs By (Optional)',
      none: 'None (Keep Order)',
      desc: 'Select the unique ID column (Key) to group items.',
    },
    composite: {
      compSheet: 'Composite Sheet (To Validate)',
      rawSheet: 'Raw Materials Sheet (Source)',
      autoAlign: 'Compact Columns (Shift Left)',
      fuzzy: 'Fuzzy Matching (Typo Detection)',
      tolerance: 'Similarity Tolerance',
      validateBtn: 'Validate Composite',
      rawSkuCol: 'Raw SKU Column (for Cost Lookup)',
      costCol: 'Unit Cost Column',
      calcCost: 'Calculate Roll-up Cost'
    },
    ocr: {
      template: 'Extraction Template',
      promptMode: 'Simple Text Prompt',
      schemaMode: 'Strict Schema Builder',
      prompt: 'Prompt Instruction',
      defineCols: 'Define Columns',
      addCol: 'Add Column',
      saveTemplate: 'Save current config as template',
      autoBilingual: 'Auto-Bilingual Format',
      smartSplit: 'Smart Size Split',
      extractBtn: 'Start Extraction',
      uploadTitle: 'Drag & Drop Images / PDFs',
      labels: {
        free: 'Free Form',
        invoice: 'Invoice / Bill',
        menu: 'Restaurant Menu',
        receipt: 'Retail Receipt',
        id: 'ID / Passport'
      },
      browserMemory: 'Files are processed in browser memory',
      hideSource: 'Hide Source',
      verify: 'Verify Mode',
      done: 'Done',
      edit: 'Edit',
      cleanPrices: 'Clean Prices',
      selectRow: 'Select a row to see source image',
      colName: 'Col Name',
      descType: 'Description / Type',
      templateName: 'Template Name...'
    },
    scraper: {
      url: 'Target URL',
      prompt: 'Extraction Prompt',
      smartMode: 'Smart Mode Active',
      preview: 'Data Preview',
    },
    csv: {
      outputMode: 'Output Mode',
      merge: 'Merge to One Workbook',
      mergeDesc: 'Creates one .xlsx file with multiple tabs.',
      zip: 'Batch Convert (ZIP)',
      zipDesc: 'Converts each CSV to a separate .xlsx file.',
      encoding: 'File Encoding',
      delimiter: 'Delimiter',
      forceText: 'Force Text Format (Phone Numbers)',
      splitLarge: 'Split Large Files',
      rowLimit: 'Max Rows per Sheet',
      smartMerge: 'Smart Header Align (Merge)',
      settings: 'Import Settings'
    },
    pdf: {
      split: 'Cut / Split PDF',
      merge: 'Merge PDFs',
      splitMethod: 'Split Method',
      fixedPage: 'Fixed Page Count',
      extractAll: 'Extract All Pages',
      range: 'Extract Specific Range',
      pagesPerFile: 'Pages per file:',
      hint: 'Upload multiple PDF files and arrange them in the desired order.'
    },
    image: {
      direction: 'Direction',
      vertical: 'Vertical',
      horizontal: 'Horizontal',
      gap: 'Gap (px)',
      uniform: 'Uniform Scale',
      bg: 'Background',
      transparent: 'Transparent',
      compressMode: 'Compression Mode',
      balanced: 'Balanced',
      extreme: 'Extreme',
      hq: 'Original/HQ',
      custom: 'Custom',
      quality: 'Quality',
      resize: 'Resize (Max Width)',
      format: 'Output Format',
      genPdf: 'Generate PDF',
      pageSize: 'Page Size',
      margins: 'Margins',
      fitToImage: 'Fit to Image',
      portrait: 'Portrait',
      landscape: 'Landscape',
      none: 'None',
      small: 'Small',
      normal: 'Normal',
      large: 'Large',
      webp: 'WebP',
      jpeg: 'JPEG',
      png: 'PNG',
      original: 'Original',
      dims: {
        original: 'Original Dimensions',
        k4: '4K Ultra HD (3840px)',
        fhd: 'Full HD (1920px)',
        hd: 'HD (1280px)',
        web: 'Web Friendly (800px)'
      }
    },
    qr: {
      single: 'Single QR',
      bulk: 'Bulk Import',
      content: 'Content Type',
      color: 'Color Themes',
      size: 'Size (px)',
      errorLevel: 'Error Correction',
      labels: {
        url: 'URL',
        text: 'Text',
        email: 'Email',
        wifi: 'WiFi',
        phone: 'Phone',
        sms: 'SMS',
        whatsapp: 'WhatsApp'
      },
      placeholders: {
        email: 'Email Address *',
        subject: 'Subject',
        body: 'Message body...',
        ssid: 'Network Name (SSID) *',
        password: 'Password',
        phone: 'Phone Number (with code)',
        message: 'Message...',
        text: 'Enter text here...'
      },
      hints: {
        instant: 'Generated instantly',
        bulkStyle: 'Bulk items use current style'
      }
    },
    qc: {
      title: 'Quality Control',
      uploadA: 'Upload Reference File (File A)',
      uploadB: 'Upload Target File (File B)',
      fileType: 'File Type',
      visualMode: 'Visual Verification Mode',
      dataMode: 'Data Comparison Mode',
      keyCol: 'Unique Key Column (e.g. ID, SKU)',
      colsToCompare: 'Columns to Check',
      fuzzy: 'Ignore case & whitespace',
      run: 'Run Comparison',
      mismatch: 'Mismatch',
      missingInB: 'Missing in File B',
      match: 'Match',
      report: 'QC Report',
      row: 'Row',
      col: 'Column',
      valA: 'Value A (Ref)',
      valB: 'Value B (Target)',
      allMatch: 'Perfect Match! No errors found.',
      selectKey: 'Select Key'
    },
    workflow: {
      title: 'Workflow Automation',
      addStep: 'Add Step',
      save: 'Save Workflow',
      load: 'Load Workflow',
      colIndex: 'Column Index',
      condition: 'Condition',
      value: 'Value',
      run: 'Run Workflow',
      noSteps: 'No steps added. Add steps to create a workflow.',
      steps: {
        deleteCol: 'Delete Column',
        filter: 'Filter Rows',
        format: 'Format Text',
        replace: 'Find & Replace',
        dedupe: 'Remove Duplicates'
      },
      actions: {
        contains: 'Contains',
        equals: 'Equals',
        notContains: 'Does Not Contain',
        trim: 'Trim Whitespace',
        upper: 'Uppercase',
        lower: 'Lowercase',
        title: 'Title Case'
      }
    },
    gsheets: {
      importing: 'Importing Google Sheet...',
      error: 'Import Error',
      success: 'Google Sheet imported successfully.',
      url: 'Google Sheet URL',
      urlPlace: 'Paste full URL here...',
      load: 'Load Sheet',
      recent: 'Recent Imports',
      clear: 'Clear History',
      tip: 'Ensure the Google Sheet is "Anyone with link" or published to web (File > Share > Publish to web).',
      sheetInfo: 'Sheet Info'
    },
    tracker: {
      title: 'Link Tracker',
      defaultNote: 'Default Note',
      urlPlaceholder: 'Paste Zoho or CRM URL...',
      accountNum: 'Account Number',
      owner: 'Owner',
      note: 'Note',
      add: 'Add Record',
      list: 'Tracker List',
      date: 'Date'
    }
  },
  ar: {
    appTitle: 'أدوات إكس',
    common: {
      config: 'الإعدادات',
      selectSheet: 'اختر الورقة',
      selectCols: 'اختر الأعمدة',
      start: 'بدء المعالجة',
      processing: 'جاري المعالجة...',
      reset: 'إعادة تعيين',
      download: 'تحميل',
      completed: 'اكتمل',
      error: 'خطأ',
      rows: 'صفوف',
      preview: 'معاينة',
      save: 'حفظ',
      delete: 'حذف',
      template: 'قالب',
      noData: 'لا توجد بيانات',
      dragDrop: 'سحب وإفلات الملفات هنا',
      browse: 'أو انقر للاستعراض',
      workbench: 'منطقة العمل',
      results: 'النتائج',
      export: 'تصدير',
      batchSize: 'حجم الدفعة',
      files: 'الملفات',
      selected: 'تم التحديد',
      instructions: 'التعليمات:',
      actions: 'إجراءات'
    },
    menu: {
      excelTools: 'أدوات الإكسل والبيانات',
      aiTools: 'الذكاء الاصطناعي والاستخراج',
      mediaTools: 'أدوات الصور والملفات',
      utils: 'أدوات مساعدة',
    },
    toolInfo: {
      translator: {
        desc: 'ترجمة أعمدة الإكسل دفعة واحدة مع الحفاظ على الهيكلية.',
        instr: 'ارفع ملف إكسل، اختر الأعمدة، حدد اللغة (عربي/إنجليزي)، وابدأ المعالجة. استخدم مفاتيح API لأفضل أداء.'
      },
      duplicates: {
        desc: 'البحث عن المدخلات المكررة وحلها بذكاء.',
        instr: 'حدد الأعمدة للتحقق من التفرد. استخدم "المفتاح المركب" للتحقق من مجموعات (مثل الاسم + المعرف). يمكنك تظليل التكرارات أو حلها تلقائياً.'
      },
      packs: {
        desc: 'تجميع العناصر في حزم بناءً على معرف رئيسي (Key ID).',
        instr: 'استخدم هذا لدمج صفوف متعددة لها نفس المعرف في صف واحد بأعمدة متعددة (مثل مقاس 1، مقاس 2).'
      },
      balance: {
        desc: 'ضمان وجود جميع متغيرات المنتجات (مثل توفر جميع المقاسات لكل لون).',
        instr: 'حدد عمود معرف المنتج وأعمدة الخيارات (اللون، المقاس). ستقوم الأداة بإنشاء الصفوف الناقصة للمجموعات غير المكتملة.'
      },
      salla: {
        desc: 'تنسيق قوائم المنتجات لمنصة سلة.',
        instr: 'ارفع ملف تصدير المنتجات الخام. ستقوم الأداة تلقائياً باكتشاف المنتجات البسيطة مقابل المنتجات المتغيرة وتقسيمها إلى أوراق منفصلة.'
      },
      zid: {
        desc: 'تنظيم منتجات منصة زد (متغيرات وبسيطة).',
        instr: 'يحدد عمود "هل يوجد خيارات". يملأ اسم المنتج الأصلي للمتغيرات، ويفصل المنتجات البسيطة عن المتغيرة، ويحذف الأعمدة الفارغة.'
      },
      rewaa: {
        desc: 'رسم خرائط وتنسيق المنتجات لاستيراد منصة رواء.',
        instr: 'اختر نوع المنتج (بسيط/متغير/مركب). قم بربط أعمدة ملفك بحقول رواء القياسية. قم بتهيئة قواعد تسعير المواقع.'
      },
      composite: {
        desc: 'التحقق من صحة العناصر المركبة وحساب التكاليف.',
        instr: 'يتطلب ورقتين: "مركب" و "خام". يتحقق مما إذا كانت وحدات SKU موجودة. يمكنه حساب التكلفة الإجمالية بناءً على أسعار المواد الخام.'
      },
      csv: {
        desc: 'تحويل ملفات CSV إلى تنسيق Excel .xlsx.',
        instr: 'ارفع ملفات CSV متعددة. يمكنك دمجها في مصنف واحد (علامات تبويب) أو تحويلها بشكل فردي إلى ملف ZIP.'
      },
      ocr: {
        desc: 'استخراج البيانات من الصور/ملفات PDF إلى إكسل.',
        instr: 'ارفع الفواتير، القوائم، أو الإيصالات. حدد الهيكل أو استخدم وصفاً نصياً. يقوم الذكاء الاصطناعي باستخراج البيانات في جدول منظم.'
      },
      scraper: {
        desc: 'استخراج بيانات منظمة من أي موقع إلكتروني.',
        instr: 'أدخل رابط URL ووصفاً (مثلاً "استخراج أسعار المنتجات"). تستخدم الأداة الذكاء الاصطناعي لتحليل محتوى الصفحة.'
      },
      pdfTools: {
        desc: 'تقسيم أو دمج مستندات PDF بسهولة.',
        instr: 'للدمج: ارفع ملفات PDF متعددة وأعد ترتيبها. للتقسيم: ارفع ملف PDF واحد واختر نطاق الصفحات أو التقسيم بالعدد.'
      },
      imgPdf: {
        desc: 'تحويل صور متعددة إلى ملف PDF واحد.',
        instr: 'ارفع صور JPG/PNG. اضبط حجم الصفحة (A4/Letter) والهوامش، ثم حمل الملف.'
      },
      mergeImg: {
        desc: 'دمج الصور معاً عمودياً أو أفقياً.',
        instr: 'ارفع الصور. حدد الاتجاه (عمودي/أفقي). مفيد لإنشاء لقطات شاشة طويلة أو مجمعة.'
      },
      compressor: {
        desc: 'ضغط الصور لتقليل حجم الملف.',
        instr: 'ارفع الصور. اختر إعداداً مسبقاً (متوازن، أقصى، جودة عالية). تتم المعالجة محلياً في المتصفح.'
      },
      qr: {
        desc: 'إنشاء رموز استجابة سريعة مفردة أو مجمعة.',
        instr: 'الوضع المفرد: أدخل النص/الرابط. الوضع المجمع: ارفع ملف إكسل يحتوي على البيانات في العمود A.'
      },
      qc: {
        desc: 'مقارنة ملفين (بيانات ضد بيانات أو مرئي ضد بيانات) لضمان الدقة.',
        instr: 'ارفع الملف A والملف B. إذا كان كلاهما Excel/CSV، اختر الأعمدة للمقارنة. إذا كان أحدهما صورة/PDF، استخدم وضع المراجعة المرئية.'
      },
      workflow: {
        desc: 'أتمتة المهام المتكررة مثل حذف الأعمدة والتصفية والتنسيق.',
        instr: 'ارفع ملفاً، أضف خطوات (حذف عمود، تصفية، تنسيق، إلخ)، وقم بتشغيل العملية. احفظ العمليات للاستخدام لاحقاً.'
      },
      gsheets: {
        desc: 'استيراد البيانات مباشرة من جداول جوجل عبر الرابط.',
        instr: 'الصق رابط جدول جوجل (يجب أن يكون عاماً أو منشوراً). تقوم الأداة باستيراده كملف Excel للمعالجة.'
      },
      tracker: {
        desc: 'تتبع إعداد الحسابات والمالكين والملاحظات لعناصر CRM/Zoho.',
        instr: 'الصق رابط Zoho/CRM لاستخراج المعرف تلقائياً، أو الصق المحتوى النصي. أضف المالكين والملاحظات، ثم قم بالتصدير إلى Excel.'
      }
    },
    tabs: {
      translator: 'المترجم الذكي',
      duplicates: 'فحص التكرار',
      packs: 'إدارة الحزم',
      balance: 'توازن المنتجات',
      salla: 'منظم سلة',
      zid: 'منظم زد',
      rewaa: 'مدير رواء',
      composite: 'فحص المواد المركبة',
      csv: 'تحويل CSV',
      ocr: 'استخراج النصوص (OCR)',
      scraper: 'استخراج بيانات الويب',
      pdfTools: 'أدوات PDF',
      imgPdf: 'صور إلى PDF',
      mergeImg: 'دمج الصور',
      compressor: 'ضغط الصور',
      qr: 'صانع الباركود',
      qc: 'فحص الجودة (QC)',
      workflow: 'أتمتة العمليات',
      gsheets: 'استيراد جداول جوجل',
      tracker: 'متتبع الروابط'
    },
    actions: {
      uploadFile: 'رفع ملف',
      selectFile: 'اختر الملف المصدري',
      removeFile: 'حذف',
      reset: 'إعادة تعيين',
      hideLogs: 'إخفاء السجل',
      showLogs: 'إظهار السجل',
      clearHistory: 'مسح السجل',
      configureKey: 'مفتاح API',
      saveKeys: 'حفظ الإعدادات',
      saved: 'تم الحفظ بنجاح',
      test: 'فحص',
      autoRotate: 'تدوير المفاتيح تلقائياً لتجاوز حدود الاستخدام.',
      getGemini: 'احصل على مفتاح Gemini',
      getGroq: 'احصل على مفتاح Groq',
      valid: 'فعال',
      invalid: 'غير صالح',
      quota: 'تجاوز الحد',
    },
    system: {
      logs: 'سجلات النظام',
      uploadHint: 'قم برفع ملف Excel (.xlsx) أو CSV للبدء.',
      fileLoaded: 'تم تحميل الملف',
      sheets: 'أوراق عمل',
    },
    theme: {
      light: 'فاتح',
      dark: 'داكن',
      forest: 'غابة',
    },
    translate: {
      mode: 'نمط المعالجة',
      merge: 'دمج المحدد',
      mergeDesc: 'يدمج النصوص في خلية واحدة.',
      separate: 'فصل الأعمدة',
      separateDesc: 'ترجمة مستقلة لكل عمود.',
      direction: 'اتجاه الترجمة',
      ar_en: 'عربي ← إنجليزي',
      en_ar: 'إنجليزي ← عربي',
      auto: 'كشف تلقائي (⇄)',
      speed: 'الأداء والسرعة',
      safeMode: 'الوضع الآمن (أبطأ)',
      turboMode: 'وضع التيربو (سريع)',
      outputCol: 'عمود الناتج',
      mapCols: 'تعيين أعمدة الناتج',
      contextCol: 'عمود السياق (اختياري)',
      contextDesc: 'يساعد الذكاء الاصطناعي على فهم المعنى.',
      domain: 'مجال المحتوى',
      glossary: 'القاموس (تجاهل الترجمة)',
      glossaryPlace: 'مثال: Apple, Nike, LED',
      domains: {
        general: 'عام',
        ecommerce: 'تجارية / متاجر',
        technical: 'تقني / هندسي',
        legal: 'قانوني / رسمي'
      }
    },
    duplicates: {
      mode: 'نمط الفحص',
      composite: 'المفتاح المركب',
      compositeDesc: 'يفحص تكرار دمج الأعمدة المحددة.',
      individual: 'أعمدة فردية',
      individualDesc: 'يفحص تكرار كل عمود على حدة.',
      fullRow: 'فحص تطابق الصف بالكامل',
      fullRowDesc: 'يظلل الصفوف المكررة بالكامل باللون الأصفر.',
      autoResolve: 'حل التكرار تلقائياً',
      autoResolveDesc: 'يعدل القيم المكررة (بإضافة -1) بدلاً من تظليلها.',
      rawValues: 'استخدام القيم الخام (إصلاح الأرقام العلمية)',
      compareAcross: 'مقارنة عبر أوراق مختلفة',
      sourceSheet: 'الورقة المصدر (التي سيتم فحصها)',
      targetSheet: 'الورقة المرجعية (للبحث فيها)',
      selectSourceCol: 'حدد عمود المصدر',
      selectRefCol: 'حدد العمود المرجعي',
    },
    balance: {
      groupCol: 'عمود التجميع (معرف المنتج)',
      optionCols: 'أعمدة الخيارات (اللون، المقاس)',
      clearCols: 'أعمدة لتفريغها في الصفوف الجديدة (السعر، الكمية)',
      catCol: 'عمود التصنيف (اختياري)',
      nameCol: 'عمود اسم المنتج (اختياري)',
      analysis: 'تقرير التحليل',
      balanced: 'متوازن',
      unbalanced: 'غير متوازن',
      action: 'الإجراء المتخذ',
      added: 'تم إضافة المتغير الناقص',
      existing: 'متغير موجود',
      compareSheet: 'تقرير المطابقة والتحقق',
      compareHeaders: ['معرف المنتج', 'الحالة', 'عدد المتغيرات الأصلي', 'المتغيرات المضافة', 'العدد النهائي', 'العدد المتوقع', 'التحقق'],
      summarySheet: 'ملخص التوازن',
      summaryHeaders: ['معرف المنتج', 'عدد الخيار 1', 'أقصى عدد خيار 2', 'التفاصيل', 'حالة التوازن', 'كل القيم'],
      pass: 'نجاح',
      fail: 'فشل',
      catError: 'خطأ: الاسم مكرر في أكثر من تصنيف',
      emptyOptError: 'خطأ: خيار فارغ',
      dupVariantError: 'خطأ: تكرار المتغير',
      balancedSheet: 'قائمة المنتجات المتوازنة (جاهزة)'
    },
    salla: {
      title: 'محلل منتجات سلة',
      selectProductSheet: 'اختر ورقة المنتجات',
      howItWorks: 'كيف يعمل:',
      point1: "يبحث عن عمود 'النوع' أو بيانات مثل 'منتج'.",
      point2: "يميز بين المنتجات البسيطة والمنتجات ذات الخيارات (Variable).",
      point3: "يحذف الأعمدة الفارغة تلقائياً.",
      analyzeBtn: 'تحليل وتقسيم المنتجات',
    },
    zid: {
      title: 'منظم منتجات زد',
      selectSheet: 'اختر ورقة البيانات',
      colVariant: 'عمود: هل يوجد خيارات (Has Variant)',
      colName: 'عمود: اسم المنتج',
      howItWorks: 'آلية العمل:',
      point1: 'يفحص "هل يوجد خيارات": نعم = متغير، لا = بسيط، فارغ (تحت نعم) = خيار.',
      point2: 'يملأ اسم المنتج الأصلي عمودياً في عمود جديد.',
      point3: 'يفصل المنتجات البسيطة عن المتغيرة ويحذف الأعمدة الفارغة.',
      analyzeBtn: 'تنظيم بيانات زد',
    },
    rewaa: {
      title: 'مدير منصة رواء',
      openPlatform: 'فتح صفحة الاستيراد',
      prodType: 'نوع المنتج',
      simple: 'منتج بسيط',
      variable: 'منتج متغير',
      composite: 'منتج مركب',
      mapping: 'ربط الحقول',
      rewaaField: 'حقل رواء',
      yourCol: 'عمود ملفك',
      locations: 'المواقع والمخزون',
      unify: 'جميع المواقع لها نفس: سعر البيع، التكلفة، الضريبة',
      branches: 'أسماء الفروع (مفصولة بفاصلة)',
      branchesPlace: 'مثال: الفرع الرئيسي، المستودع، فرع الرياض',
      generate: 'إنشاء ملف استيراد رواء',
      autoMap: 'ربط تلقائي للأعمدة',
      fields: {
        name: 'اسم المنتج',
        sku: 'SKU (الرمز)',
        barcode: 'الباركود',
        category: 'التصنيف',
        cost: 'سعر التكلفة',
        price: 'سعر البيع',
        tax: 'كود الضريبة',
        supplier: 'المورد',
        parent: 'SKU الأب',
        varName: 'اسم المتغير',
        varSku: 'SKU المتغير',
        opt1Name: 'اسم الخيار 1',
        opt1Val: 'قيمة الخيار 1',
        compSku: 'SKU المركب',
        itemSku: 'SKU المكون',
        qty: 'الكمية'
      }
    },
    packs: {
      groupKey: 'مفتاح التجميع (Key)',
      sortPack: 'فرز الحزم حسب (اختياري)',
      none: 'بدون (نفس ترتيب الملف)',
      desc: 'اختر العمود الذي يحتوي على المعرف الفريد (ID) لتجميع العناصر.',
    },
    composite: {
      compSheet: 'ورقة المواد المركبة (للفحص)',
      rawSheet: 'ورقة المواد الخام (المصدر)',
      autoAlign: 'ضغط الأعمدة (إزاحة لليسار)',
      fuzzy: 'مطابقة تقريبية (اكتشاف الأخطاء المطبعية)',
      tolerance: 'درجة التسامح',
      validateBtn: 'فحص المواد المركبة',
      rawSkuCol: 'عمود SKU الخام (لحساب التكلفة)',
      costCol: 'عمود التكلفة (Unit Cost)',
      calcCost: 'حساب التكلفة الإجمالية (Roll-up)'
    },
    ocr: {
      template: 'قالب الاستخراج',
      promptMode: 'وصف نصي بسيط',
      schemaMode: 'بناء هيكل دقيق (Schema)',
      prompt: 'تعليمات الاستخراج',
      defineCols: 'تعريف الأعمدة',
      addCol: 'أضف عمود',
      saveTemplate: 'حفظ الإعدادات كقالب',
      autoBilingual: 'تنسيق ثنائي اللغة تلقائي',
      smartSplit: 'تقسيم ذكي للمقاسات',
      extractBtn: 'بدء الاستخراج',
      uploadTitle: 'اسحب الصور / PDF هنا',
      labels: {
        free: 'نموذج حر',
        invoice: 'فاتورة',
        menu: 'قائمة طعام',
        receipt: 'إيصال شراء',
        id: 'هوية / جواز سفر'
      },
      browserMemory: 'تتم معالجة الملفات في ذاكرة المتصفح',
      hideSource: 'إخفاء المصدر',
      verify: 'وضع التحقق',
      done: 'تم',
      edit: 'تعديل',
      cleanPrices: 'تنظيف الأسعار',
      selectRow: 'اختر صفاً لرؤية الصورة المصدر',
      colName: 'اسم العمود',
      descType: 'الوصف / النوع',
      templateName: 'اسم القالب...'
    },
    scraper: {
      url: 'رابط الموقع (URL)',
      prompt: 'وصف البيانات المطلوبة',
      smartMode: 'الوضع الذكي نشط',
      preview: 'معاينة البيانات',
    },
    csv: {
      outputMode: 'نمط الإخراج',
      merge: 'دمج في ملف واحد',
      mergeDesc: 'ينشئ ملف Excel واحد يحتوي على عدة أوراق.',
      zip: 'تحويل مجمع (ZIP)',
      zipDesc: 'يحول كل ملف CSV إلى ملف Excel منفصل.',
      encoding: 'ترميز الملف (Encoding)',
      delimiter: 'الفاصل (Delimiter)',
      forceText: 'إجبار تنسيق النصوص (للأرقام والهواتف)',
      splitLarge: 'تقسيم الملفات الكبيرة',
      rowLimit: 'الحد الأقصى للصفوف لكل ورقة',
      smartMerge: 'محاذاة ذكية للعناوين (Merge)',
      settings: 'إعدادات الاستيراد'
    },
    pdf: {
      split: 'قص / تقسيم PDF',
      merge: 'دمج ملفات PDF',
      splitMethod: 'طريقة التقسيم',
      fixedPage: 'عدد صفحات ثابت',
      extractAll: 'استخراج كل الصفحات',
      range: 'استخراج نطاق محدد',
      pagesPerFile: 'صفحة لكل ملف:',
      hint: 'ارفع ملفات PDF متعددة ورتبها حسب الرغبة للدمج.'
    },
    image: {
      direction: 'الاتجاه',
      vertical: 'عمودي',
      horizontal: 'أفقي',
      gap: 'المسافة (px)',
      uniform: 'توحيد القياس',
      bg: 'الخلفية',
      transparent: 'شفاف',
      compressMode: 'نمط الضغط',
      balanced: 'متوازن',
      extreme: 'أقصى ضغط',
      hq: 'جودة عالية',
      custom: 'مخصص',
      quality: 'الجودة',
      resize: 'تغيير الحجم (أقصى عرض)',
      format: 'الصيغة',
      genPdf: 'إنشاء PDF',
      pageSize: 'حجم الورقة',
      margins: 'الهوامش',
      fitToImage: 'ملاءمة الصورة',
      portrait: 'طولي',
      landscape: 'عرضي',
      none: 'بدون',
      small: 'صغير',
      normal: 'عادي',
      large: 'كبير',
      webp: 'WebP',
      jpeg: 'JPEG',
      png: 'PNG',
      original: 'الأصلي',
      dims: {
        original: 'الأبعاد الأصلية',
        k4: '4K فائق الدقة (3840px)',
        fhd: 'Full HD عالي الدقة (1920px)',
        hd: 'HD دقة عادية (1280px)',
        web: 'مناسب للويب (800px)'
      }
    },
    qr: {
      single: 'باركود مفرد',
      bulk: 'استيراد مجمع',
      content: 'نوع المحتوى',
      color: 'السمات اللونية',
      size: 'الحجم (px)',
      errorLevel: 'تصحيح الخطأ',
      labels: {
        url: 'رابط URL',
        text: 'نص عادي',
        email: 'بريد',
        wifi: 'واي فاي',
        phone: 'هاتف',
        sms: 'رسالة نصية',
        whatsapp: 'واتساب'
      },
      placeholders: {
        email: 'عنوان البريد *',
        subject: 'الموضوع',
        body: 'نص الرسالة...',
        ssid: 'اسم الشبكة (SSID) *',
        password: 'كلمة المرور',
        phone: 'رقم الهاتف (مع الرمز)',
        message: 'الرسالة...',
        text: 'أدخل النص هنا...'
      },
      hints: {
        instant: 'يتم الإنشاء فورياً',
        bulkStyle: 'تستخدم العناصر النمط الحالي'
      }
    },
    qc: {
      title: 'مراقبة الجودة',
      uploadA: 'رفع الملف المرجعي (A)',
      uploadB: 'رفع الملف المستهدف (B)',
      fileType: 'نوع الملف',
      visualMode: 'وضع التحقق المرئي',
      dataMode: 'وضع مقارنة البيانات',
      keyCol: 'عمود المفتاح الفريد (مثل ID)',
      colsToCompare: 'أعمدة للمقارنة',
      fuzzy: 'تجاهل حالة الأحرف والمسافات',
      run: 'تشغيل المقارنة',
      mismatch: 'غير متطابق',
      missingInB: 'مفقود في الملف B',
      match: 'مطابق',
      report: 'تقرير الجودة',
      row: 'صف',
      col: 'عمود',
      valA: 'القيمة أ (المرجع)',
      valB: 'القيمة ب (الهدف)',
      allMatch: 'تطابق تام! لا توجد أخطاء.',
      selectKey: 'اختر المفتاح'
    },
    workflow: {
        title: 'أتمتة العمليات',
        addStep: 'إضافة خطوة',
        save: 'حفظ العملية',
        load: 'تحميل عملية',
        colIndex: 'رقم العمود',
        condition: 'الشرط',
        value: 'القيمة',
        run: 'تشغيل العملية',
        noSteps: 'لم يتم إضافة خطوات. أضف خطوات لإنشاء عملية.',
        steps: {
            deleteCol: 'حذف عمود',
            filter: 'تصفية الصفوف',
            format: 'تنسيق النص',
            replace: 'بحث واستبدال',
            dedupe: 'إزالة التكرار'
        },
        actions: {
            contains: 'يحتوي على',
            equals: 'يساوي',
            notContains: 'لا يحتوي على',
            trim: 'إزالة المسافات الزائدة',
            upper: 'أحرف كبيرة',
            lower: 'أحرف صغيرة',
            title: 'أحرف العنوان'
        }
    },
    gsheets: {
        importing: 'جاري استيراد ورقة جوجل...',
        error: 'خطأ في الاستيراد',
        success: 'تم استيراد ورقة جوجل بنجاح.',
        url: 'رابط ورقة جوجل',
        urlPlace: 'الصق الرابط الكامل هنا...',
        load: 'تحميل الورقة',
        recent: 'عمليات الاستيراد الأخيرة',
        clear: 'مسح السجل',
        tip: 'تأكد من أن ورقة جوجل "أي شخص لديه الرابط" أو منشورة على الويب (ملف > مشاركة > نشر على الويب).',
        sheetInfo: 'معلومات الورقة'
    },
    tracker: {
        title: 'متتبع الروابط',
        defaultNote: 'ملاحظة افتراضية',
        urlPlaceholder: 'الصق رابط Zoho أو CRM...',
        accountNum: 'رقم الحساب',
        owner: 'المالك',
        note: 'ملاحظة',
        add: 'إضافة سجل',
        list: 'قائمة المتتبع',
        date: 'التاريخ'
    }
  }
};
