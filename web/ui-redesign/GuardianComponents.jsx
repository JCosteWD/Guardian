import React, { useState, useEffect, useRef } from 'react';

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN DESIGN SYSTEM — Composants visuels complets
// ══════════════════════════════════════════════════════════════════════════════

// ── TOKENS ────────────────────────────────────────────────────────────────────
export const tokens = {
  colors: {
    purple:  { 50:'#EEEDFE', 100:'#CECBF6', 400:'#7F77DD', 600:'#534AB7', 900:'#26215C' },
    blue:    { 50:'#E6F1FB', 100:'#B5D4F4', 400:'#378ADD', 600:'#185FA5', 900:'#042C53' },
    green:   { 50:'#EAF3DE', 100:'#C0DD97', 400:'#639922', 600:'#3B6D11', 900:'#173404' },
    amber:   { 50:'#FAEEDA', 100:'#FAC775', 400:'#BA7517', 600:'#854F0B', 900:'#412402' },
    red:     { 50:'#FCEBEB', 100:'#F7C1C1', 400:'#E24B4A', 600:'#A32D2D', 900:'#501313' },
    teal:    { 50:'#E1F5EE', 100:'#9FE1CB', 400:'#1D9E75', 600:'#0F6E56', 900:'#04342C' },
    coral:   { 50:'#FAECE7', 100:'#F5C4B3', 400:'#D85A30', 600:'#993C1D', 900:'#4A1B0C' },
    gray:    { 50:'#F1EFE8', 100:'#D3D1C7', 400:'#888780', 600:'#5F5E5A', 900:'#2C2C2A' },
  },
  space: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  font: { sm: 12, base: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
};

// ── ANIMATED TIME RING ────────────────────────────────────────────────────────
// Cercle SVG animé qui affiche le temps restant
export const TimeRing = ({ usedMins = 0, totalMins = 120, size = 160, isLocked = false, bonusMins = 0 }) => {
  const remaining = Math.max(0, totalMins - usedMins);
  const pct = totalMins > 0 ? Math.min(1, usedMins / totalMins) : 0;
  const r = (size / 2) - 12;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  const color = isLocked ? '#E24B4A'
    : remaining <= 10 ? '#E24B4A'
    : remaining <= 30 ? '#BA7517'
    : '#1D9E75';

  const hours = Math.floor(remaining / 60);
  const mins  = remaining % 60;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#252540" strokeWidth={8} />
      {/* Bonus arc (lighter) */}
      {bonusMins > 0 && (
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="#7F77DD" strokeWidth={4} strokeOpacity={0.4}
          strokeDasharray={`${circ * (bonusMins / totalMins)} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      )}
      {/* Progress arc */}
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeDasharray={`${circ - dash} ${dash}`}
        strokeLinecap="round"
        strokeDashoffset={0}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 1s ease, stroke 0.5s ease' }}
      />
      {/* Center text */}
      {isLocked ? (
        <text x={size/2} y={size/2 - 4} textAnchor="middle" fontSize={28} fill={color}>🔒</text>
      ) : (
        <>
          <text x={size/2} y={size/2 - 8} textAnchor="middle"
            fontSize={size > 120 ? 24 : 18} fontWeight="800" fill={color}>
            {hours > 0 ? `${hours}h${String(mins).padStart(2,'0')}` : `${mins}m`}
          </text>
          <text x={size/2} y={size/2 + 14} textAnchor="middle" fontSize={11} fill="#888780">
            restantes
          </text>
        </>
      )}
    </svg>
  );
};

// ── ACTIVITY HEATMAP ──────────────────────────────────────────────────────────
// Calendrier de chaleur façon GitHub
export const ActivityHeatmap = ({ data = [], weeks = 12 }) => {
  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (weeks * 7 - 1 - i));
    const key = d.toISOString().split('T')[0];
    const item = data.find(x => x.day === key);
    return { date: d, mins: item?.screen_mins || 0, key };
  });

  const maxMins = Math.max(...days.map(d => d.mins), 1);
  const CELL = 14;
  const GAP  = 2;
  const STEP = CELL + GAP;
  const W = weeks * STEP;
  const H = 7 * STEP + 24;

  const getColor = (mins) => {
    if (mins === 0) return '#1a1a2e';
    const intensity = mins / maxMins;
    if (intensity < 0.25) return '#0F6E56';
    if (intensity < 0.5)  return '#1D9E75';
    if (intensity < 0.75) return '#BA7517';
    return '#E24B4A';
  };

  const weekDays = ['L','M','M','J','V','S','D'];

  return (
    <svg width="100%" viewBox={`0 0 ${W + 24} ${H}`} style={{ overflow: 'visible' }}>
      {weekDays.map((d, i) => (
        <text key={i} x={0} y={i * STEP + CELL - 2} fontSize={9} fill="#888780">{d}</text>
      ))}
      {days.map((day, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        return (
          <rect key={day.key}
            x={24 + col * STEP} y={row * STEP}
            width={CELL} height={CELL} rx={3}
            fill={getColor(day.mins)}
            style={{ cursor: 'pointer' }}
          >
            <title>{day.key}: {Math.round(day.mins)} min</title>
          </rect>
        );
      })}
    </svg>
  );
};

// ── GRADE RADAR CHART ─────────────────────────────────────────────────────────
// Toile d'araignée des matières
export const GradeRadar = ({ grades = [], size = 220 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r  = (size / 2) - 30;
  const n  = grades.length;

  if (n < 3) return null;

  const angle = (i) => (i * 2 * Math.PI / n) - Math.PI / 2;
  const pt = (i, radius) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const toPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';

  const dataPoints = grades.map((g, i) => pt(i, r * (g.grade / g.max_grade)));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid circles */}
      {gridLevels.map(level => (
        <path key={level}
          d={toPath(grades.map((_, i) => pt(i, r * level)))}
          fill="none" stroke="#252540" strokeWidth={0.5}
        />
      ))}
      {/* Axes */}
      {grades.map((_, i) => (
        <line key={i} x1={cx} y1={cy}
          x2={pt(i, r).x} y2={pt(i, r).y}
          stroke="#252540" strokeWidth={0.5}
        />
      ))}
      {/* Data polygon */}
      <path d={toPath(dataPoints)} fill="#7F77DD" fillOpacity={0.25} stroke="#7F77DD" strokeWidth={2} />
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#7F77DD" />
      ))}
      {/* Labels */}
      {grades.map((g, i) => {
        const labelPt = pt(i, r + 16);
        return (
          <text key={i} x={labelPt.x} y={labelPt.y}
            textAnchor="middle" dominantBaseline="central"
            fontSize={10} fill="#888780">
            {g.subject.substring(0, 6)}
          </text>
        );
      })}
    </svg>
  );
};

// ── STREAK BADGE ──────────────────────────────────────────────────────────────
export const StreakBadge = ({ days = 0, size = 64 }) => {
  const isHot = days >= 7;
  const color = days >= 30 ? '#BA7517' : days >= 7 ? '#E24B4A' : '#888780';

  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx={32} cy={32} r={30} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} />
      <text x={32} y={24} textAnchor="middle" fontSize={22}>{days >= 7 ? '🔥' : '⚡'}</text>
      <text x={32} y={42} textAnchor="middle" fontSize={14} fontWeight="800" fill={color}>{days}</text>
      <text x={32} y={54} textAnchor="middle" fontSize={9} fill="#888780">jours</text>
    </svg>
  );
};

// ── LEVEL PROGRESS BAR ────────────────────────────────────────────────────────
export const LevelBar = ({ level = 1, progress = 0, points = 0 }) => {
  const LEVEL_COLORS = ['#888780','#1D9E75','#378ADD','#7F77DD','#BA7517','#E24B4A'];
  const color = LEVEL_COLORS[Math.min(Math.floor(level / 5), LEVEL_COLORS.length - 1)];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>Niveau {level}</span>
        <span style={{ fontSize: 12, color: '#888780' }}>{points} pts</span>
      </div>
      <div style={{ height: 8, background: '#1a1a2e', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: color, borderRadius: 4,
          transition: 'width 1s ease',
        }} />
      </div>
      <div style={{ fontSize: 10, color: '#555', marginTop: 4, textAlign: 'right' }}>
        {progress}% vers niveau {level + 1}
      </div>
    </div>
  );
};

// ── BADGE GRID ────────────────────────────────────────────────────────────────
export const BadgeGrid = ({ earned = [], available = {} }) => {
  const earnedNames = new Set(earned.map(r => r.name));

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
    }}>
      {Object.entries(available).map(([key, badge]) => {
        const isEarned = earnedNames.has(badge.name);
        return (
          <div key={key} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 6px', borderRadius: 12,
            background: isEarned ? '#1a2a1a' : '#13131f',
            border: `1px solid ${isEarned ? '#1D9E7544' : '#252540'}`,
            opacity: isEarned ? 1 : 0.4,
          }}>
            <span style={{ fontSize: 24, marginBottom: 4 }}>{badge.icon}</span>
            <span style={{ fontSize: 9, color: isEarned ? '#ccc' : '#666', textAlign: 'center', lineHeight: 1.3 }}>
              {badge.name}
            </span>
            {badge.points > 0 && (
              <span style={{ fontSize: 9, color: '#7F77DD', marginTop: 2 }}>+{badge.points}pts</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── QUOTA MINI CARD ───────────────────────────────────────────────────────────
export const QuotaMiniCard = ({ child, onClick }) => {
  const total = Math.max(1, (child.base_limit || 120) + (child.bonus_mins || 0) - (child.penalty_mins || 0));
  const used  = child.used_mins_today || 0;
  const rem   = Math.max(0, total - used);
  const pct   = Math.min(100, Math.round((used / total) * 100));
  const color = child.is_locked ? '#E24B4A' : rem <= 15 ? '#E24B4A' : rem <= 30 ? '#BA7517' : '#1D9E75';
  const isOnline = child.last_seen && (Date.now() - new Date(child.last_seen)) < 300000;

  return (
    <div onClick={onClick} style={{
      background: '#13131f', borderRadius: 16, padding: 16,
      border: `1px solid ${child.is_locked ? '#E24B4A44' : '#252540'}`,
      cursor: 'pointer', transition: 'border-color .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20,
          background: child.avatar_color || '#7F77DD',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#fff', position: 'relative',
        }}>
          {child.first_name.charAt(0)}
          {isOnline && (
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 10, height: 10, borderRadius: 5,
              background: '#1D9E75', border: '2px solid #13131f',
            }} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{child.first_name}</div>
          <div style={{ fontSize: 11, color: '#888' }}>
            {child.is_locked ? '🔒 Bloqué' : isOnline ? '● En ligne' : '○ Hors ligne'}
          </div>
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700, color,
          background: color + '22', borderRadius: 8,
          padding: '3px 8px',
        }}>
          {rem}m
        </div>
      </div>
      {/* Mini progress */}
      <div style={{ height: 5, background: '#252540', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .5s' }} />
      </div>
    </div>
  );
};

// ── ANIMATED BLOCKING OVERLAY (pour app React Native) ────────────────────────
// Rendu comme composant React Native
export const BlockingOverlayData = {
  // Ces données sont utilisées par le composant React Native natif
  messages: {
    quota: (name) => `⏰ ${name} a utilisé tout son temps d'écran pour aujourd'hui !`,
    locked: (reason) => `🔒 ${reason || 'Accès restreint par un parent'}`,
    blocked_app: (appName) => `🚫 ${appName} est bloquée par tes parents.`,
    bedtime: `🌙 C'est l'heure de dormir ! À demain !`,
  },
  primaryCTA: 'Parler à Guardian →',
  secondaryCTA: 'Faire un quiz pour gagner du temps',
};

// ── WEEK CALENDAR ─────────────────────────────────────────────────────────────
// Vue semaine interactive pour planifier les règles
export const WeekCalendar = ({ rules = {}, onSlotChange }) => {
  const hours  = Array.from({ length: 18 }, (_, i) => i + 6); // 6h → 23h
  const days   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const TYPES  = {
    free:    { label: 'Libre',   color: '#1D9E7544', border: '#1D9E75' },
    limited: { label: 'Limité', color: '#BA751744', border: '#BA7517' },
    blocked: { label: 'Bloqué', color: '#E24B4A44', border: '#E24B4A' },
    school:  { label: 'École',  color: '#378ADD44', border: '#378ADD' },
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)', minWidth: 500, gap: 2 }}>
        {/* Header */}
        <div />
        {days.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#888', padding: '4px 0' }}>
            {d}
          </div>
        ))}
        {/* Time slots */}
        {hours.map(h => (
          <React.Fragment key={h}>
            <div style={{ fontSize: 10, color: '#555', textAlign: 'right', paddingRight: 6, paddingTop: 4 }}>
              {h}h
            </div>
            {days.map((_, dayIdx) => {
              const key = `${dayIdx}-${h}`;
              const type = rules[key] || 'free';
              const cfg  = TYPES[type];
              return (
                <div key={key}
                  onClick={() => {
                    const nextTypes = Object.keys(TYPES);
                    const next = nextTypes[(nextTypes.indexOf(type) + 1) % nextTypes.length];
                    onSlotChange?.(dayIdx, h, next);
                  }}
                  style={{
                    height: 20, borderRadius: 3, cursor: 'pointer',
                    background: cfg.color, border: `1px solid ${cfg.border}`,
                    transition: 'background .15s',
                  }}
                  title={cfg.label}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {/* Légende */}
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.entries(TYPES).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: cfg.color, border: `1px solid ${cfg.border}` }} />
            <span style={{ color: '#888' }}>{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── MOOD INDICATOR ────────────────────────────────────────────────────────────
export const MoodIndicator = ({ mood, size = 32 }) => {
  const moods = {
    happy:   { emoji: '😊', color: '#1D9E75', label: 'Content' },
    neutral: { emoji: '😐', color: '#888780', label: 'Neutre' },
    sad:     { emoji: '😔', color: '#378ADD', label: 'Triste' },
    angry:   { emoji: '😠', color: '#E24B4A', label: 'Frustré' },
    excited: { emoji: '🤩', color: '#BA7517', label: 'Excité' },
  };
  const m = moods[mood] || moods.neutral;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: size }}>{m.emoji}</span>
      <span style={{ fontSize: size * 0.4, color: m.color, fontWeight: 700 }}>{m.label}</span>
    </div>
  );
};

export default {
  TimeRing, ActivityHeatmap, GradeRadar, StreakBadge,
  LevelBar, BadgeGrid, QuotaMiniCard, WeekCalendar, MoodIndicator,
  tokens,
};
