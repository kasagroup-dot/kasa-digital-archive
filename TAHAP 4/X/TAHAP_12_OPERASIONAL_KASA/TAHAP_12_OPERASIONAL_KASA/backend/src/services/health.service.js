import { env } from '../config/env.js';
import { getSupabaseAdmin } from '../config/supabase.js';

export function getServerHealth() {
  return {
    status: 'ok',
    app: env.appName,
    company: env.companyName,
    version: env.appVersion,
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    serverTime: new Date().toISOString(),
    supabaseConfigured: Boolean(env.supabaseUrl && env.supabaseServerKey),
    supabaseKeyMode: env.supabaseKeyMode
  };
}

export async function getSupabaseHealth() {
  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();

  const [{ data: settingsRows, error: settingsError }, { data: divisionRows, error: divisionsError }] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['APP_NAME', 'COMPANY_NAME', 'APP_VERSION']),
    // Gunakan GET biasa, bukan HEAD. Pada beberapa jaringan/Windows/proxy,
    // request HEAD ke PostgREST dapat gagal walaupun GET normal berhasil.
    supabase
      .from('divisions')
      .select('id')
  ]);

  if (settingsError) {
    const detail = settingsError?.message || settingsError?.details || settingsError?.hint || JSON.stringify(settingsError || {});
    const error = new Error(`Supabase app_settings gagal dibaca: ${detail}`);
    error.code = 'SUPABASE_QUERY_FAILED';
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  if (divisionsError) {
    const detail = divisionsError?.message || divisionsError?.details || divisionsError?.hint || JSON.stringify(divisionsError || {});
    const error = new Error(`Supabase divisions gagal dibaca: ${detail}`);
    error.code = 'SUPABASE_QUERY_FAILED';
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  const settings = Object.fromEntries(
    (settingsRows || []).map((row) => [String(row.key), String(row.value ?? '')])
  );

  let projectHost = '';
  try {
    projectHost = new URL(env.supabaseUrl).host;
  } catch {
    projectHost = 'invalid-url';
  }

  return {
    status: 'connected',
    projectHost,
    keyMode: env.supabaseKeyMode,
    latencyMs: Date.now() - startedAt,
    divisionCount: Array.isArray(divisionRows) ? divisionRows.length : 0,
    settings
  };
}
