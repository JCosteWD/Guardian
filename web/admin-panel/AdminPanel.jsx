import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Panneau d'administration interne
// ══════════════════════════════════════════════════════════════════════════════
// Accessible uniquement aux admins Guardian (flag admin dans la DB).
// Route: /admin (protégée par middleware isAdmin)

const ADMIN_API = axios.create({ baseURL: '/api/admin' });
ADMIN_API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('guardian_admin_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ── METRIC CARD ───────────────────────────────────────────────────────────────
const MetricCard = ({ icon, label, value, sub, color = '#7F77DD', trend }) => (
  <div style={{
    background: '#13131f', border: '1px solid #252540',
    borderRadius: 16, padding: '20px 22px',
    borderLeft: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 32, fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: '#555' }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ fontSize: 12, color: trend >= 0 ? '#1D9E75' : '#E24B4A', marginTop: 4, fontWeight: 700 }}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs mois dernier
      </div>
    )}
  </div>
);

// ── MINI BAR CHART ────────────────────────────────────────────────────────────
const MiniBarChart = ({ data = [], valueKey = 'count', labelKey = 'day', color = '#7F77DD', height = 80 }) => {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, paddingTop: 10 }}>
      {data.slice(-30).map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%', maxWidth: 20,
            height: `${Math.max(4, Math.round(((d[valueKey] || 0) / max) * (height - 10)))}px`,
            background: color, borderRadius: '3px 3px 0 0',
            opacity: i === data.length - 1 ? 1 : 0.6,
            transition: 'height 0.5s',
          }} title={`${d[labelKey]}: ${d[valueKey]}`} />
        </div>
      ))}
    </div>
  );
};

// ── COHORT TABLE ──────────────────────────────────────────────────────────────
const CohortTable = ({ cohorts = [] }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
    <thead>
      <tr>
        {['Cohorte', 'Taille', 'Sem. 0', 'Sem. 1', 'Sem. 2', 'Sem. 4'].map(h => (
          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#888', borderBottom: '1px solid #252540', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {cohorts.map((c, i) => {
        const pct = (v) => c.cohort_size > 0 ? Math.round((v / c.cohort_size) * 100) : 0;
        const cell = (v, base) => {
          const p = pct(v);
          return (
            <td key={v} style={{ padding: '8px 12px', borderBottom: '1px solid #1a1a2e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: `${p}%`, maxWidth: 60, height: 4,
                  background: p > 60 ? '#1D9E75' : p > 30 ? '#BA7517' : '#E24B4A',
                  borderRadius: 2,
                }} />
                <span style={{ color: '#ccc' }}>{p}%</span>
              </div>
            </td>
          );
        };
        return (
          <tr key={i}>
            <td style={{ padding: '8px 12px', color: '#888', borderBottom: '1px solid #1a1a2e', fontSize: 11 }}>
              {new Date(c.cohort).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })}
            </td>
            <td style={{ padding: '8px 12px', fontWeight: 700, color: '#fff', borderBottom: '1px solid #1a1a2e' }}>{c.cohort_size}</td>
            {cell(c.week0)}
            {cell(c.week1)}
            {cell(c.week2)}
            {cell(c.week4)}
          </tr>
        );
      })}
    </tbody>
  </table>
);

