import { getSupabaseAdmin } from '../config/supabase.js';

const USER_COLUMNS = 'id,legacy_id,full_name,username,email,password_hash,password_algorithm,legacy_password_salt,division_id,role,status,must_change_password,last_login_at,created_at,updated_at';
const PERMISSION_COLUMNS = 'id,legacy_id,user_id,can_view,can_upload,can_download,can_preview,can_create_folder,can_rename,can_move,can_delete,can_restore,can_view_log,updated_at';

export async function findUserByUsername(username) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .select(USER_COLUMNS)
    .ilike('username', String(username || '').trim())
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function findUserById(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .select(USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getPermissionsForUser(user) {
  if (!user) return null;
  if (user.role === 'SUPER_ADMIN') {
    return {
      can_view: true,
      can_upload: true,
      can_download: true,
      can_preview: true,
      can_create_folder: true,
      can_rename: true,
      can_move: true,
      can_delete: true,
      can_restore: true,
      can_view_log: true
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_permissions')
    .select(PERMISSION_COLUMNS)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function upgradeUserPasswordToBcrypt(userId, bcryptHash) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('app_users')
    .update({
      password_hash: bcryptHash,
      password_algorithm: 'bcrypt',
      legacy_password_salt: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateLastLogin(userId) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('app_users')
    .update({ last_login_at: now, updated_at: now })
    .eq('id', userId);
  if (error) throw error;
}

export async function changePasswordHash(userId, bcryptHash) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('app_users')
    .update({
      password_hash: bcryptHash,
      password_algorithm: 'bcrypt',
      legacy_password_salt: null,
      must_change_password: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);
  if (error) throw error;
}
