// ══════════════════════════════════════════════════════════════════════════════
// rewardsController.js – Gamification, Badges, Streaks, Levels
// Gère le système de récompenses pour les enfants (points, badges, streaks, niveaux)
// ══════════════════════════════════════════════════════════════════════════════

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /children/:childId/rewards
 * Récupère tous les éléments de gamification (stats, badges, streaks, récompenses)
 */
exports.getRewards = async (req, res) => {
  try {
    const { childId } = req.params;

    // Stats
    const statsResult = await query(
      `SELECT 
        total_points, current_level, current_streak_days, 
        level_progress, last_activity_date
      FROM child_stats
      WHERE child_id = $1`,
      [childId]
    );

    const stats = statsResult.rows[0] || {
      total_points: 0,
      current_level: 1,
      current_streak_days: 0,
      level_progress: 0,
      last_activity_date: null,
    };

    // Badges gagnés
    const badgesResult = await query(
      `SELECT id, name, description, icon, earned_at, rarity
      FROM child_badges
      WHERE child_id = $1
      ORDER BY earned_at DESC`,
      [childId]
    );

    // Récompenses disponibles
    const rewardsResult = await query(
      `SELECT id, name, description, points_required, icon, category
      FROM available_rewards
      ORDER BY points_required ASC`,
      []
    );

    // Streaks détaillé
    const streakResult = await query(
      `SELECT current_streak_days, longest_streak_days, streak_start_date, last_activity_date
      FROM child_stats
      WHERE child_id = $1`,
      [childId]
    );

    // Progression vers le prochain niveau
    const nextLevelResult = await query(
      `SELECT points_required
      FROM levels
      WHERE level_number = $1`,
      [stats.current_level + 1]
    );

    const nextLevelPoints = nextLevelResult.rows[0]?.points_required || 1000;
    const pointsToNextLevel = Math.max(0, nextLevelPoints - stats.total_points);

    res.json({
      stats: {
        ...stats,
        points_to_next_level: pointsToNextLevel,
        next_level_threshold: nextLevelPoints,
      },
      badges: badgesResult.rows,
      badges_count: badgesResult.rows.length,
      available_rewards: rewardsResult.rows,
      streak: streakResult.rows[0] || {
        current_streak_days: 0,
        longest_streak_days: 0,
        streak_start_date: null,
        last_activity_date: null,
      },
    });
  } catch (err) {
    logger.error('getRewards error:', err);
    res.status(500).json({ error: 'Impossible de récupérer les récompenses' });
  }
};

/**
 * GET /children/:childId/badges
 * Liste tous les badges gagnés par un enfant
 */
