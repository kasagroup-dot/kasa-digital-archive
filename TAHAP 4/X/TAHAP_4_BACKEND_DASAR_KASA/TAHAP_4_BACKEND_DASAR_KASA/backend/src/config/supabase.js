import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv, env } from './env.js';

let supabaseAdmin = null;

/**
 * Server-only Supabase client.
 * Jangan pernah expose SUPABASE_SERVICE_ROLE_KEY ke React/browser.
 * Tahap 4 hanya menyiapkan client; query koneksi pertama dilakukan di Tahap 5.
 */
export function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  assertSupabaseEnv();

  supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'kasa-digital-archive-backend'
      }
    }
  });

  return supabaseAdmin;
}
