import { getSupabaseAdmin } from '../config/supabase.js';

export async function writeAuditSafe({ user, action, objectType = 'AUTH', objectId = null, objectName = null, detail = null, ipAddress = null, userAgent = null, metadata = {} }) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('audit_logs').insert({
      user_id: user?.id || null,
      username_snapshot: user?.username || null,
      division_id: user?.division_id || null,
      action,
      object_type: objectType,
      object_id: objectId,
      object_name: objectName,
      detail,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      metadata: metadata || {}
    });
  } catch (error) {
    console.error('Audit log gagal:', error?.message || error);
  }
}
