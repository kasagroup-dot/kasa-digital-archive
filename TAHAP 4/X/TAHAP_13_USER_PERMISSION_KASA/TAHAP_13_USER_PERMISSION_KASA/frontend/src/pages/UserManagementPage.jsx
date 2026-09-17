import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import {
  cancelAdminPasswordResetRequest,
  createAdminUser as createUserApi,
  getAdminPasswordResetRequests,
  getAdminUsers,
  resetAdminUserPassword,
  revokeAdminUserSessions,
  updateAdminUser as updateUserApi
} from '../services/api.js';

const EMPTY_FORM = {
  name: '', username: '', email: '', role: 'DIVISION_USER', divisionId: '', status: 'ACTIVE',
  password: '', confirmPassword: '', mustChangePassword: true
};

function roleLabel(role) {
  if (role === 'SUPER_ADMIN') return 'Super Admin';
  if (role === 'DIVISION_ADMIN') return 'Division Admin';
  return 'Division User';
}

function formatDate(value) {
  if (!value) return 'Belum pernah';
  try { return new Intl.DateTimeFormat('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
  catch { return '-'; }
}

function UserModal({ mode, user, divisions, currentUser, onClose, onSaved }) {
  const isCreate = mode === 'create';
  const isReset = mode === 'reset';
  const [form, setForm] = useState(() => isCreate ? { ...EMPTY_FORM } : isReset ? {
    password: '', confirmPassword: '', mustChangePassword: true
  } : {
    name: user?.name || '', username: user?.username || '', email: user?.email || '', role: user?.role || 'DIVISION_USER',
    divisionId: user?.divisionId || '', status: user?.status || 'ACTIVE', mustChangePassword: Boolean(user?.mustChangePassword)
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const self = user?.id && currentUser?.id === user.id;
  const role = form.role || user?.role;

  function patch(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      if (isReset) {
        await resetAdminUserPassword(user.id, form);
      } else if (isCreate) {
        await createUserApi({ ...form, divisionId: form.role === 'SUPER_ADMIN' ? '' : form.divisionId });
      } else {
        await updateUserApi(user.id, { ...form, divisionId: form.role === 'SUPER_ADMIN' ? '' : form.divisionId });
      }
      onSaved(isReset ? `Password ${user.username} berhasil direset.` : isCreate ? 'User baru berhasil dibuat.' : 'User berhasil diperbarui.');
    } catch (err) {
      setError(err.message || 'Proses gagal.');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
      <form className="admin-modal" onSubmit={submit}>
        <div className="admin-modal-head">
          <div>
            <span>SUPER ADMIN · USER CONTROL</span>
            <h2>{isCreate ? 'Tambah User' : isReset ? `Reset Password · ${user?.username}` : `Edit User · ${user?.username}`}</h2>
          </div>
          <button type="button" onClick={onClose}><Icon name="close" size={18}/></button>
        </div>
        <div className="admin-modal-body">
          {error ? <div className="admin-error-box">{error}</div> : null}
          {isReset ? (
            <>
              <div className="admin-info-box">Reset password akan menggunakan bcrypt dan semua session aktif user ini akan diputus. Password tidak pernah ditampilkan kembali setelah disimpan.</div>
              <label className="admin-field"><span>Password Baru</span><input type="password" value={form.password} onChange={(e)=>patch('password',e.target.value)} minLength={6} autoFocus required /></label>
              <label className="admin-field"><span>Konfirmasi Password</span><input type="password" value={form.confirmPassword} onChange={(e)=>patch('confirmPassword',e.target.value)} minLength={6} required /></label>
              <label className="admin-check"><input type="checkbox" checked={form.mustChangePassword} onChange={(e)=>patch('mustChangePassword',e.target.checked)} /><span>User wajib mengganti password setelah login</span></label>
            </>
          ) : (
            <>
              <div className="admin-form-grid">
                <label className="admin-field"><span>Nama Lengkap</span><input value={form.name} onChange={(e)=>patch('name',e.target.value)} maxLength={150} required /></label>
                <label className="admin-field"><span>Username</span><input value={form.username} onChange={(e)=>patch('username',e.target.value)} maxLength={100} required /></label>
                <label className="admin-field admin-field-wide"><span>Email</span><input type="email" value={form.email} onChange={(e)=>patch('email',e.target.value)} maxLength={320} placeholder="opsional" /></label>
                <label className="admin-field"><span>Role</span><select value={form.role} onChange={(e)=>patch('role',e.target.value)} disabled={self}><option value="DIVISION_USER">Division User</option><option value="DIVISION_ADMIN">Division Admin</option><option value="SUPER_ADMIN">Super Admin</option></select></label>
                <label className="admin-field"><span>Divisi</span><select value={role === 'SUPER_ADMIN' ? '' : form.divisionId} onChange={(e)=>patch('divisionId',e.target.value)} disabled={role === 'SUPER_ADMIN'} required={role !== 'SUPER_ADMIN'}><option value="">— Pilih Divisi —</option>{divisions.filter(d=>d.status==='ACTIVE').map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                <label className="admin-field"><span>Status</span><select value={form.status} onChange={(e)=>patch('status',e.target.value)} disabled={self}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label>
              </div>
              {isCreate ? (
                <>
                  <div className="admin-section-line"><span>TEMPORARY PASSWORD</span></div>
                  <div className="admin-form-grid">
                    <label className="admin-field"><span>Password Awal</span><input type="password" value={form.password} onChange={(e)=>patch('password',e.target.value)} minLength={6} required /></label>
                    <label className="admin-field"><span>Konfirmasi</span><input type="password" value={form.confirmPassword} onChange={(e)=>patch('confirmPassword',e.target.value)} minLength={6} required /></label>
                  </div>
                </>
              ) : null}
              <label className="admin-check"><input type="checkbox" checked={form.mustChangePassword} onChange={(e)=>patch('mustChangePassword',e.target.checked)} /><span>Wajib ganti password saat login berikutnya</span></label>
              {self ? <div className="admin-info-box">Akun yang sedang digunakan tidak dapat menurunkan role atau menonaktifkan dirinya sendiri.</div> : null}
            </>
          )}
        </div>
        <div className="admin-modal-footer"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary" disabled={saving}>{saving ? 'Menyimpan…' : isReset ? 'Reset Password' : 'Simpan'}</button></div>
      </form>
    </div>
  );
}

export default function UserManagementPage({ currentUser, topSearch = '' }) {
  const [data, setData] = useState({ users:[], divisions:[], pagination:{ total:0,page:1,pageSize:25,totalPages:1 } });
  const [resetRequests, setResetRequests] = useState([]);
  const [filters, setFilters] = useState({ search: topSearch || '', role:'ALL', status:'ALL', divisionId:'ALL', page:1, pageSize:25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(null);
  const [busyId, setBusyId] = useState('');

  useEffect(()=>{ setFilters((p)=>({...p,search:topSearch||'',page:1})); },[topSearch]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [usersResult, requestsResult] = await Promise.all([
        getAdminUsers(filters),
        getAdminPasswordResetRequests('PENDING')
      ]);
      setData(usersResult.data || { users:[],divisions:[],pagination:{} });
      setResetRequests(requestsResult.data?.requests || []);
    } catch (err) { setError(err.message || 'Manajemen user gagal dimuat.'); }
    finally { setLoading(false); }
  },[filters]);

  useEffect(()=>{ load(); },[load]);

  function notify(message) { setToast(message); window.setTimeout(()=>setToast(''),4000); }
  function saved(message) { setModal(null); notify(message); load(); }
  function patchFilter(key,value){ setFilters((p)=>({...p,[key]:value,page:key==='page'?Number(value):1})); }

  async function revoke(user) {
    if (!window.confirm(`Putus semua session aktif ${user.username}?`)) return;
    setBusyId(user.id); setError('');
    try { const result = await revokeAdminUserSessions(user.id); notify(`${result.data?.revokedSessions || 0} session ${user.username} diputus.`); }
    catch (err) { setError(err.message || 'Gagal revoke session.'); }
    finally { setBusyId(''); }
  }

  async function cancelRequest(request) {
    if (!window.confirm(`Batalkan permintaan reset password ${request.username}?`)) return;
    setBusyId(request.id);
    try { await cancelAdminPasswordResetRequest(request.id); notify('Permintaan reset dibatalkan.'); load(); }
    catch (err) { setError(err.message || 'Request gagal dibatalkan.'); }
    finally { setBusyId(''); }
  }

  const pendingUserIds = useMemo(()=>new Set(resetRequests.map(r=>r.userId)),[resetRequests]);
  const activeCount = data.users.filter(u=>u.status==='ACTIVE').length;

  return (
    <main className="admin-workspace">
      {toast ? <div className="folder-toast">{toast}</div> : null}
      <div className="admin-heading">
        <div><span>ADMINISTRATION</span><h1>Manajemen User</h1><p>Create, edit, nonaktifkan user, reset password, dan putus session secara aman.</p></div>
        <button className="admin-primary-btn" onClick={()=>setModal({mode:'create'})}><Icon name="plus" size={15}/> User Baru</button>
      </div>

      <section className="admin-stat-row">
        <div><span>TOTAL USER</span><strong>{data.pagination?.total || 0}</strong></div>
        <div><span>AKTIF DI HALAMAN</span><strong>{activeCount}</strong></div>
        <div><span>RESET PENDING</span><strong>{resetRequests.length}</strong></div>
      </section>

      {resetRequests.length ? <section className="reset-request-strip"><div><strong>{resetRequests.length} permintaan reset password menunggu</strong><span>Proses melalui Reset Password atau batalkan jika tidak valid.</span></div><div className="reset-request-pills">{resetRequests.slice(0,4).map((r)=><span key={r.id}>{r.username}</span>)}{resetRequests.length>4?<span>+{resetRequests.length-4}</span>:null}</div></section> : null}

      <section className="admin-toolbar">
        <label className="admin-search"><Icon name="search" size={15}/><input value={filters.search} onChange={(e)=>patchFilter('search',e.target.value)} placeholder="Cari nama, username, email…" /></label>
        <select value={filters.divisionId} onChange={(e)=>patchFilter('divisionId',e.target.value)}><option value="ALL">Semua Divisi</option>{data.divisions.map((d)=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select value={filters.role} onChange={(e)=>patchFilter('role',e.target.value)}><option value="ALL">Semua Role</option><option value="SUPER_ADMIN">Super Admin</option><option value="DIVISION_ADMIN">Division Admin</option><option value="DIVISION_USER">Division User</option></select>
        <select value={filters.status} onChange={(e)=>patchFilter('status',e.target.value)}><option value="ALL">Semua Status</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select>
        <button onClick={load} disabled={loading}>Refresh</button>
      </section>

      {error ? <div className="dashboard-error">{error}<button onClick={load}>Coba lagi</button></div> : null}

      <section className="admin-table-card">
        <div className="user-table-head"><span>User</span><span>Divisi</span><span>Role</span><span>Status</span><span>Last Login</span><span>Aksi</span></div>
        {loading ? Array.from({length:6}).map((_,i)=><div className="user-table-row is-skeleton" key={i}/>) : data.users.map((user)=>(
          <div className="user-table-row" key={user.id}>
            <div className="user-cell"><div className="admin-avatar">{String(user.name||user.username).slice(0,1).toUpperCase()}</div><div><strong>{user.name}</strong><span>@{user.username}{user.email?` · ${user.email}`:''}</span>{pendingUserIds.has(user.id)?<small>RESET PASSWORD PENDING</small>:null}</div></div>
            <span>{user.divisionName}</span>
            <span className="admin-role-badge">{roleLabel(user.role)}</span>
            <span><b className={`admin-status ${user.status==='ACTIVE'?'active':'inactive'}`}>{user.status}</b>{user.mustChangePassword?<small>Must change password</small>:null}</span>
            <span>{formatDate(user.lastLoginAt)}</span>
            <div className="admin-row-actions">
              <button onClick={()=>setModal({mode:'edit',user})}><Icon name="edit" size={14}/> Edit</button>
              {user.id !== currentUser?.id ? <button onClick={()=>setModal({mode:'reset',user})}><Icon name="key" size={14}/> Reset</button> : null}
              {user.id !== currentUser?.id ? <button onClick={()=>revoke(user)} disabled={busyId===user.id}>Session</button> : null}
            </div>
          </div>
        ))}
        {!loading && !data.users.length ? <div className="empty-state admin-empty">User tidak ditemukan.</div> : null}
      </section>

      <div className="ops-pagination"><button disabled={(data.pagination?.page||1)<=1} onClick={()=>setFilters(p=>({...p,page:p.page-1}))}>Sebelumnya</button><span>Halaman {data.pagination?.page||1} / {data.pagination?.totalPages||1}</span><button disabled={(data.pagination?.page||1)>=(data.pagination?.totalPages||1)} onClick={()=>setFilters(p=>({...p,page:p.page+1}))}>Berikutnya</button></div>

      {resetRequests.length ? <section className="reset-request-card"><div className="panel-head"><div><h2>Password Reset Queue</h2><p>Permintaan dari halaman Forgot Password.</p></div></div>{resetRequests.map((r)=><div className="reset-request-row" key={r.id}><div><strong>{r.name}</strong><span>{r.username} · {r.divisionName}</span><small>{formatDate(r.requestedAt)}</small></div><div><button onClick={()=>{ const user=data.users.find(u=>u.id===r.userId); if(user)setModal({mode:'reset',user}); else notify('Cari user tersebut lewat filter lalu reset password.'); }}>Reset Password</button><button className="danger-link" disabled={busyId===r.id} onClick={()=>cancelRequest(r)}>Batalkan</button></div></div>)}</section> : null}

      {modal ? <UserModal mode={modal.mode} user={modal.user} divisions={data.divisions} currentUser={currentUser} onClose={()=>setModal(null)} onSaved={saved} /> : null}
    </main>
  );
}
