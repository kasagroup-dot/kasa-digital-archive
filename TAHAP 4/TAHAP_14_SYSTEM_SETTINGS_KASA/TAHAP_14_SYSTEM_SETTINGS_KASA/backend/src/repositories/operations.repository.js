import { getSupabaseAdmin } from '../config/supabase.js';

const DOC_COLUMNS = 'id,legacy_id,document_name,original_filename,google_drive_file_id,drive_url,folder_id,division_id,file_type,mime_type,extension,file_size,document_number,document_date,category,tags,description,current_version,uploaded_by_user_id,uploaded_by_username_snapshot,uploaded_at,updated_at,status,deleted_by_user_id,deleted_by_username_snapshot,deleted_at,original_folder_id';
const FOLDER_COLUMNS = 'id,legacy_id,name,google_drive_folder_id,parent_folder_id,division_id,description,created_by_user_id,created_by_username_snapshot,created_at,updated_at,status,original_parent_folder_id,deleted_by_user_id,deleted_by_username_snapshot,deleted_at,password_enabled,password_version';

export async function listRecentDocumentsRaw({ divisionId = null, limit = 30, search = '' }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('documents').select(DOC_COLUMNS).eq('status', 'ACTIVE');
  if (divisionId) query = query.eq('division_id', divisionId);
  const q = String(search || '').trim();
  if (q) query = query.or(`document_name.ilike.%${q.replaceAll(',', ' ')}%,original_filename.ilike.%${q.replaceAll(',', ' ')}%,document_number.ilike.%${q.replaceAll(',', ' ')}%,category.ilike.%${q.replaceAll(',', ' ')}%`);
  const { data, error } = await query.order('updated_at', { ascending: false }).limit(Math.min(Math.max(Number(limit) || 30, 1), 100));
  if (error) throw error;
  return data || [];
}

export async function listFavoriteDocumentIds(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('favorites').select('document_id,created_at').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listDocumentsByIds(ids = []) {
  if (!ids.length) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('documents').select(DOC_COLUMNS).in('id', ids).eq('status', 'ACTIVE');
  if (error) throw error;
  return data || [];
}

export async function listRecycleRows({ divisionId = null }) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('recycle_items').select('*');
  if (divisionId) query = query.eq('division_id', divisionId);
  const { data, error } = await query.order('deleted_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listDeletedDocumentsByIds(ids = []) {
  if (!ids.length) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('documents').select(DOC_COLUMNS).in('id', ids).eq('status', 'DELETED');
  if (error) throw error;
  return data || [];
}

export async function listDeletedFoldersByIds(ids = []) {
  if (!ids.length) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('folders').select(FOLDER_COLUMNS).in('id', ids).eq('status', 'DELETED');
  if (error) throw error;
  return data || [];
}

export async function findRecycleDocument(documentId) {
  const supabase = getSupabaseAdmin();
  const [{ data: recycle, error: recycleError }, { data: document, error: documentError }] = await Promise.all([
    supabase.from('recycle_items').select('*').eq('document_id', documentId).maybeSingle(),
    supabase.from('documents').select(DOC_COLUMNS).eq('id', documentId).maybeSingle()
  ]);
  if (recycleError) throw recycleError;
  if (documentError) throw documentError;
  return { recycle: recycle || null, document: document || null };
}

export async function findRecycleFolder(folderId) {
  const supabase = getSupabaseAdmin();
  const [{ data: recycle, error: recycleError }, { data: folder, error: folderError }] = await Promise.all([
    supabase.from('recycle_items').select('*').eq('folder_id', folderId).maybeSingle(),
    supabase.from('folders').select(FOLDER_COLUMNS).eq('id', folderId).maybeSingle()
  ]);
  if (recycleError) throw recycleError;
  if (folderError) throw folderError;
  return { recycle: recycle || null, folder: folder || null };
}

export async function updateDocumentRecord(documentId, patch) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('documents').update(patch).eq('id', documentId).select(DOC_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateFolderRecord(folderId, patch) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('folders').update(patch).eq('id', folderId).select(FOLDER_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function removeRecycleDocument(documentId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('recycle_items').delete().eq('document_id', documentId);
  if (error) throw error;
}

export async function removeRecycleFolder(folderId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('recycle_items').delete().eq('folder_id', folderId);
  if (error) throw error;
}

export async function removeFavoritesForDocument(documentId) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('favorites').delete().eq('document_id', documentId);
  if (error) throw error;
}

export async function listDocumentVersionDriveIds(documentId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('document_versions').select('google_drive_file_id').eq('document_id', documentId);
  if (error) throw error;
  return (data || []).map((row) => row.google_drive_file_id).filter(Boolean);
}

export async function listDivisionMapRows() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('divisions').select('id,name,google_drive_folder_id,status').eq('status', 'ACTIVE');
  if (error) throw error;
  return data || [];
}

export async function listActivityRows({ divisionId = null, userId = null, username = '', action = '', query = '', dateFrom = '', dateTo = '', page = 1, pageSize = 50 }) {
  const supabase = getSupabaseAdmin();
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 50, 1), 100);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  let q = supabase.from('audit_logs').select('*', { count: 'exact' });
  if (divisionId) q = q.eq('division_id', divisionId);
  if (userId) q = q.eq('user_id', userId);
  if (username) q = q.ilike('username_snapshot', `%${String(username).trim()}%`);
  if (action) q = q.eq('action', action);
  const search = String(query || '').trim();
  if (search) q = q.or(`object_name.ilike.%${search.replaceAll(',', ' ')}%,detail.ilike.%${search.replaceAll(',', ' ')}%,username_snapshot.ilike.%${search.replaceAll(',', ' ')}%`);
  if (dateFrom) q = q.gte('occurred_at', `${dateFrom}T00:00:00.000Z`);
  if (dateTo) q = q.lte('occurred_at', `${dateTo}T23:59:59.999Z`);
  const { data, error, count } = await q.order('occurred_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: data || [], total: Number(count || 0), page: safePage, pageSize: safePageSize };
}

export async function listActivityActions() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('audit_logs').select('action').order('action', { ascending: true }).limit(1000);
  if (error) throw error;
  return [...new Set((data || []).map((row) => row.action).filter(Boolean))].sort();
}
