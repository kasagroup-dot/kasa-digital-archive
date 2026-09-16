import { AppError } from '../utils/AppError.js';
import { makeBcryptHash, validateNewPassword } from './password.service.js';
import { writeAuditSafe } from './audit.service.js';
import {
  cancelPasswordResetRequest,
  findAdminUserById,
  getUserPermissions,
  insertAdminUser,
  listAdminDivisions,
  listPasswordResetRequests,
  listUsers,
  resetAdminUserPassword,
  resolvePasswordResetRequestsForUser,
  revokeUserSessions,
  updateAdminUser,
  upsertUserPermissions,
  usernameExists
} from '../repositories/admin.repository.js';

const ROLES = new Set(['SUPER_ADMIN', 'DIVISION_ADMIN', 'DIVISION_USER']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const PERMISSION_KEYS = [
  'can_view','can_upload','can_download','can_preview','can_create_folder',
  'can_rename','can_move','can_delete','can_restore','can_view_log'
];

function cleanText(value, max = 150) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeUsername(value) {
  return cleanText(value, 100).toUpperCase().replace(/\s+/g, '');
}

function fullPermissions() {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, true]));
}

function defaultPermissions(role) {
  if (role === 'SUPER_ADMIN' || role === 'DIVISION_ADMIN') return fullPermissions();
  return {
    can_view: true,
    can_upload: false,
    can_download: true,
    can_preview: true,
    can_create_folder: false,
    can_rename: false,
    can_move: false,
    can_delete: false,
    can_restore: false,
    can_view_log: false
  };
}

function sanitizePermissionInput(input = {}) {
  const out = {};
  for (const key of PERMISSION_KEYS) out[key] = Boolean(input[key]);
  // Tanpa CAN_VIEW, hak operasional lain tidak masuk akal.
  if (!out.can_view) {
    for (const key of PERMISSION_KEYS) out[key] = false;
  }
  return out;
}

function serializeUser(user, divisionMap, permissions = null) {
  return {
    id: user.id,
    legacyId: user.legacy_id || null,
    name: user.full_name,
    username: user.username,
    email: user.email || '',
    divisionId: user.division_id || null,
    divisionName: user.division_id ? (divisionMap.get(user.division_id)?.name || '-') : 'ALL DIVISIONS',
    role: user.role,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at || null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    passwordAlgorithm: user.password_algorithm || null,
    permissions: permissions ? {
      CAN_VIEW: Boolean(permissions.can_view),
      CAN_UPLOAD: Boolean(permissions.can_upload),
      CAN_DOWNLOAD: Boolean(permissions.can_download),
      CAN_PREVIEW: Boolean(permissions.can_preview),
      CAN_CREATE_FOLDER: Boolean(permissions.can_create_folder),
      CAN_RENAME: Boolean(permissions.can_rename),
      CAN_MOVE: Boolean(permissions.can_move),
      CAN_DELETE: Boolean(permissions.can_delete),
      CAN_RESTORE: Boolean(permissions.can_restore),
      CAN_VIEW_LOG: Boolean(permissions.can_view_log)
    } : undefined
  };
}

async function getDivisionContext() {
  const divisions = await listAdminDivisions();
  return {
    divisions: divisions.map((row) => ({ id: row.id, legacyId: row.legacy_id || null, name: row.name, slug: row.slug, status: row.status })),
    map: new Map(divisions.map((row) => [row.id, row]))
  };
}

