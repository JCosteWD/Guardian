const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { transaction } = require('../../config/database');
const logger = require('../../utils/logger');

exports.register = async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;
  
  try {
    // Vérifie si l'email est déjà pris
    const existing = await transaction(async (client) => {
      const result = await client.query('SELECT id FROM parents WHERE email = $1', [email]);
      if (result.rows[0]) {
        return { error: 'Email déjà utilisé' };
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const verifyToken = uuidv4();

      // Crée le parent
      const parent = await client.query(
        `INSERT INTO parents (email, password_hash, first_name, last_name, phone, email_verify_token)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name`,
        [email.toLowerCase(), passwordHash, firstName, lastName, phone, verifyToken]
      );

      // Crée l'abonnement gratuit par défaut
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

    // TODO: envoyer email de vérification
    logger.info(`New parent registered: ${email}`);

    res.status(201).json({
      message: 'Compte créé avec succès. Vérifiez votre email.',
      parentId: existing.id,
    });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
};
