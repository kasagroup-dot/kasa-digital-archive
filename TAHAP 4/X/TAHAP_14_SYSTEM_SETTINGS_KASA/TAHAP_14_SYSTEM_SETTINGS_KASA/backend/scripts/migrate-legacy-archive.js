import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { assertSupabaseEnv, env } from '../src/config/env.js';
import { getSupabaseAdmin } from '../src/config/supabase.js';
import {
  exportLegacyWorkbook, parseLegacyWorkbook, normalizeBoolean, cleanText,
  cleanNullableLegacyText, normalizeDateOnly, normalizeIso, parseTags, migrationTimestamp
} from './lib/legacyArchiveSource.js';

dotenv.config();
assertSupabaseEnv();

const APPLY = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run') || !APPLY;
const supabase = getSupabaseAdmin();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

function fail(message) {
  const err = new Error(message);
  err.isMigrationValidation = true;
  throw err;
}

function upper(value) { return String(value || '').trim().toUpperCase(); }
function key(value) { return String(value || '').trim(); }
function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function indexUnique(rows, field, label) {
  const map = new Map();
  for (const row of rows) {
    const k = key(row[field]);
    if (!k) continue;
    if (map.has(k)) fail(`Duplicate ${label}: ${k}`);
    map.set(k, row);
  }
  return map;
}

function folderDepth(row, folderByLegacy, memo = new Map(), stack = new Set()) {
  const id = key(row.FOLDER_ID);
  if (memo.has(id)) return memo.get(id);
  const parentId = key(row.PARENT_FOLDER_ID);
  if (!parentId) { memo.set(id, 0); return 0; }
  if (stack.has(id)) fail(`Siklus folder legacy terdeteksi di ${id}`);
  const parent = folderByLegacy.get(parentId);
  if (!parent) fail(`Parent folder ${parentId} untuk ${id} tidak ditemukan.`);
  stack.add(id);
  const depth = 1 + folderDepth(parent, folderByLegacy, memo, stack);
  stack.delete(id);
  memo.set(id, depth);
  return depth;
}

