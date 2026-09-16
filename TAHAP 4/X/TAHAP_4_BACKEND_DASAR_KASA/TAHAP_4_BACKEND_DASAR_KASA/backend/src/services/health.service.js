import { env } from '../config/env.js';

export function getServerHealth() {
  return {
    status: 'ok',
    app: env.appName,
    company: env.companyName,
    version: env.appVersion,
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    serverTime: new Date().toISOString(),
    supabaseConfigured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
  };
}