function assertRoleDivision(role, divisionId) {
  if (!ROLES.has(role)) throw new AppError('Role user tidak valid.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (role === 'SUPER_ADMIN' && divisionId) throw new AppError('Super Admin tidak boleh terikat ke satu divisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (role !== 'SUPER_ADMIN' && !divisionId) throw new AppError('Division Admin/User wajib memiliki divisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });
}

export async function getUserAdminList({ params = {} } = {}) {
  const { divisions, map } = await getDivisionContext();
  const page = await listUsers({
    search: params.search,
    role: params.role,
    status: params.status,
    divisionId: params.divisionId,
    page: params.page,
    pageSize: params.pageSize
  });
  return {
    users: page.rows.map((row) => serializeUser(row, map)),
    divisions,
    pagination: { total: page.total, page: page.page, pageSize: page.pageSize, totalPages: page.totalPages }
  };
}

export async function getUserAdminDetail(userId) {
  const [user, divisionCtx] = await Promise.all([findAdminUserById(userId), getDivisionContext()]);
  if (!user) throw new AppError('User tidak ditemukan.', { statusCode: 404, code: 'USER_NOT_FOUND' });
  const permissions = user.role === 'SUPER_ADMIN' ? fullPermissions() : (await getUserPermissions(user.id) || defaultPermissions(user.role));
  return { user: serializeUser(user, divisionCtx.map, permissions), divisions: divisionCtx.divisions };
}

export async function createAdminUser({ auth, payload = {}, ipAddress, userAgent }) {
  const name = cleanText(payload.name, 150);
  const username = normalizeUsername(payload.username);
  const email = cleanText(payload.email, 320) || null;
  const role = cleanText(payload.role, 30).toUpperCase();
  const status = cleanText(payload.status || 'ACTIVE', 20).toUpperCase();
  const divisionId = role === 'SUPER_ADMIN' ? null : cleanText(payload.divisionId, 80);
  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirmPassword || '');
  const mustChangePassword = payload.mustChangePassword !== false;

  if (!name) throw new AppError('Nama user wajib diisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (!username) throw new AppError('Username wajib diisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (!STATUSES.has(status)) throw new AppError('Status user tidak valid.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  assertRoleDivision(role, divisionId);
  if (password !== confirmPassword) throw new AppError('Konfirmasi password tidak sama.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  const passwordError = validateNewPassword(password);
  if (passwordError) throw new AppError(passwordError, { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (await usernameExists(username)) throw new AppError('Username sudah digunakan.', { statusCode: 409, code: 'USERNAME_EXISTS' });

  const divisions = await listAdminDivisions();
  if (divisionId && !divisions.some((d) => d.id === divisionId && d.status === 'ACTIVE')) {
    throw new AppError('Divisi tidak aktif atau tidak ditemukan.', { statusCode: 400, code: 'DIVISION_INVALID' });
  }

  const bcryptHash = await makeBcryptHash(password);
  const created = await insertAdminUser({
    full_name: name,
    username,
    email,
    password_hash: bcryptHash,
    password_algorithm: 'bcrypt',
    legacy_password_salt: null,
    division_id: divisionId || null,
    role,
    status,
    must_change_password: mustChangePassword
  });
  await upsertUserPermissions(created.id, defaultPermissions(role));

  await writeAuditSafe({
    user: auth.user,
    action: 'CREATE_USER',
    objectType: 'USER',
    objectId: created.id,
    objectName: created.username,
    detail: `User ${created.username} dibuat dengan role ${created.role}.`,
    ipAddress,
    userAgent,
    metadata: { role: created.role, divisionId: created.division_id, status: created.status, mustChangePassword }
  });

  const map = new Map(divisions.map((d) => [d.id, d]));
  return serializeUser(created, map);
}

export async function updateAdminUserProfile({ auth, userId, payload = {}, ipAddress, userAgent }) {
  const target = await findAdminUserById(userId);
  if (!target) throw new AppError('User tidak ditemukan.', { statusCode: 404, code: 'USER_NOT_FOUND' });

  const name = cleanText(payload.name ?? target.full_name, 150);
  const username = normalizeUsername(payload.username ?? target.username);
  const email = cleanText(payload.email ?? target.email, 320) || null;
  const role = cleanText(payload.role ?? target.role, 30).toUpperCase();
  const status = cleanText(payload.status ?? target.status, 20).toUpperCase();
  const divisionId = role === 'SUPER_ADMIN' ? null : cleanText(payload.divisionId ?? target.division_id, 80);
  const mustChangePassword = payload.mustChangePassword === undefined ? Boolean(target.must_change_password) : Boolean(payload.mustChangePassword);

  if (!name || !username) throw new AppError('Nama dan username wajib diisi.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  if (!STATUSES.has(status)) throw new AppError('Status user tidak valid.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  assertRoleDivision(role, divisionId);
  if (await usernameExists(username, target.id)) throw new AppError('Username sudah digunakan user lain.', { statusCode: 409, code: 'USERNAME_EXISTS' });

  // Akun Super Admin yang sedang dipakai tidak boleh mengunci dirinya sendiri.
  if (target.id === auth.user.id) {
    if (role !== 'SUPER_ADMIN') throw new AppError('Anda tidak dapat menurunkan role akun Super Admin yang sedang digunakan.', { statusCode: 400, code: 'SELF_ROLE_PROTECTED' });
    if (status !== 'ACTIVE') throw new AppError('Anda tidak dapat menonaktifkan akun yang sedang digunakan.', { statusCode: 400, code: 'SELF_STATUS_PROTECTED' });
  }

  const divisions = await listAdminDivisions();
  if (divisionId && !divisions.some((d) => d.id === divisionId && d.status === 'ACTIVE')) {
    throw new AppError('Divisi tidak aktif atau tidak ditemukan.', { statusCode: 400, code: 'DIVISION_INVALID' });
  }

  const updated = await updateAdminUser(target.id, {
    full_name: name,
    username,
    email,
    division_id: divisionId || null,
    role,
    status,
    must_change_password: mustChangePassword
  });

  const existingPermissions = await getUserPermissions(target.id);
  if (!existingPermissions || target.role !== role || role === 'SUPER_ADMIN') await upsertUserPermissions(target.id, defaultPermissions(role));
  if (status === 'INACTIVE') await revokeUserSessions(target.id, 'USER_DEACTIVATED_BY_ADMIN');

  await writeAuditSafe({
    user: auth.user,
    action: 'UPDATE_USER',
    objectType: 'USER',
    objectId: target.id,
    objectName: updated.username,
    detail: `Profil user ${updated.username} diperbarui.`,
    ipAddress,
    userAgent,
    metadata: { before: { role: target.role, status: target.status, divisionId: target.division_id }, after: { role, status, divisionId } }
  });

  const map = new Map(divisions.map((d) => [d.id, d]));
  return serializeUser(updated, map);
}

export async function adminResetPassword({ auth, userId, payload = {}, ipAddress, userAgent }) {
  const target = await findAdminUserById(userId);
  if (!target) throw new AppError('User tidak ditemukan.', { statusCode: 404, code: 'USER_NOT_FOUND' });
  if (target.id === auth.user.id) throw new AppError('Gunakan menu Change Password untuk mengganti password akun Anda sendiri.', { statusCode: 400, code: 'SELF_RESET_NOT_ALLOWED' });

  const password = String(payload.password || '');
  const confirmPassword = String(payload.confirmPassword || '');
  if (password !== confirmPassword) throw new AppError('Konfirmasi password tidak sama.', { statusCode: 400, code: 'VALIDATION_ERROR' });
  const passwordError = validateNewPassword(password);
  if (passwordError) throw new AppError(passwordError, { statusCode: 400, code: 'VALIDATION_ERROR' });

  const hash = await makeBcryptHash(password);
  await resetAdminUserPassword(target.id, hash, payload.mustChangePassword !== false);
  const revokedSessions = await revokeUserSessions(target.id, 'PASSWORD_RESET_BY_ADMIN');
  await resolvePasswordResetRequestsForUser(target.id, auth.user.id, 'ADMIN_RESET');

  await writeAuditSafe({
    user: auth.user,
    action: 'RESET_USER_PASSWORD',
    objectType: 'USER',
    objectId: target.id,
    objectName: target.username,
    detail: `Password ${target.username} direset oleh Super Admin.`,
    ipAddress,
    userAgent,
    metadata: { revokedSessions, mustChangePassword: payload.mustChangePassword !== false }
  });

  return { userId: target.id, username: target.username, revokedSessions };
}

export async function adminRevokeSessions({ auth, userId, ipAddress, userAgent }) {
  const target = await findAdminUserById(userId);
  if (!target) throw new AppError('User tidak ditemukan.', { statusCode: 404, code: 'USER_NOT_FOUND' });
  if (target.id === auth.user.id) throw new AppError('Session akun yang sedang digunakan tidak dapat direvoke dari menu ini.', { statusCode: 400, code: 'SELF_SESSION_PROTECTED' });
  const revokedSessions = await revokeUserSessions(target.id, 'ADMIN_REVOKED');
  await writeAuditSafe({
    user: auth.user,
    action: 'REVOKE_USER_SESSIONS',
    objectType: 'USER',
    objectId: target.id,
    objectName: target.username,
    detail: `${revokedSessions} session aktif direvoke oleh Super Admin.`,
    ipAddress,
    userAgent,
    metadata: { revokedSessions }
  });
  return { userId: target.id, username: target.username, revokedSessions };
}

export async function getPermissionsAdmin(userId) {
  const user = await findAdminUserById(userId);
  if (!user) throw new AppError('User tidak ditemukan.', { statusCode: 404, code: 'USER_NOT_FOUND' });
  const divisionCtx = await getDivisionContext();
  const permissions = user.role === 'SUPER_ADMIN' ? fullPermissions() : (await getUserPermissions(user.id) || defaultPermissions(user.role));
  return { user: serializeUser(user, divisionCtx.map, permissions) };
}

export async function updatePermissionsAdmin({ auth, userId, payload = {}, ipAddress, userAgent }) {
  const user = await findAdminUserById(userId);
  if (!user) throw new AppError('User tidak ditemukan.', { statusCode: 404, code: 'USER_NOT_FOUND' });
  if (user.role === 'SUPER_ADMIN') throw new AppError('Permission Super Admin selalu penuh dan tidak dapat dibatasi.', { statusCode: 400, code: 'SUPER_ADMIN_PERMISSION_LOCKED' });
  const permissions = sanitizePermissionInput(payload.permissions || payload);
  const saved = await upsertUserPermissions(user.id, permissions);
  await writeAuditSafe({
    user: auth.user,
    action: 'UPDATE_PERMISSION',
    objectType: 'USER',
    objectId: user.id,
    objectName: user.username,
    detail: `Permission ${user.username} diperbarui.`,
    ipAddress,
    userAgent,
    metadata: permissions
  });
  return { userId: user.id, username: user.username, permissions: saved };
}

export async function getResetRequestsAdmin({ params = {} } = {}) {
  const [requests, divisionCtx] = await Promise.all([
    listPasswordResetRequests({ status: params.status || 'PENDING', limit: params.limit || 100 }),
    getDivisionContext()
  ]);
  const userIds = [...new Set(requests.map((r) => r.user_id).filter(Boolean))];
  const users = new Map();
  for (const id of userIds) {
    const user = await findAdminUserById(id);
    if (user) users.set(id, user);
  }
  return {
    requests: requests.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username_snapshot,
      name: users.get(r.user_id)?.full_name || r.username_snapshot,
      divisionId: r.division_id || null,
      divisionName: r.division_id ? (divisionCtx.map.get(r.division_id)?.name || '-') : 'ALL DIVISIONS',
      requestedAt: r.requested_at,
      status: r.status,
      resolvedAt: r.resolved_at || null,
      resolutionAction: r.resolution_action || null,
      detail: r.detail || ''
    }))
  };
}

export async function cancelResetRequestAdmin({ auth, requestId, ipAddress, userAgent }) {
  const cancelled = await cancelPasswordResetRequest(requestId, auth.user.id);
  if (!cancelled) throw new AppError('Request reset tidak ditemukan atau sudah diproses.', { statusCode: 404, code: 'RESET_REQUEST_NOT_FOUND' });
  await writeAuditSafe({
    user: auth.user,
    action: 'CANCEL_PASSWORD_RESET_REQUEST',
    objectType: 'PASSWORD_RESET_REQUEST',
    objectId: cancelled.id,
    objectName: cancelled.username_snapshot,
    detail: 'Permintaan reset password dibatalkan oleh Super Admin.',
    ipAddress,
    userAgent
  });
  return cancelled;
}
