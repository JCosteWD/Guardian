import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  Animated, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../services/api';

// ── LEVEL RING ─────────────────────────────────────────────────────────────────
const LevelRing = ({ level, progress, color }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const SIZE = 100, R = 40, CIRC = 2 * Math.PI * R;

  useEffect(() => {
    Animated.timing(anim, { toValue: progress / 100, duration: 1200, useNativeDriver: false }).start();
  }, [progress]);

  const dash = anim.interpolate({ inputRange: [0, 1], outputRange: [`0 ${CIRC}`, `${CIRC} 0`] });

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute' }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="#1a1a2e" strokeWidth={8} />
      </svg>
      <Animated.View style={{ position: 'absolute', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none"
            stroke={color} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={`${CIRC * progress / 100} ${CIRC * (1 - progress / 100)}`}
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
          />
        </svg>
      </Animated.View>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{level}</Text>
        <Text style={{ color: '#888', fontSize: 9 }}>LEVEL</Text>
      </View>
    </View>
  );
};

// ── BADGE ITEM ─────────────────────────────────────────────────────────────────
const BadgeItem = ({ badge, earned, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(earned ? 1 : 0.9)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (earned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [earned]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.05, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onPress?.(badge));
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity onPress={handlePress} style={[
        styles.badgeItem,
        earned ? styles.badgeEarned : styles.badgeLocked,
        earned && { borderColor: '#7F77DD55' },
      ]}>
        <Animated.View style={[
          styles.badgeGlow,
          earned && { opacity: glowAnim.interpolate({ inputRange: [0,1], outputRange: [0, 0.3] }) }
        ]} />
        <Text style={[styles.badgeEmoji, !earned && { opacity: 0.3 }]}>{badge.icon}</Text>
        <Text style={[styles.badgeName, !earned && { color: '#444' }]} numberOfLines={2}>
          {badge.name}
        </Text>
        {badge.points > 0 && earned && (
          <Text style={styles.badgePoints}>+{badge.points}pts</Text>
        )}
        {!earned && <Text style={styles.badgeLockIcon}>🔒</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── STREAK FLAME ───────────────────────────────────────────────────────────────
const StreakFlame = ({ days }) => {
  const flameAnim = useRef(new Animated.Value(1)).current;
  const color     = days >= 30 ? '#BA7517' : days >= 7 ? '#E24B4A' : days >= 3 ? '#D85A30' : '#888780';

  useEffect(() => {
    if (days >= 3) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flameAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(flameAnim, { toValue: 0.95, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [days]);

  return (
    <Animated.View style={[styles.streakWrap, { transform: [{ scale: flameAnim }] }]}>
      <LinearGradient colors={[color + '22', color + '08']} style={styles.streakBg}>
        <Text style={{ fontSize: 36 }}>{days >= 7 ? '🔥' : '⚡'}</Text>
        <Text style={[styles.streakDays, { color }]}>{days}</Text>
        <Text style={styles.streakLabel}>jours d'affilée</Text>
      </LinearGradient>
    </Animated.View>
  );
};

// ── MAIN SCREEN ────────────────────────────────────────────────────────────────
export default function RewardsScreen({ navigation, route }) {
  const { child } = route?.params || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const modalAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadRewards(); }, []);

  const loadRewards = async () => {
    try {
      const { data: rewards } = await api.get(`/children/${child?.id || 'me'}/rewards`);
      setData(rewards);
    } catch (err) { console.warn('Rewards load failed:', err); }
    finally { setLoading(false); }
  };

  const showBadgeDetail = (badge) => {
    setSelectedBadge(badge);
    Animated.spring(modalAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
  };

  const hideBadgeDetail = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSelectedBadge(null));
  };

  const LEVEL_COLORS = ['#888780', '#1D9E75', '#378ADD', '#7F77DD', '#BA7517', '#E24B4A'];
  const levelColor = data ? LEVEL_COLORS[Math.min(Math.floor(data.stats.current_level / 5), LEVEL_COLORS.length - 1)] : '#888';

  if (loading) return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={styles.center}>
      <ActivityIndicator color="#7F77DD" size="large" />
    </LinearGradient>
  );

  const earnedNames = new Set((data?.recentRewards || []).filter(r => r.type === 'badge').map(r => r.name));
  const allBadges   = Object.values(data?.availableBadges || {});

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <LinearGradient colors={['#1a1a2e', '#0f0f1a']} style={styles.header}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes récompenses</Text>

          {/* Stats top row */}
          <View style={styles.topStats}>
            {/* Level ring */}
            <LevelRing
              level={data?.stats?.current_level || 1}
              progress={data?.stats?.levelProgress || 0}
              color={levelColor}
            />

            <View style={styles.topStatsRight}>
              <View style={styles.statPill}>
                <Text style={styles.statPillVal}>{data?.stats?.total_points || 0}</Text>
                <Text style={styles.statPillLabel}>points</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillVal}>{data?.stats?.quizzes_passed || 0}</Text>
                <Text style={styles.statPillLabel}>quiz réussis</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillVal}>{data?.stats?.bonus_time_earned_mins || 0}m</Text>
                <Text style={styles.statPillLabel}>bonus gagnés</Text>
              </View>
            </View>
          </View>

          {/* Progress to next level */}
          <View style={styles.levelProgress}>
            <Text style={styles.levelProgressLabel}>
              Niveau {data?.stats?.current_level || 1} → {(data?.stats?.current_level || 1) + 1}
            </Text>
            <View style={styles.levelBar}>
              <Animated.View style={[
                styles.levelBarFill,
                { width: `${data?.stats?.levelProgress || 0}%`, backgroundColor: levelColor }
              ]} />
            </View>
            <Text style={styles.levelProgressPct}>{data?.stats?.levelProgress || 0}%</Text>
          </View>
        </LinearGradient>

        {/* Streak */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔥 Streak</Text>
          <View style={styles.streakRow}>
            <StreakFlame days={data?.stats?.current_streak_days || 0} />
            <View style={styles.streakInfo}>
              <Text style={styles.streakBest}>Record : {data?.stats?.longest_streak_days || 0} jours</Text>
              <Text style={styles.streakTip}>
                {data?.stats?.current_streak_days >= 7
                  ? '🔥 Impressionnant ! Continue comme ça !'
                  : 'Connecte-toi chaque jour pour maintenir ton streak !'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏅 Badges</Text>
            <Text style={styles.sectionCount}>{earnedNames.size}/{allBadges.length}</Text>
          </View>
          <View style={styles.badgeGrid}>
            {allBadges.map((badge, i) => (
              <BadgeItem
                key={i}
                badge={badge}
                earned={earnedNames.has(badge.name)}
                onPress={showBadgeDetail}
              />
            ))}
          </View>
        </View>

        {/* Historique des gains */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📜 Historique récent</Text>
          {(data?.recentRewards || []).slice(0, 10).map((r, i) => (
            <View key={i} style={styles.historyRow}>
              <Text style={styles.historyIcon}>
                {r.type === 'badge' ? '🏅' : r.type === 'points' ? '⭐' : '🏆'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyName}>{r.name}</Text>
                <Text style={styles.historyTime}>
                  {new Date(r.earned_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                </Text>
              </View>
              {r.points_value > 0 && (
                <Text style={styles.historyPoints}>+{r.points_value} pts</Text>
              )}
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Badge detail modal */}
      {selectedBadge && (
        <Animated.View style={[
          styles.modalOverlay,
          { opacity: modalAnim }
        ]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={hideBadgeDetail} />
          <Animated.View style={[
            styles.modal,
            { transform: [{ scale: modalAnim.interpolate({ inputRange:[0,1], outputRange:[0.8,1] }) }] }
          ]}>
            <Text style={styles.modalEmoji}>{selectedBadge.icon}</Text>
            <Text style={styles.modalName}>{selectedBadge.name}</Text>
            <Text style={styles.modalDesc}>{selectedBadge.desc}</Text>
            {selectedBadge.points > 0 && (
              <View style={styles.modalPoints}>
                <Text style={styles.modalPointsText}>⭐ +{selectedBadge.points} points</Text>
              </View>
            )}
            <TouchableOpacity style={styles.modalClose} onPress={hideBadgeDetail}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { padding: 24, paddingTop: 56, paddingBottom: 28 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#7F77DD', fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 20 },

  topStats: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
  topStatsRight: { flex: 1, gap: 10 },
  statPill: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  statPillVal: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statPillLabel: { color: '#888', fontSize: 11 },

  levelProgress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelProgressLabel: { color: '#888', fontSize: 12, width: 90 },
  levelBar: { flex: 1, height: 7, backgroundColor: '#1a1a2e', borderRadius: 4, overflow: 'hidden' },
  levelBarFill: { height: '100%', borderRadius: 4 },
  levelProgressPct: { color: '#888', fontSize: 11, width: 30, textAlign: 'right' },

  section: { padding: 20, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 14 },
  sectionCount: { color: '#7F77DD', fontSize: 13, fontWeight: '700' },

  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streakWrap: { alignItems: 'center' },
  streakBg: { borderRadius: 16, padding: 16, alignItems: 'center', minWidth: 100 },
  streakDays: { fontSize: 28, fontWeight: '900', marginTop: 2 },
  streakLabel: { color: '#888', fontSize: 10, marginTop: 2 },
  streakInfo: { flex: 1 },
  streakBest: { color: '#ccc', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  streakTip: { color: '#888', fontSize: 12, lineHeight: 18 },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: { width: 76, borderRadius: 14, padding: 10, alignItems: 'center', gap: 4, position: 'relative', overflow: 'hidden' },
  badgeEarned: { backgroundColor: '#1a1a2e', borderWidth: 1 },
  badgeLocked: { backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#252540' },
  badgeGlow: { position: 'absolute', inset: 0, backgroundColor: '#7F77DD' },
  badgeEmoji: { fontSize: 26 },
  badgeName: { color: '#ccc', fontSize: 9, textAlign: 'center', lineHeight: 13 },
  badgePoints: { color: '#7F77DD', fontSize: 9, fontWeight: '700' },
  badgeLockIcon: { position: 'absolute', top: 4, right: 4, fontSize: 10 },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2e',
  },
  historyIcon: { fontSize: 20 },
  historyName: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  historyTime: { color: '#555', fontSize: 11, marginTop: 2 },
  historyPoints: { color: '#7F77DD', fontSize: 12, fontWeight: '800' },

  modalOverlay: {
    position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modal: { backgroundColor: '#13131f', borderRadius: 24, padding: 28, alignItems: 'center', width: '80%', borderWidth: 1, borderColor: '#7F77DD44' },
  modalEmoji: { fontSize: 56, marginBottom: 12 },
  modalName: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalDesc: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  modalPoints: { backgroundColor: '#7F77DD22', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 20 },
  modalPointsText: { color: '#7F77DD', fontWeight: '700' },
  modalClose: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  modalCloseText: { color: '#888', fontWeight: '700' },
});
