import { getSupabaseAdmin } from '../config/supabase.js';

const DIVISION_COLUMNS = 'id,legacy_id,name,slug,description,google_drive_folder_id,status';
const FOLDER_COLUMNS = 'id,legacy_id,name,google_drive_folder_id,parent_folder_id,division_id,description,created_by_username_snapshot,created_at,updated_at,status,password_enabled,password_version';
const DOCUMENT_COLUMNS = 'id,legacy_id,document_name,original_filename,google_drive_file_id,drive_url,folder_id,division_id,file_type,mime_type,extension,file_size,document_number,document_date,category,tags,description,current_version,uploaded_by_username_snapshot,uploaded_at,updated_at,status';

export async function listActiveDivisions() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('divisions')
    .select(DIVISION_COLUMNS)
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function findActiveDivisionById(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('divisions')
    .select(DIVISION_COLUMNS)
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function collectColumn(table, column, filters = []) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  const values = [];
  while (true) {
    let query = supabase.from(table).select(column).range(from, from + pageSize - 1);
    for (const filter of filters) query = query.eq(filter.column, filter.value);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    values.push(...rows.map((row) => row[column]).filter(Boolean));
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return values;
}

export async function getActiveCountsByDivision() {
  const [folderDivisionIds, documentDivisionIds] = await Promise.all([
    collectColumn('folders', 'division_id', [{ column: 'status', value: 'ACTIVE' }]),
    collectColumn('documents', 'division_id', [{ column: 'status', value: 'ACTIVE' }])
  ]);
  const folderCounts = new Map();
  const documentCounts = new Map();
  folderDivisionIds.forEach((id) => folderCounts.set(id, (folderCounts.get(id) || 0) + 1));
  documentDivisionIds.forEach((id) => documentCounts.set(id, (documentCounts.get(id) || 0) + 1));
  return { folderCounts, documentCounts };
}

export async function listDirectFolders({ divisionId, parentFolderId = null }) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('folders')
    .select(FOLDER_COLUMNS)
    .eq('division_id', divisionId)
    .eq('status', 'ACTIVE');
  query = parentFolderId ? query.eq('parent_folder_id', parentFolderId) : query.is('parent_folder_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listDirectDocuments({ divisionId, folderId = null }) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('division_id', divisionId)
    .eq('status', 'ACTIVE');
  query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listActiveFoldersForDivision(divisionId) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  const output = [];
  while (true) {
    const { data, error } = await supabase
      .from('folders')
      .select(FOLDER_COLUMNS)
      .eq('division_id', divisionId)
      .eq('status', 'ACTIVE')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    output.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return output;
}

export async function getFavoriteDocumentIds(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('favorites').select('document_id').eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.document_id));
}

export async function getActiveFolderUnlocks(authSessionId) {
  if (!authSessionId) return [];
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('folder_unlocks')
    .select('folder_id,password_version,expires_at')
    .eq('auth_session_id', authSessionId)
    .gt('expires_at', now);
  if (error) throw error;
  return data || [];
}
