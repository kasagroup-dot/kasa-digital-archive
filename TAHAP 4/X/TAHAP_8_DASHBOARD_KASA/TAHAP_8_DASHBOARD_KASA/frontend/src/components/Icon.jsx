const common = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};

export default function Icon({ name, size = 20 }) {
  const props = { ...common, width: size, height: size };
  switch (name) {
    case 'grid': return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'folder': return <svg {...props}><path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 8.5h18"/></svg>;
    case 'file': return <svg {...props}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h5"/></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'star': return <svg {...props}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>;
    case 'trash': return <svg {...props}><path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14"/><path d="M10 11v6M14 11v6"/></svg>;
    case 'activity': return <svg {...props}><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>;
    case 'users': return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'shield': return <svg {...props}><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z"/><path d="m9.5 12 1.7 1.7 3.6-4"/></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21v4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
    case 'menu': return <svg {...props}><path d="M5 7h14M5 12h14M5 17h14"/></svg>;
    case 'chevronDown': return <svg {...props}><path d="m7 10 5 5 5-5"/></svg>;
    case 'document': return <svg {...props}><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M10 12h5M10 16h5"/></svg>;
    case 'upload': return <svg {...props}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>;
    case 'building': return <svg {...props}><path d="M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M18 13v3"/></svg>;
    case 'database': return <svg {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>;
    case 'arrow': return <svg {...props}><path d="M5 19 19 5M10 5h9v9"/></svg>;
    case 'close': return <svg {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>;
    case 'logout': return <svg {...props}><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="8"/></svg>;
  }
}
