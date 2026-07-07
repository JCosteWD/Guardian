require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool, query } = require('../src/config/database');
const logger = require('../src/utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Seed de données de développement
// ══════════════════════════════════════════════════════════════════════════════
// Crée un compte parent de démo avec 2 enfants, règles, notes, badges,
// zones géofencing et un historique d'activité réaliste.
//
// Usage:
//   node backend/seed/seedData.js
//   node backend/seed/seedData.js --reset   (supprime les données de démo avant)
//
// Identifiants de connexion générés :
//   Email:    demo@guardian.com
//   Password: Demo1234

const DEMO_EMAIL    = 'demo@guardian.com';
const DEMO_PASSWORD = 'Demo1234';

const SUBJECTS = ['Maths', 'Français', 'Histoire', 'Sciences', 'Anglais', 'Sport', 'Arts plastiques'];
const APPS = [
  { pkg: 'com.whatsapp',          name: 'WhatsApp',   blocked: false },
  { pkg: 'com.instagram.android', name: 'Instagram',  blocked: true  },
  { pkg: 'com.tiktok',            name: 'TikTok',     blocked: true  },
  { pkg: 'com.google.android.youtube', name: 'YouTube', blocked: false },
  { pkg: 'com.king.candycrushsaga', name: 'Candy Crush', blocked: false },
  { pkg: 'com.duolingo',          name: 'Duolingo',   blocked: false },
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick    = (arr) => arr[randInt(0, arr.length - 1)];
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function reset() {
  logger.info('🗑️  Resetting demo data...');
  await query('DELETE FROM parents WHERE email = $1', [DEMO_EMAIL]);
  logger.info('✅ Demo data cleared (CASCADE removed all related rows)');
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. PARENT ────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const parentRes = await client.query(
      `INSERT INTO parents (email, password_hash, first_name, last_name, phone, email_verified, preferences)
       VALUES ($1, $2, 'Marie', 'Dupont', '+33612345678', true, $3)
       RETURNING id`,
      [DEMO_EMAIL, passwordHash, JSON.stringify({ isAdmin: true })]
    );
    const parentId = parentRes.rows[0].id;
    logger.info(`✅ Parent created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

    // ── 2. SUBSCRIPTION (Premium) ────────────────────────────────────────────
    await client.query(
      `INSERT INTO subscriptions (parent_id, plan, status, current_period_end)
       VALUES ($1, 'premium', 'active', NOW() + INTERVAL '30 days')`,
      [parentId]
    );
    logger.info('✅ Subscription: Premium (active)');

    // ── 3. ENFANTS ────────────────────────────────────────────────────────────
    const childrenData = [
      { firstName: 'Lucas', age: 11, color: '#7F77DD', emoji: '🦊', tone: 'friendly', persona: 'Guardian' },
      { firstName: 'Emma',  age: 8,  color: '#D85A30', emoji: '🐼', tone: 'fun',      persona: 'Pixel'    },
    ];

    const childIds = [];
    for (const c of childrenData) {
      const childRes = await client.query(
        `INSERT INTO children (parent_id, first_name, age, avatar_color, ai_persona_name, ai_tone,
                                device_id, device_name, is_active, last_seen, subscription_plan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW() - INTERVAL '5 minutes', 'premium')
         RETURNING id`,
        [parentId, c.firstName, c.age, c.color, c.persona, c.tone,
         `device_demo_${c.firstName.toLowerCase()}`, `Samsung Galaxy A${randInt(13,54)} de ${c.firstName}`]
      );
      childIds.push({ id: childRes.rows[0].id, ...c });
      logger.info(`✅ Child created: ${c.firstName} (${c.age} ans)`);
    }

    // ── 4. RÈGLES POUR CHAQUE ENFANT ──────────────────────────────────────────
    for (const child of childIds) {
      // Temps d'écran
      await client.query(
        `INSERT INTO screen_time_rules
           (child_id, name, daily_limit_mins, weekend_limit_mins, bedtime_start, bedtime_end,
            school_mode_enabled, school_start, school_end, is_active)
         VALUES ($1, 'Règle principale', $2, $3, '21:00', '07:00', true, '08:00', '17:00', true)`,
        [child.id, child.age <= 10 ? 90 : 120, child.age <= 10 ? 120 : 180]
      );

      // Catégories filtrées
      const categories = ['adult', 'violence', 'gambling'];
      if (child.age < 13) categories.push('social');
      for (const cat of categories) {
        await client.query(
          `INSERT INTO category_filters (child_id, category, is_blocked) VALUES ($1, $2, true)`,
          [child.id, cat]
        );
      }

      // Règles d'apps
      for (const app of APPS) {
        const isBlocked = app.blocked && child.age < 13;
        await client.query(
          `INSERT INTO app_rules (child_id, package_name, app_name, is_blocked)
           VALUES ($1, $2, $3, $4)`,
          [child.id, app.pkg, app.name, isBlocked]
        );
      }

      logger.info(`✅ Rules configured for ${child.firstName}`);
    }

    // ── 5. NOTES (4 dernières semaines) ──────────────────────────────────────
    for (const child of childIds) {
      for (let i = 0; i < 12; i++) {
        const subject = pick(SUBJECTS);
        const grade   = randInt(8, 20);
        await client.query(
          `INSERT INTO grades (child_id, subject, grade, max_grade, grade_date)
           VALUES ($1, $2, $3, 20, $4)`,
          [child.id, subject, grade, daysAgo(randInt(1, 28))]
        );
      }
      logger.info(`✅ 12 grades seeded for ${child.firstName}`);
    }

    // ── 6. QUOTAS QUOTIDIENS (7 derniers jours) ──────────────────────────────
    for (const child of childIds) {
      const baseLimit = child.age <= 10 ? 90 : 120;
      for (let i = 0; i < 7; i++) {
        const date = daysAgo(i);
        const used = i === 0 ? randInt(20, baseLimit - 10) : randInt(30, baseLimit + 30);
        const bonus = i % 3 === 0 ? randInt(0, 30) : 0;
        await client.query(
          `INSERT INTO daily_quotas (child_id, quota_date, base_limit_mins, used_mins, bonus_mins, penalty_mins, is_locked)
           VALUES ($1, $2, $3, $4, $5, 0, false)
           ON CONFLICT (child_id, quota_date) DO NOTHING`,
          [child.id, date.toISOString().split('T')[0], baseLimit, used, bonus]
        );
      }
      logger.info(`✅ 7 days of quota history for ${child.firstName}`);
    }

    // ── 7. ACTIVITY EVENTS (historique réaliste) ─────────────────────────────
    const eventTypes = ['app_opened', 'app_blocked', 'url_blocked', 'quiz_completed', 'ai_chat'];
    for (const child of childIds) {
      for (let i = 0; i < 40; i++) {
        const type = pick(eventTypes);
        const app  = pick(APPS);
        await client.query(
          `INSERT INTO activity_events (child_id, event_type, app_package, duration_secs, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [child.id, type, app.pkg, randInt(60, 1800), daysAgo(randInt(0, 7))]
        );
      }
      logger.info(`✅ 40 activity events for ${child.firstName}`);
    }

    // ── 8. GAMIFICATION ───────────────────────────────────────────────────────
    for (const child of childIds) {
      await client.query(
        `INSERT INTO child_stats (child_id, total_points, current_level, current_streak_days,
                                   longest_streak_days, quizzes_passed, bonus_time_earned_mins, last_active_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)`,
        [child.id, randInt(150, 800), randInt(2, 6), randInt(1, 12), randInt(5, 20), randInt(3, 15), randInt(30, 180)]
      );

      // Quelques badges
      const badges = [
        { name: 'Premier jour',    icon: '🌱', points: 10 },
        { name: '3 jours d\'affilée', icon: '🔥', points: 30 },
        { name: 'Premier quiz',    icon: '📝', points: 20 },
        { name: 'Bonne note',      icon: '⭐', points: 50 },
      ];
      for (const badge of badges) {
        await client.query(
          `INSERT INTO rewards (child_id, type, name, description, icon, points_value, earned_at)
           VALUES ($1, 'badge', $2, $2, $3, $4, $5)`,
          [child.id, badge.name, badge.icon, badge.points, daysAgo(randInt(0, 14))]
        );
      }
      logger.info(`✅ Gamification stats + 4 badges for ${child.firstName}`);
    }

    // ── 9. GÉOFENCING ─────────────────────────────────────────────────────────
    const zones = [
      { name: 'Maison', lat: 48.8566, lon: 2.3522, type: 'safe', radius: 150 },
      { name: 'École Jean Moulin', lat: 48.8606, lon: 2.3376, type: 'school', radius: 200 },
      { name: 'Chez Mamie', lat: 48.8434, lon: 2.3387, type: 'safe', radius: 100 },
    ];
    for (const child of childIds) {
      for (const zone of zones) {
        await client.query(
          `INSERT INTO geofence_zones (child_id, name, latitude, longitude, radius_meters, zone_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [child.id, zone.name, zone.lat, zone.lon, zone.radius, zone.type]
        );
      }
    }
    logger.info('✅ Geofencing zones created (Maison, École, Chez Mamie)');

    // ── 10. PRESETS RAPIDES ───────────────────────────────────────────────────
    const presets = [
      { name: 'Punition légère', icon: '⚠️', color: '#BA7517', delta: -30, msg: 'Temps réduit suite à un comportement.' },
      { name: 'Bonus effort',    icon: '⭐', color: '#1D9E75', delta: 30,  msg: 'Bravo pour tes efforts !' },
      { name: 'Mode devoirs',    icon: '📚', color: '#378ADD', delta: 0,   msg: 'C\'est l\'heure des devoirs !', blockAll: true },
    ];
    for (const child of childIds) {
      for (const p of presets) {
        await client.query(
          `INSERT INTO quick_presets (child_id, name, icon, color, time_delta_mins, custom_message, block_all_except_school)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [child.id, p.name, p.icon, p.color, p.delta, p.msg, p.blockAll || false]
        );
      }
    }
    logger.info('✅ Quick presets created');

    // ── 11. NOTIFICATIONS DE DÉMO ─────────────────────────────────────────────
    const notifTypes = [
      { type: 'quota_warning', title: '⏰ Lucas', body: 'Il reste 15 min de temps d\'écran.', priority: 2 },
      { type: 'grade_added',   title: '📝 Nouvelle note - Maths', body: 'Lucas a obtenu 16/20 en Maths !', priority: 2 },
      { type: 'badge_earned',  title: '🏅 Badge débloqué !', body: 'Emma a obtenu le badge "Premier quiz"', priority: 1 },
      { type: 'zone_enter',    title: '📍 Emma - École Jean Moulin', body: 'Emma est arrivée à l\'école.', priority: 2 },
    ];
    for (const n of notifTypes) {
      await client.query(
        `INSERT INTO notifications (parent_id, child_id, type, title, body, priority, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [parentId, pick(childIds).id, n.type, n.title, n.body, n.priority, daysAgo(randInt(0, 2))]
      );
    }
    logger.info('✅ Sample notifications created');

    // ── 12. PIN PARENTAL ──────────────────────────────────────────────────────
    const pinHash = await bcrypt.hash('1234', 10);
    await client.query('UPDATE parents SET pin_hash = $1 WHERE id = $2', [pinHash, parentId]);
    logger.info('✅ Parental PIN set: 1234');

    await client.query('COMMIT');

    // ── RÉSUMÉ ────────────────────────────────────────────────────────────────
    logger.info('\n' + '='.repeat(60));
    logger.info('🎉 SEED COMPLETED SUCCESSFULLY');
    logger.info('='.repeat(60));
    logger.info(`📧 Email:    ${DEMO_EMAIL}`);
    logger.info(`🔑 Password: ${DEMO_PASSWORD}`);
    logger.info(`🔢 PIN:      1234`);
    logger.info(`👶 Children: ${childrenData.map(c => c.firstName).join(', ')}`);
    logger.info(`💎 Plan:     Premium (30 jours)`);
    logger.info('='.repeat(60) + '\n');

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// ── ENTRY POINT ────────────────────────────────────────────────────────────────
(async () => {
  try {
    if (process.argv.includes('--reset')) await reset();
    await seed();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
