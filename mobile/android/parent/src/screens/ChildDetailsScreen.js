import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  StyleSheet, TextInput, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import api from '../services/api';
import { SectionCard } from '../components/SectionCard';
import { TimeSelector } from '../components/TimeSelector';
import { StatBox } from '../components/StatBox';
import { CategoryToggle } from '../components/CategoryToggle';

export default function ChildDetailsScreen({ route, navigation }) {
  const { child } = route.params;

  const [screenTime, setScreenTime] = useState({
    dailyLimitMins: 120,
    weekendLimitMins: 180,
    bedtimeStart: '21:00',
    bedtimeEnd: '07:00',
    schoolModeEnabled: false,
  });
  const [categories, setCategories] = useState({});
  const [dashboard, setDashboard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [dash, rules, urlRules] = await Promise.all([
        api.get(`/children/${child.id}/dashboard`),
        api.get(`/children/${child.id}/rules/screen-time`),
        api.get(`/children/${child.id}/rules/urls`),
      ]);

      setDashboard(dash.data);

      if (rules.data.rules[0]) {
        const r = rules.data.rules[0];
        setScreenTime({
          dailyLimitMins: r.daily_limit_mins,
          weekendLimitMins: r.weekend_limit_mins || 180,
          bedtimeStart: r.bedtime_start || '21:00',
          bedtimeEnd: r.bedtime_end || '07:00',
          schoolModeEnabled: r.school_mode_enabled || false,
        });
      }

      const catMap = {};
      urlRules.data.categories.forEach(c => { catMap[c.category_name] = c.is_blocked; });
      setCategories(catMap);
    } catch (err) {
      console.error('Load failed:', err);
    }
  };

  const saveScreenTime = async () => {
    setSaving(true);
    try {
      await api.patch(`/children/${child.id}/rules/screen-time`, {
        dailyLimitMins: screenTime.dailyLimitMins,
        weekendLimitMins: screenTime.weekendLimitMins,
        bedtimeStart: screenTime.bedtimeStart,
        bedtimeEnd: screenTime.bedtimeEnd,
        schoolModeEnabled: screenTime.schoolModeEnabled,
      });
      Alert.alert('✅ Sauvegardé', 'Les règles de temps d\'écran ont été mises à jour.');
    } catch (err) {
      Alert.alert('Erreur', 'La sauvegarde a échoué.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = async (key, value) => {
    setCategories(prev => ({ ...prev, [key]: value }));
    try {
      await api.patch(`/children/${child.id}/rules/categories`, {
        categoryName: key, isBlocked: value,
      });
    } catch (err) {
      setCategories(prev => ({ ...prev, [key]: !value }));
    }
  };

  const addBlockedUrl = async () => {
    if (!newUrl.trim()) return;
    try {
      await api.post(`/children/${child.id}/rules/urls`, {
        domain: newUrl.trim(), isBlocked: true,
      });
      setNewUrl('');
      Alert.alert('✅', `${newUrl} ajouté aux sites bloqués.`);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'ajouter ce domaine.');
    }
  };

  const TABS = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: '📊' },
    { key: 'time', label: 'Temps', icon: '⏰' },
    { key: 'content', label: 'Contenu', icon: '🔒' },
    { key: 'grades', label: 'Notes', icon: '📝' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: child.avatar_color || '#6C63FF' }]}>
          <Text style={styles.avatarText}>{child.first_name.charAt(0)}</Text>
        </View>
        <Text style={styles.headerName}>{child.first_name}</Text>
        <Text style={styles.headerAge}>{child.age} ans</Text>
      </LinearGradient>

      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && dashboard && (
          <>
            <SectionCard title="Aujourd'hui" icon="📅">
              <View style={styles.statsGrid}>
                <StatBox label="Utilisé" value={`${dashboard.quota?.usedMins || 0} min`} color="#6C63FF" />
                <StatBox label="Restant" value={`${Math.max(0, (dashboard.quota?.baseLimitMins || 120) - (dashboard.quota?.usedMins || 0))} min`} color="#51CF66" />
                <StatBox label="Bonus" value={`+${dashboard.quota?.bonusMins || 0} min`} color="#FFD93D" />
                <StatBox label="Pénalité" value={`-${dashboard.quota?.penaltyMins || 0} min`} color="#FF6B6B" />
              </View>
            </SectionCard>

            <SectionCard title="Dernières activités" icon="📱">
              {dashboard.recentActivities?.slice(0, 5).map((evt, i) => (
                <View key={i} style={styles.activityRow}>
                  <Text style={styles.activityType}>{evt.event_type}</Text>
                  <Text style={styles.activityPayload}>
                    {evt.app_package || evt.url || JSON.stringify(evt.payload).substring(0, 40)}
                  </Text>
                  <Text style={styles.activityTime}>
                    {new Date(evt.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </SectionCard>

            <SectionCard title="Statistiques semaine" icon="📈">
              {dashboard.weekStats?.map((day, i) => (
                <View key={i} style={styles.weekRow}>
                  <Text style={styles.weekDay}>
                    {new Date(day.day).toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </Text>
                  <View style={styles.weekBar}>
                    <View style={[
                      styles.weekBarFill,
                      { width: `${Math.min(100, (day.screen_mins / 120) * 100)}%` }
                    ]} />
                  </View>
                  <Text style={styles.weekMins}>{Math.round(day.screen_mins)} min</Text>
                </View>
              ))}
            </SectionCard>
          </>
        )}

        {activeTab === 'time' && (
          <>
            <SectionCard title="Temps d'écran quotidien" icon="⏰">
              <TimeSelector
                label="Jours de semaine"
                value={screenTime.dailyLimitMins}
                onChange={v => setScreenTime(p => ({ ...p, dailyLimitMins: v }))}
              />
              <TimeSelector
                label="Week-end"
                value={screenTime.weekendLimitMins}
                onChange={v => setScreenTime(p => ({ ...p, weekendLimitMins: v }))}
              />
            </SectionCard>

            <SectionCard title="Heure du coucher" icon="🌙">
              <View style={styles.bedtimeRow}>
                <Text style={styles.bedtimeLabel}>Blocage à partir de</Text>
                <TouchableOpacity style={styles.bedtimeValue}>
                  <Text style={styles.bedtimeValueText}>{screenTime.bedtimeStart}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.bedtimeRow}>
                <Text style={styles.bedtimeLabel}>Déverrouillage à</Text>
                <TouchableOpacity style={styles.bedtimeValue}>
                  <Text style={styles.bedtimeValueText}>{screenTime.bedtimeEnd}</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>

            <SectionCard title="Mode école" icon="🏫">
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Activer pendant les heures de classe</Text>
                  <Text style={styles.switchSub}>Bloque tout de 8h à 17h en semaine</Text>
                </View>
                <Switch
                  value={screenTime.schoolModeEnabled}
                  onValueChange={v => setScreenTime(p => ({ ...p, schoolModeEnabled: v }))}
                  trackColor={{ true: '#6C63FF' }}
                />
              </View>
            </SectionCard>

            <TouchableOpacity style={styles.saveButton} onPress={saveScreenTime} disabled={saving}>
              <LinearGradient colors={['#6C63FF', '#3B82F6']} style={styles.saveButtonGradient}>
                <Text style={styles.saveButtonText}>
                  {saving ? 'Sauvegarde...' : '💾 Sauvegarder les règles'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'content' && (
          <>
            <SectionCard title="Catégories de contenu" icon="🏷️">
              <CategoryToggle categories={categories} onToggle={toggleCategory} />
            </SectionCard>

            <SectionCard title="Bloquer un site" icon="🚫">
              <View style={styles.urlInputRow}>
                <TextInput
                  style={styles.urlInput}
                  value={newUrl}
                  onChangeText={setNewUrl}
                  placeholder="exemple.com"
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <TouchableOpacity style={styles.urlAddBtn} onPress={addBlockedUrl}>
                  <Text style={styles.urlAddBtnText}>Bloquer</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.urlHint}>
                💡 Le filtre s'applique automatiquement via le VPN local.
              </Text>
            </SectionCard>
          </>
        )}

        {activeTab === 'grades' && (
          <>
            <SectionCard title="Règle d'auto-ajustement" icon="🤖">
              <View style={styles.autoRuleList}>
                {[
                  { range: '< 30%', action: '-60 min', color: '#FF4757' },
                  { range: '30 – 50%', action: '-30 min', color: '#FF6B6B' },
                  { range: '50 – 80%', action: 'Aucun changement', color: '#888' },
                  { range: '80 – 90%', action: '+15 min bonus', color: '#51CF66' },
                  { range: '> 90%', action: '+30 min bonus 🌟', color: '#FFD93D' },
                ].map((r, i) => (
                  <View key={i} style={styles.autoRuleRow}>
                    <Text style={styles.autoRuleRange}>{r.range}</Text>
                    <Text style={[styles.autoRuleAction, { color: r.color }]}>{r.action}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.autoRuleNote}>
                Ces règles s'appliquent automatiquement dès qu'une note est saisie.
              </Text>
            </SectionCard>

            <SectionCard title="Notes récentes" icon="📊">
              {dashboard?.recentGrades?.length > 0 ? (
                dashboard.recentGrades.map((g, i) => (
                  <View key={i} style={styles.gradeRow}>
                    <Text style={styles.gradeSubject}>{g.subject}</Text>
                    <View style={[
                      styles.gradeBadge,
                      { backgroundColor: (g.grade / g.max_grade) >= 0.8 ? '#51CF6622' : (g.grade / g.max_grade) < 0.5 ? '#FF6B6B22' : '#FFD93D22' }
                    ]}>
                      <Text style={[
                        styles.gradeBadgeText,
                        { color: (g.grade / g.max_grade) >= 0.8 ? '#51CF66' : (g.grade / g.max_grade) < 0.5 ? '#FF6B6B' : '#FFD93D' }
                      ]}>
                        {g.grade}/{g.max_grade}
                      </Text>
                    </View>
                    <Text style={styles.gradeDate}>
                      {new Date(g.grade_date).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noData}>Aucune note enregistrée</Text>
              )}
            </SectionCard>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    paddingTop: 56, paddingBottom: 24, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#2a2a4a',
  },
  backBtn: { position: 'absolute', top: 56, left: 16, padding: 8 },
  backBtnText: { color: '#6C63FF', fontWeight: '600' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  headerName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerAge: { color: '#888', fontSize: 14, marginTop: 4 },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#16161e',
    borderBottomWidth: 1, borderBottomColor: '#2a2a4a',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6C63FF' },
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabLabel: { color: '#666', fontSize: 10, fontWeight: '600' },
  tabLabelActive: { color: '#6C63FF' },
  content: { flex: 1, paddingTop: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  activityType: { color: '#6C63FF', fontSize: 11, fontWeight: '700', width: 90 },
  activityPayload: { color: '#aaa', fontSize: 11, flex: 1 },
  activityTime: { color: '#666', fontSize: 11 },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  weekDay: { color: '#888', fontSize: 12, width: 30, textTransform: 'capitalize' },
  weekBar: { flex: 1, height: 8, backgroundColor: '#2a2a4a', borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
  weekBarFill: { height: '100%', backgroundColor: '#6C63FF', borderRadius: 4 },
  weekMins: { color: '#888', fontSize: 12, width: 50, textAlign: 'right' },
  bedtimeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bedtimeLabel: { color: '#ccc', fontSize: 15 },
  bedtimeValue: { backgroundColor: '#2a2a4a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  bedtimeValueText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  switchLabel: { color: '#ccc', fontSize: 14 },
  switchSub: { color: '#666', fontSize: 12, marginTop: 2 },
  urlInputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  urlInput: { flex: 1, backgroundColor: '#16161e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', borderWidth: 1, borderColor: '#2a2a4a' },
  urlAddBtn: { backgroundColor: '#FF6B6B22', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: '#FF6B6B' },
  urlAddBtnText: { color: '#FF6B6B', fontWeight: '700' },
  urlHint: { color: '#666', fontSize: 12, lineHeight: 18 },
  autoRuleList: { gap: 8 },
  autoRuleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  autoRuleRange: { color: '#888', fontSize: 13 },
  autoRuleAction: { fontSize: 13, fontWeight: '700' },
  autoRuleNote: { color: '#666', fontSize: 12, marginTop: 12, lineHeight: 18, fontStyle: 'italic' },
  gradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  gradeSubject: { color: '#ccc', flex: 1, fontSize: 14 },
  gradeBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginRight: 10 },
  gradeBadgeText: { fontWeight: '800', fontSize: 13 },
  gradeDate: { color: '#666', fontSize: 12 },
  noData: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  saveButton: { margin: 16, borderRadius: 16, overflow: 'hidden' },
  saveButtonGradient: { padding: 18, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
