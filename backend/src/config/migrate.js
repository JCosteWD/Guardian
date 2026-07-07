require('dotenv').config();
const { pool } = require('./database');
const logger = require('../utils/logger');

const migrations = [

  // ── EXTENSIONS ───────────────────────────────────────────────────────────────
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

  // ── ENUM TYPES ────────────────────────────────────────────────────────────────
  `DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('free', 'family', 'premium');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,

  `DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,

  `DO $$ BEGIN
    CREATE TYPE event_type AS ENUM (
      'app_opened', 'app_blocked', 'url_blocked', 'quota_reached',
      'bonus_earned', 'quiz_completed', 'rule_changed', 'tamper_attempt',
      'device_connected', 'device_disconnected', 'ai_chat'
    );
  EXCEPTION WHEN duplicate_object THEN null; END $$`,

  `DO $$ BEGIN
    CREATE TYPE day_of_week AS ENUM ('mon','tue','wed','thu','fri','sat','sun');
  EXCEPTION WHEN duplicate_object THEN null; END $$`,

  // ── PARENTS TABLE ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS parents (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email             VARCHAR(255) UNIQUE NOT NULL,
    password_hash     TEXT NOT NULL,
    pin_hash          TEXT,
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    phone             VARCHAR(20),
    avatar_url        TEXT,
    totp_secret       TEXT,
    totp_enabled      BOOLEAN DEFAULT FALSE,
    email_verified    BOOLEAN DEFAULT FALSE,
    email_verify_token TEXT,
    reset_token       TEXT,
    reset_token_expires TIMESTAMPTZ,
    last_login        TIMESTAMPTZ,
    login_attempts    INTEGER DEFAULT 0,
    locked_until      TIMESTAMPTZ,
    preferences       JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id           UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    plan                subscription_plan NOT NULL DEFAULT 'free',
    status              subscription_status NOT NULL DEFAULT 'active',
    stripe_customer_id  TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    trial_end           TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_id)
  )`,

  // ── CHILDREN TABLE ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS children (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id       UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    first_name      VARCHAR(100) NOT NULL,
    age             INTEGER CHECK (age >= 3 AND age <= 18),
    avatar_url      TEXT,
    avatar_color    VARCHAR(7) DEFAULT '#6C63FF',
    device_id       TEXT UNIQUE,
    device_name     TEXT,
    device_token    TEXT,
    pin_hash        TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    ai_persona_name VARCHAR(50) DEFAULT 'Guardian',
    ai_tone         VARCHAR(20) DEFAULT 'friendly',
    last_seen       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── SCREEN TIME RULES ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS screen_time_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    daily_limit_mins INTEGER NOT NULL DEFAULT 120,
    weekend_limit_mins INTEGER DEFAULT 180,
    bedtime_start   TIME,
    bedtime_end     TIME,
    school_mode_enabled BOOLEAN DEFAULT FALSE,
    school_start    TIME DEFAULT '08:00',
    school_end      TIME DEFAULT '17:00',
    active_days     day_of_week[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun']::day_of_week[],
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── APP RULES ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS app_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    package_name    TEXT NOT NULL,
    app_name        TEXT NOT NULL,
    app_icon_url    TEXT,
    daily_limit_mins INTEGER,
    is_blocked      BOOLEAN DEFAULT FALSE,
    blocked_reason  TEXT,
    allowed_time_start TIME,
    allowed_time_end   TIME,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(child_id, package_name)
  )`,

  // ── URL FILTER RULES ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS url_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    domain          TEXT NOT NULL,
    is_blocked      BOOLEAN DEFAULT TRUE,
    category        VARCHAR(50),
    added_by        VARCHAR(10) DEFAULT 'parent',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(child_id, domain)
  )`,

  // ── CATEGORY FILTERS ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS category_filters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    category_name   TEXT NOT NULL,
    is_blocked      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(child_id, category_name)
  )`,

  // ── GRADES (Notes scolaires) ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS grades (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    subject         VARCHAR(100) NOT NULL,
    grade           DECIMAL(4,2) NOT NULL,
    max_grade       DECIMAL(4,2) DEFAULT 20,
    grade_date      DATE NOT NULL,
    notes           TEXT,
    triggers_rule   BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── BEHAVIOR LOGS (Comportement) ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS behavior_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    parent_id       UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    description     TEXT NOT NULL,
    impact_mins     INTEGER DEFAULT 0,
    is_positive     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── QUICK PRESETS (Réglages rapides) ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS quick_presets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id       UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    icon            TEXT DEFAULT '⚡',
    color           VARCHAR(7) DEFAULT '#FF6B6B',
    time_delta_mins INTEGER DEFAULT -30,
    block_games     BOOLEAN DEFAULT FALSE,
    block_social    BOOLEAN DEFAULT FALSE,
    block_videos    BOOLEAN DEFAULT FALSE,
    block_all_except_school BOOLEAN DEFAULT FALSE,
    custom_message  TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── DAILY QUOTAS (Redis-backed mais persisté ici) ────────────────────────────
  `CREATE TABLE IF NOT EXISTS daily_quotas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    quota_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    base_limit_mins INTEGER NOT NULL,
    bonus_mins      INTEGER DEFAULT 0,
    penalty_mins    INTEGER DEFAULT 0,
    used_mins       INTEGER DEFAULT 0,
    is_locked       BOOLEAN DEFAULT FALSE,
    lock_reason     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(child_id, quota_date)
  )`,

  // ── AI CONVERSATIONS ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ai_conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    session_id      UUID DEFAULT uuid_generate_v4(),
    messages        JSONB DEFAULT '[]',
    context_summary TEXT,
    mood_detected   VARCHAR(30),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── QUIZZES ───────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS quizzes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    subject         TEXT,
    questions       JSONB NOT NULL,
    num_questions   INTEGER NOT NULL DEFAULT 10,
    time_bonus_mins INTEGER NOT NULL DEFAULT 15,
    pass_threshold  DECIMAL(3,2) DEFAULT 0.8,
    status          VARCHAR(20) DEFAULT 'pending',
    score           DECIMAL(3,2),
    correct_answers INTEGER,
    completed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── ACTIVITY EVENTS ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS activity_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    event_type      event_type NOT NULL,
    payload         JSONB DEFAULT '{}',
    app_package     TEXT,
    url             TEXT,
    duration_secs   INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── PUSH TOKENS ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS push_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id       UUID REFERENCES parents(id) ON DELETE CASCADE,
    child_id        UUID REFERENCES children(id) ON DELETE CASCADE,
    token           TEXT NOT NULL,
    platform        VARCHAR(10) DEFAULT 'android',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(token)
  )`,

  // ── REFRESH TOKENS ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL,
    user_type       VARCHAR(10) NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,
    device_info     JSONB DEFAULT '{}',
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── INDEXES ───────────────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_children_device ON children(device_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_child_date ON activity_events(child_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_grades_child ON grades(child_id, grade_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_daily_quotas_child_date ON daily_quotas(child_id, quota_date)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_conv_child ON ai_conversations(child_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_quizzes_child ON quizzes(child_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_app_rules_child ON app_rules(child_id)`,

  // ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────────
  `CREATE OR REPLACE FUNCTION update_updated_at()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
   $$ LANGUAGE plpgsql`,

  ...['parents','subscriptions','children','screen_time_rules','app_rules',
      'daily_quotas','ai_conversations'].map(t =>
    `DROP TRIGGER IF EXISTS trg_${t}_updated ON ${t};
     CREATE TRIGGER trg_${t}_updated
     BEFORE UPDATE ON ${t}
     FOR EACH ROW EXECUTE FUNCTION update_updated_at()`
  ),
];

async function migrate() {
  const client = await pool.connect();
  try {
    logger.info('Starting database migration...');
    for (const sql of migrations) {
      await client.query(sql);
    }
    logger.info('✅ Migration completed successfully');
  } catch (err) {
    logger.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
