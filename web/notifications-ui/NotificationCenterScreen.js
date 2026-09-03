import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, RefreshControl, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useApp, api } from '../App';

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Centre de notifications
// ══════════════════════════════════════════════════════════════════════════════

const NOTIF_CONFIG = {
  quota_warning:  { icon: '⏰', color: '#BA7517', bg: '#BA751722', label: 'Quota faible',          priority: 2 },
  quota_reached:  { icon: '🔴', color: '#E24B4A', bg: '#E24B4A22', label: 'Quota épuisé',          priority: 3 },
  tamper_attempt: { icon: '🚨', color: '#E24B4A', bg: '#E24B4A22', label: 'Tentative de contournement', priority: 4 },
  app_blocked:    { icon: '🚫', color: '#BA7517', bg: '#BA751722', label: 'App bloquée',            priority: 1 },
  url_blocked:    { icon: '🌐', color: '#378ADD', bg: '#378ADD22', label: 'URL bloquée',            priority: 1 },
  grade_added:    { icon: '📝', color: '#7F77DD', bg: '#7F77DD22', label: 'Nouvelle note',          priority: 2 },
  quiz_completed: { icon: '🏆', color: '#1D9E75', bg: '#1D9E7522', label: 'Quiz complété',          priority: 2 },
  zone_enter:     { icon: '📍', color: '#1D9E75', bg: '#1D9E7522', label: 'Arrivée en zone',        priority: 2 },
  zone_exit:      { icon: '📍', color: '#BA7517', bg: '#BA751722', label: 'Départ de zone',         priority: 2 },
  child_message:  { icon: '💬', color: '#7F77DD', bg: '#7F77DD22', label: 'Message de votre enfant', priority: 3 },
  distress_alert: { icon: '❤️', color: '#E24B4A', bg: '#E24B4A22', label: 'Alerte bien-être',       priority: 4 },
  weekly_report:  { icon: '📊', color: '#7F77DD', bg: '#7F77DD22', label: 'Rapport hebdomadaire',   priority: 1 },
  badge_earned:   { icon: '🏅', color: '#BA7517', bg: '#BA751722', label: 'Badge obtenu',           priority: 1 },
};

