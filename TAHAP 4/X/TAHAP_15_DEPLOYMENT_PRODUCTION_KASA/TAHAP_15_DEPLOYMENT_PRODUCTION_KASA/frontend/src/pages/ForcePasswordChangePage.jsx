import { useState } from 'react';
import Brand from '../components/Brand.jsx';
import { changeMyPassword, logout } from '../services/api.js';

export default function ForcePasswordChangePage({ user, onChanged, onLogout }) {
  const [form,setForm]=useState({oldPassword:'',newPassword:'',confirmPassword:''});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  function patch(key,value){setForm(p=>({...p,[key]:value}));}
  async function submit(e){
    e.preventDefault();setSaving(true);setError('');
    try{await changeMyPassword(form);onChanged({...user,mustChangePassword:false});}
    catch(err){setError(err.message||'Password gagal diperbarui.');}
    finally{setSaving(false);}
  }
  async function doLogout(){try{await logout();}catch{}onLogout();}
  return <main className="force-password-screen"><section className="force-password-card"><Brand/><div className="force-password-tag">SECURITY REQUIRED</div><h1>Ganti password sebelum melanjutkan.</h1><p>Akun <strong>{user?.username}</strong> menggunakan password sementara atau telah direset oleh administrator.</p>{error?<div className="admin-error-box">{error}</div>:null}<form onSubmit={submit}><label className="admin-field"><span>Password Saat Ini</span><input type="password" value={form.oldPassword} onChange={e=>patch('oldPassword',e.target.value)} required autoFocus/></label><label className="admin-field"><span>Password Baru</span><input type="password" minLength={6} value={form.newPassword} onChange={e=>patch('newPassword',e.target.value)} required/></label><label className="admin-field"><span>Konfirmasi Password Baru</span><input type="password" minLength={6} value={form.confirmPassword} onChange={e=>patch('confirmPassword',e.target.value)} required/></label><button className="force-password-submit" disabled={saving}>{saving?'Menyimpan…':'Simpan Password Baru'}</button></form><button className="force-password-logout" onClick={doLogout}>Logout</button></section></main>;
}
