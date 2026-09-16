import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { getFileManagerDivisions } from '../services/api.js';

export default function DivisionsPage({ searchTerm = '', onOpenDivision }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await getFileManagerDivisions();
      setRows(result.data || []);
    } catch (err) {
      setError(err.message || 'Daftar divisi gagal dimuat.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = String(searchTerm || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.name, row.slug, row.description].join(' ').toLowerCase().includes(q));
  }, [rows, searchTerm]);

  return (
    <main className="workspace-content">
      <div className="workspace-heading">
        <div>
          <h1>Semua Divisi</h1>
          <p>Pilih divisi untuk membuka File Manager dan struktur folder dokumen.</p>
        </div>
        <button className="dashboard-refresh" onClick={load} disabled={loading}>Refresh</button>
      </div>

      {error ? <div className="dashboard-error">{error}<button onClick={load}>Coba lagi</button></div> : null}

      <section className="division-directory-grid">
        {loading ? Array.from({ length: 8 }).map((_, i) => <div className="division-directory-card division-directory-card--loading" key={i} />) : filtered.map((division) => (
          <button className="division-directory-card" key={division.id} onClick={() => onOpenDivision(division)}>
            <div className="division-directory-icon"><Icon name="building" size={21} /></div>
            <div className="division-directory-copy">
              <strong>{division.name}</strong>
              <span>{division.description || 'PT. KASA GROUP'}</span>
            </div>
            <div className="division-directory-metrics">
              <div><strong>{Number(division.folderCount || 0).toLocaleString('id-ID')}</strong><span>Folder</span></div>
              <div><strong>{Number(division.documentCount || 0).toLocaleString('id-ID')}</strong><span>Dokumen</span></div>
            </div>
            <span className="division-directory-open">Buka <Icon name="chevronRight" size={15} /></span>
          </button>
        ))}
      </section>

      {!loading && filtered.length === 0 ? <div className="fm-empty"><Icon name="building" size={30} /><strong>Divisi tidak ditemukan</strong><span>Coba kata pencarian lain.</span></div> : null}
    </main>
  );
}
