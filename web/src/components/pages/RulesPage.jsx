import { useState, useEffect } from 'react';
import { API } from '../api';
import { useApp } from '../context';
import { Button } from '../common/Button';

export function RulesPage() {
  const { children, showToast } = useApp();
  const [selectedChild, setSelectedChild] = useState(null);
  const [activeTab, setActiveTab] = useState('screen-time');
  const [screenTimeRules, setScreenTimeRules] = useState(null);
  const [appRules, setAppRules] = useState([]);
  const [urlRules, setUrlRules] = useState([]);
  const [categoryFilters, setCategoryFilters] = useState([]);
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    if (selectedChild) {
      loadRules();
    }
  }, [selectedChild, activeTab]);

  const loadRules = async () => {
    try {
      if (activeTab === 'screen-time') {
        const { data } = await API.get(`/children/${selectedChild.id}/rules/screen-time`);
        setScreenTimeRules(data);
      } else if (activeTab === 'apps') {
        const { data } = await API.get(`/children/${selectedChild.id}/rules/apps`);
        setAppRules(data.apps || []);
      } else if (activeTab === 'urls') {
        const { data } = await API.get(`/children/${selectedChild.id}/rules/urls`);
        setUrlRules(data.urls || []);
        setCategoryFilters(data.categories || []);
      } else if (activeTab === 'presets') {
        const { data } = await API.get(`/children/${selectedChild.id}/presets`);
        setPresets(data.presets || []);
      }
    } catch (err) {
      showToast('❌ Erreur lors du chargement des règles', false);
    }
  };

  const handleUpdateScreenTime = async () => {
    try {
      await API.patch(`/children/${selectedChild.id}/rules/screen-time`, screenTimeRules);
      showToast('✅ Règles de temps d\'écran mises à jour');
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleAddAppRule = async () => {
    const packageName = prompt('Package name de l\'app (ex: com.instagram.android)');
    const appName = prompt('Nom de l\'app');
    if (!packageName || !appName) return;
    
    try {
      await API.post(`/children/${selectedChild.id}/rules/apps`, {
        packageName,
        appName,
        isBlocked: true
      });
      showToast('✅ Règle d\'app ajoutée');
      loadRules();
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleDeleteAppRule = async (packageName) => {
    try {
      await API.delete(`/children/${selectedChild.id}/rules/apps`, { data: { packageName } });
      showToast('✅ Règle d\'app supprimée');
      loadRules();
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleAddUrlRule = async () => {
    const domain = prompt('Domaine à bloquer (ex: facebook.com)');
    if (!domain) return;
    
    try {
      await API.post(`/children/${selectedChild.id}/rules/urls`, {
        domain,
        isBlocked: true
      });
      showToast('✅ Filtre URL ajouté');
      loadRules();
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleDeleteUrlRule = async (domain) => {
    try {
      await API.delete(`/children/${selectedChild.id}/rules/urls`, { data: { domain } });
      showToast('✅ Filtre URL supprimé');
      loadRules();
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleToggleCategory = async (categoryName, isBlocked) => {
    try {
      await API.patch(`/children/${selectedChild.id}/rules/categories`, {
        categoryName,
        isBlocked: !isBlocked
      });
      showToast('✅ Filtre catégorie mis à jour');
      loadRules();
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleCreatePreset = async () => {
    const name = prompt('Nom du preset');
    if (!name) return;
    
    try {
      await API.post(`/children/${selectedChild.id}/presets`, {
        name,
        icon: '⚡',
        color: '#FF6B6B',
        timeDeltaMins: -30
      });
      showToast('✅ Preset créé');
      loadRules();
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleDeletePreset = async (presetId) => {
    try {
      await API.delete(`/children/${selectedChild.id}/presets`, { data: { presetId } });
      showToast('✅ Preset supprimé');
      loadRules();
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  if (!selectedChild) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">Règles</h1>
        </div>
        <div className="card">
          <div className="card-header">Sélectionner un enfant</div>
          <div className="grid grid-2">
            {children.map(child => (
              <div 
                key={child.id} 
                className="child-card"
                onClick={() => setSelectedChild(child)}
                style={{ cursor: 'pointer' }}
              >
                <div className="child-card-header">
                  <div className="child-avatar" style={{ background: child.avatar_color || 'var(--purple)' }}>
                    {child.first_name.charAt(0)}
                  </div>
                  <div>
                    <div className="child-name">{child.first_name}</div>
                    <div className="child-meta">{child.age} ans</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Règles pour {selectedChild.first_name}</h1>
          <p className="page-sub">Gérer les restrictions et les limites</p>
        </div>
        <Button onClick={() => setSelectedChild(null)}>
          ← Retour
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'screen-time', label: '⏱️ Temps d\'écran' },
          { id: 'apps', label: '📱 Applications' },
          { id: 'urls', label: '🌐 Sites web' },
          { id: 'presets', label: '⚡ Presets' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'screen-time' && screenTimeRules && (
        <div className="card">
          <div className="card-header">Temps d'écran quotidien</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>
                Limite de base (minutes)
              </label>
              <input
                type="number"
                className="input"
                value={screenTimeRules.daily_limit_mins || 120}
                onChange={(e) => setScreenTimeRules({ ...screenTimeRules, daily_limit_mins: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, display: 'block' }}>
                Limite weekend (minutes)
              </label>
              <input
                type="number"
                className="input"
                value={screenTimeRules.weekend_limit_mins || 180}
                onChange={(e) => setScreenTimeRules({ ...screenTimeRules, weekend_limit_mins: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <Button onClick={handleUpdateScreenTime} style={{ marginTop: 16 }}>
            Enregistrer
          </Button>
        </div>
      )}

      {activeTab === 'apps' && (
        <div className="card">
          <div className="card-header">
            <span>Applications bloquées</span>
            <Button onClick={handleAddAppRule}>➕ Ajouter</Button>
          </div>
          {appRules.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Aucune application bloquée</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Package</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appRules.map((rule, idx) => (
                  <tr key={idx}>
                    <td>{rule.app_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{rule.package_name}</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteAppRule(rule.package_name)}
                        style={{ padding: '4px 8px', fontSize: 12 }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'urls' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span>Sites web bloqués</span>
              <Button onClick={handleAddUrlRule}>➕ Ajouter</Button>
            </div>
            {urlRules.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Aucun site bloqué</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Domaine</th>
                    <th>Catégorie</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {urlRules.map((rule, idx) => (
                    <tr key={idx}>
                      <td>{rule.domain}</td>
                      <td>{rule.category || '-'}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteUrlRule(rule.domain)}
                          style={{ padding: '4px 8px', fontSize: 12 }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-header">Filtres par catégorie</div>
            {categoryFilters.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Aucun filtre de catégorie</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categoryFilters.map((filter, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--surface2)', borderRadius: 8 }}>
                    <span>{filter.category_name}</span>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={filter.is_blocked}
                        onChange={() => handleToggleCategory(filter.category_name, filter.is_blocked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'presets' && (
        <div className="card">
          <div className="card-header">
            <span>Presets rapides</span>
            <Button onClick={handleCreatePreset}>➕ Créer</Button>
          </div>
          {presets.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Aucun preset personnalisé</p>
          ) : (
            <div className="grid grid-2">
              {presets.map((preset, idx) => (
                <div key={idx} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{preset.icon}</span>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeletePreset(preset.id)}
                      style={{ padding: '4px 8px', fontSize: 12 }}
                    >
                      🗑️
                    </button>
                  </div>
                  <div style={{ fontWeight: 700 }}>{preset.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {preset.time_delta_mins > 0 ? `+${preset.time_delta_mins} min` : `${preset.time_delta_mins} min`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
