import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet, AppState, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';

import HomeScreen from './src/screens/HomeScreen';
import AIChatScreen from './src/screens/AIChatScreen';
import { childAuth, getActiveRules, API_URL } from './src/services/api';
import GuardianSecurity from './src/services/securityService';

const Stack = createStackNavigator();

// ── SPLASH ────────────────────────────────────────────────────────────────────
const SplashScreen = ({ status }) => (
  <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={styles.splash}>
    <Text style={styles.splashShield}>🛡️</Text>
    <Text style={styles.splashTitle}>Guardian</Text>
    <Text style={styles.splashStatus}>{status}</Text>
    <View style={styles.splashDots}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.splashDot, { opacity: 0.3 + i * 0.3 }]} />
      ))}
    </View>
  </LinearGradient>
);

// ── SETUP REQUIRED ────────────────────────────────────────────────────────────
const SetupScreen = ({ step, onComplete }) => {
  const steps = [
    { icon: '🔐', title: 'Droits administrateur', desc: 'Nécessaire pour bloquer l\'installation de nouvelles apps.' },
    { icon: '🛡️', title: 'Service d\'accessibilité', desc: 'Surveille les apps ouvertes et applique les restrictions.' },
    { icon: '🌐', title: 'VPN de protection', desc: 'Filtre les sites web inappropriés en temps réel.' },
  ];

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={styles.setup}>
      <Text style={styles.setupTitle}>Configuration Guardian</Text>
      <Text style={styles.setupSub}>Quelques permissions sont nécessaires pour protéger cet appareil.</Text>

      {steps.map((s, i) => (
        <View key={i} style={[styles.stepCard, i < step && styles.stepCardDone]}>
          <Text style={styles.stepIcon}>{i < step ? '✅' : s.icon}</Text>
          <View style={styles.stepInfo}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepDesc}>{s.desc}</Text>
          </View>
        </View>
      ))}
    </LinearGradient>
  );
};

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState('splash'); // 'splash' | 'setup' | 'ready' | 'error'
  const [setupStep, setSetupStep] = useState(0);
  const [splashStatus, setSplashStatus] = useState('Initialisation...');
  const [childData, setChildData] = useState(null);
  const [token, setToken] = useState(null);
  const securityRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    initializeApp();
    return () => {
      securityRef.current?.destroy();
      socketRef.current?.disconnect();
    };
  }, []);

  // Gère le retour de l'app en foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && securityRef.current) {
        // Re-vérifie les règles à chaque retour en foreground
        try {
          const rules = await getActiveRules();
          await securityRef.current.updateRules(rules);
        } catch {}
      }
    });
    return () => subscription.remove();
  }, []);

  const initializeApp = async () => {
    try {
      // 1. Auth de l'appareil
      setSplashStatus('Vérification de l\'appareil...');
      let authData;
      try {
        authData = await childAuth();
        setChildData(authData.child);
        setToken(authData.accessToken);
      } catch (err) {
        setState('error');
        return;
      }

      // 2. Charge les règles actives
      setSplashStatus('Chargement des règles...');
      let rules;
      try {
        rules = await getActiveRules();
      } catch {
        rules = { blockedApps: [], blockedDomains: [], blockedCategories: [], remainingMins: 120 };
      }

      // 3. Initialise la couche sécurité Android
      setSplashStatus('Activation de la protection...');
      setSetupStep(0);

      if (Platform.OS === 'android') {
        const security = new GuardianSecurity(authData.child.id, rules);
        try {
          const initialized = await security.initialize();
          if (!initialized) {
            setState('setup');
            return;
          }
          securityRef.current = security;
        } catch (err) {
          console.warn('Security init partial:', err);
        }
      }

      // 4. Connecte le WebSocket pour les mises à jour en temps réel
      setSplashStatus('Connexion au serveur...');
      const socket = io(API_URL.replace('/api', ''), {
        auth: { token: authData.accessToken },
        reconnection: true,
        reconnectionDelay: 2000,
      });

      socket.emit('identify', { type: 'child', id: authData.child.id });

      socket.on('quota_updated', async (data) => {
        if (securityRef.current) {
          const updatedRules = await getActiveRules().catch(() => null);
          if (updatedRules) await securityRef.current.updateRules(updatedRules);
        }
      });

      socket.on('rules_updated', async () => {
        const updatedRules = await getActiveRules().catch(() => null);
        if (updatedRules && securityRef.current) {
          await securityRef.current.updateRules(updatedRules);
        }
      });

      socketRef.current = socket;

      // 5. Prêt !
      setSplashStatus('Prêt !');
      setTimeout(() => setState('ready'), 500);

    } catch (err) {
      console.error('App initialization failed:', err);
      setState('error');
    }
  };

  if (state === 'splash') return <SplashScreen status={splashStatus} />;
  if (state === 'setup') return <SetupScreen step={setupStep} onComplete={initializeApp} />;
  if (state === 'error') return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={styles.splash}>
      <Text style={{ fontSize: 56 }}>⚠️</Text>
      <Text style={styles.splashTitle}>Connexion impossible</Text>
      <Text style={styles.splashStatus}>Vérifie ta connexion internet et réessaie.</Text>
    </LinearGradient>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {props => <HomeScreen {...props} route={{ ...props.route, params: { child: childData, token } }} />}
        </Stack.Screen>
        <Stack.Screen name="AIChat">
          {props => <AIChatScreen {...props} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  splashShield: { fontSize: 72, marginBottom: 16 },
  splashTitle: {
    fontSize: 32, fontWeight: '900', color: '#fff',
    marginBottom: 8,
  },
  splashStatus: { color: '#666', fontSize: 14, marginBottom: 32 },
  splashDots: { flexDirection: 'row', gap: 8 },
  splashDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6C63FF' },

  setup: { flex: 1, padding: 24, justifyContent: 'center' },
  setupTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  setupSub: { color: '#888', fontSize: 14, lineHeight: 22, marginBottom: 32 },
  stepCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1e2040', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2a2a4a',
  },
  stepCardDone: { borderColor: '#51CF66', backgroundColor: '#1a2a1a' },
  stepIcon: { fontSize: 28 },
  stepInfo: { flex: 1 },
  stepTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  stepDesc: { color: '#888', fontSize: 12, marginTop: 3, lineHeight: 18 },
});
