export default function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <div className="brand__logo-shell">
        <img src="/kasa-logo.png" alt="Logo PT. KASA GROUP" className="brand__logo" />
      </div>
      <div className="brand__copy">
        <div className="brand__title">PT. KASA GROUP</div>
        <div className="brand__subtitle">Digital Document Management System</div>
      </div>
    </div>
  );
}
