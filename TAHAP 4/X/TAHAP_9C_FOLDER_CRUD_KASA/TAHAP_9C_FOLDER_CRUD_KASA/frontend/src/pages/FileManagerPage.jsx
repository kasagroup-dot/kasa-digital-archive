import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import {
  createFolder,
  deleteFolder,
  getFileManagerContents,
  getFileManagerTree,
  moveFolder,
  removeFolderPassword,
  renameFolder,
  setFolderPassword,
  unlockFolder
} from '../services/api.js';

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

function Modal({ title, kicker = 'FOLDER', onClose, children, footer }) {
  return (
    <div className="folder-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="folder-modal">
        <div className="folder-modal-head">
          <div><span>{kicker}</span><h2>{title}</h2></div>
          <button onClick={onClose}><Icon name="close" size={17} /></button>
        </div>
        <div className="folder-modal-body">{children}</div>
        {footer ? <div className="folder-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder = '', autoFocus = false }) {
  return <label className="folder-field"><span>{label}</span><input autoFocus={autoFocus} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
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
  const [menuFolderId, setMenuFolderId] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [tree, setTree] = useState([]);

  useEffect(() => { setFolderId(''); setPage(1); setModal(null); }, [divisionId]);
  useEffect(() => { setSearch(topSearch || ''); setPage(1); }, [topSearch]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3200); return () => clearTimeout(t); }, [toast]);

  async function load(overrideFolderId = undefined) {
    if (!divisionId) return;
    setLoading(true); setError('');
    const targetFolderId = overrideFolderId === undefined ? folderId : overrideFolderId;
    try {
      const result = await getFileManagerContents({ divisionId, folderId: targetFolderId, search, sort, page, pageSize: 25 });
      setData(result.data);
      onDivisionResolved?.(result.data?.division || null);
      return true;
    } catch (err) {
      if (err.code === 'FOLDER_LOCKED') {
        const details = err.payload?.details || {};
        setModal({ type: 'unlock', folderId: details.folderId || targetFolderId, folderName: details.folderName || 'Folder', resumeFolderId: targetFolderId });
        return false;
      }
      setError(err.message || 'File Manager gagal dimuat.');
      return false;
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [divisionId, folderId, search, sort, page]);

  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };
  const title = data?.division?.name || 'File Manager';
  const currentFolder = useMemo(() => {
    if (!folderId) return null;
    return (data?.breadcrumb || []).find((x) => x.id === folderId) || null;
  }, [folderId, data]);
  const totalFileSize = useMemo(() => items.filter((x) => x.kind === 'document').reduce((sum, x) => sum + Number(x.data.fileSize || 0), 0), [items]);

  function openFolder(id) { setMenuFolderId(''); setFolderId(id || ''); setPage(1); }
  function folderRowById(id) { return items.find((x) => x.kind === 'folder' && x.data.id === id)?.data || null; }

  async function runAction(action, successMessage) {
    setBusy(true); setError('');
    try {
      await action();
      setModal(null); setMenuFolderId('');
      setToast(successMessage);
      await load();
    } catch (err) {
      if (err.code === 'FOLDER_LOCKED') {
        const details = err.payload?.details || {};
        setModal({ type: 'unlock', folderId: details.folderId, folderName: details.folderName || 'Folder', resumeFolderId: folderId });
      } else {
        setError(err.message || 'Operasi folder gagal.');
      }
    } finally { setBusy(false); }
  }

  async function prepareMove(row) {
    setBusy(true); setError('');
    try {
      const result = await getFileManagerTree(divisionId);
      setTree(result.data || []);
      setModal({ type: 'move', row, targetParentFolderId: row.parentFolderId || '' });
      setMenuFolderId('');
    } catch (err) { setError(err.message || 'Folder tujuan gagal dimuat.'); }
    finally { setBusy(false); }
  }

  function showFolderMenu(row, event) {
    event.preventDefault(); event.stopPropagation();
    setMenuFolderId((old) => old === row.id ? '' : row.id);
  }

  function renderFolderActions(row) {
    if (menuFolderId !== row.id) return null;
    const caps = data?.capabilities || {};
    return <div className="folder-action-menu" onClick={(e) => e.stopPropagation()}>
      {caps.rename ? <button onClick={() => { setModal({ type: 'rename', row, name: row.name }); setMenuFolderId(''); }}><Icon name="edit" size={14} /> Rename</button> : null}
      {caps.move ? <button onClick={() => prepareMove(row)}><Icon name="move" size={14} /> Pindahkan</button> : null}
      {row.canManagePassword ? <button onClick={() => { setModal({ type: 'password', row, password: '', confirm: '' }); setMenuFolderId(''); }}><Icon name="key" size={14} /> {row.passwordProtected ? 'Ubah Password' : 'Pasang Password'}</button> : null}
      {row.passwordProtected && row.canManagePassword ? <button onClick={() => runAction(() => removeFolderPassword(row.id), 'Password folder dihapus.')}><Icon name="lock" size={14} /> Hapus Password</button> : null}
      {caps.delete ? <button className="danger" onClick={() => { setModal({ type: 'delete', row }); setMenuFolderId(''); }}><Icon name="trash" size={14} /> Hapus Folder</button> : null}
      {!caps.rename && !caps.move && !caps.delete && !row.canManagePassword ? <span className="folder-action-empty">Tidak ada aksi tersedia.</span> : null}
    </div>;
  }

  const folderModal = (() => {
    if (!modal) return null;
    if (modal.type === 'create') {
      const save = () => {
        if (modal.password !== modal.confirm) return setError('Konfirmasi password folder tidak sama.');
        return runAction(() => createFolder({ divisionId, parentFolderId: folderId, name: modal.name, description: modal.description, password: modal.password }), 'Folder berhasil dibuat.');
      };
      return <Modal title="Buat Folder Baru" onClose={() => setModal(null)} footer={<><button className="secondary" onClick={() => setModal(null)}>Batal</button><button className="primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Buat Folder'}</button></>}>
        <TextField label="Nama Folder" autoFocus value={modal.name} onChange={(v) => setModal({ ...modal, name: v })} placeholder="Contoh: Laporan 2026" />
        <label className="folder-field"><span>Deskripsi</span><textarea value={modal.description} onChange={(e) => setModal({ ...modal, description: e.target.value })} placeholder="Opsional" /></label>
        <div className="folder-password-box"><strong>Password Folder (opsional)</strong><p>Jika diisi, folder akan terkunci di aplikasi KASA. Password minimal 6 karakter.</p>
          <TextField label="Password" type="password" value={modal.password} onChange={(v) => setModal({ ...modal, password: v })} />
          <TextField label="Konfirmasi Password" type="password" value={modal.confirm} onChange={(v) => setModal({ ...modal, confirm: v })} />
        </div>
      </Modal>;
    }
    if (modal.type === 'rename') {
      return <Modal title="Rename Folder" onClose={() => setModal(null)} footer={<><button className="secondary" onClick={() => setModal(null)}>Batal</button><button className="primary" disabled={busy} onClick={() => runAction(() => renameFolder(modal.row.id, modal.name), 'Nama folder berhasil diubah.')}>{busy ? 'Menyimpan…' : 'Simpan'}</button></>}>
        <TextField label="Nama Folder" autoFocus value={modal.name} onChange={(v) => setModal({ ...modal, name: v })} />
      </Modal>;
    }
    if (modal.type === 'move') {
      const options = tree.filter((x) => x.folderId !== modal.row.id);
      return <Modal title={`Pindahkan ${modal.row.name}`} onClose={() => setModal(null)} footer={<><button className="secondary" onClick={() => setModal(null)}>Batal</button><button className="primary" disabled={busy} onClick={() => runAction(() => moveFolder(modal.row.id, modal.targetParentFolderId), 'Folder berhasil dipindahkan.')}>{busy ? 'Memindahkan…' : 'Pindahkan'}</button></>}>
        <label className="folder-field"><span>Folder Tujuan</span><select value={modal.targetParentFolderId} onChange={(e) => setModal({ ...modal, targetParentFolderId: e.target.value })}>{options.map((x) => <option key={x.folderId || 'ROOT'} value={x.folderId}>{x.path}{x.passwordProtected ? ' 🔒' : ''}</option>)}</select></label>
        <div className="folder-modal-note">Folder tidak dapat dipindahkan ke dirinya sendiri atau ke subfoldernya sendiri. Backend juga memvalidasi aturan ini.</div>
      </Modal>;
    }
    if (modal.type === 'delete') {
      return <Modal title="Hapus Folder?" kicker="RECYCLE BIN" onClose={() => setModal(null)} footer={<><button className="secondary" onClick={() => setModal(null)}>Batal</button><button className="danger-btn" disabled={busy} onClick={() => runAction(() => deleteFolder(modal.row.id), 'Folder dipindahkan ke Recycle Bin.')}>{busy ? 'Menghapus…' : 'Pindahkan ke Recycle Bin'}</button></>}>
        <p className="folder-confirm-copy">Folder <strong>{modal.row.name}</strong> akan dipindahkan ke Recycle Bin. Folder harus kosong sebelum dapat dihapus.</p>
      </Modal>;
    }
    if (modal.type === 'password') {
      const save = () => {
        if (modal.password !== modal.confirm) return setError('Konfirmasi password folder tidak sama.');
        return runAction(() => setFolderPassword(modal.row.id, modal.password), 'Password folder berhasil disimpan.');
      };
      return <Modal title={modal.row.passwordProtected ? 'Ubah Password Folder' : 'Pasang Password Folder'} kicker="SECURITY" onClose={() => setModal(null)} footer={<><button className="secondary" onClick={() => setModal(null)}>Batal</button><button className="primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan Password'}</button></>}>
        <div className="folder-modal-note warning">Password ini melindungi akses melalui aplikasi KASA. Kebijakan sharing langsung Google Drive tetap mengikuti konfigurasi Drive perusahaan.</div>
        <TextField label="Password Baru" autoFocus type="password" value={modal.password} onChange={(v) => setModal({ ...modal, password: v })} />
        <TextField label="Konfirmasi Password" type="password" value={modal.confirm} onChange={(v) => setModal({ ...modal, confirm: v })} />
      </Modal>;
    }
    if (modal.type === 'unlock') {
      const submit = async () => {
        setBusy(true); setError('');
        try {
          await unlockFolder(modal.folderId, modal.password || '');
          const resume = modal.resumeFolderId || modal.folderId;
          setModal(null); setToast('Folder berhasil dibuka.');
          setFolderId(resume);
          await load(resume);
        } catch (err) { setError(err.message || 'Password folder salah.'); }
        finally { setBusy(false); }
      };
      return <Modal title={`Buka ${modal.folderName}`} kicker="FOLDER LOCKED" onClose={() => { setModal(null); if (folderId) setFolderId(data?.breadcrumb?.at(-2)?.id || ''); }} footer={<><button className="secondary" onClick={() => setModal(null)}>Batal</button><button className="primary" disabled={busy} onClick={submit}>{busy ? 'Memeriksa…' : 'Buka Folder'}</button></>}>
        <TextField label="Password Folder" autoFocus type="password" value={modal.password || ''} onChange={(v) => setModal({ ...modal, password: v })} />
      </Modal>;
    }
    return null;
  })();

  return (
    <main className="workspace-content" onClick={() => menuFolderId && setMenuFolderId('')}>
      {toast ? <div className="folder-toast">{toast}</div> : null}
      <div className="workspace-heading fm-heading">
        <div>
          <button className="fm-back-link" onClick={onBackToDivisions}><Icon name="arrowLeft" size={15} /> Semua Divisi</button>
          <h1>{title}</h1>
          <p>File Manager divisi · folder dan dokumen aktif.</p>
        </div>
        <div className="fm-heading-actions">
          <div className="fm-heading-stats"><span><strong>{pagination.total}</strong> item</span><span><strong>{formatBytes(totalFileSize)}</strong> halaman ini</span></div>
          {data?.capabilities?.createFolder ? <button className="fm-create-folder" onClick={() => setModal({ type: 'create', name: '', description: '', password: '', confirm: '' })}><Icon name="plus" size={16} /> Folder Baru</button> : null}
        </div>
      </div>

      <section className="fm-toolbar-card">
        <div className="fm-breadcrumb">{(data?.breadcrumb || [{ id: '', name: title }]).map((crumb, index, arr) => <span key={`${crumb.id}-${index}`} className="fm-crumb-wrap"><button className={`fm-crumb ${index === arr.length - 1 ? 'is-current' : ''}`} onClick={() => index < arr.length - 1 && openFolder(crumb.id)}>{crumb.name}</button>{index < arr.length - 1 ? <Icon name="chevronRight" size={13} /> : null}</span>)}</div>
        <div className="fm-view-toggle"><button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid"><Icon name="grid" size={17} /></button><button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List"><Icon name="list" size={17} /></button></div>
      </section>

      <section className="fm-filterbar"><div className="fm-local-search"><Icon name="search" size={17} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cari dalam folder ini..." /></div><select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="name_asc">Nama A–Z</option><option value="name_desc">Nama Z–A</option><option value="size_desc">Ukuran terbesar</option><option value="size_asc">Ukuran terkecil</option></select><button className="fm-refresh" onClick={() => load()} disabled={loading}>Refresh</button></section>

      {error ? <div className="dashboard-error">{error}<button onClick={() => setError('')}>Tutup</button></div> : null}

      {loading ? <div className="fm-loading-grid">{Array.from({ length: 8 }).map((_, i) => <div className="fm-card fm-card--loading" key={i} />)}</div> : items.length === 0 ? <div className="fm-empty"><Icon name="folder" size={34} /><strong>Folder ini masih kosong</strong><span>Klik <b>Folder Baru</b> untuk menguji Folder CRUD. Metadata arsip lama akan masuk pada Tahap 10.</span></div> : viewMode === 'grid' ? <div className="fm-grid">{items.map((item) => {
        const row = item.data; const isFolder = item.kind === 'folder';
        return <div key={`${item.kind}-${row.id}`} className="fm-card fm-card-interactive" role={isFolder ? 'button' : undefined} tabIndex={isFolder ? 0 : -1} onDoubleClick={() => isFolder && openFolder(row.id)} onClick={() => isFolder && openFolder(row.id)}>
          <div className="fm-card-top"><div className={`fm-file-icon ${isFolder ? 'is-folder' : ''}`}>{isFolder ? <Icon name="folder" size={21} /> : badge(row.extension)}</div><div className="fm-card-badges">{isFolder && row.passwordProtected ? <span title="Password folder"><Icon name="lock" size={15} /></span> : null}{!isFolder && row.isFavorite ? <span className="fm-star">★</span> : null}{isFolder ? <button className="folder-more" onClick={(e) => showFolderMenu(row, e)} title="Aksi folder"><Icon name="more" size={17} /></button> : null}</div></div>
          <strong className="fm-card-name" title={isFolder ? row.name : row.originalFilename}>{isFolder ? row.name : row.originalFilename}</strong><span className="fm-card-meta">{isFolder ? `Folder${row.passwordProtected ? ' · Password' : ''}` : `${formatBytes(row.fileSize)} · ${formatDate(row.uploadedAt)}`}</span>
          {isFolder ? renderFolderActions(row) : null}
        </div>;
      })}</div> : <div className="fm-table-wrap"><table className="fm-table"><thead><tr><th>Nama</th><th>Tipe</th><th>Ukuran</th><th>Tanggal</th><th>Uploader</th><th>Status</th><th></th></tr></thead><tbody>{items.map((item) => {
        const row = item.data; const isFolder = item.kind === 'folder';
        return <tr key={`${item.kind}-${row.id}`} className={isFolder ? 'is-folder-row' : ''}><td><button className="fm-name-button" onClick={() => isFolder && openFolder(row.id)}><span className={`fm-mini-icon ${isFolder ? 'is-folder' : ''}`}>{isFolder ? <Icon name="folder" size={16} /> : badge(row.extension)}</span><span>{isFolder ? row.name : row.originalFilename}</span>{isFolder && row.passwordProtected ? <Icon name="lock" size={13} /> : null}</button></td><td>{isFolder ? 'Folder' : String(row.extension || row.fileType || 'FILE').toUpperCase()}</td><td>{isFolder ? '—' : formatBytes(row.fileSize)}</td><td>{formatDate(isFolder ? row.createdAt : row.uploadedAt)}</td><td>{isFolder ? row.createdBy || '—' : row.uploadedBy || '—'}</td><td>{isFolder && row.passwordProtected ? 'Protected' : 'Active'}</td><td className="folder-table-actions">{isFolder ? <><button className="folder-more" onClick={(e) => showFolderMenu(row, e)}><Icon name="more" size={17} /></button>{renderFolderActions(row)}</> : null}</td></tr>;
      })}</tbody></table></div>}

      {!loading && pagination.totalPages > 1 ? <div className="fm-pagination"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1}>Sebelumnya</button><span>Halaman {pagination.page} dari {pagination.totalPages}</span><button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={pagination.page >= pagination.totalPages}>Berikutnya</button></div> : null}
      {folderModal}
    </main>
  );
}
