import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseAdmin } from '../src/config/supabase.js';
import { assertSupabaseEnv } from '../src/config/env.js';

assertSupabaseEnv();
const supabase = getSupabaseAdmin();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, '..', 'migration', 'legacy-users.json');
const payload = JSON.parse(await fs.readFile(sourcePath, 'utf8'));

console.log('\nKASA DIGITAL ARCHIVE — MIGRASI USER LEGACY → SUPABASE');
console.log('------------------------------------------------------');

const { data: divisions, error: divError } = await supabase
  .from('divisions')
  .select('id,legacy_id,name');
if (divError) throw divError;
const divisionMap = new Map((divisions || []).map((d) => [d.legacy_id, d]));

let migratedUsers = 0;
let migratedPermissions = 0;

for (const source of payload.users) {
  const divisionId = source.division_legacy_id ? divisionMap.get(source.division_legacy_id)?.id : null;
  if (source.division_legacy_id && !divisionId) throw new Error(`Divisi ${source.division_legacy_id} tidak ditemukan di Supabase.`);

  const userRow = {
    legacy_id: source.legacy_id,
    full_name: source.full_name,
    username: source.username,
    email: null,
    password_hash: source.password_hash,
    password_algorithm: 'legacy_sha256_2500',
    legacy_password_salt: source.legacy_password_salt,
    division_id: divisionId,
    role: source.role,
    status: source.status,
    must_change_password: source.must_change_password,
    last_login_at: source.last_login_at,
    created_at: source.created_at,
    updated_at: source.updated_at
  };

  const { data: user, error: userError } = await supabase
    .from('app_users')
    .upsert(userRow, { onConflict: 'legacy_id' })
    .select('id,legacy_id,username,role')
    .single();
  if (userError) throw userError;
  migratedUsers += 1;

  const permissionRow = {
    legacy_id: source.permission_legacy_id,
    user_id: user.id,
    can_view: true,
    can_upload: true,
    can_download: true,
    can_preview: true,
    can_create_folder: true,
    can_rename: true,
    can_move: true,
    can_delete: true,
    can_restore: true,
    can_view_log: true,
    updated_at: '2026-08-27T09:21:55.826Z'
  };

  const { error: permissionError } = await supabase
    .from('user_permissions')
    .upsert(permissionRow, { onConflict: 'user_id' });
  if (permissionError) throw permissionError;
  migratedPermissions += 1;

  console.log(`✓ ${user.username.padEnd(14)} ${user.role}`);
}

const { data: allUsers, error: userCountError } = await supabase
  .from('app_users')
  .select('id');
if (userCountError) throw userCountError;
const userCount = Array.isArray(allUsers) ? allUsers.length : 0;

console.log('------------------------------------------------------');
console.log(`Migrated users       : ${migratedUsers}`);
console.log(`Migrated permissions : ${migratedPermissions}`);
console.log(`Total app_users      : ${userCount}`);
console.log('✅ Migrasi user selesai. Password plaintext tidak pernah dipindahkan.');
console.log('Saat login pertama sukses, hash legacy otomatis di-upgrade menjadi bcrypt.\n');
