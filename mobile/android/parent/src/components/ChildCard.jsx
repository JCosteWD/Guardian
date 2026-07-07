import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function ChildCard({ child, onQuickAction, onViewDetails }) {
  const remaining = Math.max(0,
    (child.base_limit || 120) + (child.bonus_mins || 0) - (child.penalty_mins || 0) - (child.used_mins_today || 0)
  );
  const total = (child.base_limit || 120) + (child.bonus_mins || 0) - (child.penalty_mins || 0);
  const progress = total > 0 ? Math.min(1, (child.used_mins_today || 0) / total) : 0;

  const statusColor = child.is_locked ? '#FF4757'
    : remaining <= 15 ? '#FF6B6B'
    : remaining <= 30 ? '#FFD93D'
    : '#51CF66';

  const isOnline = child.last_seen &&
    (new Date() - new Date(child.last_seen)) < 300000;

  return (
    <View style={styles.childCard}>
      <View style={styles.childCardHeader}>
        <View style={[styles.childAvatar, { backgroundColor: child.avatar_color || '#6C63FF' }]}>
          <Text style={styles.childAvatarText}>
            {child.first_name.charAt(0).toUpperCase()}
          </Text>
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.childInfo}>
          <Text style={styles.childName}>{child.first_name}</Text>
          <Text style={styles.childStatus}>
            {child.is_locked ? '🔒 Accès bloqué'
              : isOnline ? '📱 En ligne'
              : '💤 Hors ligne'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => onViewDetails(child)}
        >
          <Text style={styles.detailsBtnText}>Détails →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressBar}>
        <View style={[
          styles.progressFill,
          { width: `${Math.round(progress * 100)}%`, backgroundColor: statusColor }
        ]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.progressLabel}>
          {child.used_mins_today || 0} min utilisées
        </Text>
        <Text style={[styles.progressLabel, { color: statusColor, fontWeight: '700' }]}>
          {remaining} min restantes
        </Text>
      </View>

      <View style={styles.quickActions}>
        <QuickActionBtn icon="📉" label="-30 min" color="#FF6B6B"
          onPress={() => onQuickAction(child, { timeDelta: -30, label: '-30 min' })} />
        <QuickActionBtn icon="📈" label="+30 min" color="#51CF66"
          onPress={() => onQuickAction(child, { timeDelta: 30, label: '+30 min' })} />
        <QuickActionBtn icon="📚" label="Devoirs" color="#4C6EF5"
          onPress={() => onQuickAction(child, { blockAll: true, label: 'Mode devoirs' })} />
        <QuickActionBtn icon={child.is_locked ? '🔓' : '🔒'}
          label={child.is_locked ? 'Déverrouiller' : 'Bloquer'}
          color={child.is_locked ? '#51CF66' : '#FF4757'}
          onPress={() => onQuickAction(child, {
            lock: !child.is_locked,
            label: child.is_locked ? 'Déverrouillé' : 'Bloqué',
          })} />
      </View>
    </View>
  );
}

function QuickActionBtn({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.qaBtn} onPress={onPress}>
      <View style={[styles.qaBtnInner, { backgroundColor: color + '22' }]}>
        <Text style={styles.qaBtnIcon}>{icon}</Text>
      </View>
      <Text style={[styles.qaBtnLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  childCard: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1e2040',
    borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#2a2a4a',
  },
  childCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  childAvatar: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
  },
  childAvatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#51CF66', borderWidth: 2, borderColor: '#1e2040',
  },
  childInfo: { flex: 1, marginLeft: 14 },
  childName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  childStatus: { color: '#888', fontSize: 13, marginTop: 2 },
  detailsBtn: { padding: 8 },
  detailsBtnText: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  progressBar: {
    height: 8, backgroundColor: '#2a2a4a', borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabels: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 16,
  },
  progressLabel: { color: '#888', fontSize: 12 },
  quickActions: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  qaBtn: { alignItems: 'center', flex: 1 },
  qaBtnInner: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  qaBtnIcon: { fontSize: 22 },
  qaBtnLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
