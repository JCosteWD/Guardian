const cron = require('node-cron');
const { query } = require('../config/database');
const { quota, getClient } = require('../config/redis');
const { sendToParent, sendToChild } = require('./notificationService');
const logger = require('../utils/logger');

// ── RESET DAILY QUOTAS (chaque jour à minuit) ─────────────────────────────────
cron.schedule('0 0 * * *', async () => {
  logger.info('CRON: Resetting daily quotas...');
  try {
    const children = await query(
      `SELECT c.id, c.parent_id, c.first_name,
              str.daily_limit_mins, str.weekend_limit_mins
       FROM children c
       LEFT JOIN screen_time_rules str ON str.child_id = c.id AND str.is_active = true
       WHERE c.is_active = true`
    );

    const isWeekend = [0, 6].includes(new Date().getDay());

    for (const child of children.rows) {
      const limitMins = isWeekend
        ? (child.weekend_limit_mins || child.daily_limit_mins || 120)
        : (child.daily_limit_mins || 120);

      // Crée le quota en DB
      await query(
        `INSERT INTO daily_quotas (child_id, base_limit_mins)
         VALUES ($1, $2)
         ON CONFLICT (child_id, quota_date) DO NOTHING`,
        [child.id, limitMins]
      );

      // Initialise dans Redis
      await quota.init(child.id, limitMins);
    }

    logger.info(`CRON: ${children.rows.length} quotas reset`);
  } catch (err) {
    logger.error('CRON: Reset quotas failed:', err);
  }
}, { timezone: 'Europe/Paris' });

// ── BEDTIME ENFORCEMENT (toutes les minutes entre 20h et 23h) ────────────────
cron.schedule('* 20-23 * * *', async () => {
  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const rules = await query(
      `SELECT c.id as child_id, c.first_name, c.parent_id,
              str.bedtime_start, str.bedtime_end
       FROM children c
       JOIN screen_time_rules str ON str.child_id = c.id AND str.is_active = true
       WHERE c.is_active = true
         AND str.bedtime_start IS NOT NULL
         AND $1 >= str.bedtime_start::TEXT`,
      [currentTime]
    );

    for (const rule of rules.rows) {
      const q = await quota.get(rule.child_id);
      if (q && !q.isLocked) {
        await quota.lock(rule.child_id, `C'est l'heure du coucher ! Bonne nuit 🌙`);
      }
    }
  } catch (err) {
    logger.error('CRON: Bedtime enforcement failed:', err);
  }
}, { timezone: 'Europe/Paris' });

// ── UNLOCK MORNING (chaque matin à l'heure de réveil) ────────────────────────
cron.schedule('0 7 * * *', async () => {
  try {
    const rules = await query(
      `SELECT DISTINCT c.id as child_id
       FROM children c
       JOIN screen_time_rules str ON str.child_id = c.id AND str.is_active = true
       WHERE c.is_active = true AND str.bedtime_end IS NOT NULL`
    );

    for (const rule of rules.rows) {
      await quota.unlock(rule.child_id);
    }

    logger.info(`CRON: ${rules.rows.length} children unlocked for morning`);
  } catch (err) {
    logger.error('CRON: Morning unlock failed:', err);
  }
}, { timezone: 'Europe/Paris' });

// ── WEEKLY AI REPORTS (chaque lundi à 8h, plan premium uniquement) ───────────
cron.schedule('0 8 * * 1', async () => {
  logger.info('CRON: Generating weekly AI reports...');
  try {
    const premiumFamilies = await query(
      `SELECT c.id as child_id, c.parent_id
       FROM children c
       JOIN subscriptions s ON s.parent_id = c.parent_id
       WHERE s.plan = 'premium' AND c.is_active = true`
    );

    const { generateWeeklyReport } = require('./aiService');

    for (const { child_id, parent_id } of premiumFamilies.rows) {
      const report = await generateWeeklyReport(parent_id, child_id);
      if (report) {
        await sendToParent(parent_id, {
          title: '📊 Rapport hebdomadaire Guardian',
          body: 'Le rapport de la semaine de votre enfant est disponible.',
          data: { type: 'weekly_report', childId: child_id },
        });
      }
    }

    logger.info(`CRON: ${premiumFamilies.rows.length} weekly reports generated`);
  } catch (err) {
    logger.error('CRON: Weekly reports failed:', err);
  }
}, { timezone: 'Europe/Paris' });

// ── PERSIST REDIS QUOTAS TO DB (toutes les 5 minutes) ────────────────────────
cron.schedule('*/5 * * * *', async () => {
  try {
    const children = await query('SELECT id FROM children WHERE is_active = true');

    for (const child of children.rows) {
      const q = await quota.get(child.id);
      if (!q) continue;

      await query(
        `UPDATE daily_quotas SET
           used_mins = $1, bonus_mins = $2, penalty_mins = $3,
           is_locked = $4, lock_reason = $5
         WHERE child_id = $6 AND quota_date = CURRENT_DATE`,
        [q.usedMins, q.bonusMins, q.penaltyMins, q.isLocked, q.lockReason, child.id]
      );
    }
  } catch (err) {
    logger.error('CRON: Quota persistence failed:', err);
  }
});

// ── ALERT LOW QUOTA (toutes les 15 minutes) ───────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  try {
    const children = await query(
      'SELECT id, first_name, parent_id FROM children WHERE is_active = true'
    );

    for (const child of children.rows) {
      const remaining = await quota.getRemainingMins(child.id);

      if (remaining === 15) {
        await sendToParent(child.parent_id, {
          title: `⏰ ${child.first_name} – 15 min restantes`,
          body: `Il reste 15 minutes de temps d'écran à ${child.first_name} aujourd'hui.`,
        });
      }
    }
  } catch (err) {
    logger.error('CRON: Alert quota failed:', err);
  }
});

logger.info('✅ Cron jobs initialized');
