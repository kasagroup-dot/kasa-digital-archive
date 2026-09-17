import { env } from '../src/config/env.js';
import { getSystemStatus } from '../src/services/system.service.js';

const strict = process.argv.includes('--strict');

function mark(item) {
  if (item.ok) return '✅';
  return item.severity === 'warning' ? '⚠️' : '❌';
}

try {
  const status = await getSystemStatus();
  console.log('\nKASA Production Readiness');
  console.log('=========================');
  console.log(`Environment : ${status.environment.nodeEnv}`);
  console.log(`App Version : ${status.environment.appVersion}`);
  console.log(`CORS        : ${status.environment.frontendUrls.join(', ')}`);
  console.log(`Cookie      : SameSite=${status.environment.cookie.sameSite} Secure=${status.environment.cookie.secure}`);
  console.log(`Drive       : ${status.drive.connected ? status.drive.name : 'NOT CONNECTED'}`);
  console.log('');
  for (const item of status.checks) {
    console.log(`${mark(item)} ${item.label}: ${item.detail}`);
  }
  console.log('');
  console.log(`Critical ready   : ${status.criticalReady ? 'YES' : 'NO'}`);
  console.log(`Production ready : ${status.productionReady ? 'YES' : 'NO'}`);
  console.log(`Local/core ready : ${status.criticalReady ? 'YES' : 'NO'}`);
  console.log(`Data             : ${status.counts.activeFolders} folders, ${status.counts.activeDocuments} documents, ${status.counts.activeUsers} users`);
  console.log(`Sessions         : ${status.counts.activeSessions} active, ${status.counts.expiredActiveSessions} stale-active`);

  if (!status.criticalReady) process.exitCode = 1;
  else if (strict && !status.productionReady) process.exitCode = 2;

  if (!strict && env.nodeEnv !== 'production') {
    console.log('\nℹ️ LOCAL MODE: critical services siap. NODE_ENV=development dan HTTP localhost ditandai sebagai warning, bukan kegagalan.');
    console.log('ℹ️ Setelah Railway/Cloudflare aktif, set NODE_ENV=production lalu jalankan npm run production:check:strict.');
  }
} catch (error) {
  console.error('\n❌ Production readiness check gagal:', error?.message || error);
  process.exitCode = 1;
}
