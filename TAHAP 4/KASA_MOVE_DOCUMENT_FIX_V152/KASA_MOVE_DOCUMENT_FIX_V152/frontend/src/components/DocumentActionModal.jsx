import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import {
  deleteDocument,
  downloadDocument,
  downloadDocumentVersion,
  getDocumentPreview,
  getDocumentVersions,
  getFileManagerTree,
  getGlobalDocumentDetail,
  moveDocument,
  renameDocument,
  toggleDocumentFavorite
} from '../services/api.js';

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
  const options = { day:'2-digit', month:'short', year:'numeric' };
  if (withTime) Object.assign(options,{hour:'2-digit',minute:'2-digit'});
  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

export default function DocumentActionModal({ documentId, initialDocument = null, capabilities = {}, onClose, onChanged }) {
  const [document, setDocument] = useState(initialDocument);
  const [view, setView] = useState('detail');
  const [preview, setPreview] = useState(null);
  const [versions, setVersions] = useState(null);
  const [tree, setTree] = useState([]);
  const [name, setName] = useState(initialDocument?.documentName || '');
  const [targetFolderId, setTargetFolderId] = useState(initialDocument?.folderId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setBusy(true); setError('');
      try {
        const result = await getGlobalDocumentDetail(documentId);
        if (active) { setDocument(result.data); setName(result.data?.documentName || ''); setTargetFolderId(result.data?.folderId || ''); }
      } catch (err) { if (active) setError(err.message || 'Detail dokumen gagal dimuat.'); }
      finally { if (active) setBusy(false); }
    }
    load();
    return () => { active = false; };
  }, [documentId]);

  async function openPreview() {
    setBusy(true); setError('');
    try { const result = await getDocumentPreview(documentId); setPreview(result.data); setView('preview'); }
    catch (err) { setError(err.message || 'Preview gagal dimuat.'); }
    finally { setBusy(false); }
  }

  async function openMove() {
    setBusy(true); setError('');
    try { const result = await getFileManagerTree(document.divisionId); setTree(result.data || []); setView('move'); }
    catch (err) { setError(err.message || 'Folder tujuan gagal dimuat.'); }
    finally { setBusy(false); }
  }

  async function openVersions() {
    setBusy(true); setError('');
    try { const result = await getDocumentVersions(documentId); setVersions(result.data); setView('versions'); }
    catch (err) { setError(err.message || 'Riwayat versi gagal dimuat.'); }
    finally { setBusy(false); }
  }

  async function doRename() {
    setBusy(true); setError('');
    try { await renameDocument(documentId, name); await onChanged?.(); setView('detail'); const result = await getGlobalDocumentDetail(documentId); setDocument(result.data); }
    catch (err) { setError(err.message || 'Rename gagal.'); }
    finally { setBusy(false); }
  }

  async function doMove() {
    const currentFolderId = String(document?.folderId || '');
    const selectedFolderId = String(targetFolderId || '');
    if (currentFolderId === selectedFolderId) {
      setError('Dokumen sudah berada di folder tersebut. Pilih folder tujuan yang berbeda.');
      return;
    }

    setBusy(true); setError('');
    try { await moveDocument(documentId, targetFolderId); await onChanged?.(); onClose?.(); }
    catch (err) { setError(err.message || 'Move gagal.'); }
    finally { setBusy(false); }
  }

  async function doDelete() {
    setBusy(true); setError('');
    try { await deleteDocument(documentId); await onChanged?.(); onClose?.(); }
    catch (err) { setError(err.message || 'Delete gagal.'); }
    finally { setBusy(false); }
  }

  async function doFavorite() {
    setBusy(true); setError('');
    try {
      const result = await toggleDocumentFavorite(documentId);
      setDocument((old) => old ? { ...old, isFavorite: Boolean(result.data?.favorite) } : old);
      await onChanged?.();
    } catch (err) { setError(err.message || 'Favorit gagal diperbarui.'); }
    finally { setBusy(false); }
  }

  if (!document) {
    return <div className="doc-modal-backdrop"><article className="doc-modal"><div className="doc-modal-head"><div><span className="doc-modal-kicker">DOCUMENT ENGINE</span><h2>Memuat dokumen…</h2></div><button onClick={onClose}><Icon name="close" size={18}/></button></div>{error ? <div className="dashboard-error">{error}</div> : null}</article></div>;
  }

  return (
    <div className="doc-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}>
      <article className={`doc-modal document-engine-modal ${view === 'preview' ? 'is-preview' : ''}`}>
        <div className="doc-modal-head">
          <div><span className="doc-modal-kicker">DOCUMENT ENGINE · v{document.version || 1}</span><h2>{document.documentName || document.originalFilename}</h2></div>
          <button onClick={onClose}><Icon name="close" size={18}/></button>
        </div>
        {error ? <div className="dashboard-error document-engine-error">{error}</div> : null}

        {view === 'detail' ? <>
          <div className="doc-modal-grid">
            <div><span>Nama file</span><strong>{document.originalFilename || '—'}</strong></div>
            <div><span>Divisi</span><strong>{document.divisionName || '—'}</strong></div>
            <div><span>Folder</span><strong>{document.folderPath || 'Root'}</strong></div>
            <div><span>Tipe</span><strong>{document.fileType || document.extension || '—'}</strong></div>
            <div><span>Ukuran</span><strong>{formatBytes(document.fileSize)}</strong></div>
            <div><span>Uploader</span><strong>{document.uploadedBy || '—'}</strong></div>
            <div><span>Upload</span><strong>{formatDate(document.uploadedAt, true)}</strong></div>
            <div><span>Favorit</span><strong>{document.isFavorite ? 'Ya' : 'Tidak'}</strong></div>
          </div>
          <div className="document-engine-actions">
            {capabilities.preview !== false ? <button onClick={openPreview}><Icon name="eye" size={15}/> Preview</button> : null}
            {capabilities.download !== false ? <button onClick={() => downloadDocument(document.id, document.originalFilename)}><Icon name="download" size={15}/> Download</button> : null}
            <button onClick={() => window.open(document.driveUrl, '_blank', 'noopener')}><Icon name="arrow" size={15}/> Drive</button>
            <button onClick={doFavorite}><Icon name="star" size={15}/> {document.isFavorite ? 'Hapus Favorit' : 'Favorit'}</button>
            <button onClick={openVersions}><Icon name="history" size={15}/> Versi</button>
            {capabilities.rename !== false ? <button onClick={() => setView('rename')}><Icon name="edit" size={15}/> Rename</button> : null}
            {capabilities.move !== false ? <button onClick={openMove}><Icon name="move" size={15}/> Pindah</button> : null}
            {capabilities.delete !== false ? <button className="danger" onClick={() => setView('delete')}><Icon name="trash" size={15}/> Hapus</button> : null}
          </div>
        </> : null}

        {view === 'preview' ? <div className="document-preview-view"><div className="document-subbar"><button onClick={() => setView('detail')}><Icon name="arrowLeft" size={15}/> Kembali</button><span>{preview?.previewKind || 'drive'} preview</span></div><iframe src={preview?.previewUrl} title="Preview dokumen" allow="autoplay" /></div> : null}

        {view === 'rename' ? <div className="document-form-view"><label className="folder-field"><span>Nama Dokumen</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label><div className="doc-modal-actions"><button onClick={() => setView('detail')}>Batal</button><button className="primary-doc-action" disabled={busy || !name.trim()} onClick={doRename}>Simpan Rename</button></div></div> : null}

        {view === 'move' ? <div className="document-form-view"><label className="folder-field"><span>Folder Tujuan</span><select value={targetFolderId} onChange={(e) => { setTargetFolderId(e.target.value); setError(''); }}>{tree.map((row) => <option key={row.folderId || 'root'} value={row.folderId || ''}>{row.path}</option>)}</select></label>{String(targetFolderId || '') === String(document?.folderId || '') ? <div className="folder-modal-note warning">Dokumen saat ini sudah berada di folder ini. Pilih folder tujuan yang berbeda.</div> : null}<div className="doc-modal-actions"><button onClick={() => setView('detail')}>Batal</button><button className="primary-doc-action" disabled={busy || String(targetFolderId || '') === String(document?.folderId || '')} onClick={doMove}>Pindahkan</button></div></div> : null}

        {view === 'delete' ? <div className="document-form-view"><div className="folder-modal-note warning">Dokumen <strong>{document.originalFilename}</strong> akan dipindahkan ke Recycle Bin. File Google Drive belum dihapus permanen.</div><div className="doc-modal-actions"><button onClick={() => setView('detail')}>Batal</button><button className="danger-doc-action" disabled={busy} onClick={doDelete}>Hapus Dokumen</button></div></div> : null}

        {view === 'versions' ? <div className="document-versions-view"><div className="document-subbar"><button onClick={() => setView('detail')}><Icon name="arrowLeft" size={15}/> Kembali</button><span>Riwayat versi</span></div>
          {versions ? <div className="version-list">
            <div className="version-row current"><div><strong>v{versions.current.versionNumber} · CURRENT</strong><span>{versions.current.filename} · {formatBytes(versions.current.fileSize)} · {formatDate(versions.current.uploadedAt,true)}</span></div><div><a href={versions.current.driveUrl} target="_blank" rel="noreferrer">Drive</a></div></div>
            {(versions.history || []).map((row) => <div className="version-row" key={row.id}><div><strong>v{row.versionNumber}</strong><span>{row.filename} · {formatBytes(row.fileSize)} · {formatDate(row.uploadedAt,true)}</span></div><div><a href={row.driveUrl} target="_blank" rel="noreferrer">Drive</a><button onClick={() => downloadDocumentVersion(documentId,row.id,row.filename)}>Download</button></div></div>)}
          </div> : null}
        </div> : null}
      </article>
    </div>
  );
}