// ── MAIN ADMIN PANEL ──────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [mrr, churn, users, features, security, retention] = await Promise.all([
        ADMIN_API.get('/analytics/mrr').catch(() => ({ data: {} })),
        ADMIN_API.get('/analytics/churn').catch(() => ({ data: {} })),
        ADMIN_API.get('/analytics/users').catch(() => ({ data: {} })),
        ADMIN_API.get('/analytics/features').catch(() => ({ data: {} })),
        ADMIN_API.get('/analytics/security').catch(() => ({ data: {} })),
        ADMIN_API.get('/analytics/retention').catch(() => ({ data: {} })),
      ]);
      setMetrics({ mrr: mrr.data, churn: churn.data, users: users.data, features: features.data, security: security.data, retention: retention.data });
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); const int = setInterval(load, 60000); return () => clearInterval(int); }, []);

  const TABS = [
    { key: 'overview',   label: '📊 Vue d\'ensemble' },
    { key: 'users',      label: '👥 Utilisateurs' },
    { key: 'revenue',    label: '💰 Revenus' },
    { key: 'features',   label: '🔧 Features' },
    { key: 'security',   label: '🔒 Sécurité' },
    { key: 'retention',  label: '🔄 Rétention' },
  ];

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080810; color: #F0F0FA; font-family: 'Inter', system-ui, sans-serif; }
    .adm { display: flex; min-height: 100vh; }
    .adm-sidebar { width: 220px; background: #0f0f1a; border-right: 1px solid #1e2040; padding: 24px 0; position: fixed; height: 100vh; }
    .adm-logo { padding: 0 20px 24px; font-size: 18px; font-weight: 900; color: #7F77DD; border-bottom: 1px solid #1e2040; margin-bottom: 16px; }
    .adm-logo span { font-size: 11px; background: #7F77DD; color: #fff; padding: 2px 6px; border-radius: 5px; margin-left: 6px; }
    .adm-nav-item { display: flex; align-items: center; padding: 10px 20px; font-size: 13px; color: #888; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-weight: 600; transition: all .12s; }
    .adm-nav-item:hover { background: #1a1a2e; color: #fff; }
    .adm-nav-item.active { background: #7F77DD1A; color: #7F77DD; }
    .adm-main { margin-left: 220px; flex: 1; padding: 32px; }
    .adm-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
    .adm-title { font-size: 22px; font-weight: 900; }
    .adm-refresh { background: none; border: 1px solid #252540; color: #888; padding: 7px 14px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 700; }
    .adm-refresh:hover { border-color: #7F77DD; color: #7F77DD; }
    .adm-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .adm-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .adm-card { background: #13131f; border: 1px solid #252540; border-radius: 16px; padding: 20px; }
    .adm-card-title { font-size: 14px; font-weight: 700; margin-bottom: 16px; color: #F0F0FA; }
    .adm-badge { display: inline-flex; padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; }
    .adm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .adm-table th { text-align: left; padding: 9px 12px; color: #888; border-bottom: 1px solid #252540; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; }
    .adm-table td { padding: 10px 12px; border-bottom: 1px solid #1a1a2e; color: #ccc; }
    .adm-table tr:hover td { background: #1a1a2e; }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #1D9E75; animation: pulse 1.5s infinite; display: inline-block; margin-right: 6px; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  `;

  const m = metrics;

  return (
    <>
      <style>{css}</style>
      <div className="adm">
        <aside className="adm-sidebar">
          <div className="adm-logo">🛡️ Guardian <span>ADMIN</span></div>
          {TABS.map(t => (
            <button key={t.key} className={`adm-nav-item${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
          <div style={{ position: 'absolute', bottom: 20, left: 20, fontSize: 11, color: '#444' }}>
            <span className="live-dot" />Auto-refresh 60s
          </div>
        </aside>

        <main className="adm-main">
          <div className="adm-header">
            <div>
              <div className="adm-title">
                {TABS.find(t => t.key === tab)?.label || 'Dashboard'}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
                Mis à jour : {new Date().toLocaleTimeString('fr-FR')}
              </div>
            </div>
            <button className="adm-refresh" onClick={load} disabled={refreshing}>
              {refreshing ? '⟳ Chargement...' : '↻ Rafraîchir'}
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>Chargement des métriques...</div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {tab === 'overview' && (
                <>
                  <div className="adm-grid-4">
                    <MetricCard icon="💰" label="MRR" value={`${m.mrr?.current?.mrr || '0'}€`} sub={`ARR: ${m.mrr?.current?.arr || '0'}€`} color="#1D9E75" />
                    <MetricCard icon="👥" label="Utilisateurs" value={m.mrr?.current?.totalUsers || 0} sub={`${m.mrr?.current?.paidTotal || 0} payants`} color="#7F77DD" />
                    <MetricCard icon="📈" label="Conversion" value={m.mrr?.current?.conversionRate || '0%'} sub="Free → Paid" color="#378ADD" />
                    <MetricCard icon="📉" label="Churn 30j" value={m.churn?.churnRate || '0%'} sub={`${m.churn?.churned30d || 0} départs`} color="#E24B4A" />
                  </div>
                  <div className="adm-grid-4" style={{ marginBottom: 24 }}>
                    <MetricCard icon="📱" label="DAU" value={m.users?.dau || 0} sub="Actifs aujourd'hui" color="#BA7517" />
                    <MetricCard icon="📅" label="WAU" value={m.users?.wau || 0} sub="Actifs cette semaine" color="#BA7517" />
                    <MetricCard icon="📆" label="MAU" value={m.users?.mau || 0} sub="Actifs ce mois" color="#BA7517" />
                    <MetricCard icon="🔗" label="Stickiness" value={m.users?.stickiness || '0%'} sub="DAU / MAU" color="#CC5DE8" />
                  </div>
                  <div className="adm-grid-2">
                    <div className="adm-card">
                      <div className="adm-card-title">DAU — 30 derniers jours</div>
                      <MiniBarChart data={m.users?.dauHistory || []} valueKey="active_children" labelKey="day" color="#7F77DD" />
                    </div>
                    <div className="adm-card">
                      <div className="adm-card-title">Répartition des plans</div>
                      {[
                        { label: 'Gratuit', count: m.mrr?.current?.freeUsers || 0, color: '#888' },
                        { label: 'Family', count: m.mrr?.current?.familyUsers || 0, color: '#378ADD' },
                        { label: 'Premium', count: m.mrr?.current?.premiumUsers || 0, color: '#7F77DD' },
                      ].map(p => (
                        <div key={p.label} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 13, color: p.color, fontWeight: 700 }}>{p.label}</span>
                            <span style={{ fontSize: 13, color: '#ccc' }}>{p.count}</span>
                          </div>
                          <div style={{ height: 6, background: '#1e2040', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${m.mrr?.current?.totalUsers > 0 ? Math.round(p.count / m.mrr.current.totalUsers * 100) : 0}%`, background: p.color, borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── REVENUE ── */}
              {tab === 'revenue' && (
                <>
                  <div className="adm-grid-4" style={{ marginBottom: 24 }}>
                    <MetricCard icon="💰" label="MRR actuel" value={`${m.mrr?.current?.mrr || '0'}€`} color="#1D9E75" />
                    <MetricCard icon="📈" label="ARR projeté" value={`${m.mrr?.current?.arr || '0'}€`} color="#1D9E75" />
                    <MetricCard icon="🆕" label="New MRR (30j)" value={`${m.mrr?.current?.newMrr30d || '0'}€`} color="#7F77DD" />
                    <MetricCard icon="💎" label="LTV estimée" value={`${m.churn?.ltv || '0'}€`} sub="Par client payant" color="#BA7517" />
                  </div>
                  <div className="adm-card">
                    <div className="adm-card-title">MRR historique</div>
                    <MiniBarChart data={m.mrr?.history || []} valueKey="mrr" labelKey="month" color="#1D9E75" height={120} />
                  </div>
                </>
              )}

              {/* ── FEATURES ── */}
              {tab === 'features' && (
                <div className="adm-grid-2">
                  <div className="adm-card">
                    <div className="adm-card-title">📊 Utilisation features (30j)</div>
                    {Object.entries(m.features?.features || {}).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a1a2e' }}>
                        <span style={{ color: '#aaa', fontSize: 13, textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span style={{ fontWeight: 700, color: '#7F77DD' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="adm-card">
                    <div className="adm-card-title">🔝 Top événements</div>
                    <table className="adm-table">
                      <thead><tr><th>Événement</th><th>Occurrences</th></tr></thead>
                      <tbody>
                        {(m.features?.topEvents || []).map((e, i) => (
                          <tr key={i}>
                            <td>{e.event_type}</td>
                            <td style={{ fontWeight: 700, color: '#7F77DD' }}>{parseInt(e.count).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── SECURITY ── */}
              {tab === 'security' && (
                <div className="adm-grid-2">
                  <div className="adm-card">
                    <div className="adm-card-title">🛡️ Sécurité — 30 derniers jours</div>
                    {[
                      { label: '🚨 Tentatives de contournement', val: m.security?.last30Days?.tamper_attempts, color: '#E24B4A' },
                      { label: '🚫 Apps bloquées', val: m.security?.last30Days?.app_blocks, color: '#BA7517' },
                      { label: '🌐 URLs bloquées', val: m.security?.last30Days?.url_blocks, color: '#378ADD' },
                      { label: '⏰ Quotas atteints', val: m.security?.last30Days?.quota_hits, color: '#7F77DD' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a2e' }}>
                        <span style={{ fontSize: 13, color: '#aaa' }}>{s.label}</span>
                        <span style={{ fontWeight: 800, color: s.color }}>{parseInt(s.val || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="adm-card">
                    <div className="adm-card-title">🚫 Apps les plus bloquées</div>
                    <table className="adm-table">
                      <thead><tr><th>Package</th><th>Blocages</th></tr></thead>
                      <tbody>
                        {(m.security?.topBlockedApps || []).map((a, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{a.app_package}</td>
                            <td style={{ fontWeight: 700, color: '#E24B4A' }}>{parseInt(a.count).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── RETENTION ── */}
              {tab === 'retention' && (
                <div className="adm-card">
                  <div className="adm-card-title">🔄 Analyse de rétention par cohorte</div>
                  <CohortTable cohorts={m.retention?.cohorts || []} />
                </div>
              )}

              {/* ── USERS ── */}
              {tab === 'users' && (
                <div className="adm-grid-2">
                  <div className="adm-card">
                    <div className="adm-card-title">DAU — 30 jours</div>
                    <MiniBarChart data={m.users?.dauHistory || []} valueKey="active_children" labelKey="day" color="#7F77DD" height={100} />
                  </div>
                  <div className="adm-card">
                    <div className="adm-card-title">Métriques clés</div>
                    {[
                      { l: 'DAU', v: m.users?.dau || 0, c: '#7F77DD' },
                      { l: 'WAU', v: m.users?.wau || 0, c: '#378ADD' },
                      { l: 'MAU', v: m.users?.mau || 0, c: '#1D9E75' },
                      { l: 'Stickiness', v: m.users?.stickiness || '0%', c: '#CC5DE8' },
                    ].map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a2e' }}>
                        <span style={{ color: '#aaa', fontSize: 13 }}>{s.l}</span>
                        <span style={{ fontWeight: 800, color: s.c, fontSize: 16 }}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
