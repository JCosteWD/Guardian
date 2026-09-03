const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const profileController = require('../controllers/profileController');
const { requireParent, requireChild } = require('../middleware/auth');

// ══════════════════════════════════════════════════════════════════════════════
// PROFIL PARENT
// ══════════════════════════════════════════════════════════════════════════════
router.get('/auth/profile',    requireParent, profileController.getProfile);
router.patch('/auth/profile',  requireParent, profileController.updateProfile);

router.post('/auth/change-password',
  requireParent,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
  ],
  profileController.changePassword
);

// ── PUSH TOKENS ───────────────────────────────────────────────────────────────
router.post('/push-tokens',
  requireParent,
  [body('token').notEmpty()],
  profileController.registerPushToken
);

// Push token depuis app enfant
router.post('/device/push-token',
  requireChild,
  [body('token').notEmpty()],
  async (req, res) => {
    const { query } = require('../config/database');
    try {
      await query(
        `INSERT INTO push_tokens (child_id, token, platform)
         VALUES ($1, $2, 'android')
         ON CONFLICT (token) DO UPDATE SET child_id = $1, is_active = true`,
        [req.child.id, req.body.token]
      );
      res.json({ message: 'Token enregistré' });
    } catch (err) {
      res.status(500).json({ error: 'Erreur' });
    }
  }
);

// ── DEVICE PAIRING ────────────────────────────────────────────────────────────
// Couplage via QR code / token
router.post('/auth/pair-device',
  [body('pairingToken').notEmpty().isLength({ min: 6, max: 8 })],
  profileController.pairDevice
);

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES COMPLÈTES CONSOLIDÉES
// (À monter dans server.js après les routes existantes)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Dans server.js, ajouter :
 *
 * const routesV3  = require('./backend-extra/routesV3');
 * const routesP4  = require('./routes/routesP4');
 *
 * app.use('/api', routesV3);
 * app.use('/api', routesP4);
 */

module.exports = router;