// ── NOTIFICATION ITEM ─────────────────────────────────────────────────────────
const NotifItem = ({ notif, onPress, onDismiss }) => {
  const cfg = NOTIF_CONFIG[notif.type] || { icon: '📌', color: '#888', bg: '#88888822', label: 'Notification' };
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isNew = !notif.read_at;

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -60, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss(notif.id));
  };

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)    return 'À l\'instant';
    if (mins < 60)   return `Il y a ${mins} min`;
    if (hours < 24)  return `Il y a ${hours}h`;
    if (days === 1)  return 'Hier';
    return `Il y a ${days} jours`;
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
      <TouchableOpacity
        style={[
          styles.notifItem,
          { borderColor: cfg.color + '33' },
          isNew && { borderLeftWidth: 3, borderLeftColor: cfg.color },
        ]}
        onPress={() => onPress(notif)}
        activeOpacity={0.8}
      >
        <View style={[styles.notifIconWrap, { backgroundColor: cfg.bg }]}>
          <Text style={styles.notifIcon}>{cfg.icon}</Text>
          {notif.priority >= 3 && <View style={styles.urgentDot} />}
        </View>

        <View style={styles.notifContent}>
          <View style={styles.notifTop}>
            <Text style={[styles.notifType, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
          </View>
          <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
          <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
          {notif.child_name && (
            <Text style={styles.notifChild}>👤 {notif.child_name}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.notifDismiss} onPress={handleDismiss}>
          <Text style={styles.notifDismissText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── FILTER BAR ────────────────────────────────────────────────────────────────
const FilterBar = ({ active, onChange }) => {
  const FILTERS = [
    { key: 'all',      label: 'Tout',      icon: '🔔' },
    { key: 'urgent',   label: 'Urgent',    icon: '🚨' },
    { key: 'activity', label: 'Activité',  icon: '📱' },
    { key: 'grades',   label: 'Notes',     icon: '📝' },
    { key: 'rewards',  label: 'Récomp.',   icon: '🏆' },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
      {FILTERS.map(f => (
        <TouchableOpacity
          key={f.key}
          style={[styles.filterChip, active === f.key && styles.filterChipActive]}
          onPress={() => onChange(f.key)}
        >
          <Text style={styles.filterIcon}>{f.icon}</Text>
          <Text style={[styles.filterLabel, active === f.key && styles.filterLabelActive]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function NotificationCenterScreen({ navigation }) {
  const { notifications: liveNotifs, socket } = useApp();
  const [notifs, setNotifs]       = useState([]);
  const [filter, setFilter]       = useState('all');
  const [unread, setUnread]       = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const bellAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadNotifications();
    // Anime la cloche si nouvelles notifs
    if (liveNotifs.length > 0) ringBell();
  }, [liveNotifs.length]);

  // Mise à jour en temps réel via WebSocket
  useEffect(() => {
    if (!socket) return;
    const events = ['quota_warning', 'tamper_attempt', 'distress_alert', 'child_message', 'zone_enter'];
    events.forEach(evt => {
      socket.on(evt, (data) => {
        setNotifs(prev => [{
          id: Date.now().toString(),
          type: evt,
          title: data.title || evt,
          body: data.body || JSON.stringify(data),
          child_name: data.childName,
          child_id: data.childId,
          priority: NOTIF_CONFIG[evt]?.priority || 1,
          created_at: new Date(),
          read_at: null,
        }, ...prev]);
        setUnread(u => u + 1);
        ringBell();
      });
    });
    return () => events.forEach(evt => socket.off(evt));
  }, [socket]);

  const ringBell = () => {
    Animated.sequence([
      Animated.timing(bellAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 100, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const loadNotifications = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get('/notifications?limit=50');
      setNotifs(data.notifications || []);
      setUnread(data.notifications?.filter(n => !n.read_at).length || 0);
    } catch {
      // Utilise les notifs live si l'API échoue
      setNotifs(liveNotifs.map((n, i) => ({ ...n, id: i.toString() })));
    } finally {
      setRefreshing(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, read_at: new Date() })));
      setUnread(0);
    } catch {}
  };

  const handleDismiss = async (id) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    await api.delete(`/notifications/${id}`).catch(() => {});
  };

  const handlePress = (notif) => {
    // Mark as read
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date() } : n));
    setUnread(u => Math.max(0, u - 1));
    api.post(`/notifications/${notif.id}/read`).catch(() => {});

    // Navigate based on type
    if (['quota_warning', 'quota_reached', 'tamper_attempt', 'app_blocked', 'url_blocked'].includes(notif.type) && notif.child_id) {
      navigation.navigate('ChildDetails', { childId: notif.child_id });
    } else if (notif.type === 'distress_alert' && notif.child_id) {
      navigation.navigate('ChildDetails', { childId: notif.child_id });
    } else if (notif.type === 'weekly_report' && notif.child_id) {
      navigation.navigate('WeeklyReport', { childId: notif.child_id });
    } else if (notif.type === 'child_message') {
      Alert.alert(
        `💬 Message de ${notif.child_name || 'votre enfant'}`,
        notif.body,
        [{ text: 'OK' }]
      );
    }
  };

  // Filtrage
  const FILTER_TYPES = {
    urgent:   ['tamper_attempt', 'distress_alert', 'quota_reached'],
    activity: ['app_blocked', 'url_blocked', 'quota_warning', 'zone_enter', 'zone_exit'],
    grades:   ['grade_added'],
    rewards:  ['quiz_completed', 'badge_earned', 'weekly_report'],
  };

  const filteredNotifs = notifs.filter(n => {
    if (filter === 'all') return true;
    return FILTER_TYPES[filter]?.includes(n.type) || false;
  });

  const bellRotate = bellAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] });

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadNotifications} tintColor="#7F77DD" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Retour</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Animated.Text style={[styles.bellIcon, { transform: [{ rotate: bellRotate }] }]}>
              🔔
            </Animated.Text>
            <Text style={styles.title}>Alertes</Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
          {unread > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={styles.markRead}>Tout lire</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats rapides */}
        <View style={styles.statsRow}>
          {[
            { label: 'Non lues', value: unread, color: '#E24B4A' },
            { label: 'Total', value: notifs.length, color: '#7F77DD' },
            { label: 'Urgentes', value: notifs.filter(n => (NOTIF_CONFIG[n.type]?.priority || 0) >= 3).length, color: '#BA7517' },
          ].map((s, i) => (
            <View key={i} style={styles.statPill}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Filter bar */}
        <FilterBar active={filter} onChange={setFilter} />

        {/* Notifications */}
        {filteredNotifs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>🔕</Text>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'Aucune notification' : `Aucune notification dans cette catégorie`}
            </Text>
            <Text style={styles.emptySub}>
              Les alertes Guardian apparaîtront ici en temps réel.
            </Text>
          </View>
        ) : (
          <>
            {/* Urgent en tête */}
            {filteredNotifs.filter(n => (NOTIF_CONFIG[n.type]?.priority || 0) >= 3).length > 0 && filter === 'all' && (
              <>
                <Text style={styles.sectionLabel}>🚨 À traiter en priorité</Text>
                {filteredNotifs
                  .filter(n => (NOTIF_CONFIG[n.type]?.priority || 0) >= 3)
                  .map(n => <NotifItem key={n.id} notif={n} onPress={handlePress} onDismiss={handleDismiss} />)
                }
                <Text style={styles.sectionLabel}>📋 Autres</Text>
              </>
            )}

            {filteredNotifs
              .filter(n => filter !== 'all' || (NOTIF_CONFIG[n.type]?.priority || 0) < 3)
              .map(n => <NotifItem key={n.id} notif={n} onPress={handlePress} onDismiss={handleDismiss} />)
            }
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  back: { color: '#7F77DD', fontWeight: '600', fontSize: 14 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellIcon: { fontSize: 22 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  badge: { backgroundColor: '#E24B4A', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  markRead: { color: '#7F77DD', fontSize: 13, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statPill: { flex: 1, backgroundColor: '#13131f', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#252540' },
  statVal: { fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 2 },

  filterBar: { marginBottom: 20 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#13131f', borderWidth: 1, borderColor: '#252540', marginRight: 8 },
  filterChipActive: { borderColor: '#7F77DD', backgroundColor: '#7F77DD18' },
  filterIcon: { fontSize: 14 },
  filterLabel: { color: '#888', fontWeight: '600', fontSize: 12 },
  filterLabelActive: { color: '#7F77DD' },

  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#13131f', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
  notifIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifIcon: { fontSize: 22 },
  urgentDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E24B4A', borderWidth: 1.5, borderColor: '#13131f' },
  notifContent: { flex: 1 },
  notifTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  notifType: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  notifTime: { color: '#555', fontSize: 10 },
  notifTitle: { color: '#fff', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  notifBody: { color: '#888', fontSize: 12, lineHeight: 18 },
  notifChild: { color: '#555', fontSize: 11, marginTop: 4 },
  notifDismiss: { padding: 4 },
  notifDismissText: { color: '#444', fontSize: 16 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { color: '#888', fontSize: 17, fontWeight: '700' },
  emptySub: { color: '#555', fontSize: 13, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
});
