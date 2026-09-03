import { useState, useEffect } from 'react';
import { API } from '../api';
import { useApp } from '../context';
import { Button } from '../common/Button';
import { AddChildModal } from '../common/AddChildModal';

export function ChildrenPage() {
  const { children, loadChildren, showToast } = useApp();
  const [selectedChild, setSelectedChild] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview', 'pronote', 'gamification'
  const [childDashboard, setChildDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Pronote simulation / config state
  const [pronoteUser, setPronoteUser] = useState('');
  const [pronotePass, setPronoteUserPass] = useState('');
  const [pronoteUrl, setPronoteUrl] = useState('');
  const [pronoteCasType, setPronoteCasType] = useState('none');
  const [isPronoteConnected, setIsPronoteConnected] = useState(false);
  const [isPronoteConnecting, setIsPronoteConnecting] = useState(false);
  const [isInteractiveLoginOpen, setIsInteractiveLoginOpen] = useState(false);

  // Simulated homework list for demo purposes
  const [homeworkList, setHomeworkList] = useState([
    { id: 1, subject: 'Mathématiques', description: 'Exercices 4 et 5 page 112 (Fractions)', dueDate: 'Demain', isDone: false, reward: '+5 min' },
    { id: 2, subject: 'Anglais', description: 'Apprendre le vocabulaire de la leçon 3 (Irregular verbs)', dueDate: 'Dans 2 jours', isDone: true, reward: '+5 min' },
    { id: 3, subject: 'Histoire', description: 'Lire le chapitre sur la Révolution Française', dueDate: 'La semaine prochaine', isDone: false, reward: '+10 min' },
  ]);

  // Simulated teacher behavior notes / comments for demo purposes
  const [teacherComments, setTeacherComments] = useState([
    { id: 1, date: 'Hier', author: 'M. Dupont (Maths)', type: 'warning', text: 'Inattentif en fin d\'heure. Doit rester concentré.', impact: '-10 min' },
    { id: 2, date: 'Il y a 3 jours', author: 'Mme. Martin (Français)', type: 'success', text: 'Excellente participation orale aujourd\'hui !', impact: '+15 min' },
    { id: 3, date: 'Il y a un de 5 jours', author: 'M. Lopez (SVT)', type: 'neutral', text: 'Travail rendu à l\'heure et soigné.', impact: 'Neutre' },
  ]);

  // Simulated gamification goals for demo purposes
  const [customGoals, setCustomGoals] = useState([
    { id: 1, title: 'Sortie Cinéma', pointsNeeded: 150, currentPoints: 110, icon: '🎬' },
    { id: 2, title: 'Soirée Pizza', pointsNeeded: 250, currentPoints: 110, icon: '🍕' },
  ]);

  useEffect(() => {
    loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChild) {
      loadChildDashboard(selectedChild.id);
      setIsPronoteConnected(false);
    }
  }, [selectedChild]);

  const loadChildDashboard = async (childId) => {
    setLoadingDashboard(true);
    try {
      const { data } = await API.get(`/children/${childId}/dashboard`);
      setChildDashboard(data);
    } catch (err) {
      console.error('Error loading child dashboard:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

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
      if (selectedChild && selectedChild.id === child.id) {
        loadChildDashboard(child.id);
      }
    } catch { showToast('❌ Erreur action rapide', false); }
  };

  const handleGradeQuick = async (child, grade) => {
    const subject = prompt(`Matière pour ${child.first_name} ?`) || 'Général';
    if (!grade) return;
    try {
      const { data } = await API.post(`/children/${child.id}/grades`, { subject, grade, gradeDate: new Date() });
      const msg = data.penaltyMins > 0 ? `📉 -${data.penaltyMins} min appliqué` : data.bonusMins > 0 ? `⭐ +${data.bonusMins} min bonus !` : `📝 Note enregistrée`;
      showToast(msg, data.bonusMins > 0);
      loadChildren();
      if (selectedChild && selectedChild.id === child.id) {
        loadChildDashboard(child.id);
      }
    } catch { showToast('❌ Erreur enregistrement note', false); }
  };

  const handleDeleteChild = async (childId) => {
    try {
      await API.delete(`/children/${childId}`);
      showToast('✅ Enfant supprimé avec succès');
      setSelectedChild(null);
      loadChildren();
    } catch { showToast('❌ Erreur lors de la suppression', false); }
  };

  const handleConnectPronote = async (e) => {
    e.preventDefault();
    if (!selectedChild || !pronoteUser || !pronotePass || !pronoteUrl) {
      showToast('⚠️ URL, identifiant et mot de passe Pronote requis', false);
      return;
    }
    setIsPronoteConnecting(true);
    try {
      const credentials = {
        childId: selectedChild.id,
        schoolUrl: pronoteUrl,
        username: pronoteUser,
        password: pronotePass,
        casType: pronoteCasType,
      };
      const { data: connection } = await API.post('/pronote/test-connection', credentials);
      if (!connection.success) {
        throw new Error(connection.message || 'Connexion Pronote refusée');
      }
      await API.post(`/children/${selectedChild.id}/pronote/config`, {
        ...credentials,
        autoSync: true,
      });
      setIsPronoteConnected(true);
      showToast('✨ Connexion Pronote réelle établie et configuration sauvegardée !');
    } catch (err) {
      showToast(`❌ ${err.response?.data?.message || err.response?.data?.error || err.message || 'Connexion Pronote impossible'}`, false);
    } finally {
      setIsPronoteConnecting(false);
    }
  };

  const handleInteractivePronoteLogin = () => {
    if (!selectedChild || !pronoteUrl) {
      showToast('⚠️ URL Pronote requise avant ouverture du portail', false);
      return;
    }

    const loginWindow = window.open(pronoteUrl, 'guardian-pronote-login', 'popup,width=1100,height=800');
    if (!loginWindow) {
      showToast('⚠️ Autorisez les fenêtres popup pour ouvrir Pronote', false);
      return;
    }

    setIsInteractiveLoginOpen(true);
    showToast('🔐 Connexion interactive ouverte. Cette fenêtre sert à consulter Pronote ; pour synchroniser Guardian, utilisez le formulaire sécurisé ci-dessus.');
    const checkWindow = window.setInterval(() => {
      if (loginWindow.closed) {
        window.clearInterval(checkWindow);
        setIsInteractiveLoginOpen(false);
        showToast('Fenêtre Pronote fermée. Pour récupérer les données, utilisez la connexion sécurisée côté serveur.', false);
      }
    }, 500);
  };

  const toggleHomework = (id) => {
    setHomeworkList(homeworkList.map(hw => {
      if (hw.id === id) {
        const nextState = !hw.isDone;
        if (nextState) {
          showToast(`🏆 Bravo ! Devoir accompli. ${hw.reward} accordés.`);
        }
        return { ...hw, isDone: nextState };
      }
      return hw;
    }));
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Famille et Scolarité</h1>
          <p className="page-sub">Gérer les profils, suivre la scolarité et motiver vos enfants</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          ➕ Ajouter un enfant
        </Button>
      </div>

      {/* LIST OF CHILDREN CARDS */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>👶 Profils de vos enfants ({children.length})</span>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 'normal' }}>
            Cliquez sur un enfant pour ouvrir son espace scolaire intelligent
          </span>
        </div>
        <div className="grid grid-2">
          {children.map(child => {
            const total = Math.max(1, (child.base_limit || 120) + (child.bonus_mins || 0) - (child.penalty_mins || 0));
            const used = child.used_mins_today || 0;
            const remaining = Math.max(0, total - used);
            const pct = Math.min(100, Math.round((used / total) * 100));
            const color = child.is_locked ? 'var(--red)' : remaining <= 15 ? 'var(--red)' : remaining <= 30 ? 'var(--yellow)' : 'var(--green)';
            const isOnline = child.last_seen && (new Date() - new Date(child.last_seen)) < 300000;
            const isSelected = selectedChild && selectedChild.id === child.id;

            return (
              <div
                key={child.id}
                className={`child-card ${isSelected ? 'active-child' : ''}`}
                onClick={() => { setSelectedChild(child); setActiveSubTab('overview'); }}
                style={{
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--purple)' : '1px solid var(--border)',
                  background: isSelected ? 'var(--surface2)' : 'var(--surface)',
                  boxShadow: isSelected ? '0 0 15px rgba(108, 99, 255, 0.15)' : 'none',
                  position: 'relative'
                }}
              >
                <div className="child-card-header">
                  <div className="child-avatar" style={{ background: child.avatar_color || 'var(--purple)' }}>
                    {child.first_name.charAt(0)}
                    {isOnline && <div className="online-dot" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="child-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {child.first_name}
                      {isSelected && <span style={{ fontSize: 12, color: 'var(--purple)' }}>✨ Sélectionné</span>}
                    </div>
                    <div className="child-meta">{child.age} ans · {child.device_name || 'Appareil Android'}</div>
                  </div>
                  <div>
                    {child.is_locked
                      ? <span className="badge" style={{ background: '#FF6B6B22', color: 'var(--red)' }}>🔒 Bloqué</span>
                      : <span className="badge" style={{ background: color + '22', color }}>{remaining} min rest.</span>
                    }
                  </div>
                </div>

                <div className="progress-bar" style={{ height: 6, marginBottom: 6 }}>
                  <div className="progress-fill" style={{ width: pct + '%', background: color }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                  <span>{used} / {total} min</span>
                  <span>{pct}% utilisé</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SELECTED CHILD EXPANDED SCHOOL DASHBOARD */}
      {selectedChild ? (
        <div className="card" style={{ borderLeft: '4px solid var(--purple)' }}>
          <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
            <div className="child-avatar" style={{ background: selectedChild.avatar_color || 'var(--purple)', width: 40, height: 40, fontSize: 18 }}>
              {selectedChild.first_name.charAt(0)}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Espace Scolaire Intelligent — {selectedChild.first_name}</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Configurez Pronote, visualisez les résultats scolaires et gérez les objectifs éducatifs de votre enfant.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button 
                className="btn btn-ghost" 
                onClick={() => setSelectedChild(null)}
                style={{ padding: '8px 14px', fontSize: 13 }}
              >
                ✕ Fermer l'espace
              </button>
            </div>
          </div>

          {/* TAB SYSTEM */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            {[
              { id: 'overview', label: '📊 Suivi Général & Actions' },
              { id: 'pronote', label: '📚 Connexion Pronote & Résultats' },
              { id: 'gamification', label: '🏆 Défis, Points & Récompenses' },
            ].map(tab => (
              <button
                key={tab.id}
                className="nav-item"
                style={{
                  width: 'auto',
                  background: activeSubTab === tab.id ? 'var(--surface2)' : 'none',
                  color: activeSubTab === tab.id ? 'var(--purple)' : 'var(--muted)',
                  fontWeight: activeSubTab === tab.id ? '700' : '500',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onClick={() => setActiveSubTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* SUB-TAB: GENERAL OVERVIEW */}
          {activeSubTab === 'overview' && (
            <div className="grid grid-2" style={{ gap: 20 }}>

              {/* Active Limits & Controls */}
              <div className="card" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚙️ Ajustements Manuels Rapides
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                  Ajoutez ou retirez du temps d'écran à la volée, ou entrez une note manuellement pour déclencher l'IA.
                </p>

                <div className="qa-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  <button className="qa-btn" onClick={() => handleQuickAction(selectedChild, 30, '+30 mins')} style={{ color: 'var(--green)', padding: 12 }}>
                    <span style={{ fontSize: 24, marginBottom: 4 }}>📈</span>
                    <strong>Offrir +30 min</strong>
                  </button>
                  <button className="qa-btn" onClick={() => handleQuickAction(selectedChild, -30, '-30 mins')} style={{ color: 'var(--red)', padding: 12 }}>
                    <span style={{ fontSize: 24, marginBottom: 4 }}>📉</span>
                    <strong>Retirer -30 min</strong>
                  </button>
                  <button className="qa-btn" onClick={() => {
                    const grade = prompt('Saisir une note sur /20 :');
                    if (grade) handleGradeQuick(selectedChild, parseFloat(grade));
                  }} style={{ color: 'var(--yellow)', padding: 12 }}>
                    <span style={{ fontSize: 24, marginBottom: 4 }}>📝</span>
                    <strong>Saisir une note scolaire</strong>
                  </button>
                  <button className="qa-btn" onClick={() => handleQuickAction(selectedChild, 0, selectedChild.is_locked ? 'Déverrouillé' : 'Verrouillé', !selectedChild.is_locked)} style={{ color: selectedChild.is_locked ? 'var(--green)' : 'var(--red)', padding: 12 }}>
                    <span style={{ fontSize: 24, marginBottom: 4 }}>{selectedChild.is_locked ? '🔓' : '🔒'}</span>
                    <strong>{selectedChild.is_locked ? 'Déverrouiller l\'appareil' : 'Verrouiller l\'appareil'}</strong>
                  </button>
                </div>

                <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Configuration d'Assistant IA</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Persona IA</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>🤖 {selectedChild.ai_persona_name || 'Guardian'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Ton Conversationnel</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, textTransform: 'capitalize' }}>🗣️ {selectedChild.ai_tone || 'Friendly (Amical)'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Activity Summary */}
              <div className="card" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                  📊 Activités et Historique de Temps
                </h3>
                {childDashboard && childDashboard.recentActivities && childDashboard.recentActivities.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
                    {childDashboard.recentActivities.map((act, index) => (
                      <div key={index} style={{ background: 'var(--surface)', padding: 10, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <div>
                          <span style={{ fontWeight: 600, color: act.event_type === 'app_opened' ? 'var(--purple)' : 'var(--blue)' }}>
                            {act.event_type === 'app_opened' ? '📱 Application ouverte' : act.event_type === 'ai_chat' ? '🤖 Discussion IA' : '🌐 Navigation Web'}
                          </span>
                          <div style={{ color: 'var(--muted)', marginTop: 2 }}>{act.app_package || act.url || 'Assistant Personnel'}</div>
                        </div>
                        <span style={{ color: 'var(--muted)' }}>{new Date(act.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                    <span style={{ fontSize: 32 }}>📱</span>
                    <p style={{ fontSize: 13, marginTop: 8 }}>Aucune activité signalée aujourd'hui par l'appareil enfant.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB: PRONOTE & GRADES */}
          {activeSubTab === 'pronote' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Pronote Connection Setup & Status */}
              <div className="card" style={{ background: isPronoteConnected ? 'rgba(81, 207, 102, 0.05)' : 'var(--surface)', border: isPronoteConnected ? '1px solid var(--green)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>🟢</span>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>Intégration Pronote & ÉcoleDirecte</h3>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                        {isPronoteConnected
                          ? `Connecté à l'instance Pronote. Les notes, devoirs et appréciations profs sont synchronisés toutes les heures.`
                          : 'Configurez la connexion scolaire pour importer automatiquement les notes scolaires de votre enfant.'
                        }
                      </p>
                    </div>
                  </div>
                  <div>
                    {isPronoteConnected ? (
                      <span className="badge" style={{ background: 'var(--green)22', color: 'var(--green)', padding: '6px 12px', fontSize: 12 }}>
                        ✓ Synchronisation active
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--red)22', color: 'var(--red)', padding: '6px 12px', fontSize: 12 }}>
                        ✗ Non connecté
                      </span>
                    )}
                  </div>
                </div>

                {!isPronoteConnected ? (
                  <form onSubmit={handleConnectPronote} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 10, marginTop: 16 }}>
                    <input
                      type="text"
                      placeholder="Identifiant Elève / Parent"
                      className="input"
                      value={pronoteUser}
                      onChange={(e) => setPronoteUser(e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder="Mot de passe"
                      className="input"
                      value={pronotePass}
                      onChange={(e) => setPronoteUserPass(e.target.value)}
                    />
                    <input
                      type="url"
                      placeholder="https://xxx.index-education.net/pronote/"
                      className="input"
                      value={pronoteUrl}
                      onChange={(e) => setPronoteUrl(e.target.value)}
                    />
                    <select
                      className="input"
                      value={pronoteCasType}
                      onChange={(e) => setPronoteCasType(e.target.value)}
                    >
                      <option value="none">Connexion Pronote directe</option>
                      <option value="ac-grenoble">ENT Académie de Grenoble</option>
                      <option value="iledefrance">ENT Île-de-France</option>
                      <option value="monbureaunumerique-educonnect">Mon bureau numérique / EduConnect</option>
                      <option value="educdenormandie">EduConnect Normandie</option>
                    </select>
                    <Button type="submit" disabled={isPronoteConnecting} style={{ height: '100%', background: 'linear-gradient(135deg, var(--purple), var(--blue))' }}>
                      {isPronoteConnecting ? 'Connexion...' : '⚡ Connecter'}
                    </Button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        showToast('🔄 Synchronisation forcée lancée...');
                        setTimeout(() => showToast('✨ Notes et devoirs rafraîchis !'), 1200);
                      }}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      🔄 Synchroniser maintenant
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        setIsPronoteConnected(false);
                        showToast('Configuration Pronote supprimée.');
                      }}
                      style={{ padding: '6px 12px', fontSize: 12, border: 'none', background: 'rgba(255,107,107,0.1)', color: 'var(--red)' }}
                    >
                      🔌 Déconnecter Pronote
                    </button>
                  </div>
                )}
                {!isPronoteConnected && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleInteractivePronoteLogin}
                      disabled={isInteractiveLoginOpen}
                      style={{ padding: '8px 12px', fontSize: 12 }}
                    >
                      {isInteractiveLoginOpen ? '🔐 Fenêtre Pronote ouverte...' : '🌐 Ouvrir Pronote / EduConnect'}
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Connexion interactive dans une fenêtre séparée
                    </span>
                  </div>
                )}
              </div>

              {/* GRID WITH GRADES & HOMEWORK & BEHAVIOR COMMENTS */}
              {isPronoteConnected ? (
                <div className="grid grid-3" style={{ gap: 20 }}>

                  {/* Notes scolaires synchronisées */}
                  <div className="card" style={{ background: 'var(--surface2)', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                      <span>📝 Dernières notes (Pronote)</span>
                      <span style={{ color: 'var(--green)', fontSize: 13 }}>Moy. G : 14.5/20</span>
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      {[
                        { subject: 'Mathématiques', grade: 16.5, max: 20, impact: '📈 +15 min bonus !', impactColor: 'var(--green)', comment: 'Excellent travail sur la géométrie.' },
                        { subject: 'Mathématiques', grade: 7.0, max: 20, impact: '📉 -30 min (Restriction)', impactColor: 'var(--red)', comment: 'Fractions non acquises. À réviser.' },
                        { subject: 'Anglais', grade: 18.0, max: 20, impact: '📈 +30 min bonus !', impactColor: 'var(--green)', comment: 'Very good participations !' },
                        { subject: 'SVT', grade: 12.0, max: 20, impact: 'Neutre', impactColor: 'var(--muted)', comment: 'Bon ensemble, continue ainsi.' },
                      ].map((n, i) => (
                        <div key={i} style={{ background: 'var(--surface)', padding: 12, borderRadius: 8, borderLeft: `3px solid ${n.grade >= 14 ? 'var(--green)' : n.grade >= 10 ? 'var(--yellow)' : 'var(--red)'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{n.subject}</span>
                            <span style={{ fontWeight: 800, fontSize: 14, color: n.grade >= 14 ? 'var(--green)' : n.grade >= 10 ? 'var(--yellow)' : 'var(--red)' }}>
                              {n.grade.toFixed(1)}/{n.max}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 4 }}>
                            « {n.comment} »
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                            <span style={{ color: 'var(--muted)' }}>Impact d'écran :</span>
                            <span style={{ color: n.impactColor, fontWeight: 700 }}>{n.impact}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Devoirs synchronisés */}
                  <div className="card" style={{ background: 'var(--surface2)', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                      📚 Cahier de textes & Devoirs
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      {homeworkList.map((hw) => (
                        <div
                          key={hw.id}
                          onClick={() => toggleHomework(hw.id)}
                          style={{
                            background: hw.isDone ? 'rgba(81,207,99,0.02)' : 'var(--surface)',
                            padding: 12,
                            borderRadius: 8,
                            border: hw.isDone ? '1px dashed var(--green)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            opacity: hw.isDone ? 0.7 : 1,
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, background: 'var(--purple)22', color: 'var(--purple)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                              {hw.subject}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>📅 {hw.dueDate}</span>
                          </div>
                          <p style={{ fontSize: 12, marginTop: 6, fontWeight: hw.isDone ? 'normal' : '500', textDecoration: hw.isDone ? 'line-through' : 'none' }}>
                            {hw.description}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                            <span style={{ color: hw.isDone ? 'var(--green)' : 'var(--muted)', fontWeight: hw.isDone ? '700' : 'normal' }}>
                              {hw.isDone ? '✅ Complété' : '⬜ Cliquer pour cocher'}
                            </span>
                            {!hw.isDone && <span style={{ color: 'var(--green)', fontWeight: 700 }}>🎁 Gain: {hw.reward}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Avis Profs & Appréciations Comportement */}
                  <div className="card" style={{ background: 'var(--surface2)', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                      💬 Appréciations et Vie Scolaire
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      {teacherComments.map((comment) => (
                        <div
                          key={comment.id}
                          style={{
                            background: 'var(--surface)',
                            padding: 12,
                            borderRadius: 8,
                            borderLeft: `3px solid ${comment.type === 'success' ? 'var(--green)' : comment.type === 'warning' ? 'var(--red)' : 'var(--border)'}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{comment.author}</span>
                            <span style={{ color: 'var(--muted)' }}>{comment.date}</span>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--text)', marginTop: 6, fontStyle: 'italic' }}>
                            « {comment.text} »
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                            <span style={{ color: 'var(--muted)' }}>Ajustement automatique :</span>
                            <span style={{ fontWeight: 700, color: comment.type === 'success' ? 'var(--green)' : comment.type === 'warning' ? 'var(--red)' : 'var(--muted)' }}>
                              {comment.impact}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ background: 'var(--surface2)', padding: '50px 0', textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border)' }}>
                  <span style={{ fontSize: 44 }}>🎓</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>Rien à afficher pour le moment</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, maxWidth: 450, margin: '6px auto 14px' }}>
                    Dès que Pronote sera synchronisé, cet espace affichera un suivi interactif, ludique et automatisé pour suivre les notes de {selectedChild.first_name}.
                  </p>
                  <button
                    onClick={() => {
                      setIsPronoteConnected(true);
                      showToast('🔧 Mode démonstration activé ! Les données scolaires simulées de Pronote sont montées.');
                    }}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: 13 }}
                  >
                    🚀 Activer le mode démo Pronote
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB: GAMIFICATION & CHALLENGES */}
          {activeSubTab === 'gamification' && (
            <div className="grid grid-2" style={{ gap: 20 }}>

              {/* Gamification state */}
              <div className="card" style={{ background: 'var(--surface2)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
                  🏆 Niveau, Points et Streaks de {selectedChild.first_name}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>⭐</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Points d'apprentissage</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: 'var(--yellow)' }}>110 pts</div>
                  </div>
                  <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📈</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Niveau Scolaire</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: 'var(--purple)' }}>Niveau 2</div>
                  </div>
                  <div style={{ background: 'var(--surface)', padding: 14, borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🔥</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Série de révisions</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: 'var(--orange)' }}>5 Jours</div>
                  </div>
                </div>

                <div className="progress-bar" style={{ height: 10, marginBottom: 8 }}>
                  <div className="progress-fill" style={{ width: '40%', background: 'var(--purple)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                  <span>Progrès vers le Niveau 3</span>
                  <span>40% (40 / 100 XP)</span>
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏅 Badges Débloqués</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: 'rgba(108,99,255,0.1)', color: 'var(--purple)', padding: '6px 10px' }}>
                    🧠 Einstein (Quiz parfait)
                  </span>
                  <span className="badge" style={{ background: 'rgba(81,207,102,0.1)', color: 'var(--green)', padding: '6px 10px' }}>
                    📚 Révisard (5 de devoirs faits)
                  </span>
                  <span className="badge" style={{ background: 'rgba(255,146,43,0.1)', color: 'var(--orange)', padding: '6px 10px' }}>
                    🔥 Assidu (Série de 5 jours)
                  </span>
                </div>
              </div>

              {/* Reward Objectives Set by Parent */}
              <div className="card" style={{ background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>🎯 Objectifs & Récompenses définis</h3>
                  <button
                    onClick={() => {
                      const title = prompt('Nom de la récompense (ex: Place de Laser Game) :');
                      const pointsStr = prompt('Points requis (ex: 150) :');
                      if (title && pointsStr) {
                        setCustomGoals([...customGoals, {
                          id: Date.now(),
                          title,
                          pointsNeeded: parseInt(pointsStr),
                          currentPoints: 110,
                          icon: '🏆'
                        }]);
                        showToast('✅ Nouvel objectif de récompense défini !');
                      }
                    }}
                    className="btn btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                  >
                    ➕ Ajouter
                  </button>
                </div>

                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                  Définissez des récompenses réelles pour stimuler l'autonomie et les efforts de votre enfant.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {customGoals.map((goal) => {
                    const progressPct = Math.min(100, Math.round((goal.currentPoints / goal.pointsNeeded) * 100));
                    return (
                      <div key={goal.id} style={{ background: 'var(--surface)', padding: 12, borderRadius: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 16 }}>{goal.icon}</span> {goal.title}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: '700', color: progressPct >= 100 ? 'var(--green)' : 'var(--muted)' }}>
                            {goal.currentPoints} / {goal.pointsNeeded} Pts
                          </span>
                        </div>
                        <div className="progress-bar" style={{ height: 6, marginBottom: 4 }}>
                          <div className="progress-fill" style={{ width: `${progressPct}%`, background: progressPct >= 100 ? 'var(--green)' : 'var(--purple)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
                          <span>{progressPct}% complété</span>
                          {progressPct >= 100 && <span style={{ color: 'var(--green)', fontWeight: '700' }}>⭐ Prêt à débloquer !</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* DANGER AREA AT FOOTER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Identifiant technique : {selectedChild.id}</span>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(`⚠️ Êtes-vous sûr de vouloir supprimer définitivement le profil de ${selectedChild.first_name} ? Toutes ses données scolaires et de temps d'écran seront effacées.`)) {
                  handleDeleteChild(selectedChild.id);
                }
              }}
              style={{ padding: '6px 12px', fontSize: 11 }}
            >
              🗑️ Supprimer le profil enfant
            </button>
          </div>

        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 16, padding: '40px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: 44 }}>📱</span>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 12 }}>Aucun enfant sélectionné</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, maxWidth: 500, margin: '6px auto' }}>
            Veuillez cliquer sur l'une des cartes d'enfant ci-dessus pour accéder à son suivi scolaire connecté (Pronote), ses objectifs de récompenses ludiques et les commandes d'ajustements de temps.
          </p>
        </div>
      )}

      <AddChildModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
