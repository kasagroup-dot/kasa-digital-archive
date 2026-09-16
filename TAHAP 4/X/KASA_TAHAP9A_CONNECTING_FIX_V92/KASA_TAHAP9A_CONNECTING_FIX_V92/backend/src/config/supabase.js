import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv, env } from './env.js';

let supabaseAdmin = null;

const SUPABASE_FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(input, init = {}) {
  if (init?.signal) return fetch(input, init);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
      fetch: fetchWithTimeout,
      headers: {
        'X-Client-Info': 'kasa-digital-archive-backend/0.9.2'
      }
    }
  });

  return supabaseAdmin;
}
