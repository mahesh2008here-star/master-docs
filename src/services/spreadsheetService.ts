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
    headers.push(
      val !== undefined && val !== null && String(val).trim() !== ''
        ? String(val)
        : `Col ${c + 1}`
    );
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

function parseDelimitedText(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

function decodeSpreadsheetText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

export function parseSpreadsheetBuffer(buffer: Uint8Array | ArrayBuffer | string): SpreadsheetData {
  try {
    let workbook: XLSX.WorkBook;
    if (typeof buffer === 'string') {
      workbook = XLSX.read(buffer, { type: 'string' });
    } else {
      const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      // If UTF-16 BOM text CSV/TSV, decode first so XLSX doesn't misread binary bytes
      if (
        uint8.length >= 2 &&
        ((uint8[0] === 0xff && uint8[1] === 0xfe) || (uint8[0] === 0xfe && uint8[1] === 0xff))
      ) {
        workbook = XLSX.read(decodeSpreadsheetText(uint8), { type: 'string' });
      } else {
        workbook = XLSX.read(uint8, { type: 'array' });
      }
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

    if (sheets.length > 0 && sheets.some((s) => s.headers.length > 0 || s.rows.length > 0)) {
      return { sheets };
    }
  } catch (error) {
    console.warn('XLSX parser fallback engaged:', error);
  }

  // RFC-4180 quote-aware delimiter fallback (supports comma, semicolon, tab)
  const text =
    typeof buffer === 'string'
      ? buffer
      : decodeSpreadsheetText(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));

  const trimmed = text.trim();
  if (!trimmed) {
    return { sheets: [{ name: 'Sheet1', headers: [], rows: [] }] };
  }

  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  const countUnquoted = (line: string, target: string): number => {
    let count = 0;
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQ = !inQ;
      else if (!inQ && line[i] === target) count++;
    }
    return count;
  };
  const tabs = countUnquoted(firstLine, '\t');
  const semis = countUnquoted(firstLine, ';');
  const commas = countUnquoted(firstLine, ',');
  const delimiter = tabs > commas && tabs >= semis ? '\t' : semis > commas ? ';' : ',';

  const parsed = parseDelimitedText(trimmed, delimiter);
  const { headers, rows } = normalizeSheetRows(parsed);
  return {
    sheets: [{ name: 'Sheet1', headers, rows }],
  };
}
