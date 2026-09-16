import { AppError } from '../utils/AppError.js';
import {
  countRows,
  getDivisionOptions,
  getRecentActivity,
  listActiveDocumentDivisionIds,
  listDocumentSizes
} from '../repositories/dashboard.repository.js';

function startOfCurrentMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
}

function startOfNextMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
}

function resolveScope(user, requestedDivisionId, divisions) {
  if (user.role === 'SUPER_ADMIN') {
    const requested = String(requestedDivisionId || '').trim();
    if (!requested || requested === 'ALL') return { divisionId: null, label: 'Semua Divisi' };
    const found = divisions.find((division) => division.id === requested);
    if (!found) throw new AppError('Divisi dashboard tidak ditemukan.', { statusCode: 400, code: 'INVALID_DIVISION' });
    return { divisionId: found.id, label: found.name };
  }

  const own = divisions.find((division) => division.id === user.division_id);
  return { divisionId: user.division_id || null, label: own?.name || 'Divisi Saya' };
}

function buildDistribution(divisions, documentDivisionIds, scopeDivisionId) {
  const counts = new Map();
  for (const id of documentDivisionIds) counts.set(id, (counts.get(id) || 0) + 1);

  const source = scopeDivisionId
    ? divisions.filter((division) => division.id === scopeDivisionId)
    : divisions;

  return source
    .map((division) => ({
      divisionId: division.id,
      legacyId: division.legacy_id || null,
      name: division.name,
      slug: division.slug,
      count: counts.get(division.id) || 0
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function getDashboardSummary({ user, requestedDivisionId = null }) {
  const divisions = await getDivisionOptions();
  const scope = resolveScope(user, requestedDivisionId, divisions);
  const monthStart = startOfCurrentMonthIso();
  const nextMonth = startOfNextMonthIso();

  const [
    totalDocuments,
    totalFolders,
    totalUsers,
    uploadsThisMonth,
    documentSizes,
    documentDivisionIds,
    recentActivity
  ] = await Promise.all([
    countRows('documents', { divisionId: scope.divisionId, status: 'ACTIVE' }),
    countRows('folders', { divisionId: scope.divisionId, status: 'ACTIVE' }),
    user.role === 'SUPER_ADMIN' && !scope.divisionId
      ? countRows('app_users', { status: 'ACTIVE' })
      : countRows('app_users', { divisionId: scope.divisionId, status: 'ACTIVE' }),
    countRows('documents', {
      divisionId: scope.divisionId,
      status: 'ACTIVE',
      extra: [
        { type: 'gte', column: 'uploaded_at', value: monthStart },
        { type: 'lt', column: 'uploaded_at', value: nextMonth }
      ]
    }),
    listDocumentSizes({ divisionId: scope.divisionId }),
    listActiveDocumentDivisionIds({ divisionId: scope.divisionId }),
    getRecentActivity({ divisionId: scope.divisionId, limit: 8 })
  ]);

  const storageBytes = documentSizes.reduce((sum, size) => sum + Number(size || 0), 0);
  const distribution = buildDistribution(divisions, documentDivisionIds, scope.divisionId);

  return {
    scope: {
      divisionId: scope.divisionId,
      label: scope.label,
      isGlobal: !scope.divisionId
    },
    stats: {
      totalDocuments,
      totalFolders,
      storageBytes,
      totalUsers,
      uploadsThisMonth,
      totalDivisions: scope.divisionId ? 1 : divisions.length
    },
    documentsByDivision: distribution,
    recentActivity,
    divisionOptions: user.role === 'SUPER_ADMIN'
      ? divisions.map((division) => ({ id: division.id, legacyId: division.legacy_id || null, name: division.name, slug: division.slug }))
      : []
  };
}
