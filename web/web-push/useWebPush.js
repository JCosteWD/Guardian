// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Hook React pour Web Push Notifications
// ══════════════════════════════════════════════════════════════════════════════
// Usage dans DashboardV2.jsx:
//   const { permission, subscribed, requestPermission, unsubscribe } = useWebPush();

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = axios.create({ baseURL: '/api' });
API.interceptors.request.use(cfg => {
  const t = localStorage.getItem('guardian_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// ── URL BASE64 → Uint8Array (requis par PushManager) ─────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── HOOK PRINCIPAL ─────────────────────────────────────────────────────────────
export function useWebPush() {
  const [supported, setSupported]   = useState(false);
  const [permission, setPermission] = useState('default'); // default | granted | denied
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(isSupported);

    if (isSupported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
  };

  // ── DEMANDE D'AUTORISATION + SOUSCRIPTION ───────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (!supported) {
      setError('Les notifications push ne sont pas supportées par ce navigateur.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Demande la permission navigateur
      const permResult = await Notification.requestPermission();
      setPermission(permResult);

      if (permResult !== 'granted') {
        setLoading(false);
        return false;
      }

      // 2. Récupère la clé VAPID publique
      const { data } = await API.get('/web-push/vapid-key');
      if (!data.publicKey) throw new Error('Clé VAPID non disponible');

      // 3. S'abonne au PushManager
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      // 4. Enregistre la subscription côté serveur
      await API.post('/web-push/subscribe', {
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      });

      setSubscribed(true);
      setLoading(false);
      return true;

    } catch (err) {
      console.error('Web push subscription error:', err);
      setError(err.message || 'Erreur lors de l\'activation des notifications');
      setLoading(false);
      return false;
    }
  }, [supported]);

  // ── DÉSABONNEMENT ────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await API.post('/web-push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }

      setSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── TEST NOTIFICATION ────────────────────────────────────────────────────────
  const sendTestNotification = useCallback(async () => {
    try {
      await API.post('/web-push/test');
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    supported, permission, subscribed, loading, error,
    requestPermission, unsubscribe, sendTestNotification,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT UI — Bannière d'activation des notifications
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';

export function PushNotificationBanner() {
  const { supported, permission, subscribed, loading, error, requestPermission } = useWebPush();
  const [dismissed, setDismissed] = React.useState(
    localStorage.getItem('guardian_push_banner_dismissed') === 'true'
  );

  if (!supported || subscribed || permission === 'denied' || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('guardian_push_banner_dismissed', 'true');
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'linear-gradient(135deg, #7F77DD18, #378ADD12)',
      border: '1px solid #7F77DD33', borderRadius: 14,
      padding: '14px 18px', marginBottom: 20,
    }}>
      <span style={{ fontSize: 24 }}>🔔</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#F0F0FA', fontWeight: 700, fontSize: 14 }}>
          Activez les notifications
        </div>
        <div style={{ color: '#888780', fontSize: 12, marginTop: 2 }}>
          Recevez les alertes Guardian en temps réel, même fenêtre fermée.
        </div>
        {error && <div style={{ color: '#E24B4A', fontSize: 11, marginTop: 4 }}>{error}</div>}
      </div>
      <button
        onClick={requestPermission}
        disabled={loading}
        style={{
          background: 'linear-gradient(135deg, #7F77DD, #378ADD)',
          color: '#fff', border: 'none', borderRadius: 10,
          padding: '8px 16px', fontWeight: 700, fontSize: 13,
          cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? 'Activation...' : 'Activer'}
      </button>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, padding: 4 }}
      >
        ✕
      </button>
    </div>
  );
}

export default useWebPush;
