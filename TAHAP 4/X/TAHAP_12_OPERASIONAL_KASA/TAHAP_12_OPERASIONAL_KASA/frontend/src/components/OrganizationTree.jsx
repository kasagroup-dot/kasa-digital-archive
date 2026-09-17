const divisions = [
  ['HR', 'Human Resources', 'people'],
  ['FINANCE', 'Finance Division', 'card'],
  ['ACCOUNTING', 'Accounting', 'document'],
  ['DATA', 'Data & Analytics', 'database'],
  ['IT', 'Information Tech.', 'monitor'],
  ['MARKETING', 'Marketing', 'arrow'],
  ['PARTNERSHIP', 'Partnership', 'link'],
  ['FACILITIES', 'Facilities', 'home'],
  ['LOGISTIC', 'Logistics', 'boxes'],
  ['BERSIH SEHAT', 'Health & Sanitation', 'heart'],
  ['F&B', 'Food & Beverage', 'fork'],
  ['VISI', 'Learning Center', 'eye']
];

function TinyIcon({ type }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', 'aria-hidden': true };
  const paths = {
    people: <><circle cx="9" cy="8" r="3"/><path d="M4 19v-2a5 5 0 0 1 10 0v2"/><path d="M16 5a3 3 0 0 1 0 6"/></>,
    card: <><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h5"/></>,
    document: <><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></>,
    database: <><ellipse cx="12" cy="6" rx="6" ry="3"/><path d="M6 6v6c0 1.7 2.7 3 6 3s6-1.3 6-3V6"/><path d="M6 12v6c0 1.7 2.7 3 6 3s6-1.3 6-3v-6"/></>,
    monitor: <><rect x="4" y="5" width="16" height="11" rx="2"/><path d="M9 20h6M12 16v4"/></>,
    arrow: <><path d="M5 12h13"/><path d="M14 8l4 4-4 4"/></>,
    link: <><path d="M10 13a4 4 0 0 0 5.7.1l2-2a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M14 11a4 4 0 0 0-5.7-.1l-2 2a4 4 0 0 0 5.7 5.7l1.1-1.1"/></>,
    home: <><path d="M4 11l8-6 8 6"/><path d="M6 10v10h12V10M10 20v-6h4v6"/></>,
    boxes: <><rect x="4" y="11" width="7" height="7" rx="1"/><rect x="13" y="11" width="7" height="7" rx="1"/><rect x="8.5" y="4" width="7" height="5" rx="1"/></>,
    heart: <path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5Z"/>,
    fork: <><path d="M7 4v16M4 4v5a3 3 0 0 0 6 0V4M17 4v16M17 4c3 2 3 6 0 8"/></>,
    eye: <><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/></>
  };
  return <svg {...common}>{paths[type]}</svg>;
}

export default function OrganizationTree() {
  return (
    <div className="org-tree" aria-label="Struktur divisi PT. KASA GROUP">
      <div className="org-tree__root-wrap">
        <div className="org-tree__root">PT. KASA GROUP</div>
      </div>
      <div className="org-tree__branches">
        {divisions.map(([title, subtitle, icon]) => (
          <div className="division-card" key={title}>
            <div className="division-card__icon"><TinyIcon type={icon} /></div>
            <div className="division-card__copy">
              <div className="division-card__title">{title}</div>
              <div className="division-card__subtitle">{subtitle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
