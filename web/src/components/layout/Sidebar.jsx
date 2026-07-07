import { useApp } from '../context';

export function Sidebar({ page, setPage }) {
  const { parent } = useApp();

  const navItems = [
    { id: 'overview', icon: '📊', label: 'Tableau de bord' },
    { id: 'children', icon: '👶', label: 'Enfants' },
    { id: 'rules', icon: '📜', label: 'Règles' },
    { id: 'subscription', icon: '💳', label: 'Abonnement' },
    { id: 'settings', icon: '⚙️', label: 'Paramètres' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-shield">🛡️</span>
        <span className="logo-text">Guardian</span>
        {parent?.plan && <span className="logo-plan">{parent.plan}</span>}
      </div>
      <div className="nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => window.location.reload()}>
          <span className="icon">🚪</span>
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
