import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TimeRing, ActivityHeatmap, GradeRadar, StreakBadge,
  LevelBar, BadgeGrid, QuotaMiniCard, WeekCalendar, MoodIndicator, tokens
} from './GuardianComponents.jsx';
import io from 'socket.io-client';
import axios from 'axios';

const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('guardian_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ── GLOBAL CSS ─────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#080810; --s1:#0f0f1a; --s2:#13131f; --s3:#1a1a2e;
    --b1:#1e2040; --b2:#252550; --b3:#303060;
    --purple:#7F77DD; --purple2:#534AB7; --blue:#378ADD;
    --green:#1D9E75; --yellow:#BA7517; --red:#E24B4A;
    --text:#F0F0FA; --muted:#888780; --faint:#444460;
    --r:14px; --gap:16px;
  }
  body { background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; }
  ::-webkit-scrollbar { width:4px; }
  ::-webkit-scrollbar-track { background:var(--s1); }
  ::-webkit-scrollbar-thumb { background:var(--b3); border-radius:4px; }

  .g-app { display:flex; min-height:100vh; }

  /* ── SIDEBAR ── */
  .g-sidebar {
    width:220px; background:var(--s1); border-right:1px solid var(--b1);
    display:flex; flex-direction:column; position:fixed; height:100vh; z-index:20;
    transition:width .2s;
  }
  .g-logo { padding:24px 18px 16px; display:flex; align-items:center; gap:10; border-bottom:1px solid var(--b1); }
  .g-logo-text { font-size:18px; font-weight:900; background:linear-gradient(135deg,var(--purple),var(--blue)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  .g-plan { font-size:10px; background:var(--purple2); color:#fff; border-radius:5px; padding:2px 6px; font-weight:700; }
  .g-nav { flex:1; padding:12px; display:flex; flex-direction:column; gap:2px; }
  .g-nav-item {
    display:flex; align-items:center; gap:10; padding:9px 12px; border-radius:10px;
    cursor:pointer; color:var(--muted); font-size:13px; font-weight:500;
    transition:all .12s; border:none; background:none; width:100%; text-align:left;
  }
  .g-nav-item:hover { background:var(--s3); color:var(--text); }
  .g-nav-item.active { background:linear-gradient(135deg,#7F77DD1A,#378ADD1A); color:var(--purple); font-weight:700; }
  .g-nav-icon { font-size:17px; width:22px; text-align:center; }
  .g-nav-badge { margin-left:auto; background:var(--red); color:#fff; border-radius:10px; padding:1px 6px; font-size:10px; font-weight:800; }
  .g-sidebar-bottom { padding:12px; border-top:1px solid var(--b1); }
  .g-user { display:flex; align-items:center; gap:10; padding:8px; border-radius:10px; }
  .g-user-av { width:32px; height:32px; border-radius:50%; background:var(--purple2); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; color:#fff; }
  .g-user-name { font-size:13px; font-weight:600; }
  .g-user-plan { font-size:10px; color:var(--muted); }

  /* ── MAIN ── */
  .g-main { margin-left:220px; flex:1; padding:28px; min-width:0; }
  .g-topbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
  .g-page-title { font-size:24px; font-weight:900; }
  .g-page-sub { font-size:13px; color:var(--muted); margin-top:3px; }

  /* ── CARDS ── */
  .g-card { background:var(--s2); border:1px solid var(--b1); border-radius:var(--r); padding:20px; }
  .g-card-title { font-size:14px; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
  .g-card-sub { font-size:12px; color:var(--muted); margin-top:4px; }

  /* ── GRIDS ── */
  .g-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:var(--gap); }
  .g-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:var(--gap); }
  .g-grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:var(--gap); }
  .g-grid-main { display:grid; grid-template-columns:1fr 360px; gap:var(--gap); }

  /* ── STAT CARD ── */
  .g-stat { background:var(--s2); border:1px solid var(--b1); border-radius:var(--r); padding:18px; }
  .g-stat-label { font-size:11px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.8px; }
  .g-stat-value { font-size:30px; font-weight:900; margin:6px 0 4px; }
  .g-stat-trend { font-size:11px; display:flex; align-items:center; gap:4px; }

  /* ── BUTTONS ── */
  .g-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all .12s; }
  .g-btn-primary { background:linear-gradient(135deg,var(--purple),var(--blue)); color:#fff; }
  .g-btn-primary:hover { opacity:.9; transform:translateY(-1px); }
  .g-btn-ghost { background:var(--s3); color:var(--text); border:1px solid var(--b2); }
  .g-btn-ghost:hover { border-color:var(--purple); }
  .g-btn-danger { background:#E24B4A18; color:var(--red); border:1px solid var(--red); }
  .g-btn-sm { padding:5px 12px; font-size:12px; }
  .g-btn:disabled { opacity:.4; cursor:not-allowed; transform:none; }

  /* ── BADGE ── */
  .g-badge { display:inline-flex; align-items:center; padding:3px 8px; border-radius:8px; font-size:11px; font-weight:700; }

  /* ── CHILD SELECTOR TABS ── */
  .g-child-tabs { display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
  .g-child-tab { display:flex; align-items:center; gap:8px; padding:7px 14px; border-radius:10px; cursor:pointer; background:var(--s2); border:1px solid var(--b1); font-size:13px; color:var(--muted); font-weight:600; transition:all .12s; }
  .g-child-tab.active { border-color:var(--purple); background:#7F77DD18; color:var(--purple); }
  .g-child-tab-dot { width:8px; height:8px; border-radius:50%; background:var(--green); }

  /* ── QUICK ACTION ── */
  .g-qa { display:flex; flex-direction:column; align-items:center; gap:5px; padding:12px 8px; border-radius:12px; background:var(--s3); border:1px solid var(--b2); cursor:pointer; transition:all .12s; min-width:72px; font-size:12px; font-weight:600; color:var(--muted); }
  .g-qa:hover { transform:translateY(-2px); }
  .g-qa-icon { font-size:20px; }

  /* ── TABLE ── */
  .g-table { width:100%; border-collapse:collapse; }
  .g-table th { text-align:left; padding:9px 12px; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.8px; border-bottom:1px solid var(--b1); }
  .g-table td { padding:11px 12px; font-size:13px; border-bottom:1px solid var(--b1); }
  .g-table tr:last-child td { border:none; }
  .g-table tr:hover td { background:var(--s3); }

  /* ── ALERT TOAST ── */
  .g-toast { position:fixed; bottom:24px; right:24px; z-index:999; padding:12px 18px; border-radius:12px; font-weight:600; font-size:13px; max-width:320px; animation:slideUp .25s ease; pointer-events:none; }
  @keyframes slideUp { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }

  /* ── LIVE INDICATOR ── */
  .g-live { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; color:var(--green); }
  .g-live-dot { width:7px; height:7px; border-radius:50%; background:var(--green); animation:pulse 1.5s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  /* ── REALTIME BAR ── */
  .g-rt-bar { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:10px; background:var(--s3); margin-bottom:8px; border:1px solid var(--b1); }
  .g-rt-name { font-weight:700; font-size:13px; }
  .g-rt-prog { flex:1; height:6px; background:var(--b2); border-radius:3px; overflow:hidden; margin:0 12px; }
  .g-rt-fill { height:100%; border-radius:3px; transition:width .5s; }
  .g-rt-time { font-size:12px; font-weight:700; min-width:48px; text-align:right; }

  /* ── MOOD PANEL ── */
  .g-mood-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .g-mood-card { padding:12px 8px; border-radius:10px; border:1px solid var(--b1); text-align:center; background:var(--s3); }

  /* ── MEDIATION INPUT ── */
  .g-msg-input { display:flex; gap:8px; margin-top:12px; }
  .g-msg-field { flex:1; background:var(--s3); border:1px solid var(--b2); border-radius:10px; padding:10px 14px; color:var(--text); font-size:13px; font-family:inherit; outline:none; transition:border-color .15s; }
  .g-msg-field:focus { border-color:var(--purple); }
  .g-msg-field::placeholder { color:var(--faint); }

  @media(max-width:900px) {
    .g-sidebar { width:56px; }
    .g-logo-text,.g-plan,.g-nav-item span,.g-nav-badge,.g-user-name,.g-user-plan { display:none; }
    .g-nav-item { justify-content:center; }
    .g-main { margin-left:56px; padding:16px; }
    .g-grid-4 { grid-template-columns:repeat(2,1fr); }
    .g-grid-main { grid-template-columns:1fr; }
  }
`;

// ══════════════════════════════════════════════════════════════════════════════
// OVERVIEW PAGE – TABLEAU DE BORD PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function OverviewPage({ parent, children, socket, onQuickAction, showToast }) {
  const [selected, setSelected] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [liveQuotas, setLiveQuotas] = useState({});
  const [mediationMsg, setMediationMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [calendarRules, setCalendarRules] = useState({});

  useEffect(() => {
    if (children.length > 0 && !selected) setSelected(children[0]);
  }, [children]);

  useEffect(() => {
    if (!selected) return;
    loadDashboard(selected.id);
    loadRewards(selected.id);
  }, [selected]);

  // WebSocket live quotas
  useEffect(() => {
    if (!socket) return;
    socket.on('quota_updated', data => {
      setLiveQuotas(prev => ({ ...prev, [data.childId]: data }));
    });
  }, [socket]);

  const loadDashboard = async (id) => {
    const { data } = await API.get(`/children/${id}/dashboard`).catch(() => ({ data: null }));
    setDashboard(data);
  };

  const loadRewards = async (id) => {
    const { data } = await API.get(`/children/${id}/rewards`).catch(() => ({ data: null }));
    setRewards(data);
  };

  const sendMediationMsg = async () => {
    if (!mediationMsg.trim() || !selected) return;
    setSendingMsg(true);
    try {
      await API.post(`/children/${selected.id}/ai/message-to-child`, {
        message: mediationMsg, tone: 'caring',
      });
      showToast(`✉️ Message transmis à ${selected.first_name} via Guardian`);
      setMediationMsg('');
    } catch { showToast('❌ Erreur d\'envoi', false); }
    finally { setSendingMsg(false); }
  };

  const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  const onlineCount = children.filter(c => c.last_seen && (Date.now() - new Date(c.last_seen)) < 300000).length;
  const totalUsed = children.reduce((s, c) => s + (c.used_mins_today || 0), 0);

  return (
    <div>
      {/* Topbar */}
      <div className="g-topbar">
        <div>
          <h1 className="g-page-title">Tableau de bord</h1>
          <p className="g-page-sub" style={{ textTransform:'capitalize' }}>{today}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {socket?.connected && <span className="g-live"><span className="g-live-dot"/>Temps réel</span>}
          <button className="g-btn g-btn-primary">➕ Ajouter un enfant</button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="g-grid-4" style={{ marginBottom:20 }}>
        {[
          { label:'Enfants actifs', value:children.length, color:'var(--purple)', icon:'👨‍👩‍👧‍👦' },
          { label:'En ligne', value:onlineCount, color:'var(--green)', icon:'🟢', trend:`/${children.length}` },
          { label:'Temps total utilisé', value:`${totalUsed}m`, color:'var(--blue)', icon:'⏱️' },
          { label:'Alertes', value:0, color:'var(--yellow)', icon:'🔔' },
        ].map((s,i) => (
          <div key={i} className="g-stat">
            <div className="g-stat-label">{s.icon} {s.label}</div>
            <div className="g-stat-value" style={{ color:s.color }}>{s.value}</div>
            {s.trend && <div className="g-stat-trend" style={{ color:'var(--muted)' }}>{s.trend}</div>}
          </div>
        ))}
      </div>

      {/* Temps réel – barres de quotas */}
      <div className="g-grid-main" style={{ marginBottom:20 }}>
        <div>
          <div className="g-card" style={{ marginBottom:16 }}>
            <div className="g-card-title">⏱️ Temps d'écran en direct</div>
            {children.map(child => {
              const live = liveQuotas[child.id];
              const total = Math.max(1,(child.base_limit||120)+(child.bonus_mins||0)-(child.penalty_mins||0));
              const used  = live?.usedMins ?? child.used_mins_today ?? 0;
              const rem   = Math.max(0, total - used);
              const pct   = Math.min(100, Math.round(used/total*100));
              const color = child.is_locked?'var(--red)':rem<=15?'var(--red)':rem<=30?'var(--yellow)':'var(--green)';
              const isOn  = child.last_seen && (Date.now()-new Date(child.last_seen))<300000;
              return (
                <div key={child.id} className="g-rt-bar" style={{ cursor:'pointer', borderColor: selected?.id===child.id ? 'var(--purple)':'var(--b1)' }}
                  onClick={() => setSelected(child)}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:120 }}>
                    <div style={{ width:32,height:32,borderRadius:16,background:child.avatar_color||'var(--purple2)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,color:'#fff',position:'relative' }}>
                      {child.first_name.charAt(0)}
                      {isOn && <div style={{ position:'absolute',bottom:0,right:0,width:9,height:9,borderRadius:5,background:'var(--green)',border:'2px solid var(--s2)' }}/>}
                    </div>
                    <span className="g-rt-name">{child.first_name}</span>
                  </div>
                  <div className="g-rt-prog">
                    <div className="g-rt-fill" style={{ width:`${pct}%`, background:color }}/>
                  </div>
                  <span className="g-rt-time" style={{ color }}>{rem}m</span>
                </div>
              );
            })}
          </div>

          {/* Actions rapides */}
          {selected && (
            <div className="g-card">
              <div className="g-card-title">⚡ Actions rapides — {selected.first_name}</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { icon:'📉', label:'-30 min', color:'var(--red)', fn:()=>onQuickAction(selected,{timeDelta:-30}) },
                  { icon:'📈', label:'+30 min', color:'var(--green)', fn:()=>onQuickAction(selected,{timeDelta:30}) },
                  { icon:'📚', label:'Devoirs', color:'var(--blue)', fn:()=>onQuickAction(selected,{blockAll:true}) },
                  { icon:selected.is_locked?'🔓':'🔒', label:selected.is_locked?'Débloquer':'Bloquer', color:selected.is_locked?'var(--green)':'var(--red)', fn:()=>onQuickAction(selected,{lock:!selected.is_locked}) },
                  { icon:'🌙', label:'Coucher', color:'var(--purple)', fn:()=>onQuickAction(selected,{lock:true,reason:'C\'est l\'heure de dormir ! 🌙'}) },
                  { icon:'⭐', label:'+15 bonus', color:'var(--yellow)', fn:()=>onQuickAction(selected,{timeDelta:15}) },
                ].map((a,i) => (
                  <button key={i} className="g-qa" onClick={a.fn} style={{ color:a.color, borderColor:a.color+'33' }}>
                    <span className="g-qa-icon">{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>

              {/* Médiation parent → enfant */}
              <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--b1)' }}>
                <div className="g-card-title" style={{ marginBottom:8 }}>💬 Envoyer un message via Guardian</div>
                <p style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>L'IA reformule votre message de façon adaptée à l'âge de {selected.first_name}.</p>
                <div className="g-msg-input">
                  <input className="g-msg-field" value={mediationMsg} onChange={e=>setMediationMsg(e.target.value)}
                    placeholder={`Message pour ${selected.first_name}...`} onKeyDown={e=>e.key==='Enter'&&sendMediationMsg()} />
                  <button className="g-btn g-btn-primary" onClick={sendMediationMsg} disabled={!mediationMsg.trim()||sendingMsg}>
                    {sendingMsg ? '...' : '→'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panneau droit – détails enfant sélectionné */}
        {selected && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Anneau temps */}
            <div className="g-card" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
              <TimeRing
                usedMins={selected.used_mins_today||0}
                totalMins={(selected.base_limit||120)+(selected.bonus_mins||0)-(selected.penalty_mins||0)}
                isLocked={selected.is_locked}
                bonusMins={selected.bonus_mins||0}
                size={140}
              />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontWeight:700, fontSize:16 }}>{selected.first_name}</div>
                {selected.bonus_mins > 0 && (
                  <div style={{ fontSize:11, color:'var(--purple)', marginTop:3 }}>+{selected.bonus_mins} min bonus !</div>
                )}
                {selected.penalty_mins > 0 && (
                  <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>−{selected.penalty_mins} min pénalité</div>
                )}
              </div>
            </div>

            {/* Gamification */}
            {rewards && (
              <div className="g-card">
                <div className="g-card-title">🏆 Progression</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                  <StreakBadge days={rewards.stats?.current_streak_days||0} size={48}/>
                  <div style={{ flex:1, marginLeft:12 }}>
                    <LevelBar
                      level={rewards.stats?.current_level||1}
                      progress={rewards.stats?.levelProgress||0}
                      points={rewards.stats?.total_points||0}
                    />
                  </div>
                </div>
                <BadgeGrid earned={rewards.recentRewards||[]} available={rewards.availableBadges||{}} />
              </div>
            )}

            {/* Notes radar */}
            {dashboard?.recentGrades?.length >= 3 && (
              <div className="g-card" style={{ alignItems:'center', display:'flex', flexDirection:'column' }}>
                <div className="g-card-title">📊 Radar des notes</div>
                <GradeRadar grades={dashboard.recentGrades} size={180}/>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendrier hebdomadaire */}
      {selected && (
        <div className="g-card" style={{ marginBottom:16 }}>
          <div className="g-card-title">📅 Planification hebdomadaire – {selected.first_name}</div>
          <p style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>
            Cliquez sur un créneau pour changer son statut. Les règles s'appliquent automatiquement.
          </p>
          <WeekCalendar rules={calendarRules} onSlotChange={(day,h,type) => setCalendarRules(p=>({...p,[`${day}-${h}`]:type}))} />
        </div>
      )}

      {/* Heatmap d'activité */}
      {dashboard?.weekStats && (
        <div className="g-card">
          <div className="g-card-title">🗓️ Historique d'activité (12 semaines)</div>
          <ActivityHeatmap data={dashboard.weekStats} weeks={12}/>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP SHELL v2
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardV2() {
  const [parent, setParent]     = useState(null);
  const [children, setChildren] = useState([]);
  const [page, setPage]         = useState('overview');
  const [toast, setToast]       = useState(null);
  const [socket, setSocket]     = useState(null);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('guardian_token');
    if (!token) return;
    API.get('/children').then(r => {
      setChildren(r.data.children);
      setParent({ firstName: 'Parent', plan: 'premium' });
      // Init socket
      const s = io(window.location.origin, { auth: { token }, reconnection: true });
      s.on('quota_warning', () => setNotifCount(n => n + 1));
      s.on('tamper_attempt', () => { setNotifCount(n => n + 1); showToast('🚨 Tentative de contournement !', false); });
      s.on('child_message', d => showToast(`💬 ${d.childName}: ${d.message.substring(0,60)}...`));
      setSocket(s);
    }).catch(() => {});
    return () => socket?.disconnect();
  }, []);

  const showToast = (msg, success = true) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 4000);
  };

  const loadChildren = async () => {
    const { data } = await API.get('/children');
    setChildren(data.children);
  };

  const handleQuickAction = async (child, action) => {
    try {
      const payload = {};
      if (action.timeDelta) payload.customDelta = action.timeDelta;
      if (action.lock !== undefined) payload.customLock = action.lock;
      if (action.reason) payload.lockReason = action.reason;
      if (action.blockAll) { payload.customLock = true; payload.lockReason = '📚 Mode devoirs activé'; }
      await API.post(`/children/${child.id}/quick-action`, { ...payload, childName: child.first_name });
      showToast(`✅ Appliqué à ${child.first_name}`);
      loadChildren();
    } catch { showToast('❌ Erreur', false); }
  };

  const NAV = [
    { key:'overview',     icon:'📊', label:'Vue d\'ensemble' },
    { key:'children',     icon:'👶', label:'Enfants' },
    { key:'activity',     icon:'📈', label:'Activité' },
    { key:'family',       icon:'👨‍👩‍👧', label:'Famille' },
    { key:'subscription', icon:'💎', label:'Abonnement' },
    { key:'audit',        icon:'🔍', label:'Audit' },
    { key:'settings',     icon:'⚙️', label:'Paramètres' },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="g-app">
        {/* Sidebar */}
        <aside className="g-sidebar">
          <div className="g-logo">
            <span style={{ fontSize:24 }}>🛡️</span>
            <span className="g-logo-text">Guardian</span>
            <span className="g-plan">{parent?.plan?.toUpperCase()||'FREE'}</span>
          </div>
          <nav className="g-nav">
            {NAV.map(n => (
              <button key={n.key} className={`g-nav-item${page===n.key?' active':''}`} onClick={()=>{ setPage(n.key); if(n.key==='activity'||n.key==='family')setNotifCount(0); }}>
                <span className="g-nav-icon">{n.icon}</span>
                <span>{n.label}</span>
                {n.key==='activity' && notifCount > 0 && <span className="g-nav-badge">{notifCount}</span>}
              </button>
            ))}
          </nav>
          <div className="g-sidebar-bottom">
            <div className="g-user">
              <div className="g-user-av">{parent?.firstName?.charAt(0)||'P'}</div>
              <div>
                <div className="g-user-name">{parent?.firstName}</div>
                <div className="g-user-plan">Plan {parent?.plan}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="g-main">
          {page === 'overview' && (
            <OverviewPage parent={parent} children={children} socket={socket}
              onQuickAction={handleQuickAction} showToast={showToast} />
          )}
          {page !== 'overview' && (
            <div>
              <div className="g-topbar">
                <h1 className="g-page-title">{NAV.find(n=>n.key===page)?.label}</h1>
              </div>
              <div className="g-card">
                <p style={{ color:'var(--muted)' }}>Section en cours de développement. Revenez sur Vue d'ensemble pour accéder aux fonctionnalités.</p>
              </div>
            </div>
          )}
        </main>

        {/* Toast */}
        {toast && (
          <div className="g-toast" style={{
            background: toast.success ? '#0F6E5622' : '#E24B4A22',
            border: `1px solid ${toast.success ? 'var(--green)' : 'var(--red)'}`,
            color: '#fff',
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}
