import React, { useState, useEffect, useRef } from 'react';

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Widget Analytics Temps Réel (extension de DashboardV2)
// ══════════════════════════════════════════════════════════════════════════════
// Flux d'activité live + mini-graphiques qui se mettent à jour via WebSocket.

// ── LIVE ACTIVITY FEED ────────────────────────────────────────────────────────
export function LiveActivityFeed({ socket, maxItems = 15 }) {
  const [events, setEvents] = useState([]);
  const feedRef = useRef(null);

  const EVENT_STYLE = {
    app_blocked:    { icon: '🚫', color: '#BA7517' },
    url_blocked:    { icon: '🌐', color: '#378ADD' },
    quota_warning:  { icon: '⏰', color: '#BA7517' },
    quota_reached:  { icon: '🔴', color: '#E24B4A' },
    grade_added:    { icon: '📝', color: '#7F77DD' },
    quiz_completed: { icon: '🏆', color: '#1D9E75' },
    zone_enter:     { icon: '📍', color: '#1D9E75' },
    zone_exit:      { icon: '📍', color: '#BA7517' },
    tamper_attempt: { icon: '🚨', color: '#E24B4A' },
    child_message:  { icon: '💬', color: '#7F77DD' },
    badge_earned:   { icon: '🏅', color: '#BA7517' },
  };

  useEffect(() => {
    if (!socket) return;

    const handler = (type) => (data) => {
      setEvents(prev => [
        { id: Date.now() + Math.random(), type, data, timestamp: new Date() },
        ...prev,
      ].slice(0, maxItems));
    };

    const types = Object.keys(EVENT_STYLE);
    types.forEach(t => socket.on(t, handler(t)));

    return () => types.forEach(t => socket.off(t));
  }, [socket, maxItems]);

  const formatEventText = (type, data) => {
    switch (type) {
      case 'app_blocked':    return `${data.childName || 'Un enfant'} a tenté d'ouvrir une app bloquée`;
      case 'url_blocked':    return `Site bloqué : ${data.domain || 'site web'}`;
      case 'quota_warning':  return `${data.childName} : quota bientôt épuisé (${data.remainingMins}min)`;
      case 'quota_reached':  return `${data.childName} : quota épuisé`;
      case 'grade_added':    return `${data.childName} : nouvelle note en ${data.subject} (${data.grade}/${data.maxGrade})`;
      case 'quiz_completed': return `${data.childName} a réussi un quiz (+${data.bonusMins}min)`;
      case 'zone_enter':     return `${data.childName} est arrivé(e) : ${data.zoneName}`;
      case 'zone_exit':      return `${data.childName} a quitté : ${data.zoneName}`;
      case 'tamper_attempt': return `⚠️ Tentative de contournement détectée`;
      case 'child_message':  return `Message de ${data.childName}`;
      case 'badge_earned':   return `${data.childName} a débloqué un badge !`;
      default: return 'Événement Guardian';
    }
  };

  return (
    <div style={{ background: '#13131f', border: '1px solid #1e2040', borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F0FA' }}>📡 Activité en direct</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: '#1D9E75', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 11, color: '#1D9E75', fontWeight: 700 }}>Live</span>
        </div>
      </div>

      <div ref={feedRef} style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#555' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>👀</div>
            <div style={{ fontSize: 12 }}>En attente d'activité...</div>
          </div>
        ) : (
          events.map(evt => {
            const style = EVENT_STYLE[evt.type] || { icon: '📌', color: '#888780' };
            return (
              <div key={evt.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                background: '#0f0f1a', borderRadius: 10, borderLeft: `2px solid ${style.color}`,
                animation: 'fadeSlide .3s ease',
              }}>
                <span style={{ fontSize: 16 }}>{style.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatEventText(evt.type, evt.data)}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: '#555', flexShrink: 0 }}>
                  {evt.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes fadeSlide { from { opacity:0; transform: translateX(-8px); } to { opacity:1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

// ── LIVE SPARKLINE (mini graphique temps réel) ────────────────────────────────
export function LiveSparkline({ data = [], color = '#7F77DD', height = 50, label }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      {label && <div style={{ fontSize: 11, color: '#888780', marginBottom: 6 }}>{label}</div>}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {data.length > 1 && (
          <>
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            <polygon points={`0,100 ${points} 100,100`} fill={`url(#grad-${label})`} />
          </>
        )}
      </svg>
    </div>
  );
}

// ── REALTIME STATS BAR ────────────────────────────────────────────────────────
export function RealtimeStatsBar({ socket, children = [] }) {
  const [stats, setStats] = useState({
    onlineCount: 0,
    totalUsedToday: 0,
    eventsLastHour: 0,
    activeAlerts: 0,
  });
  const [history, setHistory] = useState({ events: Array(20).fill(0) });

  useEffect(() => {
    const onlineCount = children.filter(c => c.last_seen && (Date.now() - new Date(c.last_seen)) < 300000).length;
    const totalUsed = children.reduce((s, c) => s + (c.used_mins_today || 0), 0);
    setStats(s => ({ ...s, onlineCount, totalUsedToday: totalUsed }));
  }, [children]);

  useEffect(() => {
    if (!socket) return;

    let eventCount = 0;
    const countEvent = () => {
      eventCount++;
      setStats(s => ({ ...s, eventsLastHour: s.eventsLastHour + 1 }));
      setHistory(h => ({ events: [...h.events.slice(1), eventCount] }));
    };

    const alertTypes = ['tamper_attempt', 'distress_alert', 'quota_reached'];
    const allTypes = ['app_blocked', 'url_blocked', 'quota_warning', 'grade_added', 'quiz_completed', 'zone_enter', ...alertTypes];

    allTypes.forEach(t => socket.on(t, countEvent));
    alertTypes.forEach(t => socket.on(t, () => setStats(s => ({ ...s, activeAlerts: s.activeAlerts + 1 }))));

    return () => allTypes.forEach(t => socket.off(t));
  }, [socket]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {[
        { label: 'En ligne maintenant', value: stats.onlineCount, suffix: `/${children.length}`, color: '#1D9E75', icon: '🟢' },
        { label: 'Temps utilisé aujourd\'hui', value: `${stats.totalUsedToday}`, suffix: 'min', color: '#378ADD', icon: '⏱️' },
        { label: 'Événements (1h)', value: stats.eventsLastHour, suffix: '', color: '#7F77DD', icon: '📊' },
        { label: 'Alertes actives', value: stats.activeAlerts, suffix: '', color: stats.activeAlerts > 0 ? '#E24B4A' : '#888780', icon: '🔔' },
      ].map((s, i) => (
        <div key={i} style={{ background: '#13131f', border: '1px solid #1e2040', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, color: '#888780', fontWeight: 600, marginBottom: 6 }}>{s.icon} {s.label}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>
            {s.value}<span style={{ fontSize: 13, color: '#888780', fontWeight: 600 }}> {s.suffix}</span>
          </div>
          {i === 2 && <LiveSparkline data={history.events} color="#7F77DD" height={24} />}
        </div>
      ))}
    </div>
  );
}

// ── WEEKLY TREND CHART (SVG bar chart) ────────────────────────────────────────
export function WeeklyTrendChart({ data = [] }) {
  // data: [{ day: 'Lun', screenMins: 95, quizzes: 2 }, ...]
  const maxMins = Math.max(...data.map(d => d.screenMins || 0), 60);

  return (
    <div style={{ background: '#13131f', border: '1px solid #1e2040', borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#F0F0FA', marginBottom: 16 }}>📈 Tendance hebdomadaire</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
        {data.map((d, i) => {
          const heightPct = ((d.screenMins || 0) / maxMins) * 100;
          const isToday = i === data.length - 1;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10, color: '#888780', fontWeight: 700 }}>{d.screenMins || 0}m</div>
              <div style={{
                width: '100%', maxWidth: 28, height: `${Math.max(4, heightPct)}%`,
                background: isToday ? 'linear-gradient(180deg, #7F77DD, #378ADD)' : '#252550',
                borderRadius: '6px 6px 0 0', transition: 'height .5s ease',
                position: 'relative',
              }}>
                {d.quizzes > 0 && (
                  <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 11 }}>
                    🏆
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: isToday ? '#7F77DD' : '#555', fontWeight: isToday ? 800 : 600 }}>
                {d.day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default { LiveActivityFeed, LiveSparkline, RealtimeStatsBar, WeeklyTrendChart };
