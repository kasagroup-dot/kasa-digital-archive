import { getSupabaseAdmin } from '../config/supabase.js';

const USER_COLUMNS = 'id,legacy_id,full_name,username,email,division_id,role,status,must_change_password,last_login_at,created_at,updated_at';
const DIVISION_COLUMNS = 'id,legacy_id,name,slug,status';
const PERMISSION_COLUMNS = 'id,user_id,can_view,can_upload,can_download,can_preview,can_create_folder,can_rename,can_move,can_delete,can_restore,can_view_log,updated_at';

export async function listAdminDivisions() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('divisions')
    .select(DIVISION_COLUMNS)
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listUsers({ search = '', role = '', status = '', divisionId = '', page = 1, pageSize = 25 } = {}) {
  const supabase = getSupabaseAdmin();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from('app_users')
    .select(USER_COLUMNS, { count: 'exact' });

  const q = String(search || '').trim();
  if (q) {
    const escaped = q.replaceAll(',', ' ');
    query = query.or(`full_name.ilike.%${escaped}%,username.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }
  if (role) query = query.eq('role', role);
  if (status) query = query.eq('status', status);
  if (divisionId) query = query.eq('division_id', divisionId);

  const { data, error, count } = await query
    .order('full_name', { ascending: true })
    .range(from, to);
  if (error) throw error;

  return {
    rows: data || [],
    total: Number(count || 0),
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(Number(count || 0) / safePageSize))
  };
}

export async function findAdminUserById(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .select(`${USER_COLUMNS},password_algorithm`)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function usernameExists(username, excludeUserId = '') {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('app_users')
    .select('id')
    .ilike('username', String(username || '').trim());
  if (excludeUserId) query = query.neq('id', excludeUserId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

export async function insertAdminUser(record) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .insert(record)
    .select(USER_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateAdminUser(userId, patch) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select(USER_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function resetAdminUserPassword(userId, bcryptHash, mustChangePassword = true) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('app_users')
    .update({
      password_hash: bcryptHash,
      password_algorithm: 'bcrypt',
      legacy_password_salt: null,
      must_change_password: Boolean(mustChangePassword),
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function revokeUserSessions(userId, reason = 'ADMIN_REVOKED') {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('auth_sessions')
    .update({ status: 'REVOKED', revoked_at: now, revoked_reason: reason })
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .select('id');
  if (error) throw error;
  return (data || []).length;
}

export async function getUserPermissions(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_permissions')
    .select(PERMISSION_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function upsertUserPermissions(userId, permissions) {
  const supabase = getSupabaseAdmin();
  const payload = {
    user_id: userId,
    ...permissions,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase
    .from('user_permissions')
    .upsert(payload, { onConflict: 'user_id' })
    .select(PERMISSION_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function listPasswordResetRequests({ status = 'PENDING', limit = 100 } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('password_reset_requests')
    .select('id,user_id,username_snapshot,division_id,requested_at,status,resolved_at,resolution_action,detail')
    .order('requested_at', { ascending: false })
    .limit(Math.min(200, Math.max(1, Number(limit) || 100)));
  if (status && status !== 'ALL') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function resolvePasswordResetRequestsForUser(userId, adminUserId, action = 'ADMIN_RESET') {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('password_reset_requests')
    .update({
      status: 'RESOLVED',
      resolved_by_user_id: adminUserId,
      resolved_at: new Date().toISOString(),
      resolution_action: action
    })
    .eq('user_id', userId)
    .eq('status', 'PENDING');
  if (error) throw error;
}

export async function cancelPasswordResetRequest(requestId, adminUserId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('password_reset_requests')
    .update({
      status: 'CANCELLED',
      resolved_by_user_id: adminUserId,
      resolved_at: new Date().toISOString(),
      resolution_action: 'ADMIN_CANCELLED'
    })
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .select('id,user_id,username_snapshot,status')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}
