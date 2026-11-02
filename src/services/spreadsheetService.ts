import * as XLSX from 'xlsx';

export interface SheetData {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface SpreadsheetData {
  sheets: SheetData[];
}

export function parseSpreadsheetBuffer(buffer: ArrayBuffer | string): SpreadsheetData {
  try {
    let workbook: XLSX.WorkBook;
    if (typeof buffer === 'string') {
      workbook = XLSX.read(buffer, { type: 'string' });
    } else {
      workbook = XLSX.read(buffer, { type: 'array' });
    }

    const sheets: SheetData[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const json: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (json.length > 0) {
        const headers = (json[0] || []).map((h) => String(h || ''));
        const rows = json.slice(1);
        sheets.push({
          name: sheetName,
          headers,
          rows,
        });
      } else {
        sheets.push({
          name: sheetName,
          headers: [],
          rows: [],
        });
      }
    }

    return { sheets };
  } catch (error) {
    console.error('Failed to parse spreadsheet:', error);
    // Return structured CSV fallback
    if (typeof buffer === 'string') {
      const lines = buffer.trim().split('\n');
      const headers = lines[0] ? lines[0].split(',') : [];
      const rows = lines.slice(1).map((line) => line.split(','));
      return {
        sheets: [
          {
            name: 'Sheet1',
            headers,
            rows,
          },
        ],
      };
    }
    throw error;
  }
}
