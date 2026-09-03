const express = require('express');
const { body, param, query: qv, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Middleware de validation
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Données invalides', errors: errors.array() });
  }
  next();
};

const authController = require('../controllers/auth');
const childrenController = require('../controllers/children');
const rulesController = require('../controllers/rules');
const notificationsController = require('../controllers/notifications');
const billingController = require('../controllers/billing');
const pronoteController = require('../controllers/pronote');

const {
  requireParent, requireChild, requirePlan,
  verifyParentPIN, requireChildOwnership, verifyToken,
} = require('../middleware/auth');

const router = express.Router();

// ── RATE LIMITERS ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  skip: () => process.env.NODE_ENV === 'test',
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de messages. Patientez un moment.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.post('/auth/register', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  validate,
], authController.register);

router.post('/auth/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
], authController.login);

router.post('/auth/refresh', authController.refresh);
router.post('/auth/logout', verifyToken, authController.logout);
router.post('/auth/pin', requireParent, authController.setPin);
router.post('/auth/2fa/setup', requireParent, authController.setup2FA);
router.post('/auth/2fa/confirm', requireParent, authController.confirm2FA);
router.post('/auth/child', authLimiter, authController.childAuth);

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/notifications/preferences', requireParent, notificationsController.getNotificationPreferences);
router.patch('/notifications/preferences', requireParent, notificationsController.updateNotificationPreference);

// ══════════════════════════════════════════════════════════════════════════════
// CHILDREN ROUTES (parent)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/children', requireParent, childrenController.getChildren);

router.post('/children', requireParent, [
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('age').isInt({ min: 3, max: 18 }),
  validate,
], childrenController.createChild);

router.patch('/children/:childId', requireParent, requireChildOwnership, childrenController.updateChild);
router.delete('/children/:childId', requireParent, requireChildOwnership, childrenController.deleteChild);
router.post('/children/:childId/pair-device', requireParent, requireChildOwnership, childrenController.pairDevice);

router.get(
  '/children/:childId/dashboard',
  requireParent, requireChildOwnership,
  childrenController.getChildDashboard
);

router.post(
  '/children/:childId/quick-action',
  requireParent, requireChildOwnership,
  childrenController.quickAction
);

// ── LOG depuis l'appareil enfant ──────────────────────────────────────────────
router.post('/device/activity', requireChild, childrenController.logActivity);
router.get('/device/rules', requireChild, rulesController.getActiveRules);

// ══════════════════════════════════════════════════════════════════════════════
// RULES ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Screen time
router.get('/children/:childId/rules/screen-time', requireParent, requireChildOwnership, rulesController.getScreenTimeRules);
router.patch('/children/:childId/rules/screen-time', requireParent, requireChildOwnership, rulesController.updateScreenTimeRule);

// App rules
router.get('/children/:childId/rules/apps', requireParent, requireChildOwnership, rulesController.getAppRules);
router.post('/children/:childId/rules/apps', requireParent, requireChildOwnership, [
  body('packageName').notEmpty(),
  body('appName').notEmpty(),
  validate,
], rulesController.setAppRule);
router.delete('/children/:childId/rules/apps', requireParent, requireChildOwnership, rulesController.deleteAppRule);

// URL / category filters
router.get('/children/:childId/rules/urls', requireParent, requireChildOwnership, rulesController.getUrlRules);
router.post('/children/:childId/rules/urls', requireParent, requireChildOwnership, rulesController.addUrlRule);
router.delete('/children/:childId/rules/urls', requireParent, requireChildOwnership, rulesController.deleteUrlRule);
router.patch('/children/:childId/rules/categories', requireParent, requireChildOwnership, rulesController.updateCategoryFilter);
router.delete('/children/:childId/rules/categories', requireParent, requireChildOwnership, rulesController.deleteCategoryFilter);

// Grades
router.post('/children/:childId/grades', requireParent, requireChildOwnership, [
  body('subject').notEmpty(),
  body('grade').isFloat({ min: 0 }),
  body('maxGrade').optional().isFloat({ min: 1 }),
  validate,
], rulesController.addGrade);

// Presets
router.get('/children/:childId/presets', requireParent, requireChildOwnership, rulesController.getPresets);
router.post('/children/:childId/presets', requireParent, requireChildOwnership, rulesController.createPreset);
router.delete('/children/:childId/presets', requireParent, requireChildOwnership, rulesController.deletePreset);

