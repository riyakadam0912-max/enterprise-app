import ExcelJS from 'exceljs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_COLUMNS = 200;

function assertSafeHeader(header: string): string {
  const normalized = header.trim();
  if (!normalized || ['__proto__', 'prototype', 'constructor'].includes(normalized.toLowerCase())) {
    return '';
  }
  return normalized;
}

export function neutralizeFormula(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  row.push(field);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

export async function readSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Spreadsheet files must be 10 MB or smaller.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'xls') {
    throw new Error('Legacy XLS files are not supported. Upload XLSX or CSV instead.');
  }

  if (extension === 'csv') {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return [];
    const headers = rows[0].map(assertSafeHeader);
    if (headers.filter(Boolean).length === 0) return [];
    if (headers.length > MAX_COLUMNS || rows.length - 1 > MAX_ROWS) {
      throw new Error('CSV exceeds the import limit of 10,000 rows and 200 columns.');
    }

    return rows.slice(1).map((values) => {
      const row: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        if (header) row[header] = neutralizeFormula(values[index] ?? '');
      });
      return row;
    });
  }

  if (extension !== 'xlsx') {
    throw new Error('Only CSV and XLSX files can be imported.');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    headers[columnNumber - 1] = assertSafeHeader(String(cell.value ?? ''));
  });
  if (headers.filter(Boolean).length === 0) return [];
  if (headers.length > MAX_COLUMNS || sheet.actualRowCount - 1 > MAX_ROWS) {
    throw new Error('Workbook exceeds the import limit of 10,000 rows and 200 columns.');
  }

  const records: Record<string, unknown>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = row.getCell(index + 1).value;
      if (value instanceof Date) record[header] = value.toISOString();
      else if (typeof value === 'object' && value !== null && 'text' in value) {
        record[header] = neutralizeFormula((value as { text: unknown }).text);
      } else record[header] = neutralizeFormula(value);
    });
    if (Object.keys(record).length > 0) records.push(record);
  });
  return records;
}

export async function createXlsxBuffer(
  rows: Record<string, unknown>[],
): Promise<ArrayBuffer> {
  if (rows.length > MAX_ROWS) throw new Error('Export exceeds 10,000 rows.');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Export');
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    .filter((header) => assertSafeHeader(header) !== '')
    .slice(0, MAX_COLUMNS);

  sheet.addRow(headers);
  rows.forEach((row) => {
    sheet.addRow(headers.map((header) => neutralizeFormula(row[header])));
  });
  return await workbook.xlsx.writeBuffer() as unknown as ArrayBuffer;
}
