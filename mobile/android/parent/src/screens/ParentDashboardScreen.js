import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, Alert, Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../services/api';
import { ChildCard } from '../components/ChildCard';
import { GradeQuickInput } from '../components/GradeQuickInput';
import { FeedbackToast } from '../components/FeedbackToast';

export default function ParentDashboardScreen({ navigation }) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gradeChild, setGradeChild] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const feedbackAnim = useRef(new Animated.Value(0)).current;

  const showFeedback = (msg, success = true) => {
    setActionFeedback({ msg, success });
    Animated.sequence([
      Animated.timing(feedbackAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const loadChildren = useCallback(async () => {
    try {
      const { data } = await api.get('/children');
      setChildren(data.children);
    } catch (err) {
      console.error('Failed to load children:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadChildren(); }, []);

  const handleQuickAction = async (child, action) => {
    try {
      const payload = {};
      if (action.timeDelta) payload.customDelta = action.timeDelta;
      if (action.lock !== undefined) payload.customLock = action.lock;
      if (action.blockAll) {
        payload.customDelta = -999;
        payload.customLock = true;
        payload.lockReason = '📚 Mode devoirs activé par un parent';
      }

      await api.post(`/children/${child.id}/quick-action`, {
        ...payload,
        childName: child.first_name,
      });

      showFeedback(`✅ ${action.label} appliqué à ${child.first_name}`);
      loadChildren();
    } catch (err) {
      showFeedback('❌ Erreur lors de l\'action', false);
    }
  };

  const handleGradeSubmit = async (childId, subject, grade) => {
    try {
      const { data } = await api.post(`/children/${childId}/grades`, {
        subject, grade, maxGrade: 20, gradeDate: new Date(),
      });

      setGradeChild(null);

      const msg = data.penaltyMins > 0
        ? `📉 ${grade}/20 en ${subject} → -${data.penaltyMins} min pour ${gradeChild.first_name}`
        : data.bonusMins > 0
        ? `⭐ ${grade}/20 en ${subject} → +${data.bonusMins} min bonus !`
        : `📝 Note de ${grade}/20 en ${subject} enregistrée`;

      showFeedback(msg, data.bonusMins > 0);
      loadChildren();
    } catch (err) {
      showFeedback('❌ Erreur lors de la saisie', false);
    }
  };

  return (
    <LinearGradient colors={['#0f0f1a', '#1a1a2e']} style={styles.container}>
      <FeedbackToast message={actionFeedback?.msg} success={actionFeedback?.success} opacity={feedbackAnim} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          loadChildren();
        }} tintColor="#6C63FF" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Tableau de bord</Text>
            <Text style={styles.headerSub}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.globalActions}>
          <TouchableOpacity style={styles.globalBtn} onPress={() => setGradeChild(children[0])}>
            <Text style={styles.globalBtnIcon}>📝</Text>
            <Text style={styles.globalBtnText}>Saisir une note</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.globalBtn} onPress={() => navigation.navigate('AddChild')}>
            <Text style={styles.globalBtnIcon}>➕</Text>
            <Text style={styles.globalBtnText}>Ajouter un enfant</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <Text style={styles.loaderText}>Chargement...</Text>
          </View>
        ) : children.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👶</Text>
            <Text style={styles.emptyTitle}>Aucun enfant configuré</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddChild')}>
              <Text style={styles.emptyBtnText}>Ajouter mon premier enfant</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              {children.length} enfant{children.length > 1 ? 's' : ''}
            </Text>
            {children.map(child => (
              <ChildCard
                key={child.id}
                child={child}
                onQuickAction={handleQuickAction}
                onViewDetails={(c) => navigation.navigate('ChildDetails', { child: c })}
              />
            ))}
          </>
        )}

        {gradeChild && (
          <View style={styles.modalOverlay}>
            <GradeQuickInput
              child={gradeChild}
              onSubmit={handleGradeSubmit}
              onClose={() => setGradeChild(null)}
            />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: '#888', fontSize: 14, marginTop: 4, textTransform: 'capitalize' },
  settingsBtn: { padding: 8 },
  settingsIcon: { fontSize: 26 },
  globalActions: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 20,
  },
  globalBtn: {
    flex: 1, backgroundColor: '#1e2040', borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  globalBtnIcon: { fontSize: 28, marginBottom: 6 },
  globalBtnText: { color: '#aaa', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  sectionTitle: {
    color: '#666', fontSize: 12, fontWeight: '700',
    paddingHorizontal: 24, marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  loader: { padding: 40, alignItems: 'center' },
  loaderText: { color: '#666', fontSize: 16 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: '#888', fontSize: 18, marginBottom: 20 },
  emptyBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center',
  },
});
