import { getSupabaseAdmin } from '../config/supabase.js';

const DOCUMENT_COLUMNS = 'id,legacy_id,document_name,original_filename,google_drive_file_id,drive_url,folder_id,division_id,file_type,mime_type,extension,file_size,document_number,document_date,category,tags,description,current_version,uploaded_by_username_snapshot,uploaded_at,updated_at,status';
const FOLDER_COLUMNS = 'id,name,parent_folder_id,division_id,password_enabled,password_version,status';
const DIVISION_COLUMNS = 'id,legacy_id,name,slug,description,status';

async function collectPaged(builder, pageSize = 1000) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function listActiveDocuments({ divisionIds = [] } = {}) {
  const supabase = getSupabaseAdmin();
  return collectPaged(async (from, to) => {
    let query = supabase
      .from('documents')
      .select(DOCUMENT_COLUMNS)
      .eq('status', 'ACTIVE')
      .range(from, to);
    if (divisionIds.length) query = query.in('division_id', divisionIds);
    return query;
  });
}

export async function findActiveDocumentById(documentId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS)
    .eq('id', documentId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function listActiveFolders({ divisionIds = [] } = {}) {
  const supabase = getSupabaseAdmin();
  return collectPaged(async (from, to) => {
    let query = supabase
      .from('folders')
      .select(FOLDER_COLUMNS)
      .eq('status', 'ACTIVE')
      .range(from, to);
    if (divisionIds.length) query = query.in('division_id', divisionIds);
    return query;
  });
}

export async function listActiveDivisionsForDocuments() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('divisions')
    .select(DIVISION_COLUMNS)
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listFavoriteDocumentIdsForUser(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('favorites')
    .select('document_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.document_id));
}

export async function listActiveFolderUnlocksForSession(sessionId) {
  if (!sessionId) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('folder_unlocks')
    .select('folder_id,password_version,expires_at')
    .eq('auth_session_id', sessionId)
    .gt('expires_at', new Date().toISOString());
  if (error) throw error;
  return data || [];
}
