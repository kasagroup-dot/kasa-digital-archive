import { useEffect, useState } from 'react';
import { forgotPassword } from '../services/api.js';

export default function ForgotPasswordModal({ open, initialUsername, onClose }) {
  const [username, setUsername] = useState(initialUsername || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setUsername(initialUsername || '');
      setMessage('');
      setError('');
    }
  }, [open, initialUsername]);

  if (!open) return null;

  async function submit(event) {
    event.preventDefault();
    const clean = username.trim();
    if (!clean) {
      setError('Username wajib diisi.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await forgotPassword(clean);
      setMessage(result?.message || 'Permintaan reset password berhasil dicatat.');
    } catch (err) {
      setError(err.message || 'Permintaan reset password gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
        <button className="modal-close" type="button" aria-label="Tutup" onClick={onClose}>×</button>
        <div className="modal-kicker">ACCOUNT RECOVERY</div>
        <h2 id="forgot-title">Forgot password?</h2>
        <p>Masukkan username Anda. Permintaan reset akan dicatat untuk ditindaklanjuti administrator.</p>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="forgotUsername">Username</label>
          <input
            id="forgotUsername"
            className="login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="your.username"
            disabled={loading || Boolean(message)}
          />
          {error ? <div className="form-message form-message--error">{error}</div> : null}
          {message ? <div className="form-message form-message--success">{message}</div> : null}
          <div className="modal-actions">
            <button type="button" className="button button--ghost" onClick={onClose}>Close</button>
            {!message ? <button type="submit" className="button button--primary" disabled={loading}>{loading ? 'Sending...' : 'Send request'}</button> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
