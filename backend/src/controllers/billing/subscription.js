const { query } = require('../../config/database');

exports.getSubscription = async (req, res) => {
  try {
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
