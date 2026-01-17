
export interface FileData {
  name: string;
  workbook: any; // Using any for xlsx WorkBook
  sheets: string[];
  spreadsheetId?: string; // ID of the source Google Sheet (if applicable)
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export type SheetData = any[][]; // Array of arrays representing rows and columns

export interface SallaRow {
  category: string;
  data: any[];
}
