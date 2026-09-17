import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log('');
  console.log('=========================================================');
  console.log(` ${env.appName} — BACKEND`);
  console.log('=========================================================');
  console.log(` Environment : ${env.nodeEnv}`);
  console.log(` Port        : ${env.port}`);
  console.log(` API         : http://localhost:${env.port}${env.apiPrefix}`);
  console.log(` Health      : http://localhost:${env.port}${env.apiPrefix}/health`);
  console.log('=========================================================');
  console.log('');
});

function shutdown(signal) {
  console.log(`\n${signal} diterima. Menutup server dengan aman...`);

  server.close((error) => {
    if (error) {
      console.error('Gagal menutup server:', error);
      process.exit(1);
    }

    console.log('Server berhenti dengan aman.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Shutdown timeout. Proses dihentikan paksa.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});
