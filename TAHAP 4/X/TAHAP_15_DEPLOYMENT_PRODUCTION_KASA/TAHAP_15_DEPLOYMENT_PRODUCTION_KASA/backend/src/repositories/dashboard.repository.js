import { getSupabaseAdmin } from '../config/supabase.js';

function applyDivision(query, divisionId, column = 'division_id') {
  return divisionId ? query.eq(column, divisionId) : query;
}

export async function getDivisionOptions() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('divisions')
    .select('id,legacy_id,name,slug,status')
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function countRows(table, { divisionId = null, status = null, extra = [] } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(table).select('id', { count: 'exact', head: false }).limit(1);
  if (divisionId) query = query.eq('division_id', divisionId);
  if (status) query = query.eq('status', status);
  for (const filter of extra) {
    if (filter.type === 'gte') query = query.gte(filter.column, filter.value);
    else if (filter.type === 'lt') query = query.lt(filter.column, filter.value);
    else if (filter.type === 'eq') query = query.eq(filter.column, filter.value);
  }
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

export async function listDocumentSizes({ divisionId = null } = {}) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  const sizes = [];

  while (true) {
    let query = supabase
      .from('documents')
      .select('file_size')
      .eq('status', 'ACTIVE')
      .range(from, from + pageSize - 1);
    query = applyDivision(query, divisionId);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    sizes.push(...rows.map((row) => Number(row.file_size || 0)));
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return sizes;
}

export async function listActiveDocumentDivisionIds({ divisionId = null } = {}) {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  let from = 0;
  const out = [];

  while (true) {
    let query = supabase
      .from('documents')
      .select('division_id')
      .eq('status', 'ACTIVE')
      .range(from, from + pageSize - 1);
    query = applyDivision(query, divisionId);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    out.push(...rows.map((row) => row.division_id).filter(Boolean));
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export async function getRecentActivity({ divisionId = null, limit = 8 } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('audit_logs')
    .select('id,occurred_at,username_snapshot,division_id,action,object_type,object_name,detail')
    .order('occurred_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit || 8), 1), 20));
  query = applyDivision(query, divisionId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
