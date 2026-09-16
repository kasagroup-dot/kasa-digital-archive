import { assertSupabaseEnv } from '../src/config/env.js';
import { getSupabaseAdmin } from '../src/config/supabase.js';

assertSupabaseEnv();
const supabase = getSupabaseAdmin();

const { data: users, error: usersError } = await supabase
  .from('app_users')
  .select('username,role,status,password_algorithm,division_id')
  .order('username');
if (usersError) throw usersError;

const { count: permissionCount, error: permissionsError } = await supabase
  .from('user_permissions')
  .select('*', { count: 'exact', head: true });
if (permissionsError) throw permissionsError;

const bcryptCount = (users || []).filter((u) => u.password_algorithm === 'bcrypt').length;
const legacyCount = (users || []).filter((u) => u.password_algorithm === 'legacy_sha256_2500').length;

console.log('\nKASA AUTH VERIFY');
console.log('------------------------------');
console.log(`Users       : ${users?.length || 0}`);
console.log(`Permissions : ${permissionCount || 0}`);
console.log(`Legacy hash : ${legacyCount}`);
console.log(`Bcrypt      : ${bcryptCount}`);
console.log('------------------------------');
for (const user of users || []) console.log(`${user.username.padEnd(14)} ${user.role.padEnd(16)} ${user.password_algorithm}`);
console.log('');

if ((users?.length || 0) !== 13 || permissionCount !== 13) {
  console.error('❌ Jumlah user/permission belum sesuai. Jalankan npm run migrate:users.');
  process.exit(1);
}
console.log('✅ Struktur authentication siap.\n');
