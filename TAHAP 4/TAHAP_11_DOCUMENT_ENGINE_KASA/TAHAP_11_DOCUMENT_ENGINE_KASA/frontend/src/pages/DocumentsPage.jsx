import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import DocumentActionModal from '../components/DocumentActionModal.jsx';
import { getGlobalDocumentDetail, getGlobalDocuments } from '../services/api.js';

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(options, { hour: '2-digit', minute: '2-digit' });
  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

function extensionBadge(row) {
  const value = String(row.extension || row.fileType || 'FILE').replace('.', '').toUpperCase();
  return value.length > 5 ? value.slice(0, 5) : value;
}

function DocumentDetails({ document, onClose }) {
  if (!document) return null;
  return (
    <div className="doc-modal-backdrop" onClick={onClose}>
      <article className="doc-modal" onClick={(event) => event.stopPropagation()}>
        <div className="doc-modal-head">
          <div>
            <span className="doc-modal-kicker">DOCUMENT DETAILS</span>
            <h2>{document.documentName || document.originalFilename}</h2>
          </div>
          <button onClick={onClose} aria-label="Tutup"><Icon name="close" size={18} /></button>
        </div>
        <div className="doc-modal-grid">
          <div><span>Nama file</span><strong>{document.originalFilename || '—'}</strong></div>
          <div><span>Divisi</span><strong>{document.divisionName || '—'}</strong></div>
          <div><span>Folder</span><strong>{document.folderPath || 'Root'}</strong></div>
          <div><span>Tipe</span><strong>{document.fileType || document.extension || '—'}</strong></div>
          <div><span>Ukuran</span><strong>{formatBytes(document.fileSize)}</strong></div>
          <div><span>Versi</span><strong>v{document.version || 1}</strong></div>
          <div><span>No. dokumen</span><strong>{document.documentNumber || '—'}</strong></div>
          <div><span>Tanggal dokumen</span><strong>{formatDate(document.documentDate)}</strong></div>
          <div><span>Kategori</span><strong>{document.category || '—'}</strong></div>
          <div><span>Uploader</span><strong>{document.uploadedBy || '—'}</strong></div>
          <div><span>Upload</span><strong>{formatDate(document.uploadedAt, true)}</strong></div>
          <div><span>Favorit</span><strong>{document.isFavorite ? 'Ya' : 'Tidak'}</strong></div>
        </div>
        <div className="doc-modal-section">
          <span>Tags</span>
          <div className="doc-tag-list">{(document.tags || []).length ? document.tags.map((tag) => <b key={tag}>{tag}</b>) : <em>Belum ada tag</em>}</div>
        </div>
        <div className="doc-modal-section">
          <span>Deskripsi</span>
          <p>{document.description || 'Belum ada deskripsi.'}</p>
        </div>
        <div className="doc-modal-actions">
          {document.driveUrl ? <a href={document.driveUrl} target="_blank" rel="noreferrer">Buka Google Drive <Icon name="arrow" size={15} /></a> : null}
          <button onClick={onClose}>Tutup</button>
        </div>
      </article>
    </div>
  );
}

