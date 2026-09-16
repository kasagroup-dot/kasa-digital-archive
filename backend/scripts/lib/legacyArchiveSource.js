import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { getGoogleDrive } from '../../src/services/googleDrive.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

export const DEFAULT_LEGACY_SPREADSHEET_ID = '10v4UzQPrqGIZD3l4xMtRVApTARXVnYU4kbeX6vkBuqE';
export const REQUIRED_SHEETS = [
  'CONFIG','USERS','DIVISIONS','FOLDERS','DOCUMENTS','FILE_VERSIONS',
  'PERMISSIONS','ACTIVITY_LOG','FAVORITES','RECYCLE_BIN','SESSIONS','PASSWORD_RESET_REQUESTS'
];

export function migrationTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value ?? '').trim().toLowerCase();
  return ['true','1','yes','y','on'].includes(s);
}

export function cleanText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function cleanNullableLegacyText(value) {
  const s = cleanText(value);
  if (s === null) return null;
  return ['.','-','n/a','null','undefined'].includes(s.toLowerCase()) ? null : s;
}

export function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const s = String(value).trim();
  if (!s || s === '.') return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
}

export function normalizeIso(value, fallback = null) {
  if (!value) return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export function parseTags(value) {
  const s = cleanNullableLegacyText(value);
  if (!s) return [];
  return [...new Set(s.split(/[;,|]/g).map(v => v.trim()).filter(Boolean))];
}

export async function exportLegacyWorkbook({ spreadsheetId, saveCopy = false } = {}) {
  const id = String(spreadsheetId || process.env.LEGACY_SPREADSHEET_ID || DEFAULT_LEGACY_SPREADSHEET_ID).trim();
  if (!id) throw new Error('LEGACY_SPREADSHEET_ID kosong.');
  const drive = getGoogleDrive();
  const res = await drive.files.export(
    { fileId: id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { responseType: 'arraybuffer' }
  );
  const buffer = Buffer.from(res.data);
  let savedPath = null;
  if (saveCopy) {
    const dir = path.join(backendRoot, 'migration', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    savedPath = path.join(dir, `legacy-source-${migrationTimestamp()}.xlsx`);
    fs.writeFileSync(savedPath, buffer);
  }
  return { id, buffer, savedPath };
}

export function parseLegacyWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: true });
  const missing = REQUIRED_SHEETS.filter(name => !workbook.Sheets[name]);
  if (missing.length) throw new Error(`Sheet legacy tidak lengkap: ${missing.join(', ')}`);
  const sheets = {};
  for (const name of REQUIRED_SHEETS) {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null, raw: true });
  }
  return sheets;
}