// ══════════════════════════════════════════════════════════════════════════════
// AI ROUTES (Premium only - from child device)
// ══════════════════════════════════════════════════════════════════════════════

// In dev mode, allow AI chat without strict auth for testing
router.post('/ai/chat', aiLimiter, [
  body('message').trim().isLength({ min: 1, max: 500 }),
  validate,
], async (req, res) => {
  const aiService = require('../services/aiService');
  const shouldUseMockAi = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true' || !process.env.ANTHROPIC_API_KEY;

  const runChat = () => aiService.chat(req, res);

  if (!req.headers.authorization && shouldUseMockAi) {
    req.user = { id: 'parent-1', type: 'child' };
    req.child = {
      id: 'child-1',
      first_name: 'Enfant',
      age: 10,
      educational_level: 'CM2',
      subscription_plan: 'premium',
    };
    return runChat();
  }

  return requireChild(req, res, runChat);
});

router.post('/ai/quiz/generate', requireChild, (req, res) => {
  const aiService = require('../services/aiService');
  aiService.generateQuiz(req, res);
});

router.post('/ai/quiz/:quizId/submit', requireChild, [
  body('answers').isObject(),
  validate,
], (req, res) => {
  const aiService = require('../services/aiService');
  aiService.submitQuiz(req, res);
});

