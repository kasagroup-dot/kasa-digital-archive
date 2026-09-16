import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';
import StatCard from '../components/StatCard.jsx';
import Icon from '../components/Icon.jsx';
import { getDashboardSummary, logout } from '../services/api.js';

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatActivityTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function actionLabel(action) {
  const map = {
    LOGIN: 'LOGIN', LOGOUT: 'LOGOUT', UPLOAD: 'UPLOAD DOCUMENT', CREATE_FOLDER: 'CREATE FOLDER',
    DELETE_DOCUMENT: 'DELETE DOCUMENT', DELETE_FOLDER: 'DELETE FOLDER', RENAME_DOCUMENT: 'RENAME DOCUMENT',
    RENAME_FOLDER: 'RENAME FOLDER', MOVE_DOCUMENT: 'MOVE DOCUMENT', MOVE_FOLDER: 'MOVE FOLDER',
    PASSWORD_RESET_REQUEST: 'PASSWORD RESET REQUEST', CHANGE_PASSWORD: 'CHANGE PASSWORD'
  };
  return map[action] || String(action || 'ACTIVITY').replaceAll('_', ' ');
}

export default function DashboardPage({ user, onLogout }) {
  const [summary, setSummary] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const load = useCallback(async (divisionValue = selectedDivision) => {
    setLoading(true);
    setError('');
    try {
      const result = await getDashboardSummary(divisionValue === 'ALL' ? '' : divisionValue);
      setSummary(result.data);
    } catch (err) {
      setError(err.message || 'Dashboard gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, [selectedDivision]);

  useEffect(() => { load(selectedDivision); }, [selectedDivision]);

  async function handleLogout() {
    try { await logout(); } catch (_) {}
    onLogout();
  }

  function handleMenu() {
    if (window.matchMedia('(max-width: 900px)').matches) setMobileOpen(true);
    else setCollapsed((v) => !v);
  }

  function handleNavigate(key, label) {
    if (key === 'dashboard') return;
    setNotice(`${label} akan kita migrasikan di Tahap 9. Dashboard Tahap 8 sudah memakai data Supabase asli.`);
    window.setTimeout(() => setNotice(''), 4800);
    setMobileOpen(false);
  }

  function handleSearch(term) {
    setNotice(term ? `Pencarian “${term}” akan diaktifkan saat menu Dokumen dimigrasikan di Tahap 9.` : 'Masukkan kata pencarian terlebih dahulu.');
    window.setTimeout(() => setNotice(''), 4200);
  }

  const stats = summary?.stats || {};
  const distribution = summary?.documentsByDivision || [];
  const maxDivision = useMemo(() => Math.max(1, ...distribution.map((item) => Number(item.count || 0))), [distribution]);

  return (
    <div className={`application-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        user={user}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <div className="app-main">
        <Topbar
          user={user}
          title="Dashboard"
          scope={summary?.scope}
          divisions={summary?.divisionOptions || []}
          selectedDivision={selectedDivision}
          onDivisionChange={setSelectedDivision}
          onMenu={handleMenu}
          onSearch={handleSearch}
          onLogout={handleLogout}
        />

        <main className="dashboard-content">
          {notice ? <div className="dashboard-toast">{notice}</div> : null}
          <div className="dashboard-heading">
            <div>
              <h1>KASA Group Digital Command Center</h1>
              <p>Ringkasan pengarsipan dokumen PT. KASA GROUP.</p>
            </div>
            <button className="dashboard-refresh" onClick={() => load(selectedDivision)} disabled={loading}>Refresh</button>
          </div>

          {error ? <div className="dashboard-error">{error}<button onClick={() => load(selectedDivision)}>Coba lagi</button></div> : null}

          <section className={`stats-grid ${loading ? 'is-loading' : ''}`}>
            <StatCard label="TOTAL DOCUMENTS" value={loading ? '—' : Number(stats.totalDocuments || 0).toLocaleString('id-ID')} note="Dokumen aktif" />
            <StatCard label="TOTAL FOLDERS" value={loading ? '—' : Number(stats.totalFolders || 0).toLocaleString('id-ID')} note="Folder aktif" />
            <StatCard label="STORAGE USED" value={loading ? '—' : formatBytes(stats.storageBytes)} note="Metadata file aktif" />
            <StatCard label="TOTAL USERS" value={loading ? '—' : Number(stats.totalUsers || 0).toLocaleString('id-ID')} note="User aktif" />
            <StatCard label="UPLOAD THIS MONTH" value={loading ? '—' : Number(stats.uploadsThisMonth || 0).toLocaleString('id-ID')} note="Bulan berjalan" />
            <StatCard label="TOTAL DIVISIONS" value={loading ? '—' : Number(stats.totalDivisions || 0).toLocaleString('id-ID')} note="Divisi aktif" />
          </section>

          <section className="dashboard-lower-grid">
            <article className="dashboard-panel distribution-panel">
              <div className="panel-head"><div><h2>Documents by Division</h2><p>Distribusi dokumen aktif</p></div></div>
              <div className="division-bars">
                {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="bar-row skeleton-row" />) : distribution.map((item) => (
                  <div className="bar-row" key={item.divisionId}>
                    <span className="bar-label">{item.name}</span>
                    <div className="bar-track"><span style={{ width: `${item.count ? Math.max(2, (item.count / maxDivision) * 100) : 1}%` }} /></div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
                {!loading && distribution.length === 0 ? <div className="empty-state">Belum ada data distribusi.</div> : null}
              </div>
              {!loading && Number(stats.totalDocuments || 0) === 0 ? <div className="migration-note">Metadata dokumen/folder lama belum dimigrasikan ke Supabase. Itu memang dijadwalkan pada Tahap 10.</div> : null}
            </article>

            <article className="dashboard-panel activity-panel">
              <div className="panel-head"><div><h2>Recent Activity</h2><p>Aktivitas terbaru yang diizinkan</p></div></div>
              <div className="activity-list">
                {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="activity-item skeleton-activity" />) : (summary?.recentActivity || []).map((item) => (
                  <div className="activity-item" key={item.id}>
                    <div className="activity-icon"><Icon name="arrow" size={15} /></div>
                    <div className="activity-copy">
                      <strong>{item.username_snapshot || 'SYSTEM'} · {actionLabel(item.action)}</strong>
                      <span>{item.object_name || item.detail || 'Aktivitas sistem'}</span>
                      <small>{formatActivityTime(item.occurred_at)}</small>
                    </div>
                  </div>
                ))}
                {!loading && !(summary?.recentActivity || []).length ? <div className="empty-state">Belum ada aktivitas.</div> : null}
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
