import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import DocumentActionModal from '../components/DocumentActionModal.jsx';
import { getFavoriteDocuments, getRecentDocuments } from '../services/api.js';

function formatBytes(bytes) {
  const n = Number(bytes || 0); if (!n) return '0 B';
  if (n < 1024) return `${n} B`; if (n < 1024 ** 2) return `${(n/1024).toFixed(1)} KB`; if (n < 1024 ** 3) return `${(n/1024**2).toFixed(1)} MB`; return `${(n/1024**3).toFixed(2)} GB`;
}
function formatDate(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d); }
function badge(row) { const x=String(row.extension||row.fileType||'FILE').replace('.','').toUpperCase(); return x.slice(0,5); }

export default function DocumentCollectionPage({ mode, selectedDivision='ALL', searchTerm='' }) {
  const recent = mode === 'recent';
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [selected,setSelected]=useState(null);
  async function load(){ setLoading(true); setError(''); try { const result = recent ? await getRecentDocuments({divisionId:selectedDivision,search:searchTerm,limit:60}) : await getFavoriteDocuments({search:searchTerm}); setItems(result.data||[]); } catch(err){setError(err.message||'Data gagal dimuat.');} finally{setLoading(false);} }
  useEffect(()=>{load();},[recent,selectedDivision,searchTerm]);
  const totalBytes=useMemo(()=>items.reduce((sum,row)=>sum+Number(row.fileSize||0),0),[items]);
  return <main className="workspace-content ops-workspace">
    <div className="workspace-heading doc-heading"><div><h1>{recent?'Dokumen Terbaru':'Favorit'}</h1><p>{recent?'Aktivitas dokumen terbaru yang dapat Anda akses.':'Dokumen yang Anda tandai untuk akses cepat.'}</p></div><div className="doc-heading-metrics"><span><strong>{items.length}</strong> Dokumen</span><span><strong>{formatBytes(totalBytes)}</strong> Storage</span></div></div>
    <div className="ops-inline-toolbar"><span>{searchTerm ? <>Pencarian: <strong>{searchTerm}</strong></> : recent ? 'Urutan berdasarkan update terbaru' : 'Favorit milik akun Anda'}</span><button onClick={load} disabled={loading}>Refresh</button></div>
    {error?<div className="dashboard-error">{error}<button onClick={load}>Coba lagi</button></div>:null}
    {loading?<div className="ops-doc-grid">{Array.from({length:8}).map((_,i)=><div className="doc-skeleton" key={i}/>)}</div>:items.length===0?<div className="fm-empty"><Icon name={recent?'clock':'star'} size={34}/><strong>{recent?'Belum ada dokumen terbaru':'Belum ada dokumen favorit'}</strong><span>{searchTerm?'Tidak ada dokumen yang cocok dengan pencarian.':recent?'Dokumen yang diupload atau diperbarui akan muncul di sini.':'Klik Favorit pada Document Engine untuk menambahkan dokumen.'}</span></div>:<section className="ops-doc-grid">{items.map(row=><button className="doc-card" key={row.id} onClick={()=>setSelected(row)}><div className="doc-card-head"><span className="doc-type-badge">{badge(row)}</span>{row.isFavorite?<Icon name="star" size={15}/>:null}</div><strong>{row.documentName||row.originalFilename}</strong><span className="doc-card-filename">{row.originalFilename}</span><div className="ops-doc-meta"><span>{row.divisionName||'—'}</span><span>{formatBytes(row.fileSize)}</span><span>{formatDate(row.updatedAt||row.uploadedAt)}</span></div></button>)}</section>}
    {selected?<DocumentActionModal documentId={selected.id} initialDocument={selected} onClose={()=>setSelected(null)} onChanged={load}/>:null}
  </main>;
}
