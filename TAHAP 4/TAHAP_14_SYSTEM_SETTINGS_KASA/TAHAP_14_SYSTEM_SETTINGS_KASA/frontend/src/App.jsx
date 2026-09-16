import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage.jsx';
import { refreshSession } from './services/api.js';

const SESSION_BOOT_TIMEOUT_MS = 6000;

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [bootNote, setBootNote] = useState('Checking secure session…');

  useEffect(() => {
    let active = true;
    const noteTimer = window.setTimeout(() => {
      if (active) setBootNote('Memeriksa backend dan secure session…');
    }, 1800);

    async function restore() {
      try {
        const result = await refreshSession({ timeoutMs: SESSION_BOOT_TIMEOUT_MS });
        if (active) setUser(result?.data?.user || null);
      } catch (error) {
        console.warn('KASA session restore skipped:', error?.code || error?.name || error?.message || error);
        if (active) setUser(null);
      } finally {
        window.clearTimeout(noteTimer);
        if (active) setBooting(false);
      }
    }

    restore();
    return () => {
      active = false;
      window.clearTimeout(noteTimer);
    };
  }, []);

  if (booting) {
    return (
      <main className="boot-screen">
        <div className="boot-logo"><img src="/kasa-logo.png" alt="KASA" /></div>
        <div className="boot-copy"><strong>PT. KASA GROUP</strong><span>{bootNote}</span></div>
        <span className="boot-spinner" />
      </main>
    );
  }

  if (!user) return <LoginPage onLogin={(nextUser) => setUser(nextUser)} />;
  if (user.mustChangePassword) return <ForcePasswordChangePage user={user} onChanged={(nextUser)=>setUser(nextUser)} onLogout={()=>setUser(null)} />;
  return <DashboardPage user={user} onLogout={() => setUser(null)} />;
}
