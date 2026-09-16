import readline from 'readline';

const API_BASE_URL = String(process.env.API_BASE_URL || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');

function question(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(query, (answer) => { rl.close(); resolve(answer); }));
}

function hiddenQuestion(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') return question(query).then(resolve);

    let value = '';
    stdout.write(query);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      if (char === '\u0003') process.exit(130);
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(value);
        return;
      }
      if (char === '\u007f' || char === '\b') {
        if (value.length) {
          value = value.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }
      value += char;
      stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    const cause = error?.cause;
    const details = [
      error?.message,
      cause?.code,
      cause?.message
    ].filter(Boolean).join(' | ');
    const wrapped = new Error(details || 'Tidak dapat terhubung ke backend.');
    wrapped.code = cause?.code || 'FETCH_FAILED';
    throw wrapped;
  }

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { success: false, message: text || `HTTP ${response.status}` };
  }
  return { response, body };
}

console.log('');
console.log('KASA Authentication Test');
console.log('API:', API_BASE_URL);
console.log('');

// Preflight: pastikan backend hidup sebelum minta username/password.
try {
  const { response, body } = await fetchJson(`${API_BASE_URL}/health`);
  if (!response.ok || body?.success === false) {
    console.error('❌ Backend merespons tetapi health check gagal.');
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log('✅ Backend terhubung.');
} catch (error) {
  console.error('❌ Backend TIDAK dapat dijangkau.');
  console.error(`   ${error.message}`);
  console.error('');
  console.error('Yang harus dilakukan:');
  console.error('1. Buka Terminal 1 di folder backend.');
  console.error('2. Jalankan: npm run dev');
  console.error('3. JANGAN tutup Terminal 1.');
  console.error('4. Buka Terminal 2, lalu jalankan: npm run auth:test');
  console.error('5. Cek juga browser: http://127.0.0.1:4000/api/v1/health');
  process.exit(1);
}

const username = (await question('Username: ')).trim();
const password = await hiddenQuestion('Password: ');

try {
  const { response: loginRes, body: loginBody } = await fetchJson(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, rememberMe: false })
  });

  console.log('\nLOGIN RESULT');
  console.log(JSON.stringify(loginBody, null, 2));

  if (!loginRes.ok || !loginBody?.data?.accessToken) {
    console.error('\n❌ Login ditolak oleh backend. Ini bukan masalah koneksi.');
    process.exit(1);
  }

  const { response: meRes, body: meBody } = await fetchJson(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${loginBody.data.accessToken}` }
  });

  console.log('\nME RESULT');
  console.log(JSON.stringify(meBody, null, 2));

  if (!meRes.ok) process.exit(1);
  console.log('\n✅ Authentication test sukses.\n');
} catch (error) {
  console.error('\n❌ Test gagal:', error?.message || error);
  console.error(`API yang diuji: ${API_BASE_URL}`);
  process.exit(1);
}
