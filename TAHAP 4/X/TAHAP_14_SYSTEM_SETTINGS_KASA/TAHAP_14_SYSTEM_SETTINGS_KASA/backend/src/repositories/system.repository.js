import { getSupabaseAdmin } from '../config/supabase.js';

export async function listAppSettings(keys = []) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('app_settings').select('key,value,description,is_secret,updated_at').order('key');
  if (Array.isArray(keys) && keys.length) query = query.in('key', keys);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertAppSettings(items = []) {
  if (!Array.isArray(items) || !items.length) return [];
  const supabase = getSupabaseAdmin();
  const rows = items.map((item) => ({
    key: item.key,
    value: String(item.value ?? ''),
    description: item.description || null,
    is_secret: false,
    updated_at: new Date().toISOString()
  }));
  const { data, error } = await supabase
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' })
    .select('key,value,description,is_secret,updated_at');
  if (error) throw error;
  return data || [];
}

async function countRows(table, apply) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(table).select('id', { count: 'exact' }).limit(1);
  if (typeof apply === 'function') query = apply(query);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

export async function getSystemCounts() {
  const nowIso = new Date().toISOString();
  const [
    activeUsers,
    activeDivisions,
    activeFolders,
    activeDocuments,
    recycleItems,
    activeSessions,
    expiredActiveSessions,
    pendingPasswordResets,
    auditLogs
  ] = await Promise.all([
    countRows('app_users', (q) => q.eq('status', 'ACTIVE')),
    countRows('divisions', (q) => q.eq('status', 'ACTIVE')),
    countRows('folders', (q) => q.eq('status', 'ACTIVE')),
    countRows('documents', (q) => q.eq('status', 'ACTIVE')),
    countRows('recycle_items'),
    countRows('auth_sessions', (q) => q.eq('status', 'ACTIVE').gt('expires_at', nowIso)),
    countRows('auth_sessions', (q) => q.eq('status', 'ACTIVE').lte('expires_at', nowIso)),
    countRows('password_reset_requests', (q) => q.eq('status', 'PENDING')),
    countRows('audit_logs')
  ]);

  return {
    activeUsers,
    activeDivisions,
    activeFolders,
    activeDocuments,
    recycleItems,
    activeSessions,
    expiredActiveSessions,
    pendingPasswordResets,
    auditLogs
  };
}

export async function getLastAuditActivity() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('occurred_at,action,username_snapshot')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function expireStaleSessions() {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('auth_sessions')
    .update({ status: 'EXPIRED', revoked_reason: 'AUTO_EXPIRED' })
    .eq('status', 'ACTIVE')
    .lte('expires_at', now)
    .select('id');
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}
