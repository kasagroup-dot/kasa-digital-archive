import crypto from 'crypto';

const secret = crypto.randomBytes(64).toString('base64url');
console.log('\nCopy baris berikut ke file backend/.env:\n');
console.log(`JWT_ACCESS_SECRET=${secret}`);
console.log('\nJangan share nilai ini ke chat / GitHub.\n');
