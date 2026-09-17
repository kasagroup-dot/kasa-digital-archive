import { getSupabaseAdmin } from '../config/supabase.js';

const DOCUMENT_COLUMNS = 'id,legacy_id,document_name,original_filename,google_drive_file_id,drive_url,folder_id,division_id,file_type,mime_type,extension,file_size,document_number,document_date,category,tags,description,current_version,uploaded_by_user_id,uploaded_by_username_snapshot,uploaded_at,updated_at,status,deleted_by_user_id,deleted_by_username_snapshot,deleted_at,original_folder_id';

export async function findDocumentById(documentId, { includeDeleted = false } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('documents').select(DOCUMENT_COLUMNS).eq('id', documentId);
  if (!includeDeleted) query = query.eq('status', 'ACTIVE');
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function findDuplicateDocument({ divisionId, folderId = null, filename, excludeDocumentId = null }) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('division_id', divisionId)
    .eq('status', 'ACTIVE')
    .ilike('original_filename', String(filename || ''));
  query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null);
  if (excludeDocumentId) query = query.neq('id', excludeDocumentId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function listSiblingDocumentNames({ divisionId, folderId = null }) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('documents')
    .select('original_filename')
    .eq('division_id', divisionId)
    .eq('status', 'ACTIVE');
  query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => String(row.original_filename || '')).filter(Boolean);
}

export async function insertDocument(record) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('documents').insert(record).select(DOCUMENT_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateDocument(documentId, patch) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('documents').update(patch).eq('id', documentId).select(DOCUMENT_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function insertDocumentVersion(record) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('document_versions').insert(record).select('*').single();
  if (error) throw error;
  return data;
}

export async function listDocumentVersions(documentId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function findDocumentVersion(documentId, versionId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('id', versionId)
    .eq('document_id', documentId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function favoriteExists(userId, documentId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('favorites').select('id').eq('user_id', userId).eq('document_id', documentId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function addFavorite(userId, documentId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('favorites').insert({ user_id: userId, document_id: documentId }).select('id').single();
  if (error) throw error;
  return data;
}

export async function removeFavorite(userId, documentId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('document_id', documentId);
  if (error) throw error;
}

export async function insertRecycleDocument({ documentId, divisionId, originalFolderId, userId, username }) {
  const supabase = getSupabaseAdmin();
  await supabase.from('recycle_items').delete().eq('document_id', documentId);
  const { error } = await supabase.from('recycle_items').insert({
    object_type: 'DOCUMENT',
    document_id: documentId,
    division_id: divisionId,
    original_parent_folder_id: originalFolderId || null,
    deleted_by_user_id: userId || null,
    deleted_by_username_snapshot: username || null,
    deleted_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function createUploadSession(record) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('upload_sessions').insert(record).select('*').single();
  if (error) throw error;
  return data;
}

export async function findUploadSession(uploadId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('upload_sessions').select('*').eq('id', uploadId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function updateUploadSession(uploadId, patch) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('upload_sessions').update(patch).eq('id', uploadId).select('*').single();
  if (error) throw error;
  return data;
}

export async function getMaxUploadBytes() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'MAX_UPLOAD_SIZE').maybeSingle();
  if (error) throw error;
  const value = Number(data?.value || 0);
  return Number.isFinite(value) && value > 0 ? value : 250 * 1024 * 1024;
}
