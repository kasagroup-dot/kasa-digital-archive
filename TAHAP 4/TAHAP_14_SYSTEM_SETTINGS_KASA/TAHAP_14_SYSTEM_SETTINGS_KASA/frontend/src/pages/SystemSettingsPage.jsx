import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { cleanupExpiredSessions, getSystemSettings, getSystemStatus, updateSystemSettings } from '../services/api.js';

function fmt(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString('id-ID') : '0';
}

function timeText(value) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch { return String(value); }
}

function cloneForm(settings) {
  return {
    storage: {
      maxUploadMb: Number(settings?.storage?.maxUploadMb || 250),
      maxPreviewMb: Number(settings?.storage?.maxPreviewMb || 8)
    },
    session: {
      sessionDurationHours: Number(settings?.session?.sessionDurationHours || 8),
      rememberSessionDays: Number(settings?.session?.rememberSessionDays || 7)
    },
    pagination: {
      defaultPageSize: Number(settings?.pagination?.defaultPageSize || 25),
      maxPageSize: Number(settings?.pagination?.maxPageSize || 100)
    },
    maintenance: {
      enabled: Boolean(settings?.maintenance?.enabled),
      message: settings?.maintenance?.message || 'Sistem sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.'
    }
  };
}

function StatusBadge({ ok, children }) {
  return <span className={`system-status-badge ${ok ? 'ok' : 'bad'}`}>{ok ? 'READY' : 'CHECK'} · {children}</span>;
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSettings = useCallback(async () => {
    const result = await getSystemSettings();
    setSettings(result.data);
    setForm(cloneForm(result.data));
  }, []);

  const loadStatus = useCallback(async () => {
    setChecking(true);
    try {
      const result = await getSystemStatus();
      setStatus(result.data);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const [settingsResult, statusResult] = await Promise.all([getSystemSettings(), getSystemStatus()]);
        if (!live) return;
        setSettings(settingsResult.data);
        setForm(cloneForm(settingsResult.data));
        setStatus(statusResult.data);
      } catch (err) {
        if (live) setError(err.message || 'System Settings gagal dimuat.');
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, []);

  function patch(section, key, value) {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }

  async function save() {
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await updateSystemSettings(form);
      setSettings(result.data);
      setForm(cloneForm(result.data));
      setNotice('System Settings berhasil disimpan. Perubahan runtime aktif tanpa restart untuk limit upload, session, dan maintenance.');
      await loadStatus();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan System Settings.');
    } finally { setSaving(false); }
  }

  async function refreshAll() {
    setError(''); setNotice('');
    try {
      await Promise.all([loadSettings(), loadStatus()]);
      setNotice('Settings dan diagnostics diperbarui.');
    } catch (err) { setError(err.message || 'Refresh gagal.'); }
  }

  async function cleanup() {
    if (!window.confirm('Tandai semua session ACTIVE yang sudah kedaluwarsa menjadi EXPIRED? Session aktif yang masih valid tidak akan disentuh.')) return;
    setCleaning(true); setError(''); setNotice('');
    try {
      const result = await cleanupExpiredSessions();
      setNotice(result.message || 'Session kedaluwarsa berhasil dibersihkan.');
      await loadStatus();
    } catch (err) { setError(err.message || 'Cleanup session gagal.'); }
    finally { setCleaning(false); }
  }

  const checks = status?.checks || [];
  const counts = status?.counts || {};
  const readiness = useMemo(() => {
    if (!status) return { text: 'CHECKING', ok: false };
    if (status.productionReady) return { text: 'PRODUCTION READY', ok: true };
    if (status.criticalReady) return { text: 'CORE READY · PROD CONFIG PENDING', ok: true };
    return { text: 'ACTION REQUIRED', ok: false };
  }, [status]);

  if (loading) return <main className="admin-workspace"><div className="permission-loading">Memuat System Settings…</div></main>;
  if (!form) return <main className="admin-workspace"><div className="admin-error-box">{error || 'System Settings tidak tersedia.'}</div></main>;

  return (
    <main className="admin-workspace system-settings-page">
      <div className="admin-heading system-heading">
        <div>
          <span>SYSTEM CONTROL</span>
          <h1>System Settings</h1>
          <p>Konfigurasi operasional, diagnostics, dan production readiness KASA Digital Archive.</p>
        </div>
        <div className="system-heading-actions">
          <StatusBadge ok={readiness.ok}>{readiness.text}</StatusBadge>
          <button className="admin-secondary-btn" onClick={refreshAll} disabled={checking}><Icon name="history" size={15}/>{checking ? 'Checking…' : 'Refresh Diagnostics'}</button>
          <button className="admin-primary-btn" onClick={save} disabled={saving}><Icon name="settings" size={15}/>{saving ? 'Menyimpan…' : 'Simpan Settings'}</button>
        </div>
      </div>

      {error ? <div className="admin-error-box system-message">{error}</div> : null}
      {notice ? <div className="admin-info-box system-message">{notice}</div> : null}

      <section className="system-overview-grid">
        <article className="system-overview-card"><span>APP</span><strong>{settings?.branding?.appName}</strong><small>{settings?.branding?.companyName} · {settings?.branding?.appVersion}</small></article>
        <article className="system-overview-card"><span>DATABASE</span><strong>{status?.environment?.supabaseKeyMode === 'secret' ? 'SUPABASE SECRET' : String(status?.environment?.supabaseKeyMode || '-').toUpperCase()}</strong><small>{fmt(counts.activeDocuments)} dokumen · {fmt(counts.activeFolders)} folder</small></article>
        <article className="system-overview-card"><span>GOOGLE DRIVE</span><strong>{status?.drive?.connected ? 'CONNECTED' : 'CHECK REQUIRED'}</strong><small>{status?.drive?.name || settings?.storage?.rootDriveFolderId || '-'}</small></article>
        <article className="system-overview-card"><span>SESSION</span><strong>{fmt(counts.activeSessions)} ACTIVE</strong><small>{fmt(counts.expiredActiveSessions)} expired-active menunggu cleanup</small></article>
      </section>

      <section className="system-settings-grid">
        <article className="system-panel">
          <div className="system-panel-head"><div><span>STORAGE</span><h2>Upload & Preview</h2></div><Icon name="upload" size={19}/></div>
          <div className="system-form-grid">
            <label><span>Maximum Upload / File</span><div className="number-with-unit"><input type="number" min="1" max="1024" value={form.storage.maxUploadMb} onChange={(e)=>patch('storage','maxUploadMb',e.target.value)}/><b>MB</b></div><small>Aktif langsung pada Document Engine. Range 1–1024 MB.</small></label>
            <label><span>Direct Preview Limit</span><div className="number-with-unit"><input type="number" min="1" max="100" value={form.storage.maxPreviewMb} onChange={(e)=>patch('storage','maxPreviewMb',e.target.value)}/><b>MB</b></div><small>Batas konfigurasi preview langsung. Range 1–100 MB.</small></label>
          </div>
          <div className="system-readonly"><span>Google Drive Root</span><code>{settings?.storage?.rootDriveFolderId || '-'}</code><small>Read-only di UI untuk mencegah arsip terputus dari root folder produksi.</small></div>
        </article>

        <article className="system-panel">
          <div className="system-panel-head"><div><span>AUTHENTICATION</span><h2>Session Policy</h2></div><Icon name="shield" size={19}/></div>
          <div className="system-form-grid">
            <label><span>Normal Session</span><div className="number-with-unit"><input type="number" min="1" max="72" value={form.session.sessionDurationHours} onChange={(e)=>patch('session','sessionDurationHours',e.target.value)}/><b>JAM</b></div><small>Dipakai pada login baru tanpa Remember Session.</small></label>
            <label><span>Remember Session</span><div className="number-with-unit"><input type="number" min="1" max="30" value={form.session.rememberSessionDays} onChange={(e)=>patch('session','rememberSessionDays',e.target.value)}/><b>HARI</b></div><small>Dipakai pada login baru dengan Remember Session.</small></label>
          </div>
          <button className="system-cleanup-btn" onClick={cleanup} disabled={cleaning}><Icon name="history" size={14}/>{cleaning ? 'Cleaning…' : 'Cleanup Expired Sessions'}</button>
        </article>

        <article className="system-panel">
          <div className="system-panel-head"><div><span>UI / API</span><h2>Pagination</h2></div><Icon name="list" size={19}/></div>
          <div className="system-form-grid">
            <label><span>Default Page Size</span><input type="number" min="10" max="100" value={form.pagination.defaultPageSize} onChange={(e)=>patch('pagination','defaultPageSize',e.target.value)}/><small>Default hasil per halaman untuk File Manager dan Dokumen Global.</small></label>
            <label><span>Maximum Page Size</span><input type="number" min="10" max="500" value={form.pagination.maxPageSize} onChange={(e)=>patch('pagination','maxPageSize',e.target.value)}/><small>Batas maksimum page size untuk File Manager dan Dokumen Global.</small></label>
          </div>
          <div className="system-readonly"><span>Security Model</span><code>{settings?.branding?.securityModel || '-'}</code></div>
        </article>

        <article className={`system-panel maintenance-panel ${form.maintenance.enabled ? 'is-active' : ''}`}>
          <div className="system-panel-head"><div><span>EMERGENCY CONTROL</span><h2>Maintenance Mode</h2></div><Icon name="settings" size={19}/></div>
          <button className={`maintenance-toggle ${form.maintenance.enabled ? 'enabled' : ''}`} onClick={()=>patch('maintenance','enabled',!form.maintenance.enabled)} type="button"><i/><span>{form.maintenance.enabled ? 'MAINTENANCE ON' : 'MAINTENANCE OFF'}</span></button>
          <label className="maintenance-message"><span>Pesan Maintenance</span><textarea maxLength="300" value={form.maintenance.message} onChange={(e)=>patch('maintenance','message',e.target.value)}/><small>Saat ON, user selain Super Admin tidak bisa login/refresh/menggunakan API. Super Admin tetap dapat masuk untuk perbaikan.</small></label>
        </article>
      </section>

      <section className="system-diagnostics">
        <div className="system-panel-head diagnostics-title"><div><span>FINAL HARDENING</span><h2>Production Readiness</h2></div><small>Last check: {timeText(status?.checkedAt)}</small></div>
        <div className="system-check-grid">
          {checks.map((item)=>(
            <article className={`system-check ${item.ok ? 'ok' : 'bad'} ${item.severity === 'warning' ? 'warning' : ''}`} key={item.key}>
              <div className="system-check-icon">{item.ok ? '✓' : '!'}</div>
              <div><strong>{item.label}</strong><p>{item.detail}</p><small>{item.severity === 'critical' ? 'Critical' : 'Production warning'}</small></div>
            </article>
          ))}
        </div>
        <div className="system-runtime-grid">
          <div><span>NODE ENV</span><strong>{status?.environment?.nodeEnv || '-'}</strong></div>
          <div><span>COOKIE</span><strong>{String(status?.environment?.cookie?.sameSite || '-').toUpperCase()} · {status?.environment?.cookie?.secure ? 'SECURE' : 'DEV'}</strong></div>
          <div><span>ACTIVE USERS</span><strong>{fmt(counts.activeUsers)}</strong></div>
          <div><span>DIVISIONS</span><strong>{fmt(counts.activeDivisions)}</strong></div>
          <div><span>RECYCLE ITEMS</span><strong>{fmt(counts.recycleItems)}</strong></div>
          <div><span>PENDING RESET</span><strong>{fmt(counts.pendingPasswordResets)}</strong></div>
          <div><span>AUDIT LOGS</span><strong>{fmt(counts.auditLogs)}</strong></div>
          <div><span>LAST ACTIVITY</span><strong>{timeText(status?.lastActivity?.occurred_at)}</strong></div>
        </div>
        <div className="system-prod-note">
          <strong>Production checklist command</strong>
          <code>npm run production:check</code>
          <span>Setelah Railway environment memakai <b>NODE_ENV=production</b>, jalankan <code>npm run production:check:strict</code> sebelum cutover.</span>
        </div>
      </section>
    </main>
  );
}
