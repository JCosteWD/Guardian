import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, BackHandler,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getActiveRules, logActivity } from '../services/api';
import io from 'socket.io-client';
import { API_URL } from '../services/api';
import { QuotaRing } from '../components/QuotaRing';
import { AppIcon } from '../components/AppIcon';
import { Header } from '../components/Header';
import { LockBanner } from '../components/LockBanner';
import { GuardianCTA } from '../components/GuardianCTA';

const ALLOWED_APPS = [
  { id: 'youtube_kids', name: 'YouTube Kids', emoji: '📺', color: '#FF0000', package: 'com.google.android.youtube' },
  { id: 'games', name: 'Jeux', emoji: '🎮', color: '#9B59B6', package: 'com.games' },
  { id: 'music', name: 'Musique', emoji: '🎵', color: '#1ABC9C', package: 'com.music' },
  { id: 'education', name: 'École', emoji: '📚', color: '#3498DB', package: 'com.school' },
  { id: 'camera', name: 'Appareil photo', emoji: '📷', color: '#E67E22', package: 'com.camera' },
  { id: 'guardian', name: 'Guardian IA', emoji: '🛡️', color: '#6C63FF', package: 'guardian.ai' },
];

export default function HomeScreen({ navigation, route }) {
  const { child, token } = route.params || {};
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    loadRules();

    const clockInterval = setInterval(() => setCurrentTime(new Date()), 60000);

    const socket = io(API_URL.replace('/api', ''), {
      auth: { token },
      reconnection: true,
    });

    socket.emit('identify', { type: 'child', id: child?.id });

    socket.on('quota_updated', (data) => {
      setRules(prev => prev ? {
        ...prev,
        remainingMins: data.isLocked ? 0 : (prev.remainingMins + (data.deltaMinutes || 0)),
        isLocked: data.isLocked || prev.isLocked,
        lockReason: data.message || prev.lockReason,
      } : prev);

      if (data.message) {
        Alert.alert(
          data.type === 'penalty' ? '⚠️ Restriction' : '🎉 Bonus !',
          data.message,
          [{ text: 'OK' }]
        );
      }
    });

    socket.on('rules_updated', () => loadRules());

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);

    return () => {
      clearInterval(clockInterval);
      socket.disconnect();
      backHandler.remove();
    };
  }, []);

  const loadRules = async () => {
    try {
      const data = await getActiveRules();
      setRules(data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAppPress = (app) => {
    if (!rules) return;

    if (rules.isLocked) {
      Alert.alert('🔒 Accès bloqué', rules.lockReason || 'Ton accès est restreint par un parent.', [
        { text: 'Demander à Guardian', onPress: () => navigation.navigate('AIChat', { child }) },
        { text: 'OK' },
      ]);
      return;
    }

    if (rules.remainingMins <= 0) {
      Alert.alert('⏰ Temps écoulé', 'Tu as utilisé tout ton temps d\'écran pour aujourd\'hui !', [
        { text: 'Parler à Guardian', onPress: () => navigation.navigate('AIChat', { child }) },
        { text: 'OK' },
      ]);
      return;
    }

    if (rules.blockedApps?.includes(app.package)) {
      Alert.alert('🚫 Application bloquée', 'Tes parents ont bloqué cette application.', [
        { text: 'Demander à Guardian pourquoi', onPress: () => navigation.navigate('AIChat', { child }) },
        { text: 'OK' },
      ]);
      logActivity('app_blocked', { appName: app.name, package: app.package });
      return;
    }

    if (app.id === 'guardian') {
      navigation.navigate('AIChat', { child });
      return;
    }

    logActivity('app_opened', { appName: app.name }, { appPackage: app.package });
    Alert.alert('Lancement', `Ouverture de ${app.name}...`);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0f0f1a', '#1a1a2e']} style={styles.loadingContainer}>
        <Text style={styles.loadingEmoji}>🛡️</Text>
        <Text style={styles.loadingText}>Chargement de Guardian...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f0f1a', '#1a1a2e']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Header child={child} currentTime={currentTime} />

        <QuotaRing
          usedMins={rules ? (rules.remainingMins !== undefined ?
            (rules.usedMins || 0) : 0) : 0}
          totalMins={rules?.baseLimitMins || 120}
          isLocked={rules?.isLocked || false}
        />

        {rules?.isLocked && (
          <LockBanner
            lockReason={rules.lockReason}
            onChatPress={() => navigation.navigate('AIChat', { child })}
          />
        )}

        <Text style={styles.sectionTitle}>Mes applications</Text>
        <View style={styles.appsGrid}>
          {ALLOWED_APPS.map(app => (
            <AppIcon
              key={app.id}
              app={app}
              isBlocked={rules?.blockedApps?.includes(app.package) || false}
              onPress={handleAppPress}
            />
          ))}
        </View>

        <GuardianCTA onPress={() => navigation.navigate('AIChat', { child })} />

        <View style={{ height: 30 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingEmoji: { fontSize: 64, marginBottom: 20 },
  loadingText: { color: '#888', fontSize: 16 },
  sectionTitle: {
    color: '#888', fontSize: 13, fontWeight: '600',
    paddingHorizontal: 24, marginBottom: 16,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  appsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 8,
  },
});