exports.getBadges = async (req, res) => {
  try {
    const { childId } = req.params;

    const result = await query(
      `SELECT id, name, description, icon, earned_at, rarity, condition_met
      FROM child_badges
      WHERE child_id = $1
      ORDER BY earned_at DESC`,
      [childId]
    );

    res.json({
      badges: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    logger.error('getBadges error:', err);
    res.status(500).json({ error: 'Impossible de récupérer les badges' });
  }
};

/**
 * POST /children/:childId/badges
 * Parent ajoute un badge manuellement (récompense spéciale)
 */
exports.addBadge = async (req, res) => {
  try {
    const { childId } = req.params;
    const { name, description, icon, rarity } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Le nom du badge est requis' });
    }

    const result = await query(
      `INSERT INTO child_badges (child_id, name, description, icon, rarity, earned_at, condition_met)
      VALUES ($1, $2, $3, $4, $5, NOW(), 'manual_award')
      RETURNING id, name, description, icon, earned_at, rarity`,
      [childId, name, description || null, icon || '🏆', rarity || 'common']
    );

    // Ajouter des points au badge
    const pointsPerBadge = { common: 10, rare: 25, epic: 50, legendary: 100 };
    const points = pointsPerBadge[rarity || 'common'];

    await query(
      `UPDATE child_stats 
      SET total_points = total_points + $1
      WHERE child_id = $2`,
      [points, childId]
    );

    // Émettre l'événement Socket.io
    const io = req.app.get('io');
    const childOwner = await query('SELECT parent_id FROM children WHERE id = $1', [childId]);
    if (childOwner.rows[0]) {
      io.to(`parent:${childOwner.rows[0].parent_id}`).emit('badge-earned', {
        childId,
        badge: result.rows[0],
        points_earned: points,
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      badge: result.rows[0],
      points_earned: points,
      message: `Badge "${name}" ajouté!`,
    });
  } catch (err) {
    logger.error('addBadge error:', err);
    res.status(500).json({ error: 'Impossible d\'ajouter le badge' });
  }
};

/**
 * DELETE /children/:childId/badges/:badgeId
 * Supprime un badge (admin/parent)
 */
exports.removeBadge = async (req, res) => {
  try {
    const { childId, badgeId } = req.params;

    const result = await query(
      `DELETE FROM child_badges 
      WHERE id = $1 AND child_id = $2
      RETURNING name, rarity`,
      [badgeId, childId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Badge introuvable' });
    }

    res.json({
      success: true,
      message: `Badge "${result.rows[0].name}" supprimé`,
    });
  } catch (err) {
    logger.error('removeBadge error:', err);
    res.status(500).json({ error: 'Impossible de supprimer le badge' });
  }
};

/**
 * GET /children/:childId/streak
 * Récupère les informations détaillées sur la streak
 */
exports.getStreak = async (req, res) => {
  try {
    const { childId } = req.params;

    const result = await query(
      `SELECT 
        current_streak_days, longest_streak_days, 
        streak_start_date, last_activity_date,
        streak_frozen_until
      FROM child_stats
      WHERE child_id = $1`,
      [childId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Statistiques introuvables' });
    }

    const streak = result.rows[0];

    res.json({
      current_streak: streak.current_streak_days,
      longest_streak: streak.longest_streak_days,
      streak_start_date: streak.streak_start_date,
      last_activity_date: streak.last_activity_date,
      streak_frozen_until: streak.streak_frozen_until,
      days_until_streak_break: calculateDaysSinceLastActivity(streak.last_activity_date),
    });
  } catch (err) {
    logger.error('getStreak error:', err);
    res.status(500).json({ error: 'Impossible de récupérer la streak' });
  }
};

/**
 * POST /children/:childId/streak/freeze
 * Parent gèle la streak pour un jour (évite la casse si pas d'activité)
 */
exports.freezeStreak = async (req, res) => {
  try {
    const { childId } = req.params;

    // Vérifier si déjà gelée
    const checkResult = await query(
      `SELECT streak_frozen_until FROM child_stats WHERE child_id = $1`,
      [childId]
    );

    if (checkResult.rows[0]?.streak_frozen_until && new Date(checkResult.rows[0].streak_frozen_until) > new Date()) {
      return res.status(400).json({ error: 'La streak est déjà gelée pour aujourd\'hui' });
    }

    // Geler jusqu'à demain
    const tomorrowAtMidnight = new Date();
    tomorrowAtMidnight.setDate(tomorrowAtMidnight.getDate() + 1);
    tomorrowAtMidnight.setHours(0, 0, 0, 0);

    await query(
      `UPDATE child_stats 
      SET streak_frozen_until = $1
      WHERE child_id = $2`,
      [tomorrowAtMidnight, childId]
    );

    res.json({
      success: true,
      message: 'Streak gelée pour 24h!',
      frozen_until: tomorrowAtMidnight,
    });
  } catch (err) {
    logger.error('freezeStreak error:', err);
    res.status(500).json({ error: 'Impossible de geler la streak' });
  }
};

/**
 * POST /children/:childId/points
 * Ajoute des points manuellement (parent reward)
 */
exports.addPoints = async (req, res) => {
  try {
    const { childId } = req.params;
    const { points, reason } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Nombre de points invalide' });
    }

    const result = await query(
      `UPDATE child_stats 
      SET total_points = total_points + $1
      WHERE child_id = $2
      RETURNING total_points, current_level`,
      [points, childId]
    );

    // Enregistrer la transaction
    await query(
      `INSERT INTO points_transactions (child_id, amount, reason, transaction_type)
      VALUES ($1, $2, $3, 'manual_reward')`,
      [childId, points, reason || 'Parent reward']
    );

    // Émettre l'événement
    const io = req.app.get('io');
    const childOwner = await query('SELECT parent_id FROM children WHERE id = $1', [childId]);
    if (childOwner.rows[0]) {
      io.to(`child:${childId}`).emit('points-earned', {
        points,
        reason: reason || 'Vous avez gagné des points!',
        new_total: result.rows[0].total_points,
      });
    }

    res.json({
      success: true,
      points_added: points,
      total_points: result.rows[0].total_points,
      message: `${points} points ajoutés!`,
    });
  } catch (err) {
    logger.error('addPoints error:', err);
    res.status(500).json({ error: 'Impossible d\'ajouter les points' });
  }
};

/**
 * GET /children/:childId/levels
 * Récupère les informations de niveaux
 */
exports.getLevels = async (req, res) => {
  try {
    const { childId } = req.params;

    // Stats actuelles
    const statsResult = await query(
      `SELECT total_points, current_level FROM child_stats WHERE child_id = $1`,
      [childId]
    );

    if (statsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Enfant introuvable' });
    }

    const currentStats = statsResult.rows[0];

    // Tous les niveaux
    const levelsResult = await query(
      `SELECT level_number, name, description, points_required, reward, icon
      FROM levels
      ORDER BY level_number ASC`
    );

    const levels = levelsResult.rows.map(level => ({
      ...level,
      unlocked: level.level_number <= currentStats.current_level,
      current: level.level_number === currentStats.current_level,
      progress: currentStats.total_points,
    }));

    // Calculer progression
    const currentLevel = levels.find(l => l.current);
    const nextLevel = levels.find(l => l.level_number === currentStats.current_level + 1);

    let levelProgress = 0;
    if (currentLevel && nextLevel) {
      const currentRequired = currentLevel.points_required;
      const nextRequired = nextLevel.points_required;
      const progressPoints = currentStats.total_points - currentRequired;
      const totalForLevel = nextRequired - currentRequired;
      levelProgress = Math.floor((progressPoints / totalForLevel) * 100);
    }

    res.json({
      current_level: currentStats.current_level,
      total_points: currentStats.total_points,
      level_progress: levelProgress,
      levels,
      current_level_info: currentLevel,
      next_level_info: nextLevel,
    });
  } catch (err) {
    logger.error('getLevels error:', err);
    res.status(500).json({ error: 'Impossible de récupérer les niveaux' });
  }
};

/**
 * GET /children/:childId/available-rewards
 * Liste les récompenses disponibles
 */
exports.getAvailableRewards = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, description, points_required, icon, category
      FROM available_rewards
      ORDER BY points_required ASC`
    );

    res.json({
      rewards: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    logger.error('getAvailableRewards error:', err);
    res.status(500).json({ error: 'Impossible de récupérer les récompenses' });
  }
};

/**
 * POST /children/:childId/redeem-reward/:rewardId
 * L'enfant échange des points pour une récompense
 */
exports.redeemReward = async (req, res) => {
  try {
    const { childId, rewardId } = req.params;

    // Vérifier la récompense
    const rewardResult = await query(
      `SELECT id, name, points_required, category FROM available_rewards WHERE id = $1`,
      [rewardId]
    );

    if (rewardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Récompense introuvable' });
    }

    const reward = rewardResult.rows[0];

    // Vérifier les points
    const statsResult = await query(
      `SELECT total_points FROM child_stats WHERE child_id = $1`,
      [childId]
    );

    const currentPoints = statsResult.rows[0]?.total_points || 0;

    if (currentPoints < reward.points_required) {
      return res.status(400).json({ 
        error: 'Pas assez de points',
        required: reward.points_required,
        current: currentPoints,
      });
    }

    // Échanger les points
    await query(
      `UPDATE child_stats 
      SET total_points = total_points - $1
      WHERE child_id = $2`,
      [reward.points_required, childId]
    );

    // Enregistrer le rachat
    const result = await query(
      `INSERT INTO redemptions (child_id, reward_id, points_spent, redeemed_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, redeemed_at`,
      [childId, rewardId, reward.points_required]
    );

    // Émettre l'événement
    const io = req.app.get('io');
    const childOwner = await query('SELECT parent_id FROM children WHERE id = $1', [childId]);
    if (childOwner.rows[0]) {
      io.to(`parent:${childOwner.rows[0].parent_id}`).emit('reward-redeemed', {
        childId,
        reward_name: reward.name,
        points_spent: reward.points_required,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `Récompense "${reward.name}" échangée!`,
      redemption_id: result.rows[0].id,
      redeemed_at: result.rows[0].redeemed_at,
    });
  } catch (err) {
    logger.error('redeemReward error:', err);
    res.status(500).json({ error: 'Impossible d\'échanger la récompense' });
  }
};

/**
 * Helper: Calcule les jours depuis la dernière activité
 */
function calculateDaysSinceLastActivity(lastActivityDate) {
  if (!lastActivityDate) return 999;
  const now = new Date();
  const last = new Date(lastActivityDate);
  const diffTime = Math.abs(now - last);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

module.exports = exports;
