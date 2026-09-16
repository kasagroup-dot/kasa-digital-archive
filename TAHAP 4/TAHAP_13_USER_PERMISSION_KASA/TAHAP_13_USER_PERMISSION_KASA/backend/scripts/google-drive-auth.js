import fs from 'fs';
import http from 'http';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'google-oauth-client.json');
const envPath = path.join(root, '.env');
const redirectUri = 'http://127.0.0.1:53682/oauth2callback';

function readOAuthConfig() {
  if (fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const cfg = raw.installed || raw.web;
    if (cfg?.client_id && cfg?.client_secret) return { clientId: cfg.client_id, clientSecret: cfg.client_secret };
  }
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  if (clientId && clientSecret) return { clientId, clientSecret };
  throw new Error('Google OAuth client belum tersedia. Download OAuth Client JSON tipe Desktop app, rename menjadi google-oauth-client.json, lalu taruh di folder backend.');
}

function updateEnv(values) {
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${String(value).replace(/\r?\n/g, '\\n')}`;
    const regex = new RegExp(`^${key}=.*$`, 'm');
    text = regex.test(text) ? text.replace(regex, line) : `${text.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envPath, text, 'utf8');
}

const { clientId, clientSecret } = readOAuthConfig();
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive']
});

console.log('\nKASA Google Drive OAuth');
console.log('=======================');
console.log('Browser akan dibuka. Login menggunakan akun Google pemilik arsip KASA.');
console.log('Jika browser tidak terbuka, copy URL berikut:\n');
console.log(authUrl, '\n');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404); res.end('Not found'); return;
    }
    const error = url.searchParams.get('error');
    if (error) throw new Error(`Google OAuth ditolak: ${error}`);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Authorization code tidak ditemukan.');
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) throw new Error('Google tidak mengirim refresh_token. Cabut akses aplikasi di Google Account lalu jalankan ulang drive:auth dengan prompt consent.');

    updateEnv({
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_CLIENT_SECRET: clientSecret,
      GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
      GOOGLE_OAUTH_REDIRECT_URI: redirectUri
    });

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>KASA Digital Archive</h2><p>Google Drive berhasil terhubung. Anda boleh menutup tab ini.</p>');
    console.log('✅ Google Drive OAuth berhasil. Credential sudah disimpan ke backend/.env');
    console.log('Sekarang restart backend lalu jalankan: npm run drive:test');
    setTimeout(() => server.close(() => process.exit(0)), 300);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(err.message);
    console.error('❌ OAuth gagal:', err.message);
    setTimeout(() => server.close(() => process.exit(1)), 300);
  }
});

server.listen(53682, '127.0.0.1', () => {
  const cmd = process.platform === 'win32' ? `start "" "${authUrl}"` : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
  exec(cmd, () => {});
});
