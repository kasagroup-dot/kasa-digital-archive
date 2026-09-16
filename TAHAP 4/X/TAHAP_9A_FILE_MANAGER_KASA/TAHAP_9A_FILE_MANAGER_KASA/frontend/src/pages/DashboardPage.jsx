import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import Topbar from '../components/Topbar.jsx';
import StatCard from '../components/StatCard.jsx';
import Icon from '../components/Icon.jsx';
import DivisionsPage from './DivisionsPage.jsx';
import FileManagerPage from './FileManagerPage.jsx';
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
  const [selectedDivision, setSelectedDivision] = useState(user?.role === 'SUPER_ADMIN' ? 'ALL' : (user?.divisionId || 'ALL'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [fileManagerDivisionId, setFileManagerDivisionId] = useState(user?.role === 'SUPER_ADMIN' ? '' : (user?.divisionId || ''));
  const [topSearch, setTopSearch] = useState('');

  const load = useCallback(async (divisionValue) => {
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
  }, []);

  useEffect(() => { load(selectedDivision); }, [selectedDivision, load]);

  async function handleLogout() {
    try { await logout(); } catch (_) {}
    onLogout();
  }

  function handleMenu() {
    if (window.matchMedia('(max-width: 900px)').matches) setMobileOpen(true);
    else setCollapsed((v) => !v);
  }

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4500);
  }

  function handleNavigate(key, label) {
    setMobileOpen(false);
    setTopSearch('');
    if (key === 'dashboard') { setActiveView('dashboard'); return; }
    if (key === 'divisions') { setActiveView('divisions'); return; }
    if (key === 'documents') {
      showNotice('Menu Dokumen adalah Tahap 9B. Tahap 9A sekarang mengaktifkan Semua Divisi + File Manager terlebih dahulu.');
      return;
    }
    showNotice(`${label} akan dimigrasikan pada tahap berikutnya sesuai urutan migrasi.`);
  }

  function handleSearch(term) {
    if (activeView === 'divisions' || activeView === 'fileManager') {
      setTopSearch(term || '');
      return;
    }
    showNotice(term ? `Pencarian “${term}” akan masuk ke Dokumen Global pada Tahap 9B.` : 'Masukkan kata pencarian terlebih dahulu.');
  }

  function openDivision(division) {
    setSelectedDivision(division.id);
    setFileManagerDivisionId(division.id);
    setTopSearch('');
    setActiveView('fileManager');
    setMobileOpen(false);
  }

  function handleDivisionChange(value) {
    setSelectedDivision(value);
    setTopSearch('');
    if (activeView === 'fileManager') {
      if (value === 'ALL') {
        setFileManagerDivisionId('');
        setActiveView('divisions');
      } else {
        setFileManagerDivisionId(value);
      }
    }
  }

  const stats = summary?.stats || {};
  const distribution = summary?.documentsByDivision || [];
  const maxDivision = useMemo(() => Math.max(1, ...distribution.map((item) => Number(item.count || 0))), [distribution]);
  const title = activeView === 'dashboard' ? 'Dashboard' : activeView === 'divisions' ? 'Semua Divisi' : 'File Manager';
  const activeKey = activeView === 'dashboard' ? 'dashboard' : 'divisions';

  return (
    <div className={`application-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        user={user}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        activeKey={activeKey}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <div className="app-main">
        <Topbar
          user={user}
          title={title}
          scope={summary?.scope}
          divisions={summary?.divisionOptions || []}
          selectedDivision={selectedDivision}
          onDivisionChange={handleDivisionChange}
          onMenu={handleMenu}
          onSearch={handleSearch}
          onLogout={handleLogout}
        />

        {notice ? <div className="dashboard-toast app-global-toast">{notice}</div> : null}

        {activeView === 'divisions' ? (
          <DivisionsPage searchTerm={topSearch} onOpenDivision={openDivision} />
        ) : activeView === 'fileManager' && fileManagerDivisionId ? (
          <FileManagerPage
            divisionId={fileManagerDivisionId}
            topSearch={topSearch}
            onBackToDivisions={() => { setActiveView('divisions'); setTopSearch(''); if (user?.role === 'SUPER_ADMIN') setSelectedDivision('ALL'); }}
          />
        ) : (
          <main className="dashboard-content">
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
        )}
      </div>
    </div>
  );
}
