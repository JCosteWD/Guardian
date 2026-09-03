import { Linking, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';

// ══════════════════════════════════════════════════════════════════════════════
// DEEP LINKS & PUSH NOTIFICATIONS – Navigation intelligente
// ══════════════════════════════════════════════════════════════════════════════
// Quand un parent appuie sur une notification push, l'app ouvre directement
// la bonne page plutôt que la page d'accueil générique.
//
// Deep link scheme: guardian://
//
// Routes supportées:
//   guardian://child/{childId}           → Profil enfant
//   guardian://child/{childId}/rules     → Règles de l'enfant
//   guardian://child/{childId}/activity  → Activité
//   guardian://child/{childId}/rewards   → Récompenses
//   guardian://alert/{childId}           → Dashboard avec alerte mise en avant
//   guardian://subscription              → Page abonnement
//   guardian://pair/{token}              → Couplage appareil (app enfant)

// ── NAVIGATION REFERENCE (à passer depuis App.js) ─────────────────────────────
let navigationRef = null;
export const setNavigationRef = (ref) => { navigationRef = ref; };

// ── PARSE DEEP LINK ───────────────────────────────────────────────────────────
const parseDeepLink = (url) => {
  if (!url) return null;
  const path = url.replace('guardian://', '');
  const parts = path.split('/').filter(Boolean);

  if (parts[0] === 'child' && parts[1]) {
    const childId = parts[1];
    const sub = parts[2];
    return {
      screen: sub === 'rules'    ? 'ChildDetails'
            : sub === 'activity' ? 'Activity'
            : sub === 'rewards'  ? 'Rewards'
            : 'ChildDetails',
      params: { childId, initialTab: sub || 'overview' },
    };
  }

  if (parts[0] === 'alert' && parts[1]) {
    return { screen: 'Dashboard', params: { highlightChild: parts[1] } };
  }

  if (parts[0] === 'subscription') {
    return { screen: 'Subscription', params: {} };
  }

  if (parts[0] === 'pair' && parts[1]) {
    return { screen: 'QRScan', params: { token: parts[1] } };
  }

  return null;
};

// ── NAVIGATE FROM NOTIFICATION DATA ──────────────────────────────────────────
const navigateFromData = (data) => {
  if (!navigationRef || !data) return;

  const { type, childId } = data;

  const routes = {
    quota_warning:  { screen: 'ChildDetails', params: { childId } },
    tamper_attempt: { screen: 'ChildDetails', params: { childId, initialTab: 'activity' } },
    distress_alert: { screen: 'ChildDetails', params: { childId } },
    quiz_completed: { screen: 'ChildDetails', params: { childId, initialTab: 'overview' } },
    zone_enter:     { screen: 'ChildDetails', params: { childId, initialTab: 'overview' } },
    child_message:  { screen: 'Dashboard',    params: { highlightChild: childId } },
    weekly_report:  { screen: 'WeeklyReport', params: { childId } },
  };

  const route = routes[type];
  if (route && navigationRef.current) {
    navigationRef.current.navigate(route.screen, route.params);
  }
};

// ── SETUP NOTIFICATION CHANNELS (Android) ────────────────────────────────────
export const setupNotificationChannels = async () => {
  await notifee.createChannel({
    id: 'guardian_alerts',
    name: 'Alertes Guardian',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [0, 250, 250, 250],
  });

  await notifee.createChannel({
    id: 'guardian_security',
    name: 'Alertes de sécurité',
    importance: AndroidImportance.HIGH,
    sound: 'alarm',
    vibration: true,
    vibrationPattern: [0, 500, 200, 500],
    badge: true,
  });

  await notifee.createChannel({
    id: 'guardian_info',
    name: 'Informations',
    importance: AndroidImportance.DEFAULT,
    sound: 'default',
  });
};

// ── DISPLAY LOCAL NOTIFICATION (depuis foreground) ───────────────────────────
export const displayNotification = async (title, body, data = {}) => {
  const channelId = data.type === 'tamper_attempt' || data.priority === 'high'
    ? 'guardian_security'
    : data.type === 'weekly_report' ? 'guardian_info'
    : 'guardian_alerts';

  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId,
      smallIcon: 'ic_notification',
      color: '#7F77DD',
      pressAction: { id: 'default' },
      category: data.priority === 'high'
        ? AndroidCategory.ALARM
        : AndroidCategory.MESSAGE,
      // Action rapides sur la notification
      actions: data.childId ? [
        { title: '⚡ Réglage rapide', pressAction: { id: 'quick_action', launchActivity: 'default' } },
        { title: '👁️ Voir l\'activité', pressAction: { id: 'view_activity', launchActivity: 'default' } },
      ] : [],
    },
  });
};

// ── INIT PUSH NOTIFICATIONS ───────────────────────────────────────────────────
export const initPushNotifications = async (onToken) => {
  // Permissions
  const authStatus = await messaging().requestPermission();
  const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED
    || authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.warn('[Push] Notification permission denied');
    return;
  }

  // Token FCM
  const token = await messaging().getToken();
  console.log('[Push] FCM Token:', token.substring(0, 20) + '...');
  onToken?.(token);

  // Refresh du token
  messaging().onTokenRefresh(newToken => onToken?.(newToken));

  // Notification reçue en foreground → affiche localement
  messaging().onMessage(async remoteMsg => {
    const { title, body } = remoteMsg.notification || {};
    const data = remoteMsg.data || {};
    if (title) await displayNotification(title, body, data);
  });

  // Tap sur notification (app en background)
  messaging().onNotificationOpenedApp(remoteMsg => {
    navigateFromData(remoteMsg.data);
  });

  // Tap sur notification (app fermée)
  messaging().getInitialNotification().then(remoteMsg => {
    if (remoteMsg) navigateFromData(remoteMsg.data);
  });

  // Actions notifee (boutons d'action rapide)
  notifee.onForegroundEvent(({ type, detail }) => {
    if (type === 3) { // PRESS ou ACTION_PRESS
      const actionId = detail.pressAction?.id;
      const data = detail.notification?.data || {};

      if (actionId === 'quick_action' && data.childId) {
        navigationRef?.current?.navigate('ChildDetails', {
          childId: data.childId, initialTab: 'quick'
        });
      } else if (actionId === 'view_activity' && data.childId) {
        navigationRef?.current?.navigate('ChildDetails', {
          childId: data.childId, initialTab: 'activity'
        });
      } else {
        navigateFromData(data);
      }
    }
  });

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    // Traitement en background (WorkManager)
  });
};

// ── INIT DEEP LINKS ───────────────────────────────────────────────────────────
export const initDeepLinks = () => {
  // Lien d'ouverture initial
  Linking.getInitialURL().then(url => {
    if (url) {
      const route = parseDeepLink(url);
      if (route && navigationRef?.current) {
        setTimeout(() => navigationRef.current.navigate(route.screen, route.params), 500);
      }
    }
  });

  // Liens en cours d'exécution
  const sub = Linking.addEventListener('url', ({ url }) => {
    const route = parseDeepLink(url);
    if (route && navigationRef?.current) {
      navigationRef.current.navigate(route.screen, route.params);
    }
  });

  return () => sub.remove();
};

// ── REGISTER PUSH TOKEN WITH BACKEND ─────────────────────────────────────────
export const registerPushToken = async (token, api) => {
  try {
    await api.post('/push-tokens', { token, platform: 'android' });
  } catch (err) {
    console.warn('[Push] Failed to register token:', err.message);
  }
};

export default {
  setNavigationRef, initPushNotifications,
  initDeepLinks, registerPushToken,
  setupNotificationChannels, displayNotification,
};
