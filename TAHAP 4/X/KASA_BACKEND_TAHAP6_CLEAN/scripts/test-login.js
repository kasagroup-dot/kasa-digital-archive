import readline from 'readline';

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

const username = (await question('Username: ')).trim();
const password = await hiddenQuestion('Password: ');

try {
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, rememberMe: false })
  });
  const loginBody = await loginRes.json();
  console.log('\nLOGIN RESULT');
  console.log(JSON.stringify(loginBody, null, 2));
  if (!loginRes.ok || !loginBody?.data?.accessToken) process.exit(1);

  const meRes = await fetch('http://localhost:4000/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${loginBody.data.accessToken}` }
  });
  const meBody = await meRes.json();
  console.log('\nME RESULT');
  console.log(JSON.stringify(meBody, null, 2));

  if (!meRes.ok) process.exit(1);
  console.log('\n✅ Authentication test sukses.\n');
} catch (error) {
  console.error('\n❌ Test gagal:', error?.message || error);
  console.error('Pastikan npm run dev sedang aktif di terminal lain.');
  process.exit(1);
}
