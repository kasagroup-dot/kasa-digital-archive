import { useState } from 'react';
import Brand from '../components/Brand.jsx';
import OrganizationTree from '../components/OrganizationTree.jsx';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';
import { login } from '../services/api.js';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await login(cleanUser, password, rememberMe);
      onLogin(result.data.user, result.data.migratedToBcrypt);
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS' || err.status === 401) {
        setError('Username atau password tidak sesuai.');
      } else if (err.code === 'RATE_LIMITED' || err.status === 429) {
        setError('Terlalu banyak percobaan login. Coba kembali beberapa saat lagi.');
      } else if (err.message?.toLowerCase().includes('fetch')) {
        setError('Backend tidak dapat dijangkau. Pastikan npm start aktif di port 4000.');
      } else {
        setError(err.message || 'Login gagal.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-visual" aria-label="PT. KASA GROUP divisions">
        <div className="login-visual__inner">
          <Brand />
          <OrganizationTree />
          <footer className="visual-footer">
            <div className="archive-online"><span className="status-dot" />ARCHIVE ONLINE</div>
            <div>© 2026 · KASA GROUP</div>
          </footer>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__content">
          <Brand />
          <div className="login-intro">
            <p>Enter your credentials to access the Kasa Group digital archive.</p>
          </div>

          <form className="login-form" onSubmit={submit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="username">Username</label>
              <input
                id="username"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="your.username"
                disabled={loading}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  className="login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button type="button" className="show-password" onClick={() => setShowPassword((v) => !v)} disabled={loading}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <label className="remember-row">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={loading} />
              <span>Remember session</span>
            </label>

            {error ? <div className="form-message form-message--error" role="alert">{error}</div> : null}

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? <><span className="button-spinner" />CONNECTING</> : 'LOGIN'}
            </button>

            <div className="forgot-wrap">
              <button type="button" className="forgot-button" onClick={() => setForgotOpen(true)} disabled={loading}>Forgot password?</button>
            </div>
          </form>

          <footer className="login-footer">
            <span>PT. KASA GROUP · DIGITAL DOCUMENT MANAGEMENT SYSTEM</span>
            <span>V0.8</span>
          </footer>
        </div>
      </section>

      <ForgotPasswordModal open={forgotOpen} initialUsername={username} onClose={() => setForgotOpen(false)} />
    </main>
  );
}
