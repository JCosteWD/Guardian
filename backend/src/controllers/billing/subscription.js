const { query } = require('../../config/database');
const logger = require('../../utils/logger');

exports.getSubscription = async (req, res) => {
  try {
    // MODE DÉMO FORCÉ - Retourne un abonnement premium de démonstration
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Retourne abonnement premium statique');
      const demoSubscription = {
        plan: 'premium',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        maxChildren: 999,
        features: [
          'Contrôle parental avancé',
          'Assistant IA pédagogique',
          'Rapports hebdomadaires détaillés',
          'Quiz éducatifs avec bonus temps',
          'Notifications en temps réel',
          'Support prioritaire'
        ]
      };
      return res.json(demoSubscription);
    }

    const result = await query(
      `SELECT s.*, p.email FROM subscriptions s
       JOIN parents p ON p.id = s.parent_id
       WHERE s.parent_id = $1`,
      [req.user.id]
    );
    const sub = result.rows[0];
    if (!sub) return res.status(404).json({ error: 'Abonnement introuvable' });

    res.json({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEnd: sub.trial_end,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'abonnement' });
  }
};
