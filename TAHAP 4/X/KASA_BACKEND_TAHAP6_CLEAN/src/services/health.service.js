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

  const [{ data: settingsRows, error: settingsError }, { count: divisionCount, error: divisionsError }] = await Promise.all([
    supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['APP_NAME', 'COMPANY_NAME', 'APP_VERSION']),
    supabase
      .from('divisions')
      .select('id', { count: 'exact', head: true })
  ]);

  if (settingsError) {
    const error = new Error(`Supabase app_settings gagal dibaca: ${settingsError.message}`);
    error.code = 'SUPABASE_QUERY_FAILED';
    error.statusCode = 500;
    error.isOperational = true;
    throw error;
  }

  if (divisionsError) {
    const error = new Error(`Supabase divisions gagal dibaca: ${divisionsError.message}`);
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
    divisionCount: Number(divisionCount || 0),
    settings
  };
}
