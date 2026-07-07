const admin = require('firebase-admin');
const { query } = require('../config/database');
const logger = require('../utils/logger');

let firebaseInitialized = false;

const initFirebase = () => {
  if (firebaseInitialized || !process.env.FIREBASE_PROJECT_ID) return;
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        clientId: process.env.FIREBASE_CLIENT_ID,
      }),
    });
    firebaseInitialized = true;
    logger.info('Firebase initialized');
  } catch (err) {
    logger.error('Firebase init failed:', err.message);
  }
};

initFirebase();

const sendPush = async (token, { title, body, data = {}, priority = 'normal' }) => {
  if (!firebaseInitialized) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: {
        priority: priority === 'high' ? 'high' : 'normal',
        notification: { sound: 'default', channelId: 'guardian_alerts' },
      },
    });
  } catch (err) {
    logger.warn('Push notification failed:', err.message);
    // Supprime les tokens invalides
    if (err.code === 'messaging/registration-token-not-registered') {
      await query('UPDATE push_tokens SET is_active = false WHERE token = $1', [token]);
    }
  }
};

const sendToParent = async (parentId, notification) => {
  try {
    const tokens = await query(
      'SELECT token FROM push_tokens WHERE parent_id = $1 AND is_active = true',
      [parentId]
    );
    await Promise.all(tokens.rows.map(t => sendPush(t.token, notification)));
  } catch (err) {
    logger.error('sendToParent error:', err);
  }
};

const sendToChild = async (childId, notification) => {
  try {
    const tokens = await query(
      'SELECT token FROM push_tokens WHERE child_id = $1 AND is_active = true',
      [childId]
    );
    await Promise.all(tokens.rows.map(t => sendPush(t.token, notification)));
  } catch (err) {
    logger.error('sendToChild error:', err);
  }
};

module.exports = { sendToParent, sendToChild, sendPush };
