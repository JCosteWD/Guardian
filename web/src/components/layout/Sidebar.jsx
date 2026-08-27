import { useApp } from '../context';
import { API } from '../api';

export function Sidebar({ page, setPage }) {
  const { parent, setParent } = useApp();

  const handleLogout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('guardian_token');
      localStorage.removeItem('guardian_remember');
      setParent(null);
      window.location.hash = '';
      window.location.reload();
    }
  };

  const navItems = [
    { id: 'overview', icon: '📊', label: 'Tableau de bord' },
    { id: 'children', icon: '👶', label: 'Enfants' },
    { id: 'rules', icon: '📜', label: 'Règles' },
    { id: 'subscription', icon: '💳', label: 'Abonnement' },
    { id: 'settings', icon: '⚙️', label: 'Paramètres' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('guardian_token');
    window.location.reload();
  };

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
        
        {/* Bouton de test pour l'IA */}
        <button
          className={`nav-item ${page === 'child-chat' ? 'active' : ''}`}
          onClick={() => setPage('child-chat')}
          style={{ marginTop: 16, border: '1px dashed var(--purple)', color: 'var(--purple)' }}
        >
          <span className="icon">🤖</span>
          <span>Test Chat IA</span>
        </button>
      </div>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={handleLogout}>
          <span className="icon">🚪</span>
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
