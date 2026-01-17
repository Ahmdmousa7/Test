
import * as XLSX from 'xlsx';
import { FileData, SheetData } from '../types';

export const readExcelFile = async (file: File): Promise<FileData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', raw: true });
        resolve({
          name: file.name,
          workbook: workbook,
          sheets: workbook.SheetNames,
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

export const fetchGoogleSheet = async (url: string): Promise<FileData> => {
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const id = idMatch ? idMatch[1] : null;

  if (!id) throw new Error("Invalid Google Sheet URL.");

  // Target: Export as XLSX to get all sheets
  const xlsxUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  
  // Proxy Strategy: Try primary (fast), then backup (reliable)
  const proxies = [
    { url: `https://corsproxy.io/?${encodeURIComponent(xlsxUrl)}`, type: 'blob' },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(xlsxUrl)}`, type: 'blob' }
  ];

  let lastError;

  for (const proxy of proxies) {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const response = await fetch(proxy.url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const arrayBuffer = await response.arrayBuffer();
          
          // Check for Access Denied (Google Login Page HTML)
          const firstBytes = new Uint8Array(arrayBuffer.slice(0, 50));
          const headerStr = String.fromCharCode(...firstBytes);
          if (headerStr.includes("<!DOCTYPE") || headerStr.includes("<html") || headerStr.includes("Sign in")) {
             throw new Error("Access Denied. Sheet must be Public (Anyone with link).");
          }

          const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: true });
          
          if (workbook.SheetNames.length === 0) throw new Error("Empty file.");

          return {
            name: `GSheet_${id.substring(0,6)}.xlsx`,
            workbook: workbook,
            sheets: workbook.SheetNames,
            spreadsheetId: id // Store ID for Write-Back operations
          };

      } catch (e: any) {
          console.warn("Proxy failed, trying next...", e.message);
          lastError = e;
          // If permission error, don't retry, it's final
          if (e.message.includes("Access Denied")) break;
      }
  }

  throw new Error(lastError?.message || "Failed to fetch Google Sheet. Check internet or privacy settings.");
};

export const getSheetData = (workbook: any, sheetName: string, raw: boolean = false): SheetData => {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: raw });
};

export const createWorkbook = (): any => {
  return XLSX.utils.book_new();
};

export const appendSheet = (workbook: any, data: any[][], sheetName: string) => {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
};

export const saveWorkbook = (workbook: any, filename: string) => {
  XLSX.writeFile(workbook, filename);
};

export const cloneWorkbook = (workbook: any): any => {
  const wbOut = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return XLSX.read(wbOut, { type: 'array' });
};
