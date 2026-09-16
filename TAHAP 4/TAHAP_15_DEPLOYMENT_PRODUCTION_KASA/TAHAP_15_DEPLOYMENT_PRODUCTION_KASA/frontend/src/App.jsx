import { useCallback, useEffect, useRef, useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage.jsx';
import MaintenancePage from './pages/MaintenancePage.jsx';
import { getRuntimeStatus, refreshSession, setAccessToken } from './services/api.js';

const SESSION_BOOT_TIMEOUT_MS = 6000;
const RUNTIME_POLL_MS = 10000;

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [bootNote, setBootNote] = useState('Checking secure session…');
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const maintenanceBlockedRef = useRef(false);

  const checkRuntime = useCallback(async () => {
    try {
      const result = await getRuntimeStatus();
      const next = result?.data?.maintenance || { enabled: false, message: '' };
      setMaintenance({ enabled: Boolean(next.enabled), message: next.message || '' });
      return next;
    } catch (error) {
      console.warn('Runtime status check skipped:', error?.message || error);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const noteTimer = window.setTimeout(() => {
      if (active) setBootNote('Memeriksa backend dan secure session…');
    }, 1800);

    async function restore() {
      try {
        const [runtimeResult, sessionResult] = await Promise.allSettled([
          getRuntimeStatus(),
          refreshSession({ timeoutMs: SESSION_BOOT_TIMEOUT_MS })
        ]);

        if (!active) return;
        if (runtimeResult.status === 'fulfilled') {
          const next = runtimeResult.value?.data?.maintenance || {};
          setMaintenance({ enabled: Boolean(next.enabled), message: next.message || '' });
        }
        if (sessionResult.status === 'fulfilled') setUser(sessionResult.value?.data?.user || null);
        else setUser(null);
      } catch (error) {
        console.warn('KASA session restore skipped:', error?.code || error?.name || error?.message || error);
        if (active) setUser(null);
      } finally {
        window.clearTimeout(noteTimer);
        if (active) setBooting(false);
      }
    }

    restore();
    return () => { active = false; window.clearTimeout(noteTimer); };
  }, []);

  useEffect(() => {
    function maintenanceEvent(event) {
      const detail = event?.detail || {};
      setMaintenance({ enabled: true, message: detail.message || 'Sistem sedang dalam pemeliharaan.' });
    }
    window.addEventListener('kasa:maintenance', maintenanceEvent);
    const timer = window.setInterval(checkRuntime, RUNTIME_POLL_MS);
    return () => {
      window.removeEventListener('kasa:maintenance', maintenanceEvent);
      window.clearInterval(timer);
    };
  }, [checkRuntime]);

  const blockedByMaintenance = Boolean(maintenance.enabled && user && user.role !== 'SUPER_ADMIN');
  useEffect(() => {
    if (blockedByMaintenance) {
      maintenanceBlockedRef.current = true;
      setAccessToken('');
      return;
    }
    if (maintenanceBlockedRef.current && !maintenance.enabled) {
      maintenanceBlockedRef.current = false;
      setUser(null);
    }
  }, [blockedByMaintenance, maintenance.enabled]);

  if (booting) {
    return (
      <main className="boot-screen">
        <div className="boot-logo"><img src="/kasa-logo.png" alt="KASA" /></div>
        <div className="boot-copy"><strong>PT. KASA GROUP</strong><span>{bootNote}</span></div>
        <span className="boot-spinner" />
      </main>
    );
  }

  if (blockedByMaintenance) {
    return <MaintenancePage message={maintenance.message} onRetry={async()=>{
      const next = await checkRuntime();
      if (next && !next.enabled) setUser(null);
    }} />;
  }

  if (!user) return <LoginPage maintenance={maintenance} onLogin={(nextUser) => setUser(nextUser)} />;
  if (user.mustChangePassword) return <ForcePasswordChangePage user={user} onChanged={(nextUser)=>setUser(nextUser)} onLogout={()=>setUser(null)} />;
  return <DashboardPage user={user} onLogout={() => setUser(null)} />;
}
