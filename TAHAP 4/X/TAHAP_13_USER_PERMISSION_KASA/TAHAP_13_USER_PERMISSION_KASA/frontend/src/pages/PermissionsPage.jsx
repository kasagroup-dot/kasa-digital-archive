import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { getAdminUserPermissions, getAdminUsers, updateAdminUserPermissions } from '../services/api.js';

const RULES = [
  ['CAN_VIEW','can_view','View','Melihat folder dan dokumen yang diizinkan.'],
  ['CAN_UPLOAD','can_upload','Upload','Upload file baru dan versi dokumen.'],
  ['CAN_DOWNLOAD','can_download','Download','Mengunduh file dokumen.'],
  ['CAN_PREVIEW','can_preview','Preview','Preview PDF, gambar, Office, video/audio.'],
  ['CAN_CREATE_FOLDER','can_create_folder','Create Folder','Membuat folder baru dalam divisi.'],
  ['CAN_RENAME','can_rename','Rename','Mengubah nama folder atau dokumen.'],
  ['CAN_MOVE','can_move','Move','Memindahkan folder atau dokumen.'],
  ['CAN_DELETE','can_delete','Delete','Memindahkan dokumen/folder ke Recycle Bin.'],
  ['CAN_RESTORE','can_restore','Restore','Restore atau proses Recycle Bin.'],
  ['CAN_VIEW_LOG','can_view_log','View Log','Melihat Activity Log.']
];

function roleLabel(role){ return role==='SUPER_ADMIN'?'Super Admin':role==='DIVISION_ADMIN'?'Division Admin':'Division User'; }

export default function PermissionsPage({ topSearch = '' }) {
  const [directory,setDirectory]=useState({users:[],divisions:[]});
  const [search,setSearch]=useState(topSearch||'');
  const [selectedId,setSelectedId]=useState('');
  const [detail,setDetail]=useState(null);
  const [permissions,setPermissions]=useState({});
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [toast,setToast]=useState('');

  useEffect(()=>setSearch(topSearch||''),[topSearch]);

  const loadUsers=useCallback(async()=>{
    setLoading(true); setError('');
    try{
      const result=await getAdminUsers({page:1,pageSize:100,status:'ALL'});
      const next=result.data||{users:[],divisions:[]}; setDirectory(next);
      setSelectedId((current)=>current || next.users?.[0]?.id || '');
    }catch(err){setError(err.message||'Daftar user gagal dimuat.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{loadUsers();},[loadUsers]);

  useEffect(()=>{
    if(!selectedId){setDetail(null);return;}
    let active=true; setDetailLoading(true); setError('');
    getAdminUserPermissions(selectedId).then((result)=>{
      if(!active)return;
      const user=result.data?.user||null; setDetail(user);
      const p=user?.permissions||{};
      setPermissions(Object.fromEntries(RULES.map(([upper,lower])=>[lower,Boolean(p[upper])])));
    }).catch((err)=>active&&setError(err.message||'Permission gagal dimuat.')).finally(()=>active&&setDetailLoading(false));
    return()=>{active=false;};
  },[selectedId]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return directory.users||[];
    return (directory.users||[]).filter(u=>`${u.name} ${u.username} ${u.divisionName} ${u.role}`.toLowerCase().includes(q));
  },[directory.users,search]);

  function toggle(key){ if(detail?.role==='SUPER_ADMIN')return; setPermissions(p=>({...p,[key]:!p[key]})); }
  function preset(type){
    if(detail?.role==='SUPER_ADMIN')return;
    if(type==='view') setPermissions(Object.fromEntries(RULES.map(([,lower])=>[lower,['can_view','can_download','can_preview'].includes(lower)])));
    if(type==='admin') setPermissions(Object.fromEntries(RULES.map(([,lower])=>[lower,true])));
    if(type==='none') setPermissions(Object.fromEntries(RULES.map(([,lower])=>[lower,false])));
  }
  async function save(){
    if(!detail||detail.role==='SUPER_ADMIN')return;
    setSaving(true);setError('');
    try{await updateAdminUserPermissions(detail.id,permissions);setToast(`Permission ${detail.username} berhasil disimpan.`);window.setTimeout(()=>setToast(''),4000);}
    catch(err){setError(err.message||'Permission gagal disimpan.');}
    finally{setSaving(false);}
  }

  return <main className="admin-workspace permission-workspace">
    {toast?<div className="folder-toast">{toast}</div>:null}
    <div className="admin-heading"><div><span>ADMINISTRATION</span><h1>Permission</h1><p>Atur hak akses granular user. Validasi tetap dilakukan oleh backend pada setiap request.</p></div></div>
    {error?<div className="dashboard-error">{error}<button onClick={loadUsers}>Coba lagi</button></div>:null}
    <div className="permission-layout">
      <aside className="permission-user-list">
        <div className="permission-user-search"><Icon name="search" size={14}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Cari user…"/></div>
        <div className="permission-user-scroll">
          {loading?Array.from({length:7}).map((_,i)=><div className="permission-user-item is-skeleton" key={i}/>):filtered.map((u)=><button key={u.id} className={`permission-user-item ${selectedId===u.id?'selected':''}`} onClick={()=>setSelectedId(u.id)}><span className="admin-avatar">{String(u.name||u.username).slice(0,1)}</span><span><strong>{u.name}</strong><small>{u.username} · {u.divisionName}</small></span><b className={`admin-status ${u.status==='ACTIVE'?'active':'inactive'}`}>{u.status}</b></button>)}
          {!loading&&!filtered.length?<div className="empty-state">User tidak ditemukan.</div>:null}
        </div>
      </aside>
      <section className="permission-panel">
        {detailLoading?<div className="permission-loading">Memuat permission…</div>:detail?<>
          <div className="permission-profile"><div className="admin-avatar large">{String(detail.name||detail.username).slice(0,1)}</div><div><span>USER ACCESS PROFILE</span><h2>{detail.name}</h2><p>{detail.username} · {detail.divisionName} · {roleLabel(detail.role)}</p></div><b className={`admin-status ${detail.status==='ACTIVE'?'active':'inactive'}`}>{detail.status}</b></div>
          {detail.role==='SUPER_ADMIN'?<div className="admin-info-box">Super Admin selalu memiliki seluruh permission. Hak akses ini tidak dapat dinonaktifkan.</div>:<div className="permission-presets"><span>Preset:</span><button onClick={()=>preset('view')}>View Only</button><button onClick={()=>preset('admin')}>Full Division Access</button><button onClick={()=>preset('none')}>Clear All</button></div>}
          <div className="permission-rule-grid">{RULES.map(([upper,key,label,description])=><button type="button" key={key} className={`permission-rule ${permissions[key]?'enabled':''}`} onClick={()=>toggle(key)} disabled={detail.role==='SUPER_ADMIN'}><span className="permission-switch"><i/></span><span><strong>{upper}</strong><b>{label}</b><small>{description}</small></span></button>)}</div>
          <div className="permission-footer"><span>{detail.role==='SUPER_ADMIN'?'Full access enforced by backend.':'Perubahan berlaku pada request berikutnya.'}</span><button className="admin-primary-btn" onClick={save} disabled={saving||detail.role==='SUPER_ADMIN'}>{saving?'Menyimpan…':'Simpan Permission'}</button></div>
        </>:<div className="empty-state">Pilih user untuk mengatur permission.</div>}
      </section>
    </div>
  </main>;
}
