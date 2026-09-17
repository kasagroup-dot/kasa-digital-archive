import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv, env } from './env.js';

let supabaseAdmin = null;

const SUPABASE_FETCH_TIMEOUT_MS = 10000;
const JWT_FUTURE_RETRY_DELAYS_MS = [1000, 2000, 4000];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOnce(input, init = {}) {
  if (init?.signal) return fetch(input, init);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function isJwtIssuedAtFutureResponse(response) {
  if (!response || response.status !== 401) return false;
  try {
    const text = await response.clone().text();
    return /PGRST303/i.test(text) || /JWT issued at future/i.test(text);
  } catch {
    return false;
  }
}

/**
 * Workaround defensif untuk bug intermittent PostgREST PGRST303
 * ("JWT issued at future"). Kita TIDAK menonaktifkan validasi JWT.
 * Hanya request yang benar-benar mendapat 401 PGRST303 yang diulang
 * dengan backoff pendek; response/error lain langsung dikembalikan.
 */
async function fetchWithTimeout(input, init = {}) {
  let response = await fetchOnce(input, init);

  for (let i = 0; i < JWT_FUTURE_RETRY_DELAYS_MS.length; i += 1) {
    const retryable = await isJwtIssuedAtFutureResponse(response);
    if (!retryable) return response;

    const delay = JWT_FUTURE_RETRY_DELAYS_MS[i];
    console.warn(`[Supabase] PGRST303 JWT issued at future. Retry ${i + 1}/${JWT_FUTURE_RETRY_DELAYS_MS.length} dalam ${delay} ms...`);
    await sleep(delay);
    response = await fetchOnce(input, init);
  }

  return response;
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
        'X-Client-Info': 'kasa-digital-archive-backend/0.10.1'
      }
    }
  });

  return supabaseAdmin;
}
