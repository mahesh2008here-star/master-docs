import * as XLSX from 'xlsx';

export interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface SpreadsheetData {
  sheets: SheetData[];
}

function normalizeSheetRows(rawRows: unknown[][]): { headers: string[]; rows: string[][] } {
  if (!rawRows || rawRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const maxCols = Math.max(1, ...rawRows.map((r) => (Array.isArray(r) ? r.length : 0)));
  const firstRow = Array.isArray(rawRows[0]) ? rawRows[0] : [];

  const headers: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const val = firstRow[c];
    headers.push(val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : `Col ${c + 1}`);
  }

  const rows: string[][] = rawRows.slice(1).map((row) => {
    const arr = Array.isArray(row) ? row : [];
    const normalized: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      const val = arr[c];
      normalized.push(val !== undefined && val !== null ? String(val) : '');
    }
    return normalized;
  });

  return { headers, rows };
}

export function parseSpreadsheetBuffer(buffer: Uint8Array | ArrayBuffer | string): SpreadsheetData {
  try {
    let workbook: XLSX.WorkBook;
    if (typeof buffer === 'string') {
      workbook = XLSX.read(buffer, { type: 'string' });
    } else {
      const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      workbook = XLSX.read(uint8, { type: 'array' });
    }

    const sheets: SheetData[] = workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: '',
        raw: false,
      });
      const { headers, rows } = normalizeSheetRows(json);
      return {
        name: sheetName,
        headers,
        rows,
      };
    });

    if (sheets.length > 0) {
      return { sheets };
    }
  } catch (error) {
    console.warn('XLSX parser fallback engaged:', error);
  }

  // Fallback CSV/TSV line parser
  const text =
    typeof buffer === 'string'
      ? buffer
      : new TextDecoder('utf-8', { fatal: false }).decode(
          buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
        );

  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { sheets: [{ name: 'Sheet1', headers: [], rows: [] }] };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parsed = lines.map((line) => line.split(delimiter).map((cell) => cell.replace(/^"|"$/g, '')));
  const { headers, rows } = normalizeSheetRows(parsed);
  return {
    sheets: [{ name: 'Sheet1', headers, rows }],
  };
}
