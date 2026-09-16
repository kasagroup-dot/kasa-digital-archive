import { useMemo, useRef, useState } from 'react';
import { FilePond } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import Icon from './Icon.jsx';
import {
  cancelResumableUpload,
  checkUploadDuplicates,
  uploadFileResumable
} from '../services/api.js';

function stripExtension(name) {
  const text = String(name || '');
  const i = text.lastIndexOf('.');
  return i > 0 ? text.slice(0, i) : text;
}

export default function UploadModal({ divisionId, folderId = '', onClose, onUploaded }) {
  const pondRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [documentName, setDocumentName] = useState('');
  const [duplicateAction, setDuplicateAction] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const server = useMemo(() => ({
    process: (_fieldName, file, _metadata, load, error, progress, abort) => {
      const controller = new AbortController();
      let currentUploadId = '';
      const singleName = files.length === 1 ? documentName : '';
      uploadFileResumable({
        divisionId,
        folderId,
        file,
        documentName: singleName || stripExtension(file.name),
        duplicateAction: duplicateAction || 'none',
        progress,
        signal: controller.signal,
        onSession: (session) => { currentUploadId = session?.uploadId || ''; }
      }).then((result) => {
        onUploaded?.(result?.document || null);
        load(result?.document?.id || file.name);
      }).catch((err) => {
        if (err?.name === 'AbortError') return;
        error(err?.message || 'Upload gagal.');
      });
      return {
        abort: () => {
          controller.abort();
          if (currentUploadId) cancelResumableUpload(currentUploadId).catch(() => {});
          abort();
        }
      };
    }
  }), [divisionId, folderId, duplicateAction, documentName, files.length, onUploaded]);

  async function beginUpload() {
    setMessage('');
    const pondFiles = pondRef.current?.getFiles?.() || [];
    if (!pondFiles.length) { setMessage('Pilih minimal satu file.'); return; }
    setChecking(true);
    try {
      const result = await checkUploadDuplicates({ divisionId, folderId, names: pondFiles.map((item) => item.file.name) });
      const found = result?.data?.duplicates || [];
      setDuplicates(found);
      if (found.length && !duplicateAction) {
        setMessage('Ada nama file yang sama. Pilih tindakan duplikat lalu klik Upload lagi.');
        return;
      }
      setProcessing(true);
      await pondRef.current.processFiles();
      setMessage('Semua file selesai diproses.');
      window.setTimeout(() => onClose?.(), 700);
    } catch (err) {
      setMessage(err?.message || 'Upload gagal diproses.');
    } finally {
      setChecking(false);
      setProcessing(false);
    }
  }

  return (
    <div className="folder-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !processing && onClose?.()}>
      <div className="folder-modal upload-modal-v11">
        <div className="folder-modal-head">
          <div><span>DOCUMENT ENGINE</span><h2>Upload File</h2></div>
          <button onClick={() => !processing && onClose?.()}><Icon name="close" size={17} /></button>
        </div>
        <div className="folder-modal-body">
          <div className="upload-v11-note">FilePond aktif · resumable upload 4 MB/chunk · progress per file · retry aman untuk file besar.</div>

          <FilePond
            ref={pondRef}
            files={files}
            onupdatefiles={(items) => {
              setFiles(items);
              if (items.length === 1 && !documentName) setDocumentName(stripExtension(items[0]?.file?.name || ''));
              if (!items.length) { setDocumentName(''); setDuplicates([]); setDuplicateAction(''); }
            }}
            allowMultiple
            maxFiles={10}
            instantUpload={false}
            allowRevert={false}
            server={server}
            labelIdle={'<span class="filepond--label-action">Browse</span> atau drop file di sini'}
            labelFileProcessing="Uploading"
            labelFileProcessingComplete="Selesai"
            labelFileProcessingError="Upload gagal"
          />

          {files.length === 1 ? (
            <label className="folder-field"><span>Nama Dokumen</span><input value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="Nama dokumen" /></label>
          ) : files.length > 1 ? <div className="folder-modal-note">Untuk multi-file, nama dokumen otomatis mengikuti nama masing-masing file.</div> : null}

          {duplicates.length ? (
            <div className="upload-duplicate-box">
              <strong>{duplicates.length} file duplikat ditemukan</strong>
              <div>{duplicates.map((row) => <span key={row.documentId}>{row.name} · versi saat ini v{row.version}</span>)}</div>
              <label><input type="radio" name="duplicateAction" checked={duplicateAction === 'version'} onChange={() => setDuplicateAction('version')} /> Upload sebagai versi baru</label>
              <label><input type="radio" name="duplicateAction" checked={duplicateAction === 'autorename'} onChange={() => setDuplicateAction('autorename')} /> Auto rename file baru</label>
            </div>
          ) : null}

          {message ? <div className="folder-modal-note warning">{message}</div> : null}
        </div>
        <div className="folder-modal-footer">
          <button className="secondary" disabled={processing} onClick={onClose}>Batal</button>
          <button className="primary" disabled={processing || checking || !files.length} onClick={beginUpload}>
            {processing ? 'Uploading…' : checking ? 'Memeriksa…' : 'Upload Semua'}
          </button>
        </div>
      </div>
    </div>
  );
}
