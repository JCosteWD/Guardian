require('dotenv').config();
const { pool } = require('../src/config/database');
const logger = require('../src/utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Migration v6 (finale et complète)
// ══════════════════════════════════════════════════════════════════════════════
// Lance APRÈS migrate.js (v1) et migrateV3.js (v3).
// Ajoute les tables manquantes : notifications, support_tickets, ent_configs.

const migrationsV6 = [

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id  UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    child_id   UUID REFERENCES children(id) ON DELETE SET NULL,
    type       VARCHAR(50) NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT,
    data       JSONB DEFAULT '{}',
    priority   INTEGER DEFAULT 1,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notifs_parent_date
   ON notifications(parent_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_notifs_unread
   ON notifications(parent_id) WHERE read_at IS NULL`,

  // ── SUPPORT TICKETS ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS support_tickets (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id  UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    category   VARCHAR(30) NOT NULL,
    subject    TEXT NOT NULL,
    message    TEXT NOT NULL,
    status     VARCHAR(20) DEFAULT 'open',
    reply      TEXT,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tickets_parent
   ON support_tickets(parent_id, created_at DESC)`,

  // ── ENT CONFIGS (Pronote / EcoleDirecte) ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ent_configs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id     UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    platform     VARCHAR(20) NOT NULL,
    username     TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    school_url   TEXT,
    student_name TEXT,
    last_sync    TIMESTAMPTZ,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(child_id, platform)
  )`,

  // ── REFERRALS ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS referrals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id     UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    referee_id      UUID REFERENCES parents(id) ON DELETE SET NULL,
    code            TEXT UNIQUE NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',
    referee_email   TEXT,
    reward_given_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_referrals_code   ON referrals(code)`,
  `CREATE INDEX IF NOT EXISTS idx_referrals_parent ON referrals(referrer_id)`,

  // ── PROMO CODES ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS promo_codes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            TEXT UNIQUE NOT NULL,
    stripe_coupon   TEXT NOT NULL,
    discount_pct    INTEGER,
    discount_months INTEGER DEFAULT 1,
    max_uses        INTEGER DEFAULT 100,
    uses_count      INTEGER DEFAULT 0,
    valid_until     TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── CORRECTIONS INDEX MANQUANTS ────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_location_events_child
   ON location_events(child_id, created_at DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_geofence_child
   ON geofence_zones(child_id) WHERE is_active = TRUE`,

  `CREATE INDEX IF NOT EXISTS idx_family_primary
   ON family_members(primary_parent_id)`,

  // ── VUE UTILITAIRE : dashboard_stats ──────────────────────────────────────
  // Vue agrégée pour accélérer le chargement du dashboard parent
  `CREATE OR REPLACE VIEW dashboard_stats AS
   SELECT
     c.id         AS child_id,
     c.parent_id,
     c.first_name,
     c.age,
     c.avatar_color,
     c.device_id,
     c.device_name,
     c.is_active,
     c.last_seen,
     c.ai_persona_name,
     c.ai_tone,
     COALESCE(dq.base_limit_mins, str.daily_limit_mins, 120)    AS base_limit,
     COALESCE(dq.used_mins, 0)                                   AS used_mins_today,
     COALESCE(dq.bonus_mins, 0)                                  AS bonus_mins,
     COALESCE(dq.penalty_mins, 0)                                AS penalty_mins,
     COALESCE(dq.is_locked, FALSE)                               AS is_locked,
     dq.lock_reason,
     COALESCE(cs.current_level, 1)                               AS level,
     COALESCE(cs.current_streak_days, 0)                         AS streak_days,
     COALESCE(cs.total_points, 0)                                AS total_points
   FROM children c
   LEFT JOIN screen_time_rules str
     ON str.child_id = c.id AND str.is_active = TRUE
   LEFT JOIN daily_quotas dq
     ON dq.child_id = c.id AND dq.quota_date = CURRENT_DATE
   LEFT JOIN child_stats cs
     ON cs.child_id = c.id`,

  // ── FONCTION: remaining_mins (calcul rapide) ───────────────────────────────
  `CREATE OR REPLACE FUNCTION remaining_mins(child_uuid UUID)
   RETURNS INTEGER AS $$
   DECLARE
     total   INTEGER;
     used    INTEGER;
   BEGIN
     SELECT
       COALESCE(base_limit_mins, 120) + COALESCE(bonus_mins, 0) - COALESCE(penalty_mins, 0),
       COALESCE(used_mins, 0)
     INTO total, used
     FROM daily_quotas
     WHERE child_id = child_uuid AND quota_date = CURRENT_DATE;

     IF total IS NULL THEN RETURN 120; END IF;
     RETURN GREATEST(0, total - used);
   END;
   $$ LANGUAGE plpgsql`,

  // ── INSERT DEFAULT PROMO CODE (pour les tests) ────────────────────────────
  `INSERT INTO promo_codes (code, stripe_coupon, discount_pct, discount_months, max_uses)
   VALUES ('LAUNCH50', 'launch50_coupon_id', 50, 3, 500)
   ON CONFLICT (code) DO NOTHING`,

  // ── PERMISSIONS PGCRYPTO (pour les UUID sécurisés) ────────────────────────
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
];

async function migrateV6() {
  const client = await pool.connect();
  try {
    logger.info('Starting Guardian v6 migration...');
    let ok = 0;
    for (const sql of migrationsV6) {
      try {
        await client.query(sql);
        ok++;
      } catch (err) {
        // Ignore les erreurs "already exists"
        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
          logger.warn(`Migration statement warning: ${err.message.substring(0, 100)}`);
        }
      }
    }
    logger.info(`✅ Migration v6 completed (${ok}/${migrationsV6.length} statements)`);
  } catch (err) {
    logger.error('Migration v6 failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateV6().catch(() => process.exit(1));
