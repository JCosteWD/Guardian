const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { transaction } = require('../../config/database');
const logger = require('../../utils/logger');
const demo = require('../../config/demo');

exports.register = async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (demo.isDemoMode() && demo.isDemoEmail(normalizedEmail)) {
      return res.status(409).json({
        error: 'Cette adresse est réservée au compte démo. Utilisez « Connexion Démo ».',
      });
    }

    const existing = await transaction(async (client) => {
      const result = await client.query('SELECT id FROM parents WHERE email = $1', [normalizedEmail]);
      if (result.rows[0]) {
        return { error: 'Email déjà utilisé' };
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const verifyToken = uuidv4();

      const parent = await client.query(
        `INSERT INTO parents (email, password_hash, first_name, last_name, phone, email_verify_token)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name`,
        [normalizedEmail, passwordHash, firstName, lastName, phone, verifyToken]
      );

      await client.query(
        `INSERT INTO subscriptions (parent_id, plan, status)
         VALUES ($1, 'free', 'active')`,
        [parent.rows[0].id]
      );

      return parent.rows[0];
    });

    if (existing?.error) {
      return res.status(409).json({ error: existing.error });
    }

    logger.info(`New parent registered: ${normalizedEmail}`);

    res.status(201).json({
      message: 'Compte créé avec succès. Vérifiez votre email.',
      parentId: existing.id,
    });
  } catch (err) {
    logger.error('Register error:', err);
    if (err.code === 'DB_UNAVAILABLE' && demo.isDemoMode()) {
      return res.status(503).json({
        error: 'Base indisponible. En mode démo, connectez-vous avec demo@guardian.com.',
      });
    }
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
};
