import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { getFileManagerContents } from '../services/api.js';

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function badge(ext) {
  const value = String(ext || 'FILE').toUpperCase();
  return value.length > 5 ? value.slice(0, 5) : value;
}

export default function FileManagerPage({ divisionId, topSearch = '', onBackToDivisions, onDivisionResolved }) {
  const [folderId, setFolderId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  useEffect(() => { setFolderId(''); setPage(1); }, [divisionId]);
  useEffect(() => { setSearch(topSearch || ''); setPage(1); }, [topSearch]);

  async function load() {
    if (!divisionId) return;
    setLoading(true); setError('');
    try {
      const result = await getFileManagerContents({ divisionId, folderId, search, sort, page, pageSize: 25 });
      setData(result.data);
      onDivisionResolved?.(result.data?.division || null);
    } catch (err) {
      setError(err.message || 'File Manager gagal dimuat.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [divisionId, folderId, search, sort, page]);

  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };
  const title = data?.division?.name || 'File Manager';

  const totalFileSize = useMemo(() => items.filter((x) => x.kind === 'document').reduce((sum, x) => sum + Number(x.data.fileSize || 0), 0), [items]);

  function openFolder(id) { setFolderId(id || ''); setPage(1); }

  return (
    <main className="workspace-content">
      <div className="workspace-heading fm-heading">
        <div>
          <button className="fm-back-link" onClick={onBackToDivisions}><Icon name="arrowLeft" size={15} /> Semua Divisi</button>
          <h1>{title}</h1>
          <p>File Manager divisi · folder dan dokumen aktif.</p>
        </div>
        <div className="fm-heading-stats">
          <span><strong>{pagination.total}</strong> item</span>
          <span><strong>{formatBytes(totalFileSize)}</strong> halaman ini</span>
        </div>
      </div>

      <section className="fm-toolbar-card">
        <div className="fm-breadcrumb">
          {(data?.breadcrumb || [{ id: '', name: title }]).map((crumb, index, arr) => (
            <span key={`${crumb.id}-${index}`} className="fm-crumb-wrap">
              <button className={`fm-crumb ${index === arr.length - 1 ? 'is-current' : ''}`} onClick={() => index < arr.length - 1 && openFolder(crumb.id)}>{crumb.name}</button>
              {index < arr.length - 1 ? <Icon name="chevronRight" size={13} /> : null}
            </span>
          ))}
        </div>
        <div className="fm-view-toggle">
          <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid"><Icon name="grid" size={17} /></button>
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List"><Icon name="list" size={17} /></button>
        </div>
      </section>

      <section className="fm-filterbar">
        <div className="fm-local-search"><Icon name="search" size={17} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cari dalam folder ini..." /></div>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          <option value="newest">Terbaru</option>
          <option value="oldest">Terlama</option>
          <option value="name_asc">Nama A–Z</option>
          <option value="name_desc">Nama Z–A</option>
          <option value="size_desc">Ukuran terbesar</option>
          <option value="size_asc">Ukuran terkecil</option>
        </select>
        <button className="fm-refresh" onClick={load} disabled={loading}>Refresh</button>
      </section>

      {error ? <div className="dashboard-error">{error}<button onClick={load}>Coba lagi</button></div> : null}

      {loading ? (
        <div className="fm-loading-grid">{Array.from({ length: 8 }).map((_, i) => <div className="fm-card fm-card--loading" key={i} />)}</div>
      ) : items.length === 0 ? (
        <div className="fm-empty">
          <Icon name="folder" size={34} />
          <strong>Folder ini masih kosong</strong>
          <span>Metadata folder/dokumen lama belum dimigrasikan ke Supabase. Setelah Tahap 10, isi lama otomatis tampil di sini.</span>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="fm-grid">
          {items.map((item) => {
            const row = item.data;
            const isFolder = item.kind === 'folder';
            return (
              <button key={`${item.kind}-${row.id}`} className="fm-card" onDoubleClick={() => isFolder && openFolder(row.id)} onClick={() => isFolder && openFolder(row.id)}>
                <div className="fm-card-top">
                  <div className={`fm-file-icon ${isFolder ? 'is-folder' : ''}`}>{isFolder ? <Icon name="folder" size={21} /> : badge(row.extension)}</div>
                  <div className="fm-card-badges">{isFolder && row.passwordProtected ? <span title="Password folder"><Icon name="lock" size={15} /></span> : null}{!isFolder && row.isFavorite ? <span className="fm-star">★</span> : null}</div>
                </div>
                <strong className="fm-card-name" title={isFolder ? row.name : row.originalFilename}>{isFolder ? row.name : row.originalFilename}</strong>
                <span className="fm-card-meta">{isFolder ? `Folder${row.passwordProtected ? ' · Password' : ''}` : `${formatBytes(row.fileSize)} · ${formatDate(row.uploadedAt)}`}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="fm-table-wrap"><table className="fm-table"><thead><tr><th>Nama</th><th>Tipe</th><th>Ukuran</th><th>Tanggal</th><th>Uploader</th><th>Status</th></tr></thead><tbody>{items.map((item) => {
          const row = item.data; const isFolder = item.kind === 'folder';
          return <tr key={`${item.kind}-${row.id}`} onDoubleClick={() => isFolder && openFolder(row.id)} className={isFolder ? 'is-folder-row' : ''}><td><button className="fm-name-button" onClick={() => isFolder && openFolder(row.id)}><span className={`fm-mini-icon ${isFolder ? 'is-folder' : ''}`}>{isFolder ? <Icon name="folder" size={16} /> : badge(row.extension)}</span><span>{isFolder ? row.name : row.originalFilename}</span>{isFolder && row.passwordProtected ? <Icon name="lock" size={13} /> : null}</button></td><td>{isFolder ? 'Folder' : String(row.extension || row.fileType || 'FILE').toUpperCase()}</td><td>{isFolder ? '—' : formatBytes(row.fileSize)}</td><td>{formatDate(isFolder ? row.createdAt : row.uploadedAt)}</td><td>{isFolder ? row.createdBy || '—' : row.uploadedBy || '—'}</td><td>{isFolder && row.passwordProtected ? 'Protected' : 'Active'}</td></tr>;
        })}</tbody></table></div>
      )}

      {!loading && pagination.totalPages > 1 ? <div className="fm-pagination"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1}>Sebelumnya</button><span>Halaman {pagination.page} dari {pagination.totalPages}</span><button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages}>Berikutnya</button></div> : null}
    </main>
  );
}