function validateSource(sheets) {
  const warnings = [];
  const folders = sheets.FOLDERS || [];
  const docs = sheets.DOCUMENTS || [];
  const versions = sheets.FILE_VERSIONS || [];
  const favorites = sheets.FAVORITES || [];
  const recycle = sheets.RECYCLE_BIN || [];
  const activity = sheets.ACTIVITY_LOG || [];
  const resets = sheets.PASSWORD_RESET_REQUESTS || [];
  const folderByLegacy = indexUnique(folders, 'FOLDER_ID', 'FOLDER_ID');
  const docByLegacy = indexUnique(docs, 'DOCUMENT_ID', 'DOCUMENT_ID');
  indexUnique(versions, 'VERSION_ID', 'VERSION_ID');
  indexUnique(favorites, 'FAVORITE_ID', 'FAVORITE_ID');
  indexUnique(recycle, 'RECYCLE_ID', 'RECYCLE_ID');
  indexUnique(activity, 'LOG_ID', 'LOG_ID');
  indexUnique(resets, 'REQUEST_ID', 'REQUEST_ID');

  const divIds = new Set((sheets.DIVISIONS || []).map(r => key(r.DIVISION_ID)).filter(Boolean));
  const userIds = new Set((sheets.USERS || []).map(r => key(r.USER_ID)).filter(Boolean));

  for (const f of folders) {
    if (!divIds.has(key(f.DIVISION_ID))) fail(`Folder ${f.FOLDER_ID} memiliki DIVISION_ID tidak valid: ${f.DIVISION_ID}`);
    if (key(f.PARENT_FOLDER_ID) && !folderByLegacy.has(key(f.PARENT_FOLDER_ID))) fail(`Folder ${f.FOLDER_ID} parent ${f.PARENT_FOLDER_ID} tidak ditemukan.`);
    folderDepth(f, folderByLegacy);
  }
  for (const d of docs) {
    if (!divIds.has(key(d.DIVISION_ID))) fail(`Dokumen ${d.DOCUMENT_ID} memiliki DIVISION_ID tidak valid: ${d.DIVISION_ID}`);
    if (key(d.FOLDER_ID) && !folderByLegacy.has(key(d.FOLDER_ID))) fail(`Dokumen ${d.DOCUMENT_ID} folder ${d.FOLDER_ID} tidak ditemukan.`);
  }
  for (const v of versions) if (!docByLegacy.has(key(v.DOCUMENT_ID))) fail(`Version ${v.VERSION_ID} document ${v.DOCUMENT_ID} tidak ditemukan.`);
  for (const fav of favorites) {
    if (!userIds.has(key(fav.USER_ID))) fail(`Favorite ${fav.FAVORITE_ID} user ${fav.USER_ID} tidak ditemukan.`);
    if (!docByLegacy.has(key(fav.DOCUMENT_ID))) fail(`Favorite ${fav.FAVORITE_ID} document ${fav.DOCUMENT_ID} tidak ditemukan.`);
  }
  for (const r of recycle) {
    const t = upper(r.OBJECT_TYPE);
    if (t === 'FOLDER' && !folderByLegacy.has(key(r.OBJECT_ID))) fail(`Recycle ${r.RECYCLE_ID} folder ${r.OBJECT_ID} tidak ditemukan.`);
    if (t === 'DOCUMENT' && !docByLegacy.has(key(r.OBJECT_ID))) fail(`Recycle ${r.RECYCLE_ID} document ${r.OBJECT_ID} tidak ditemukan.`);
  }

  const sibling = new Set();
  for (const f of folders.filter(r => upper(r.STATUS) === 'ACTIVE')) {
    const k = `${f.DIVISION_ID}|${f.PARENT_FOLDER_ID || ''}|${String(f.FOLDER_NAME || '').trim().toLowerCase()}`;
    if (sibling.has(k)) fail(`Duplicate folder ACTIVE pada parent yang sama: ${f.FOLDER_NAME}`);
    sibling.add(k);
  }
  const activeFiles = new Set();
  for (const d of docs.filter(r => upper(r.STATUS) === 'ACTIVE')) {
    const k = `${d.DIVISION_ID}|${d.FOLDER_ID || ''}|${String(d.ORIGINAL_FILENAME || '').trim().toLowerCase()}`;
    if (activeFiles.has(k)) fail(`Duplicate dokumen ACTIVE pada folder yang sama: ${d.ORIGINAL_FILENAME}`);
    activeFiles.add(k);
  }

  const protectedFolders = folders.filter(f => normalizeBoolean(f.PASSWORD_ENABLED));
  const fp2 = protectedFolders.filter(f => String(f.PASSWORD_HASH || '').startsWith('FP2$'));
  if (fp2.length && !env.legacyFolderPasswordPepper) {
    warnings.push(`${fp2.length} folder memakai hash FP2 tetapi LEGACY_FOLDER_PASSWORD_PEPPER belum diisi. Migrasi APPLY diblok agar folder tidak terkunci permanen.`);
  }

  return {
    folderByLegacy,
    docByLegacy,
    protectedFolders,
    fp2,
    warnings,
    counts: {
      folders: folders.length,
      documents: docs.length,
      documentVersions: versions.length,
      favorites: favorites.length,
      recycleItems: recycle.length,
      auditLogs: activity.length,
      passwordResetRequests: resets.length,
      sessionsSkipped: (sheets.SESSIONS || []).length
    }
  };
}

async function fetchAll(table, select='*') {
  const { data, error } = await supabase.from(table).select(select);
  if (error) throw error;
  return data || [];
}

