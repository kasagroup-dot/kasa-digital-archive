import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import { refreshSession } from './services/api.js';

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const result = await refreshSession();
        if (active) setUser(result?.data?.user || null);
      } catch (_) {
        if (active) setUser(null);
      } finally {
        if (active) setBooting(false);
      }
    }
    restore();
    return () => { active = false; };
  }, []);

  if (booting) {
    return (
      <main className="boot-screen">
        <div className="boot-logo"><img src="/kasa-logo.png" alt="KASA" /></div>
        <div className="boot-copy"><strong>PT. KASA GROUP</strong><span>Checking secure session…</span></div>
        <span className="boot-spinner" />
      </main>
    );
  }

  if (!user) return <LoginPage onLogin={(nextUser) => setUser(nextUser)} />;
  return <DashboardPage user={user} onLogout={() => setUser(null)} />;
}