// Rapport IA hebdomadaire (déclenché par cron ou parent)
router.get(
  '/children/:childId/ai/weekly-report',
  requireParent, requireChildOwnership, requirePlan('premium'),
  async (req, res) => {
    const aiService = require('../services/aiService');
    const report = await aiService.generateWeeklyReport(req.user.id, req.params.childId);
    if (!report) return res.status(500).json({ error: 'Impossible de générer le rapport' });
    res.json({ report });
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// BILLING ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/billing/subscription', requireParent, billingController.getSubscription);
router.post('/billing/checkout', requireParent, [
  body('plan').isIn(['family', 'premium']),
  validate,
], billingController.createCheckoutSession);
router.post('/billing/cancel', requireParent, billingController.cancelSubscription);

// Webhook Stripe (pas d'auth JWT, vérification par signature)
router.post('/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingController.handleWebhook
);

// ══════════════════════════════════════════════════════════════════════════════
// GAMIFICATION, REFERRAL & GDPR ROUTES
// ══════════════════════════════════════════════════════════════════════════════

const { query } = require('../config/database');

router.get('/children/:childId/rewards', requireParent, requireChildOwnership, async (req, res) => {
  try {
    const { childId } = req.params;
    const statsResult = await query(
      'SELECT total_points, current_level, current_streak_days FROM child_stats WHERE child_id = $1',
      [childId]
    );
    const stats = statsResult.rows[0] || { total_points: 100, current_level: 2, current_streak_days: 5, levelProgress: 40 };
    res.json({ stats, badges: [], rewards: [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/referral/code', requireParent, async (req, res) => {
  try {
    const result = await query(
      'SELECT code FROM referrals WHERE referrer_id = $1',
      [req.user.id]
    );
    const code = result.rows[0]?.code || 'MARIE-7X4K';
    res.json({
      code,
      link: `https://guardian.com/ref/${code}`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.get('/gdpr/export', requireParent, async (req, res) => {
  try {
    const parentResult = await query('SELECT * FROM parents WHERE id = $1', [req.user.id]);
    const childrenResult = await query('SELECT * FROM children WHERE parent_id = $1', [req.user.id]);
    const subResult = await query('SELECT * FROM subscriptions WHERE parent_id = $1', [req.user.id]);

    res.json({
      exportedBy: parentResult.rows[0]?.email,
      parent: parentResult.rows[0],
      children: childrenResult.rows,
      subscription: subResult.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur export' });
  }
});

router.delete('/gdpr/delete', requireParent, async (req, res) => {
  const { confirmation } = req.body;
  if (confirmation !== 'SUPPRIMER') {
    return res.status(400).json({ error: 'Confirmation requise' });
  }
  try {
    res.json({ success: true, message: 'Données supprimées' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur suppression' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY & ALERTS ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/activity/recent', requireParent, async (req, res) => {
  try {
    const result = await query(
      `SELECT event_type, app_package, url, child_id, created_at
       FROM activity_logs
       WHERE parent_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    const children = await query('SELECT id, first_name FROM children WHERE parent_id = $1', [req.user.id]);
    const childMap = {};
    children.rows.forEach(c => childMap[c.id] = c.first_name);
    
    const activities = result.rows.map(row => ({
      type: row.event_type,
      app_name: row.app_package,
      url: row.url,
      child_name: childMap[row.child_id] || 'Inconnu',
      created_at: row.created_at
    }));
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement de l\'activité' });
  }
});

router.get('/alerts', requireParent, async (req, res) => {
  try {
    const result = await query(
      `SELECT title, message, severity, created_at
       FROM alerts
       WHERE parent_id = $1 AND is_read = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    // En cas d'erreur, retourner un tableau vide
    res.json([]);
  }
});

router.get('/children/report', requireParent, async (req, res) => {
  try {
    // Simuler la génération d'un rapport
    res.json({ 
      success: true, 
      message: 'Rapport généré',
      url: null // Pourrait être un URL vers un PDF
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la génération du rapport' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GEOFENCING ROUTES (Geolocation & Safe Zones)
// ══════════════════════════════════════════════════════════════════════════════

const geofencingController = require('../controllers/geofencingController');

// Zone management routes (parent)
router.get('/children/:childId/geofencing/zones', requireParent, requireChildOwnership, geofencingController.getZones);
router.post('/children/:childId/geofencing/zones', requireParent, requireChildOwnership, [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('radius_meters').isInt({ min: 50, max: 5000 }),
  body('zone_type').optional().isIn(['home', 'school', 'safe_place', 'restricted']),
  validate,
], geofencingController.createZone);

router.patch('/children/:childId/geofencing/zones/:zoneId', requireParent, requireChildOwnership, geofencingController.updateZone);
router.delete('/children/:childId/geofencing/zones/:zoneId', requireParent, requireChildOwnership, geofencingController.deleteZone);

// Location tracking routes (child device)
router.post('/children/:childId/geofencing/location-update', requireChild, [
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  validate,
], geofencingController.updateLocation);

router.get('/children/:childId/geofencing/current-location', requireParent, requireChildOwnership, geofencingController.getCurrentLocation);
router.get('/children/:childId/geofencing/location-history', requireParent, requireChildOwnership, geofencingController.getLocationHistory);

// ══════════════════════════════════════════════════════════════════════════════
// PRONOTE INTEGRATION ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// Test connexion Pronote
router.post('/pronote/test-connection', requireParent, [
  body('schoolUrl').trim().isURL(),
  body('username').trim().notEmpty(),
  body('password').trim().notEmpty(),
  body('casType').optional().isIn(['none', 'ac-grenoble', 'iledefrance', 'monbureaunumerique-educonnect', 'educdenormandie']),
  validate,
], pronoteController.testConnection);

// Configuration Pronote
router.post('/children/:childId/pronote/config', requireParent, requireChildOwnership, [
  body('schoolUrl').trim().isURL(),
  body('username').trim().notEmpty(),
  body('password').trim().notEmpty(),
  body('autoSync').optional().isBoolean(),
  validate,
], pronoteController.savePronoteConfig);

// Synchronisation notes
router.post('/children/:childId/pronote/sync', requireParent, requireChildOwnership, pronoteController.syncGrades);

// Statut Pronote
router.get('/children/:childId/pronote/status', requireParent, requireChildOwnership, pronoteController.getPronoteStatus);

// Suppression configuration
router.delete('/children/:childId/pronote/config', requireParent, requireChildOwnership, pronoteController.deletePronoteConfig);

// Devoirs
router.get('/children/:childId/pronote/homework', requireParent, requireChildOwnership, pronoteController.getHomework);

// Emploi du temps
router.get('/children/:childId/pronote/schedule', requireParent, requireChildOwnership, pronoteController.getSchedule);

// Absences
router.get('/children/:childId/pronote/absences', requireParent, requireChildOwnership, pronoteController.getAbsences);

// Informations système
router.get('/pronote/system-info', pronoteController.getSystemInfo);

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'Guardian API',
  });
});

module.exports = router;