async function backupTarget() {
  const tables = [
    'app_settings','divisions','app_users','user_permissions','folders','documents',
    'document_versions','favorites','recycle_items','audit_logs','password_reset_requests'
  ];
  const snapshot = { createdAt: new Date().toISOString(), tables: {} };
  for (const table of tables) snapshot.tables[table] = await fetchAll(table);
  const dir = path.join(backendRoot, 'migration', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `supabase-before-stage10-${migrationTimestamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  return file;
}

async function loadTargetMaps() {
  const [divisions, users, folders, documents] = await Promise.all([
    fetchAll('divisions','id,legacy_id,name,slug,google_drive_folder_id'),
    fetchAll('app_users','id,legacy_id,username'),
    fetchAll('folders','id,legacy_id,google_drive_folder_id,name,division_id,parent_folder_id,status'),
    fetchAll('documents','id,legacy_id,google_drive_file_id,original_filename,division_id,folder_id,status')
  ]);
  return {
    divisions,
    users,
    folders,
    documents,
    divisionByLegacy: new Map(divisions.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r])),
    userByLegacy: new Map(users.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r])),
    userByUsername: new Map(users.map(r=>[upper(r.username),r])),
    folderByLegacy: new Map(folders.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r])),
    folderByDrive: new Map(folders.filter(r=>r.google_drive_folder_id).map(r=>[r.google_drive_folder_id,r])),
    documentByLegacy: new Map(documents.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r])),
    documentByDrive: new Map(documents.filter(r=>r.google_drive_file_id).map(r=>[r.google_drive_file_id,r]))
  };
}

function userFromSnapshot(username, maps) {
  const u = maps.userByUsername.get(upper(username));
  return { id: u?.id || null, snapshot: cleanText(username) };
}

async function saveOne(table, payload, existingId = null) {
  if (existingId) {
    const { data, error } = await supabase.from(table).update(payload).eq('id', existingId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function migrateFolders(sheets, maps) {
  const source = sheets.FOLDERS || [];
  const sourceByLegacy = new Map(source.map(r=>[key(r.FOLDER_ID),r]));
  const memo = new Map();
  const ordered = [...source].sort((a,b)=>folderDepth(a,sourceByLegacy,memo)-folderDepth(b,sourceByLegacy,memo));
  let created=0, updated=0;
  for (const r of ordered) {
    const legacyId = key(r.FOLDER_ID);
    const driveId = key(r.GOOGLE_DRIVE_FOLDER_ID);
    const division = maps.divisionByLegacy.get(key(r.DIVISION_ID));
    if (!division) fail(`Target division belum ada untuk ${r.DIVISION_ID}`);
    const parent = key(r.PARENT_FOLDER_ID) ? maps.folderByLegacy.get(key(r.PARENT_FOLDER_ID)) : null;
    const originalParent = key(r.ORIGINAL_PARENT_FOLDER_ID) ? maps.folderByLegacy.get(key(r.ORIGINAL_PARENT_FOLDER_ID)) : null;
    const createdBy = userFromSnapshot(r.CREATED_BY, maps);
    const deletedBy = userFromSnapshot(r.DELETED_BY, maps);
    const pwdBy = userFromSnapshot(r.PASSWORD_UPDATED_BY, maps);
    const pwdEnabled = normalizeBoolean(r.PASSWORD_ENABLED);
    const pwdHash = cleanText(r.PASSWORD_HASH);
    let pwdAlgorithm = null;
    if (pwdEnabled && pwdHash) pwdAlgorithm = pwdHash.startsWith('FP2$') ? 'legacy_fp2_hmac_sha256' : 'legacy_sha256_2500';
    const payload = {
      legacy_id: legacyId,
      name: cleanText(r.FOLDER_NAME) || legacyId,
      google_drive_folder_id: driveId,
      parent_folder_id: parent?.id || null,
      division_id: division.id,
      description: cleanNullableLegacyText(r.DESCRIPTION),
      created_by_user_id: createdBy.id,
      created_by_username_snapshot: createdBy.snapshot,
      created_at: normalizeIso(r.CREATED_AT, new Date().toISOString()),
      updated_at: normalizeIso(r.UPDATED_AT, normalizeIso(r.CREATED_AT, new Date().toISOString())),
      status: ['ACTIVE','DELETED','PURGED'].includes(upper(r.STATUS)) ? upper(r.STATUS) : 'ACTIVE',
      original_parent_folder_id: originalParent?.id || null,
      deleted_by_user_id: deletedBy.id,
      deleted_by_username_snapshot: deletedBy.snapshot,
      deleted_at: normalizeIso(r.DELETED_AT),
      password_enabled: pwdEnabled,
      password_hash: pwdEnabled ? pwdHash : null,
      password_algorithm: pwdEnabled ? pwdAlgorithm : null,
      password_salt: pwdEnabled ? cleanText(r.PASSWORD_SALT) : null,
      password_version: pwdEnabled ? 1 : 0,
      password_updated_at: normalizeIso(r.PASSWORD_UPDATED_AT),
      password_updated_by_user_id: pwdBy.id,
      password_updated_by_snapshot: pwdBy.snapshot
    };
    let existing = maps.folderByLegacy.get(legacyId);
    if (!existing && driveId) existing = maps.folderByDrive.get(driveId);
    if (existing?.legacy_id && existing.legacy_id !== legacyId) fail(`Drive folder ${driveId} sudah dipakai legacy_id lain: ${existing.legacy_id}`);
    const saved = await saveOne('folders', payload, existing?.id || null);
    if (existing) updated++; else created++;
    maps.folderByLegacy.set(legacyId, saved);
    maps.folderByDrive.set(driveId, saved);
  }

  // Second pass: ORIGINAL_PARENT_FOLDER_ID bisa menunjuk folder yang baru tersedia
  // setelah insert pertama. Update setelah seluruh folder sudah memiliki UUID target.
  for (const r of source) {
    const originalLegacy = key(r.ORIGINAL_PARENT_FOLDER_ID);
    if (!originalLegacy) continue;
    const current = maps.folderByLegacy.get(key(r.FOLDER_ID));
    const original = maps.folderByLegacy.get(originalLegacy);
    if (!current || !original) fail(`Original parent ${originalLegacy} untuk ${r.FOLDER_ID} tidak ditemukan setelah migrasi.`);
    const { data, error } = await supabase.from('folders').update({ original_parent_folder_id: original.id }).eq('id', current.id).select().single();
    if (error) throw error;
    maps.folderByLegacy.set(key(r.FOLDER_ID), data);
  }
  return {created,updated};
}

async function migrateDocuments(sheets, maps) {
  let created=0, updated=0;
  for (const r of sheets.DOCUMENTS || []) {
    const legacyId = key(r.DOCUMENT_ID);
    const driveId = key(r.GOOGLE_DRIVE_FILE_ID);
    const division = maps.divisionByLegacy.get(key(r.DIVISION_ID));
    const folder = key(r.FOLDER_ID) ? maps.folderByLegacy.get(key(r.FOLDER_ID)) : null;
    const originalFolder = key(r.ORIGINAL_FOLDER_ID) ? maps.folderByLegacy.get(key(r.ORIGINAL_FOLDER_ID)) : null;
    if (!division) fail(`Target division belum ada untuk dokumen ${legacyId}`);
    if (key(r.FOLDER_ID) && !folder) fail(`Target folder ${r.FOLDER_ID} belum ada untuk dokumen ${legacyId}`);
    const uploadedBy = userFromSnapshot(r.UPLOADED_BY, maps);
    const deletedBy = userFromSnapshot(r.DELETED_BY, maps);
    const payload = {
      legacy_id: legacyId,
      document_name: cleanText(r.DOCUMENT_NAME) || legacyId,
      original_filename: cleanText(r.ORIGINAL_FILENAME) || cleanText(r.DOCUMENT_NAME) || legacyId,
      google_drive_file_id: driveId,
      drive_url: cleanText(r.DRIVE_URL),
      folder_id: folder?.id || null,
      division_id: division.id,
      file_type: cleanText(r.FILE_TYPE),
      mime_type: cleanText(r.MIME_TYPE),
      extension: cleanText(r.EXTENSION),
      file_size: Math.max(0, Math.trunc(numberOr(r.FILE_SIZE,0))),
      document_number: cleanNullableLegacyText(r.DOCUMENT_NUMBER),
      document_date: normalizeDateOnly(r.DOCUMENT_DATE),
      category: cleanNullableLegacyText(r.CATEGORY),
      tags: parseTags(r.TAGS),
      description: cleanNullableLegacyText(r.DESCRIPTION),
      current_version: Math.max(1, Math.trunc(numberOr(r.VERSION,1))),
      uploaded_by_user_id: uploadedBy.id,
      uploaded_by_username_snapshot: uploadedBy.snapshot,
      uploaded_at: normalizeIso(r.UPLOADED_AT, new Date().toISOString()),
      updated_at: normalizeIso(r.UPDATED_AT, normalizeIso(r.UPLOADED_AT, new Date().toISOString())),
      status: ['ACTIVE','DELETED','PURGED'].includes(upper(r.STATUS)) ? upper(r.STATUS) : 'ACTIVE',
      deleted_by_user_id: deletedBy.id,
      deleted_by_username_snapshot: deletedBy.snapshot,
      deleted_at: normalizeIso(r.DELETED_AT),
      original_folder_id: originalFolder?.id || null
    };
    let existing = maps.documentByLegacy.get(legacyId);
    if (!existing && driveId) existing = maps.documentByDrive.get(driveId);
    if (existing?.legacy_id && existing.legacy_id !== legacyId) fail(`Drive file ${driveId} sudah dipakai legacy_id lain: ${existing.legacy_id}`);
    const saved = await saveOne('documents', payload, existing?.id || null);
    if (existing) updated++; else created++;
    maps.documentByLegacy.set(legacyId, saved);
    maps.documentByDrive.set(driveId, saved);
  }
  return {created,updated};
}

async function migrateVersions(sheets, maps) {
  let created=0, updated=0;
  const existingRows = await fetchAll('document_versions','id,legacy_id,google_drive_file_id');
  const byLegacy = new Map(existingRows.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r]));
  const byDrive = new Map(existingRows.filter(r=>r.google_drive_file_id).map(r=>[r.google_drive_file_id,r]));
  for (const r of sheets.FILE_VERSIONS || []) {
    const legacyId=key(r.VERSION_ID), driveId=key(r.GOOGLE_DRIVE_FILE_ID);
    const doc=maps.documentByLegacy.get(key(r.DOCUMENT_ID));
    if (!doc) fail(`Dokumen target untuk version ${legacyId} tidak ditemukan.`);
    const uploadedBy=userFromSnapshot(r.UPLOADED_BY,maps);
    const payload={
      legacy_id:legacyId, document_id:doc.id, version_number:Math.max(1,Math.trunc(numberOr(r.VERSION_NUMBER,1))),
      google_drive_file_id:driveId, file_size:Math.max(0,Math.trunc(numberOr(r.FILE_SIZE,0))),
      uploaded_by_user_id:uploadedBy.id, uploaded_by_username_snapshot:uploadedBy.snapshot,
      uploaded_at:normalizeIso(r.UPLOADED_AT,new Date().toISOString()), description:cleanNullableLegacyText(r.DESCRIPTION)
    };
    let existing=byLegacy.get(legacyId) || byDrive.get(driveId);
    const saved=await saveOne('document_versions',payload,existing?.id||null);
    if(existing)updated++;else created++;
    byLegacy.set(legacyId,saved); byDrive.set(driveId,saved);
  }
  return {created,updated};
}

async function migrateFavorites(sheets,maps){
  let created=0,updated=0;
  const existingRows=await fetchAll('favorites','id,legacy_id');
  const byLegacy=new Map(existingRows.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r]));
  for(const r of sheets.FAVORITES||[]){
    const legacyId=key(r.FAVORITE_ID), user=maps.userByLegacy.get(key(r.USER_ID)), doc=maps.documentByLegacy.get(key(r.DOCUMENT_ID));
    if(!user||!doc) fail(`Favorite ${legacyId} referensi user/dokumen belum tersedia.`);
    const payload={legacy_id:legacyId,user_id:user.id,document_id:doc.id,created_at:normalizeIso(r.CREATED_AT,new Date().toISOString())};
    const existing=byLegacy.get(legacyId); const saved=await saveOne('favorites',payload,existing?.id||null);
    if(existing)updated++;else created++; byLegacy.set(legacyId,saved);
  }
  return {created,updated};
}

async function migrateRecycle(sheets,maps){
  let created=0,updated=0;
  const existingRows=await fetchAll('recycle_items','id,legacy_id');
  const byLegacy=new Map(existingRows.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r]));
  for(const r of sheets.RECYCLE_BIN||[]){
    const legacyId=key(r.RECYCLE_ID), type=upper(r.OBJECT_TYPE), division=maps.divisionByLegacy.get(key(r.DIVISION_ID));
    const folder=type==='FOLDER'?maps.folderByLegacy.get(key(r.OBJECT_ID)):null;
    const doc=type==='DOCUMENT'?maps.documentByLegacy.get(key(r.OBJECT_ID)):null;
    const parent=key(r.ORIGINAL_PARENT_ID)?maps.folderByLegacy.get(key(r.ORIGINAL_PARENT_ID)):null;
    const deletedBy=userFromSnapshot(r.DELETED_BY,maps);
    if(!division || (type==='FOLDER'&&!folder) || (type==='DOCUMENT'&&!doc)) fail(`Recycle ${legacyId} referensi target belum lengkap.`);
    const payload={legacy_id:legacyId,object_type:type,document_id:doc?.id||null,folder_id:folder?.id||null,division_id:division.id,original_parent_folder_id:parent?.id||null,deleted_by_user_id:deletedBy.id,deleted_by_username_snapshot:deletedBy.snapshot,deleted_at:normalizeIso(r.DELETED_AT,new Date().toISOString())};
    const existing=byLegacy.get(legacyId); const saved=await saveOne('recycle_items',payload,existing?.id||null);
    if(existing)updated++;else created++; byLegacy.set(legacyId,saved);
  }
  return {created,updated};
}

async function migrateAudit(sheets,maps){
  const rows=sheets.ACTIVITY_LOG||[];
  if(!rows.length) return {created:0,updated:0};
  const existingRows=await fetchAll('audit_logs','legacy_id');
  const existing=new Set(existingRows.filter(r=>r.legacy_id).map(r=>r.legacy_id));
  const payloads=rows.map(r=>{
    const legacyId=key(r.LOG_ID), user=maps.userByLegacy.get(key(r.USER_ID)), division=maps.divisionByLegacy.get(key(r.DIVISION_ID));
    return {legacy_id:legacyId,occurred_at:normalizeIso(r.TIMESTAMP,new Date().toISOString()),user_id:user?.id||null,username_snapshot:cleanText(r.USERNAME),division_id:division?.id||null,action:cleanText(r.ACTION)||'LEGACY_ACTIVITY',object_type:cleanText(r.OBJECT_TYPE),object_id:cleanText(r.OBJECT_ID),object_name:cleanText(r.OBJECT_NAME),detail:cleanNullableLegacyText(r.DETAIL),metadata:{source:'legacy_spreadsheet'}};
  });
  for(let i=0;i<payloads.length;i+=100){
    const chunk=payloads.slice(i,i+100);
    const {error}=await supabase.from('audit_logs').upsert(chunk,{onConflict:'legacy_id'});
    if(error)throw error;
  }
  const updated=payloads.filter(p=>existing.has(p.legacy_id)).length;
  return {created:payloads.length-updated,updated};
}

async function migratePasswordResets(sheets,maps){
  let created=0,updated=0;
  const existingRows=await fetchAll('password_reset_requests','id,legacy_id');
  const byLegacy=new Map(existingRows.filter(r=>r.legacy_id).map(r=>[r.legacy_id,r]));
  for(const r of sheets.PASSWORD_RESET_REQUESTS||[]){
    const legacyId=key(r.REQUEST_ID), user=maps.userByLegacy.get(key(r.USER_ID)), resolvedBy=maps.userByLegacy.get(key(r.RESOLVED_BY)), division=maps.divisionByLegacy.get(key(r.DIVISION_ID));
    if(!user) fail(`Password reset ${legacyId} user ${r.USER_ID} tidak ditemukan.`);
    const oldStatus=upper(r.STATUS); const status=oldStatus==='PENDING'?'PENDING':oldStatus==='CANCELLED'?'CANCELLED':'RESOLVED';
    const payload={legacy_id:legacyId,user_id:user.id,username_snapshot:cleanText(r.USERNAME)||user.username,division_id:division?.id||null,requested_at:normalizeIso(r.REQUESTED_AT,new Date().toISOString()),status,resolved_by_user_id:resolvedBy?.id||null,resolved_at:normalizeIso(r.RESOLVED_AT),resolution_action:status==='RESOLVED'?'RESET_PASSWORD':null,detail:cleanNullableLegacyText(r.DETAIL)};
    const existing=byLegacy.get(legacyId); const saved=await saveOne('password_reset_requests',payload,existing?.id||null);
    if(existing)updated++;else created++; byLegacy.set(legacyId,saved);
  }
  return {created,updated};
}

async function writeMigrationSettings(spreadsheetId, validation) {
  const rows=[
    {key:'LEGACY_SOURCE_SPREADSHEET_ID',value:spreadsheetId,description:'Spreadsheet sumber migrasi Apps Script lama',is_secret:false},
    {key:'LEGACY_MIGRATION_STAGE10_AT',value:new Date().toISOString(),description:'Timestamp migrasi metadata legacy Tahap 10',is_secret:false},
    {key:'LEGACY_MIGRATION_FOLDERS',value:String(validation.counts.folders),description:'Jumlah folder legacy pada migrasi terakhir',is_secret:false},
    {key:'LEGACY_MIGRATION_DOCUMENTS',value:String(validation.counts.documents),description:'Jumlah dokumen legacy pada migrasi terakhir',is_secret:false}
  ];
  for(const row of rows){const {error}=await supabase.from('app_settings').upsert(row,{onConflict:'key'});if(error)throw error;}
}

async function main(){
  console.log('\nKASA STAGE 10 — MIGRASI DATA LAMA');
  console.log('=================================');
  console.log(DRY_RUN ? 'Mode: DRY RUN (tidak menulis Supabase)' : 'Mode: APPLY');

  const exported=await exportLegacyWorkbook({saveCopy:APPLY});
  console.log(`Source Spreadsheet: ${exported.id}`);
  if(exported.savedPath) console.log(`Backup source      : ${exported.savedPath}`);
  const sheets=parseLegacyWorkbook(exported.buffer);
  const validation=validateSource(sheets);

  console.log('\nSource counts');
  for(const [k,v] of Object.entries(validation.counts)) console.log(`${k.padEnd(24)}: ${v}`);
  console.log(`Protected folders        : ${validation.protectedFolders.length}`);
  for(const w of validation.warnings) console.warn(`⚠ ${w}`);

  const maps=await loadTargetMaps();
  console.log(`\nTarget before: ${maps.folders.length} folders, ${maps.documents.length} documents.`);
  console.log('Validasi referensi source: ✅');

  if (DRY_RUN) {
    const report={mode:'dry-run',createdAt:new Date().toISOString(),spreadsheetId:exported.id,counts:validation.counts,warnings:validation.warnings,targetBefore:{folders:maps.folders.length,documents:maps.documents.length}};
    const dir=path.join(backendRoot,'migration','reports'); fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,`stage10-dry-run-${migrationTimestamp()}.json`); fs.writeFileSync(file,JSON.stringify(report,null,2));
    console.log(`\n✅ DRY RUN sukses. Report: ${file}`);
    console.log('Tidak ada data Supabase yang diubah.');
    return;
  }

  if (validation.fp2.length && !env.legacyFolderPasswordPepper) {
    fail('APPLY dibatalkan: ada folder password FP2 tetapi LEGACY_FOLDER_PASSWORD_PEPPER kosong. Ambil pepper dari Apps Script lama terlebih dahulu.');
  }

  const backup=await backupTarget();
  console.log(`Backup Supabase   : ${backup}`);

  const results={};
  results.folders=await migrateFolders(sheets,maps); console.log('Folders           :',results.folders);
  results.documents=await migrateDocuments(sheets,maps); console.log('Documents         :',results.documents);
  results.documentVersions=await migrateVersions(sheets,maps); console.log('Document versions :',results.documentVersions);
  results.favorites=await migrateFavorites(sheets,maps); console.log('Favorites         :',results.favorites);
  results.recycleItems=await migrateRecycle(sheets,maps); console.log('Recycle items     :',results.recycleItems);
  results.auditLogs=await migrateAudit(sheets,maps); console.log('Audit logs        :',results.auditLogs);
  results.passwordResetRequests=await migratePasswordResets(sheets,maps); console.log('Password resets   :',results.passwordResetRequests);
  await writeMigrationSettings(exported.id,validation);

  const report={mode:'apply',createdAt:new Date().toISOString(),spreadsheetId:exported.id,backup,sourceBackup:exported.savedPath,counts:validation.counts,results,warnings:validation.warnings,note:'SESSIONS legacy sengaja tidak dimigrasikan; file Google Drive tidak dipindahkan/di-upload ulang.'};
  const dir=path.join(backendRoot,'migration','reports'); fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,`stage10-apply-${migrationTimestamp()}.json`); fs.writeFileSync(file,JSON.stringify(report,null,2));
  console.log(`\n✅ APPLY Tahap 10 selesai. Report: ${file}`);
  console.log('Legacy sessions sengaja dilewati. File Google Drive tidak disentuh.');
}

main().catch(err=>{
  console.error('\n❌ Migrasi gagal:',err.message);
  if (err.details) console.error('Details:',err.details);
  process.exit(1);
});
