export default function StatCard({ label, value, note }) {
  return (
    <article className="stat-card">
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="stat-note">{note}</span>
    </article>
  );
}
