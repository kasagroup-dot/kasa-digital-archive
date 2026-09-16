import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv, env } from './env.js';

let supabaseAdmin = null;

/**
 * Supabase client khusus BACKEND.
 *
 * Prioritas key:
 * 1. SUPABASE_SECRET_KEY (format baru sb_secret_...)
 * 2. SUPABASE_SERVICE_ROLE_KEY (legacy, hanya fallback kompatibilitas)
 *
 * Key server ini memiliki akses tinggi dan TIDAK BOLEH pernah dikirim
 * ke React, browser, GitHub, screenshot publik, atau log aplikasi.
 */
export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  assertSupabaseEnv();

  supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServerKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'kasa-digital-archive-backend/0.8.0'
      }
    }
  });

  return supabaseAdmin;
}
