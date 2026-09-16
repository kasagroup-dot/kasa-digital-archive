import { useState } from 'react';
import Brand from '../components/Brand.jsx';
import { logout } from '../services/api.js';

function roleLabel(role) {
  return ({ SUPER_ADMIN: 'Super Admin', DIVISION_ADMIN: 'Division Admin', DIVISION_USER: 'Division User' })[role] || role || 'User';
}

export default function AuthSuccessPage({ user, migratedToBcrypt, onLogout }) {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await logout();
    } catch (_) {
      // Local UI tetap logout walaupun audit/logout request terganggu.
    } finally {
      setLoading(false);
      onLogout();
    }
  }

  return (
    <main className="success-page">
      <section className="success-card">
        <Brand />
        <div className="success-badge"><span />AUTHENTICATION CONNECTED</div>
        <h1>Login berhasil.</h1>
        <p>Frontend React sudah terhubung ke authentication backend KASA Digital Archive.</p>
        <div className="success-user">
          <div className="success-avatar">{String(user?.name || user?.username || 'U').slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{user?.name || user?.username}</strong>
            <span>{roleLabel(user?.role)}{user?.divisionId ? ` · ${user.divisionId}` : ''}</span>
          </div>
        </div>
        {migratedToBcrypt ? <div className="security-note">Password legacy akun ini berhasil dimigrasikan ke bcrypt saat login.</div> : null}
        <div className="next-stage-note">
          <strong>Tahap 7 berhasil.</strong>
          <span>Dashboard produksi akan dibangun di Tahap 8. Halaman ini sengaja hanya menjadi checkpoint authentication.</span>
        </div>
        <button className="button button--primary success-logout" onClick={handleLogout} disabled={loading}>{loading ? 'Logging out...' : 'Logout'}</button>
      </section>
    </main>
  );
}
