import { useState, useEffect } from 'react';
import { API } from '../api';
import { useApp } from '../context';
import { Button } from '../common/Button';
import { AddChildModal } from '../common/AddChildModal';

export function OverviewPage() {
  const { children, loadChildren, showToast } = useApp();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => { loadChildren(); }, []);

  const handleQuickAction = async (child, delta, label, lockState) => {
    try {
      const payload = { childName: child.first_name };
      if (typeof lockState === 'boolean') {
        payload.customLock = lockState;
      } else {
        payload.customDelta = delta;
      }

      await API.post(`/children/${child.id}/quick-action`, payload);
      showToast(`✅ ${label} appliqué à ${child.first_name}`);
      loadChildren();
    } catch { showToast('❌ Erreur lors de l\'action rapide', false); }
  };

  const handleGradeQuick = async (child, grade) => {
    const subject = prompt(`Matière pour ${child.first_name} ?`) || 'Général';
    if (!grade) return;
    try {
      const { data } = await API.post(`/children/${child.id}/grades`, { subject, grade, gradeDate: new Date() });
      const msg = data.penaltyMins > 0 ? `📉 -${data.penaltyMins} min appliqué` : data.bonusMins > 0 ? `⭐ +${data.bonusMins} min bonus !` : `📝 Note enregistrée`;
      showToast(msg, data.bonusMins > 0);
      loadChildren();
    } catch { showToast('❌ Erreur lors de l\'enregistrement de la note', false); }
  };

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-sub">{today}</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          ➕ Ajouter un enfant
        </Button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">Enfants actifs</span>
          <span className="stat-value" style={{ color: 'var(--purple)' }}>{children.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">En ligne maintenant</span>
          <span className="stat-value" style={{ color: 'var(--green)' }}>
            {children.filter(c => c.last_seen && (new Date() - new Date(c.last_seen)) < 300000).length}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Temps total utilisé</span>
          <span className="stat-value" style={{ color: 'var(--blue)' }}>
            {children.reduce((s, c) => s + (c.used_mins_today || 0), 0)} min
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Alertes aujourd'hui</span>
          <span className="stat-value" style={{ color: 'var(--yellow)' }}>0</span>
        </div>
      </div>

      <div className="grid grid-2">
        {children.map(child => {
          const total = Math.max(1, (child.base_limit || 120) + (child.bonus_mins || 0) - (child.penalty_mins || 0));
          const used = child.used_mins_today || 0;
          const remaining = Math.max(0, total - used);
          const pct = Math.min(100, Math.round((used / total) * 100));
          const color = child.is_locked ? 'var(--red)' : remaining <= 15 ? 'var(--red)' : remaining <= 30 ? 'var(--yellow)' : 'var(--green)';
          const isOnline = child.last_seen && (new Date() - new Date(child.last_seen)) < 300000;

          return (
            <div key={child.id} className="child-card">
              <div className="child-card-header">
                <div className="child-avatar" style={{ background: child.avatar_color || 'var(--purple)' }}>
                  {child.first_name.charAt(0)}
                  {isOnline && <div className="online-dot" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="child-name">{child.first_name}</div>
                  <div className="child-meta">{child.age} ans · {isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}</div>
                </div>
                <div>
                  {child.is_locked
                    ? <span className="badge" style={{ background: '#FF6B6B22', color: 'var(--red)' }}>🔒 Bloqué</span>
                    : <span className="badge" style={{ background: color + '22', color }}>{remaining} min restantes</span>
                  }
                </div>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: pct + '%', background: color }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                <span>{used} min utilisées</span>
                <span>{pct}% du quota</span>
              </div>

              <div className="qa-grid">
                {[
                  { icon: '📉', label: '-30 min', color: 'var(--red)', fn: () => handleQuickAction(child, -30, '-30 min') },
                  { icon: '📈', label: '+30 min', color: 'var(--green)', fn: () => handleQuickAction(child, 30, '+30 min') },
                  { icon: '📝', label: 'Note', color: 'var(--yellow)', fn: () => { const g = prompt('Note /20 ?'); if (g) handleGradeQuick(child, parseFloat(g)); } },
                  { icon: child.is_locked ? '🔓' : '🔒', label: child.is_locked ? 'Déverrouiller' : 'Bloquer', color: child.is_locked ? 'var(--green)' : 'var(--red)',
                    fn: () => handleQuickAction(child, 0, child.is_locked ? 'Déverrouillé' : 'Bloqué', !child.is_locked) },
                ].map((a, i) => (
                  <button key={i} className="qa-btn" onClick={a.fn} style={{ color: a.color }}>
                    <span className="qa-icon">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <AddChildModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
