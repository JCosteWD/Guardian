import { useState, useEffect } from 'react';
import { API } from '../api';
import { useApp } from '../context';
import { Button } from '../common/Button';

export function ChildrenPage() {
  const { children, loadChildren, showToast } = useApp();
  const [selectedChild, setSelectedChild] = useState(null);

  useEffect(() => { loadChildren(); }, []);

  const handleQuickAction = async (child, delta, label) => {
    try {
      await API.post(`/children/${child.id}/quick-action`, {
        customDelta: delta, childName: child.first_name,
      });
      showToast(`✅ ${label} appliqué à ${child.first_name}`);
      loadChildren();
    } catch { showToast('❌ Erreur', false); }
  };

  const handleGradeQuick = async (child, grade) => {
    const subject = prompt(`Matière pour ${child.first_name} ?`) || 'Général';
    if (!grade) return;
    try {
      const { data } = await API.post(`/children/${child.id}/grades`, { subject, grade, gradeDate: new Date() });
      const msg = data.penaltyMins > 0 ? `📉 -${data.penaltyMins} min appliqué` : data.bonusMins > 0 ? `⭐ +${data.bonusMins} min bonus !` : `📝 Note enregistrée`;
      showToast(msg, data.bonusMins > 0);
      loadChildren();
    } catch { showToast('❌ Erreur', false); }
  };

  const handleDeleteChild = async (childId) => {
    try {
      await API.delete(`/children/${childId}`);
      showToast('✅ Enfant supprimé avec succès');
      setSelectedChild(null);
      loadChildren();
    } catch { showToast('❌ Erreur lors de la suppression', false); }
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Enfants</h1>
          <p className="page-sub">Gérer les profils et les règles de chaque enfant</p>
        </div>
        <Button onClick={() => window.location.hash = 'add-child'}>
          ➕ Ajouter un enfant
        </Button>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span>👶 Liste des enfants ({children.length})</span>
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
              <div key={child.id} className="child-card" onClick={() => setSelectedChild(child)}>
                <div className="child-card-header">
                  <div className="child-avatar" style={{ background: child.avatar_color || 'var(--purple)' }}>
                    {child.first_name.charAt(0)}
                    {isOnline && <div className="online-dot" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="child-name">{child.first_name}</div>
                    <div className="child-meta">{child.age} ans · {child.device_name || 'Appareil inconnu'}</div>
                    <div className="child-meta">{isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}</div>
                  </div>
                  <div>
                    {child.is_locked
                      ? <span className="badge" style={{ background: '#FF6B6B22', color: 'var(--red)' }}>🔒 Bloqué</span>
                      : <span className="badge" style={{ background: color + '22', color }}>{remaining} min restantes</span>
                    }
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12 }}>
                  <div style={{ background: 'var(--surface2)', padding: 10, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Temps utilisé</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{used} min</div>
                  </div>
                  <div style={{ background: 'var(--surface2)', padding: 10, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Limite journalière</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{total} min</div>
                  </div>
                </div>

                <div className="qa-grid" style={{ marginTop: 12 }}>
                  {[
                    { icon: '📉', label: '-30 min', color: 'var(--red)', fn: (e) => { e.stopPropagation(); handleQuickAction(child, -30, '-30 min'); } },
                    { icon: '📈', label: '+30 min', color: 'var(--green)', fn: (e) => { e.stopPropagation(); handleQuickAction(child, 30, '+30 min'); } },
                    { icon: '📝', label: 'Note', color: 'var(--yellow)', fn: (e) => { e.stopPropagation(); const g = prompt('Note /20 ?'); if (g) handleGradeQuick(child, parseFloat(g)); } },
                    { icon: child.is_locked ? '🔓' : '🔒', label: child.is_locked ? 'Débloquer' : 'Bloquer', color: child.is_locked ? 'var(--green)' : 'var(--red)',
                      fn: (e) => { e.stopPropagation(); handleQuickAction(child, 0, child.is_locked ? 'Débloqué' : 'Bloqué'); } },
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
      </div>

      {selectedChild && (
        <div className="card">
          <div className="card-header">
            <span>⚙️ Détails de {selectedChild.first_name}</span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button 
                className="btn btn-danger" 
                onClick={() => {
                  if (confirm(`Êtes-vous sûr de vouloir supprimer ${selectedChild.first_name} ? Cette action est irréversible.`)) {
                    handleDeleteChild(selectedChild.id);
                  }
                }}
                style={{ padding: '6px 12px' }}
              >
                🗑️ Supprimer
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={() => setSelectedChild(null)}
                style={{ padding: '6px 12px' }}
              >
                ✕ Fermer
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Appareil</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedChild.device_name || 'Non configuré'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Persona IA</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedChild.ai_persona_name || 'Guardian'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Ton IA</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedChild.ai_tone || 'friendly'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Statut</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {selectedChild.is_active ? '✅ Actif' : '❌ Inactif'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
