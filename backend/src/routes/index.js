const express = require('express');
const { body, param, query: qv } = require('express-validator');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/auth');
const childrenController = require('../controllers/children');
const rulesController = require('../controllers/rules');
const notificationsController = require('../controllers/notifications');
const aiService = require('../services/aiService');
const billingController = require('../controllers/billing');

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
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de messages. Patientez un moment.' },
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.post('/auth/register', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
], authController.register);

router.post('/auth/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
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
], rulesController.addGrade);

// Presets
router.get('/children/:childId/presets', requireParent, requireChildOwnership, rulesController.getPresets);
router.post('/children/:childId/presets', requireParent, requireChildOwnership, rulesController.createPreset);
router.delete('/children/:childId/presets', requireParent, requireChildOwnership, rulesController.deletePreset);

// ══════════════════════════════════════════════════════════════════════════════
// AI ROUTES (Premium only - from child device)
// ══════════════════════════════════════════════════════════════════════════════

router.post('/ai/chat', requireChild, aiLimiter, [
  body('message').trim().isLength({ min: 1, max: 500 }),
], aiService.chat);

router.post('/ai/quiz/generate', requireChild, aiService.generateQuiz);

router.post('/ai/quiz/:quizId/submit', requireChild, [
  body('answers').isObject(),
], aiService.submitQuiz);

// Rapport IA hebdomadaire (déclenché par cron ou parent)
router.get(
  '/children/:childId/ai/weekly-report',
  requireParent, requireChildOwnership, requirePlan('premium'),
  async (req, res) => {
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
], billingController.createCheckoutSession);
router.post('/billing/cancel', requireParent, billingController.cancelSubscription);

// Webhook Stripe (pas d'auth JWT, vérification par signature)
router.post('/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingController.handleWebhook
);

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