export default function DocumentsPage({ selectedDivision = 'ALL', searchTerm = '', onDivisionSync }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [stats, setStats] = useState({ totalDocuments: 0, totalBytes: 0 });
  const [filterOptions, setFilterOptions] = useState({ fileTypes: [], categories: [] });
  const [fileType, setFileType] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState('');
  const [capabilities, setCapabilities] = useState({});

  useEffect(() => { setPage(1); }, [selectedDivision, searchTerm, fileType, category, sort]);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await getGlobalDocuments({
        divisionId: selectedDivision,
        search: searchTerm,
        fileType,
        category,
        sort,
        page,
        pageSize: 25
      });
      const data = result.data || {};
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, pageSize: 25, total: 0, totalPages: 1 });
      setStats(data.stats || { totalDocuments: 0, totalBytes: 0 });
      setFilterOptions(data.filterOptions || { fileTypes: [], categories: [] });
      setCapabilities(data.capabilities || {});
      if (onDivisionSync && data.filters?.divisionId && data.filters.divisionId !== 'ALL') onDivisionSync(data.filters.divisionId);
    } catch (err) {
      setError(err.message || 'Dokumen gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [selectedDivision, searchTerm, fileType, category, sort, page]);

  async function openDetail(row) {
    setDetailLoading(row.id);
    try {
      const result = await getGlobalDocumentDetail(row.id);
      setDetail(result.data || row);
    } catch (err) {
      setError(err.message || 'Detail dokumen gagal dimuat.');
    } finally {
      setDetailLoading('');
    }
  }

  const subtitle = useMemo(() => {
    if (searchTerm) return `Hasil pencarian “${searchTerm}”`;
    if (selectedDivision !== 'ALL') return 'Dokumen aktif pada divisi terpilih';
    return 'Seluruh dokumen aktif PT. KASA GROUP';
  }, [searchTerm, selectedDivision]);

  return (
    <main className="workspace-content documents-workspace">
      <div className="workspace-heading doc-heading">
        <div>
          <h1>Dokumen</h1>
          <p>{subtitle}</p>
        </div>
        <div className="doc-heading-metrics">
          <span><strong>{Number(stats.totalDocuments || 0).toLocaleString('id-ID')}</strong> Dokumen</span>
          <span><strong>{formatBytes(stats.totalBytes)}</strong> Storage</span>
        </div>
      </div>

      <section className="doc-toolbar">
        <div className="doc-toolbar-filters">
          <label>
            <span>Tipe File</span>
            <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
              <option value="ALL">Semua Tipe</option>
              {(filterOptions.fileTypes || []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Kategori</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="ALL">Semua Kategori</option>
              {(filterOptions.categories || []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Urutkan</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Upload Terbaru</option>
              <option value="oldest">Upload Terlama</option>
              <option value="document_date_desc">Tanggal Dokumen Terbaru</option>
              <option value="document_date_asc">Tanggal Dokumen Terlama</option>
              <option value="name_asc">Nama A–Z</option>
              <option value="name_desc">Nama Z–A</option>
              <option value="size_desc">Ukuran Terbesar</option>
              <option value="size_asc">Ukuran Terkecil</option>
            </select>
          </label>
        </div>
        <div className="doc-toolbar-actions">
          <div className="fm-view-toggle">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid"><Icon name="grid" size={16} /></button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List"><Icon name="list" size={16} /></button>
          </div>
          <button className="fm-refresh" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </section>

      {searchTerm ? <div className="doc-search-chip"><Icon name="search" size={14} /> Pencarian aktif: <strong>{searchTerm}</strong></div> : null}
      {error ? <div className="dashboard-error">{error}<button onClick={load}>Coba lagi</button></div> : null}

      {loading ? (
        <div className={view === 'grid' ? 'doc-grid' : 'doc-list-skeleton'}>
          {Array.from({ length: view === 'grid' ? 10 : 7 }).map((_, index) => <div key={index} className="doc-skeleton" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="fm-empty">
          <Icon name="document" size={34} />
          <strong>Belum ada dokumen yang cocok</strong>
          <span>{searchTerm || fileType !== 'ALL' || category !== 'ALL' ? 'Ubah pencarian atau filter dokumen.' : 'Metadata dokumen lama belum dimigrasikan ke Supabase. File Manager akan terisi pada Tahap 10.'}</span>
        </div>
      ) : view === 'grid' ? (
        <section className="doc-grid">
          {items.map((row) => (
            <button className="doc-card" key={row.id} onClick={() => openDetail(row)}>
              <div className="doc-card-head"><span className="doc-type-badge">{extensionBadge(row)}</span>{row.isFavorite ? <Icon name="star" size={15} /> : null}</div>
              <strong>{row.documentName || row.originalFilename}</strong>
              <span className="doc-card-filename">{row.originalFilename}</span>
              <div className="doc-card-path"><Icon name="folder" size={13} /> {row.divisionName} · {row.folderPath || 'Root'}</div>
              <div className="doc-card-meta"><span>{formatBytes(row.fileSize)}</span><span>v{row.version || 1}</span><span>{formatDate(row.uploadedAt)}</span></div>
              {detailLoading === row.id ? <span className="doc-card-loading">Memuat…</span> : null}
            </button>
          ))}
        </section>
      ) : (
        <div className="doc-table-wrap">
          <table className="doc-table">
            <thead><tr><th>Dokumen</th><th>Divisi</th><th>Folder</th><th>Kategori</th><th>Ukuran</th><th>Versi</th><th>Upload</th></tr></thead>
            <tbody>{items.map((row) => (
              <tr key={row.id} onClick={() => openDetail(row)}>
                <td><div className="doc-table-name"><span className="doc-type-badge">{extensionBadge(row)}</span><div><strong>{row.documentName || row.originalFilename}</strong><span>{row.originalFilename}</span></div>{row.isFavorite ? <Icon name="star" size={13} /> : null}</div></td>
                <td>{row.divisionName}</td><td className="doc-path-cell">{row.folderPath || 'Root'}</td><td>{row.category || '—'}</td><td>{formatBytes(row.fileSize)}</td><td>v{row.version || 1}</td><td>{formatDate(row.uploadedAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {!loading && pagination.totalPages > 1 ? (
        <div className="fm-pagination">
          <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={pagination.page <= 1}>Sebelumnya</button>
          <span>Halaman {pagination.page} dari {pagination.totalPages} · {Number(pagination.total || 0).toLocaleString('id-ID')} dokumen</span>
          <button onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={pagination.page >= pagination.totalPages}>Berikutnya</button>
        </div>
      ) : null}

      {detail ? <DocumentActionModal documentId={detail.id} initialDocument={detail} capabilities={capabilities} onClose={() => setDetail(null)} onChanged={load} /> : null}
    </main>
  );
}
