const { query } = require('../../config/database');
const { quota } = require('../../config/redis');
const logger = require('../../utils/logger');

exports.addGrade = async (req, res) => {
  const { childId } = req.params;
  const { subject, grade, maxGrade = 20, gradeDate, notes } = req.body;

  try {
    const result = await query(
      `INSERT INTO grades (child_id, subject, grade, max_grade, grade_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [childId, subject, grade, maxGrade, gradeDate || new Date(), notes]
    );

    const percentage = (grade / maxGrade) * 100;
    let autoAction = null;
    let penaltyMins = 0;
    let bonusMins = 0;
    let message = '';

    if (percentage < 30) {
      penaltyMins = 60;
      message = `Suite à ta note en ${subject} (${grade}/${maxGrade}), ton temps a été réduit de 60 min. Courage, tu peux faire mieux ! 💪`;
      autoAction = 'heavy_penalty';
    } else if (percentage < 50) {
      penaltyMins = 30;
      message = `Ta note en ${subject} (${grade}/${maxGrade}) est un peu faible. Ton temps a été réduit de 30 min pour te motiver à réviser.`;
      autoAction = 'penalty';
    } else if (percentage >= 80 && percentage < 90) {
      bonusMins = 15;
      message = `Bravo pour ta note en ${subject} (${grade}/${maxGrade}) ! Tu gagnes 15 min bonus ! 🎉`;
      autoAction = 'bonus';
    } else if (percentage >= 90) {
      bonusMins = 30;
      message = `Excellent travail en ${subject} (${grade}/${maxGrade}) ! 🌟 Tu gagnes 30 min bonus !`;
      autoAction = 'big_bonus';
    }

    if (penaltyMins > 0) {
      await quota.addPenalty(childId, penaltyMins);
      await query(
        `UPDATE daily_quotas SET penalty_mins = penalty_mins + $1 WHERE child_id = $2 AND quota_date = CURRENT_DATE`,
        [penaltyMins, childId]
      );
    }
    if (bonusMins > 0) {
      await quota.addBonus(childId, bonusMins);
      await query(
        `UPDATE daily_quotas SET bonus_mins = bonus_mins + $1 WHERE child_id = $2 AND quota_date = CURRENT_DATE`,
        [bonusMins, childId]
      );
    }

    if (autoAction) {
      const parentResult = await query('SELECT parent_id FROM children WHERE id = $1', [childId]);
      await query(
        `INSERT INTO behavior_logs (child_id, parent_id, type, description, impact_mins, is_positive)
         VALUES ($1, $2, 'grade', $3, $4, $5)`,
        [childId, parentResult.rows[0].parent_id, message,
         bonusMins - penaltyMins, bonusMins > 0]
      );
    }

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('grade_added', {
      subject, grade, maxGrade, percentage: Math.round(percentage),
      autoAction, message, penaltyMins, bonusMins,
    });

    res.json({
      grade: result.rows[0],
      autoAction,
      message,
      penaltyMins,
      bonusMins,
    });
  } catch (err) {
    logger.error('addGrade error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la note' });
  }
};
