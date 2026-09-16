import { useState } from 'react';
import Icon from './Icon.jsx';

export default function Topbar({ user, title, scope, divisions, selectedDivision, onDivisionChange, onMenu, onSearch, onLogout }) {
  const [search, setSearch] = useState('');
  const [userMenu, setUserMenu] = useState(false);
  const initial = String(user?.name || user?.username || 'U').slice(0, 1).toUpperCase();

  function submit(event) {
    event.preventDefault();
    onSearch(search.trim());
  }

  return (
    <header className="app-topbar">
      <div className="topbar-title-group">
        <button className="topbar-menu-button" onClick={onMenu} aria-label="Toggle navigation"><Icon name="menu" size={20} /></button>
        <div className="topbar-title-copy">
          <strong>{title}</strong>
          <span>{scope?.label || 'PT. KASA GROUP'}</span>
        </div>
      </div>

      <form className="topbar-search" onSubmit={submit}>
        <Icon name="search" size={19} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari dokumen, folder, nomor dokumen atau tag..." />
        <button type="submit">Enter</button>
      </form>

      <div className="topbar-actions">
        {user?.role === 'SUPER_ADMIN' ? (
          <label className="division-select-wrap">
            <select value={selectedDivision || 'ALL'} onChange={(e) => onDivisionChange(e.target.value)}>
              <option value="ALL">Semua Divisi</option>
              {(divisions || []).map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
            </select>
            <Icon name="chevronDown" size={15} />
          </label>
        ) : null}

        <div className="topbar-user-wrap">
          <button className="topbar-user-button" onClick={() => setUserMenu((v) => !v)}>
            <span className="topbar-avatar">{initial}</span>
            <span className="topbar-user-name">{user?.name || user?.username}</span>
            <Icon name="chevronDown" size={14} />
          </button>
          {userMenu ? (
            <div className="topbar-user-menu">
              <div><strong>{user?.name || user?.username}</strong><span>{user?.username}</span></div>
              <button onClick={onLogout}><Icon name="logout" size={16} /> Logout</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
