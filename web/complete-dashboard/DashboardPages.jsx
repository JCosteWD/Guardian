import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('guardian_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ══════════════════════════════════════════════════════════════════════════════
// CHILDREN PAGE – Gestion complète des profils enfants
// ══════════════════════════════════════════════════════════════════════════════
export function ChildrenPage({ onSelectChild }) {
  const [children, setChildren]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ firstName:'', age:10, aiTone:'friendly', avatarColor:'#7F77DD' });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await API.get('/children').catch(() => ({ data: { children: [] } }));
    setChildren(data.children);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.firstName.trim()) return;
    setSaving(true);
    try {
      const { data } = await API.post('/children', form);
      setShowAdd(false);
      load();
      // Affiche le QR code de couplage
      window.open(`/pair/${data.pairingCode}`, '_blank');
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur lors de la création');
    } finally { setSaving(false); }
  };

  const COLORS = ['#7F77DD','#378ADD','#1D9E75','#BA7517','#E24B4A','#D85A30','#CC5DE8','#20C997'];
  const TONES  = [
    { k:'friendly', l:'Chaleureux 😊' }, { k:'fun', l:'Fun 🎉' },
    { k:'calm', l:'Calme 🌿' }, { k:'strict', l:'Structuré 📋' },
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:900, color:'#F0F0FA' }}>Mes enfants</h1>
          <p style={{ fontSize:13, color:'#888780', marginTop:3 }}>{children.length} profil{children.length !== 1 ? 's' : ''} configuré{children.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="g-btn g-btn-primary" onClick={() => setShowAdd(true)}>➕ Ajouter un enfant</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="g-card" style={{ marginBottom:20, borderColor:'#7F77DD44' }}>
          <div className="g-card-title">👶 Nouveau profil enfant</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label style={{ fontSize:12, color:'#888780', fontWeight:600, display:'block', marginBottom:6 }}>Prénom</label>
              <input className="g-input" value={form.firstName} onChange={e => setForm(f => ({...f, firstName:e.target.value}))} placeholder="Ex: Lucas" style={{ width:'100%', padding:'10px 14px', background:'#1a1a2e', border:'1px solid #252550', borderRadius:10, color:'#F0F0FA', fontSize:14, outline:'none' }} />
            </div>
            <div>
              <label style={{ fontSize:12, color:'#888780', fontWeight:600, display:'block', marginBottom:6 }}>Âge</label>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <button onClick={() => setForm(f => ({...f, age:Math.max(3,f.age-1)}))} style={{ width:36, height:36, borderRadius:10, background:'#1e2040', border:'1px solid #252550', color:'#fff', fontSize:20, cursor:'pointer' }}>−</button>
                <span style={{ fontSize:22, fontWeight:800, color:'#fff', minWidth:30, textAlign:'center' }}>{form.age}</span>
                <button onClick={() => setForm(f => ({...f, age:Math.min(18,f.age+1)}))} style={{ width:36, height:36, borderRadius:10, background:'#1e2040', border:'1px solid #252550', color:'#fff', fontSize:20, cursor:'pointer' }}>+</button>
              </div>
            </div>
            <div>
              <label style={{ fontSize:12, color:'#888780', fontWeight:600, display:'block', marginBottom:8 }}>Couleur avatar</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => setForm(f => ({...f, avatarColor:c}))} style={{ width:28, height:28, borderRadius:'50%', backgroundColor:c, cursor:'pointer', border:form.avatarColor===c ? '3px solid #fff' : '2px solid transparent', transition:'border .15s' }} />
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize:12, color:'#888780', fontWeight:600, display:'block', marginBottom:8 }}>Ton de l'IA</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {TONES.map(t => (
                  <button key={t.k} onClick={() => setForm(f => ({...f, aiTone:t.k}))} style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${form.aiTone===t.k ? '#7F77DD' : '#252550'}`, background:form.aiTone===t.k ? '#7F77DD22' : 'transparent', color:form.aiTone===t.k ? '#7F77DD' : '#888780', fontSize:12, fontWeight:600, cursor:'pointer' }}>{t.l}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
            <button className="g-btn g-btn-ghost" onClick={() => setShowAdd(false)}>Annuler</button>
            <button className="g-btn g-btn-primary" onClick={handleAdd} disabled={saving || !form.firstName.trim()}>
              {saving ? 'Création...' : '✓ Créer le profil'}
            </button>
          </div>
        </div>
      )}

      {/* Children grid */}
      {loading ? <div style={{ textAlign:'center', padding:40, color:'#888780' }}>Chargement...</div> : (
        <div className="g-grid-3">
          {children.map(child => {
            const total = Math.max(1, (child.base_limit||120) + (child.bonus_mins||0) - (child.penalty_mins||0));
            const used  = child.used_mins_today || 0;
            const rem   = Math.max(0, total - used);
            const pct   = Math.min(100, Math.round(used/total*100));
            const color = child.is_locked ? '#E24B4A' : rem<=15 ? '#E24B4A' : rem<=30 ? '#BA7517' : '#1D9E75';
            const isOn  = child.last_seen && (Date.now()-new Date(child.last_seen))<300000;
            return (
              <div key={child.id} className="g-card" style={{ cursor:'pointer', borderColor: isOn ? '#1D9E7533':'#1e2040' }} onClick={() => onSelectChild(child)}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ width:48, height:48, borderRadius:24, background:child.avatar_color||'#7F77DD', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:20, color:'#fff', position:'relative' }}>
                    {child.first_name.charAt(0)}
                    {isOn && <div style={{ position:'absolute', bottom:0, right:0, width:12, height:12, borderRadius:6, background:'#1D9E75', border:'2px solid #13131f' }}/>}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:16, color:'#F0F0FA' }}>{child.first_name}</div>
                    <div style={{ fontSize:12, color:'#888780' }}>{child.age} ans · {isOn ? '● En ligne' : '○ Hors ligne'}</div>
                  </div>
                  <span className="g-badge" style={{ background:color+'22', color, border:`1px solid ${color}44` }}>{rem}m</span>
                </div>
                <div style={{ height:6, background:'#1e2040', borderRadius:3, overflow:'hidden', marginBottom:12 }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width .5s' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888780' }}>
                  <span>{used} min utilisées</span>
                  <span>{pct}% du quota</span>
                </div>
                <div style={{ marginTop:12, display:'flex', gap:6 }}>
                  <span style={{ fontSize:10, background:'#7F77DD22', color:'#7F77DD', borderRadius:8, padding:'3px 8px', fontWeight:700 }}>{child.device_name || 'Non couplé'}</span>
                  {child.is_locked && <span style={{ fontSize:10, background:'#E24B4A22', color:'#E24B4A', borderRadius:8, padding:'3px 8px', fontWeight:700 }}>🔒 Bloqué</span>}
                </div>
              </div>
            );
          })}
          {children.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 20px', color:'#888780' }}>
              <div style={{ fontSize:56, marginBottom:12 }}>👶</div>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Aucun enfant configuré</div>
              <div style={{ fontSize:14 }}>Cliquez sur "Ajouter un enfant" pour commencer.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUDIT PAGE – Log de sécurité
// ══════════════════════════════════════════════════════════════════════════════
export function AuditPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { load(); }, [page]);

  const load = async () => {
    setLoading(true);
    const { data } = await API.get(`/gdpr/audit?page=${page}&limit=20`).catch(() => ({ data: { events:[], total:0 } }));
    setEvents(data.events || []);
    setTotal(data.total || 0);
    setLoading(false);
  };

  const EVENT_CONFIG = {
    tamper_attempt: { icon:'🚨', color:'#E24B4A', label:'Tentative de contournement' },
    app_blocked:    { icon:'🚫', color:'#BA7517', label:'App bloquée' },
    url_blocked:    { icon:'🌐', color:'#378ADD', label:'URL bloquée' },
    quota_reached:  { icon:'⏰', color:'#7F77DD', label:'Quota atteint' },
  };

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:'#F0F0FA' }}>🔍 Journal d'audit</h1>
        <p style={{ fontSize:13, color:'#888780', marginTop:3 }}>{total} événement{total!==1?'s':''} enregistré{total!==1?'s':''}</p>
      </div>
      <div className="g-card">
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#888780' }}>Chargement...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#888780' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
            <div style={{ fontWeight:700 }}>Aucun événement de sécurité</div>
            <div style={{ fontSize:13, marginTop:6 }}>Tout semble normal. Guardian surveille en permanence.</div>
          </div>
        ) : (
          <table className="g-table">
            <thead>
              <tr>
                <th>Type</th><th>Enfant</th><th>Détail</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt, i) => {
                const cfg = EVENT_CONFIG[evt.event_type] || { icon:'📌', color:'#888780', label:evt.event_type };
                return (
                  <tr key={i}>
                    <td><span className="g-badge" style={{ background:cfg.color+'22', color:cfg.color }}>{cfg.icon} {cfg.label}</span></td>
                    <td style={{ color:'#F0F0FA', fontWeight:600 }}>{evt.child_name}</td>
                    <td style={{ color:'#888780', fontSize:12, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {evt.app_package || evt.url || JSON.stringify(evt.payload||{}).substring(0,60)}
                    </td>
                    <td style={{ color:'#888780', fontSize:12, whiteSpace:'nowrap' }}>
                      {new Date(evt.created_at).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {/* Pagination */}
        {total > 20 && (
          <div style={{ display:'flex', justifyContent:'center', gap:10, marginTop:16 }}>
            <button className="g-btn g-btn-ghost g-btn-sm" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>← Préc.</button>
            <span style={{ color:'#888780', fontSize:13, alignSelf:'center' }}>Page {page} / {Math.ceil(total/20)}</span>
            <button className="g-btn g-btn-ghost g-btn-sm" onClick={() => setPage(p => p+1)} disabled={page>=Math.ceil(total/20)}>Suiv. →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS PAGE – Web version complète
// ══════════════════════════════════════════════════════════════════════════════
export function SettingsPageComplete({ parent, onLogout }) {
  const [profile, setProfile] = useState({ firstName: parent?.firstName||'', lastName: parent?.lastName||'', phone: '' });
  const [passwords, setPasswords] = useState({ current:'', newPwd:'', confirm:'' });
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await API.patch('/auth/profile', { firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone });
      showToast('✅ Profil sauvegardé');
    } catch (err) { showToast('❌ ' + (err.response?.data?.error || 'Erreur')); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (passwords.newPwd !== passwords.confirm) return showToast('❌ Mots de passe différents');
    if (passwords.newPwd.length < 8) return showToast('❌ Minimum 8 caractères');
    setSaving(true);
    try {
      await API.post('/auth/change-password', { currentPassword: passwords.current, newPassword: passwords.newPwd });
      setPasswords({ current:'', newPwd:'', confirm:'' });
      showToast('✅ Mot de passe modifié');
    } catch (err) { showToast('❌ ' + (err.response?.data?.error || 'Erreur')); }
    finally { setSaving(false); }
  };

  const handleSetPin = async () => {
    if (pin.length < 4) return showToast('❌ PIN minimum 4 chiffres');
    try {
      await API.post('/auth/pin', { pin });
      setPin(''); showToast('✅ PIN configuré');
    } catch (err) { showToast('❌ Erreur PIN'); }
  };

  const Field = ({ label, value, onChange, type='text', placeholder, disabled }) => (
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:12, color:'#888780', fontWeight:600, display:'block', marginBottom:6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{ width:'100%', padding:'10px 14px', background: disabled ? '#0f0f18' : '#1a1a2e', border:'1px solid #252550', borderRadius:10, color:'#F0F0FA', fontSize:14, outline:'none', opacity: disabled ? 0.5 : 1 }} />
    </div>
  );

  const Card = ({ title, children }) => (
    <div className="g-card" style={{ marginBottom:16 }}>
      <div className="g-card-title">{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, padding:'12px 18px', borderRadius:12, background: toast.startsWith('✅') ? '#1D9E7522' : '#E24B4A22', border:`1px solid ${toast.startsWith('✅') ? '#1D9E75' : '#E24B4A'}`, color:'#fff', fontWeight:600, zIndex:999 }}>
          {toast}
        </div>
      )}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:24, fontWeight:900, color:'#F0F0FA' }}>⚙️ Paramètres</h1>
      </div>
      <div className="g-grid-2">
        <div>
          <Card title="👤 Profil">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Field label="Prénom" value={profile.firstName} onChange={v => setProfile(p => ({...p, firstName:v}))} placeholder="Marie" />
              <Field label="Nom" value={profile.lastName} onChange={v => setProfile(p => ({...p, lastName:v}))} placeholder="Dupont" />
            </div>
            <Field label="Email" value={parent?.email||''} onChange={() => {}} disabled placeholder="email@exemple.com" />
            <Field label="Téléphone" value={profile.phone} onChange={v => setProfile(p => ({...p, phone:v}))} placeholder="+33 6 12 34 56 78" />
            <button className="g-btn g-btn-primary" onClick={handleSaveProfile} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
              {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
            </button>
          </Card>

          <Card title="🔑 Mot de passe">
            <Field label="Mot de passe actuel" value={passwords.current} onChange={v => setPasswords(p => ({...p, current:v}))} type="password" placeholder="••••••••" />
            <Field label="Nouveau mot de passe" value={passwords.newPwd} onChange={v => setPasswords(p => ({...p, newPwd:v}))} type="password" placeholder="Min 8 car., 1 maj., 1 chiffre" />
            <Field label="Confirmer" value={passwords.confirm} onChange={v => setPasswords(p => ({...p, confirm:v}))} type="password" placeholder="••••••••" />
            <button className="g-btn g-btn-primary" onClick={handleChangePassword} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
              🔑 Changer
            </button>
          </Card>
        </div>

        <div>
          <Card title="🔐 PIN parental">
            <p style={{ fontSize:13, color:'#888780', marginBottom:14, lineHeight:1.6 }}>
              Le PIN protège les modifications sensibles et empêche votre enfant de changer les paramètres.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} placeholder="4 à 8 chiffres" maxLength={8}
                style={{ flex:1, padding:'10px 14px', background:'#1a1a2e', border:'1px solid #252550', borderRadius:10, color:'#F0F0FA', fontSize:14, outline:'none' }} />
              <button className="g-btn g-btn-primary" onClick={handleSetPin}>Enregistrer</button>
            </div>
          </Card>

          <Card title="📦 Données personnelles (RGPD)">
            <p style={{ fontSize:13, color:'#888780', marginBottom:14, lineHeight:1.6 }}>
              Vous pouvez exporter toutes vos données ou les supprimer définitivement conformément au RGPD.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <a href="/api/gdpr/export?format=json" target="_blank" className="g-btn g-btn-ghost" style={{ justifyContent:'center', textDecoration:'none' }}>
                📥 Exporter mes données (JSON)
              </a>
              <a href="/api/gdpr/export?format=summary" target="_blank" className="g-btn g-btn-ghost" style={{ justifyContent:'center', textDecoration:'none' }}>
                📄 Export résumé (Markdown)
              </a>
              <button className="g-btn g-btn-danger" style={{ justifyContent:'center' }} onClick={() => {
                if (window.confirm('Supprimer TOUTES vos données ? Cette action est irréversible.')) {
                  const c = window.prompt('Tapez SUPPRIMER_MES_DONNEES pour confirmer :');
                  if (c === 'SUPPRIMER_MES_DONNEES') {
                    API.delete('/gdpr/delete', { data: { confirmation: c } }).then(() => { onLogout(); });
                  }
                }
              }}>
                🗑️ Supprimer mon compte
              </button>
            </div>
          </Card>

          <Card title="🚪 Session">
            <button className="g-btn g-btn-danger" style={{ width:'100%', justifyContent:'center' }} onClick={onLogout}>
              Se déconnecter
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default { ChildrenPage, AuditPage, SettingsPageComplete };
