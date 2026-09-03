import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';

const API_URL = __DEV__
  ? 'http://10.0.2.2:3000/api'  // Android emulator → localhost
  : 'https://api.guardian-app.com/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ── TOKEN STORAGE (Keychain = chiffré Android Keystore) ───────────────────────
const TOKEN_KEY = 'guardian_child_token';

const saveToken = async (token) => {
  await Keychain.setGenericPassword(TOKEN_KEY, token, {
    service: TOKEN_KEY,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

const getToken = async () => {
  const creds = await Keychain.getGenericPassword({ service: TOKEN_KEY });
  return creds ? creds.password : null;
};

const clearToken = async () => {
  await Keychain.resetGenericPassword({ service: TOKEN_KEY });
};

// ── INTERCEPTOR: ajoute le JWT à chaque requête ───────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const childAuth = async () => {
  const deviceId = await DeviceInfo.getUniqueId();
  const deviceName = await DeviceInfo.getDeviceName();

  const { data } = await api.post('/auth/child', { deviceId, deviceName });
  await saveToken(data.accessToken);
  return data;
};

// ── RULES (ce que l'enfant peut/ne peut pas faire) ───────────────────────────
export const getActiveRules = async () => {
  const { data } = await api.get('/device/rules');
  return data;
};

// ── ACTIVITY LOGGING ──────────────────────────────────────────────────────────
export const logActivity = async (eventType, payload = {}, extras = {}) => {
  try {
    await api.post('/device/activity', { eventType, payload, ...extras });
  } catch (err) {
    // On ne bloque pas sur les erreurs de log
    console.warn('Activity log failed:', err.message);
  }
};

// ── AI CHAT ───────────────────────────────────────────────────────────────────
export const sendAIMessage = async (message, sessionId = null) => {
  const { data } = await api.post('/ai/chat', { message, sessionId });
  return data;
};

// ── QUIZ ──────────────────────────────────────────────────────────────────────
export const generateQuiz = async (subject, numQuestions = 10, timeBonusMins = 15) => {
  const { data } = await api.post('/ai/quiz/generate', {
    subject, numQuestions, timeBonusMins,
  });
  return data;
};

export const submitQuiz = async (quizId, answers) => {
  const { data } = await api.post(`/ai/quiz/${quizId}/submit`, { answers });
  return data;
};

export { saveToken, getToken, clearToken, API_URL };
export default api;
