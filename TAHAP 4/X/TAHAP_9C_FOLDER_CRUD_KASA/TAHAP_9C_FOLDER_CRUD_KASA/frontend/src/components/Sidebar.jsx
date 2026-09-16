import Brand from './Brand.jsx';
import Icon from './Icon.jsx';

const mainItems = [
  ['Dashboard Global', 'grid', 'dashboard'],
  ['Semua Divisi', 'grid', 'divisions'],
  ['Dokumen', 'folder', 'documents'],
  ['Dokumen Terbaru', 'clock', 'recent'],
  ['Favorit', 'star', 'favorites'],
  ['Recycle Bin', 'trash', 'recycle'],
  ['Activity Log', 'activity', 'activity']
];

const adminItems = [
  ['Manajemen User', 'users', 'users'],
  ['Permission', 'shield', 'permissions'],
  ['System Settings', 'settings', 'settings']
];

export default function Sidebar({ user, collapsed, mobileOpen, activeKey = 'dashboard', onCloseMobile, onNavigate, onLogout }) {
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const initial = String(user?.name || user?.username || 'U').slice(0, 1).toUpperCase();

  function item([label, icon, key]) {
    return (
      <button key={key} className={`side-item ${activeKey === key ? 'side-item--active' : ''}`} onClick={() => onNavigate(key, label)} title={collapsed ? label : undefined}>
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <>
      <div className={`sidebar-backdrop ${mobileOpen ? 'is-open' : ''}`} onClick={onCloseMobile} />
      <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="sidebar-head">
          <Brand compact />
          <button className="sidebar-mobile-close" onClick={onCloseMobile} aria-label="Close navigation"><Icon name="close" size={19} /></button>
        </div>

        <nav className="side-nav">
          {mainItems.map(item)}
          {isSuperAdmin ? (
            <>
              <div className="side-section-label">ADMINISTRATION</div>
              {adminItems.map(item)}
            </>
          ) : null}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initial}</div>
          <div className="sidebar-user-copy">
            <strong>{user?.name || user?.username}</strong>
            <span>{isSuperAdmin ? 'Direksi · Super Admin' : user?.role === 'DIVISION_ADMIN' ? 'Division Admin' : 'Division User'}</span>
          </div>
          <button className="sidebar-logout" onClick={onLogout} title="Logout"><Icon name="logout" size={17} /></button>
        </div>
      </aside>
    </>
  );
}
