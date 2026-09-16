import Brand from '../components/Brand.jsx';

export default function MaintenancePage({ message, onRetry }) {
  return (
    <main className="maintenance-screen">
      <section className="maintenance-card">
        <Brand />
        <div className="maintenance-state">MAINTENANCE MODE</div>
        <h1>Sistem sedang dalam pemeliharaan.</h1>
        <p>{message || 'Sistem sedang dalam pemeliharaan. Silakan coba kembali beberapa saat lagi.'}</p>
        <div className="maintenance-note">Akses operasional sementara dihentikan. Super Admin tetap dapat masuk untuk melakukan perbaikan.</div>
        <button type="button" onClick={onRetry}>Cek Status Lagi</button>
      </section>
    </main>
  );
}
