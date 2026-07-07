const axios = require('axios');
const { query } = require('../config/database');
const { awardBadge, addPoints, processGradeReward } = require('./gamificationController');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// INTÉGRATION ENT – Pronote & EcoleDirecte
// ══════════════════════════════════════════════════════════════════════════════
// Récupère automatiquement les notes depuis les plateformes scolaires françaises.
// Les parents configurent leurs identifiants ENT une seule fois.
// Guardian interroge l'API toutes les heures et applique les ajustements.
//
// Table SQL (ajouter à migrateV3.js):
// CREATE TABLE IF NOT EXISTS ent_configs (
//   id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
//   child_id     UUID REFERENCES children(id) ON DELETE CASCADE,
//   platform     VARCHAR(20) NOT NULL,  -- 'pronote' | 'ecoledirecte'
//   username     TEXT NOT NULL,
//   password_enc TEXT NOT NULL,         -- chiffré AES-256
//   school_url   TEXT,                  -- URL de l'instance Pronote
//   student_name TEXT,
//   last_sync    TIMESTAMPTZ,
//   is_active    BOOLEAN DEFAULT TRUE,
//   created_at   TIMESTAMPTZ DEFAULT NOW(),
//   UNIQUE(child_id, platform)
// );

// ── PRONOTE CLIENT ────────────────────────────────────────────────────────────
// Utilise la lib pronote-api (npm install pronote-api)
// ou passe par pronotepy (via un microservice Python si nécessaire)
class PronoteClient {
  constructor(schoolUrl, username, password, casType = 'none') {
    this.schoolUrl = schoolUrl;
    this.username  = username;
    this.password  = password;
    this.casType   = casType;
    this.session   = null;
  }

  async login() {
    try {
      // pronote-api v4+ (Node.js natif)
      const pronotepy = require('pronote-api');
      this.session = await pronotepy.login(
        this.schoolUrl,
        this.username,
        this.password,
        this.casType
      );
      logger.info(`[Pronote] Logged in as ${this.username}`);
      return true;
    } catch (err) {
      logger.error('[Pronote] Login failed:', err.message);
      return false;
    }
  }

  async getRecentGrades(weeksBack = 4) {
    if (!this.session) await this.login();
    if (!this.session) return [];

    try {
      const period = this.session.getPeriod('Trimestre 1') || this.session.periods[0];
      const grades = await period.grades;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - weeksBack * 7);

      return grades
        .filter(g => new Date(g.date) >= cutoff)
        .map(g => ({
          subject:  g.subject.name,
          grade:    parseFloat(g.grade.replace(',', '.')),
          maxGrade: parseFloat(g.outOf.replace(',', '.')),
          date:     new Date(g.date).toISOString(),
          comment:  g.comment || '',
          average:  parseFloat(g.average?.replace(',', '.') || '0'),
        }));
    } catch (err) {
      logger.error('[Pronote] getGrades failed:', err.message);
      return [];
    }
  }

  async getHomework(daysAhead = 7) {
    if (!this.session) await this.login();
    if (!this.session) return [];

    try {
      const from = new Date();
      const to   = new Date();
      to.setDate(to.getDate() + daysAhead);

      const homework = await this.session.homework(from, to);
      return homework.map(h => ({
        subject:     h.subject.name,
        description: h.description,
        dueDate:     new Date(h.date).toISOString(),
        isDone:      h.done,
      }));
    } catch (err) {
      logger.error('[Pronote] getHomework failed:', err.message);
      return [];
    }
  }

  async getAbsences() {
    if (!this.session) await this.login();
    if (!this.session) return [];

    try {
      const period = this.session.periods[0];
      const absences = await period.absences;
      return absences.map(a => ({
        date:     new Date(a.from).toISOString(),
        duration: a.duration,
        justified: a.justified,
        reason:   a.reason || '',
      }));
    } catch (err) {
      return [];
    }
  }
}

// ── ECOLEDIRECTE CLIENT ───────────────────────────────────────────────────────
class EcoleDirecteClient {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.token    = null;
    this.account  = null;
    this.BASE_URL = 'https://api.ecoledirecte.com/v3';
  }

  async login() {
    try {
      const resp = await axios.post(`${this.BASE_URL}/login.awp`, null, {
        params: {
          data: JSON.stringify({
            identifiant: this.username,
            motdepasse:  this.password,
            isRelogin:   false,
          })
        },
        headers: { 'X-Token': '', 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (resp.data.code !== 200) throw new Error(resp.data.message);

      this.token   = resp.data.token;
      this.account = resp.data.data?.accounts?.find(a => a.typeCompte === 'E'); // Élève
      logger.info('[EcoleDirecte] Logged in');
      return true;
    } catch (err) {
      logger.error('[EcoleDirecte] Login failed:', err.message);
      return false;
    }
  }

  async getRecentGrades() {
    if (!this.token) await this.login();
    if (!this.token || !this.account) return [];

    try {
      const resp = await axios.post(
        `${this.BASE_URL}/eleves/${this.account.id}/notes.awp?verbe=get&`,
        `data={}`,
        { headers: { 'X-Token': this.token } }
      );

      if (resp.data.code !== 200) return [];

      const notes = resp.data.data?.notes || [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 28);

      return notes
        .filter(n => new Date(n.dateSaisie) >= cutoff)
        .map(n => ({
          subject:  n.libelleMatiere,
          grade:    parseFloat(n.valeur.replace(',', '.')),
          maxGrade: parseFloat(n.noteSur.replace(',', '.')),
          date:     new Date(n.dateSaisie).toISOString(),
          comment:  n.commentaire || '',
        }));
    } catch (err) {
      logger.error('[EcoleDirecte] getGrades failed:', err.message);
      return [];
    }
  }
}

// ── ENT CONFIG ────────────────────────────────────────────────────────────────
exports.saveENTConfig = async (req, res) => {
  const { childId } = req.params;
  const { platform, username, password, schoolUrl } = req.body;

  if (!['pronote', 'ecoledirecte'].includes(platform)) {
    return res.status(400).json({ error: 'Plateforme non supportée (pronote ou ecoledirecte)' });
  }

  try {
    // Chiffre le mot de passe avant stockage
    const crypto = require('crypto');
    const key    = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(32));
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc    = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag    = cipher.getAuthTag();
    const passwordEnc = `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;

    // Teste la connexion avant de sauvegarder
    let testOk = false;
    if (platform === 'pronote') {
      const client = new PronoteClient(schoolUrl, username, password);
      testOk = await client.login();
    } else {
      const client = new EcoleDirecteClient(username, password);
      testOk = await client.login();
    }

    if (!testOk) {
      return res.status(401).json({ error: 'Identifiants incorrects ou plateforme inaccessible' });
    }

    await query(
      `INSERT INTO ent_configs (child_id, platform, username, password_enc, school_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (child_id, platform) DO UPDATE SET
         username = EXCLUDED.username,
         password_enc = EXCLUDED.password_enc,
         school_url = EXCLUDED.school_url`,
      [childId, platform, username, passwordEnc, schoolUrl || null]
    );

    // Lance une première sync immédiate
    await syncChildGrades(childId);

    res.json({ success: true, message: `Connexion ${platform} établie. Notes synchronisées.` });
  } catch (err) {
    logger.error('saveENTConfig error:', err);
    res.status(500).json({ error: 'Erreur lors de la configuration ENT' });
  }
};

// ── SYNC GRADES ───────────────────────────────────────────────────────────────
const syncChildGrades = async (childId) => {
  try {
    const configs = await query(
      'SELECT * FROM ent_configs WHERE child_id = $1 AND is_active = true',
      [childId]
    );

    if (!configs.rows.length) return { synced: 0 };

    const child = await query('SELECT first_name, parent_id FROM children WHERE id = $1', [childId]);
    if (!child.rows[0]) return { synced: 0 };

    let totalSynced = 0;

    for (const config of configs.rows) {
      // Déchiffre le mot de passe
      const crypto   = require('crypto');
      const key      = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(32));
      const [ivHex, tagHex, encHex] = config.password_enc.split(':');
      const iv       = Buffer.from(ivHex, 'hex');
      const tag      = Buffer.from(tagHex, 'hex');
      const enc      = Buffer.from(encHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const password = decipher.update(enc) + decipher.final('utf8');

      // Récupère les notes selon la plateforme
      let newGrades = [];
      if (config.platform === 'pronote') {
        const client = new PronoteClient(config.school_url, config.username, password);
        newGrades = await client.getRecentGrades(4);
      } else if (config.platform === 'ecoledirecte') {
        const client = new EcoleDirecteClient(config.username, password);
        newGrades = await client.getRecentGrades();
      }

      // Évite les doublons (vérifie les notes déjà insérées)
      const existing = await query(
        'SELECT subject, grade, grade_date FROM grades WHERE child_id = $1 AND created_at >= NOW() - INTERVAL \'30 days\'',
        [childId]
      );
      const existingKeys = new Set(existing.rows.map(g => `${g.subject}-${g.grade}-${g.grade_date?.toISOString()?.split('T')[0]}`));

      for (const g of newGrades) {
        const key = `${g.subject}-${g.grade}-${g.date?.split('T')[0]}`;
        if (existingKeys.has(key)) continue;

        // Insère la note
        await query(
          `INSERT INTO grades (child_id, subject, grade, max_grade, grade_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
          [childId, g.subject, g.grade, g.maxGrade || 20, g.date, g.comment]
        );

        // Applique l'ajustement automatique
        const pct = g.grade / (g.maxGrade || 20);
        const io  = global.app?.get?.('io');

        let penaltyMins = 0, bonusMins = 0;
        if (pct < 0.30) penaltyMins = 60;
        else if (pct < 0.50) penaltyMins = 30;
        else if (pct >= 0.90) bonusMins = 30;
        else if (pct >= 0.80) bonusMins = 15;

        if (io) {
          io.to(`child:${childId}`).emit('grade_added', {
            subject: g.subject, grade: g.grade, maxGrade: g.maxGrade || 20,
            percentage: Math.round(pct * 100),
            penaltyMins, bonusMins,
            source: config.platform,
          });
        }

        // Gamification
        await processGradeReward(childId, pct * 100, g.subject);

        // Notifie le parent
        await notificationService.sendToParent(child.rows[0].parent_id, {
          title: `📚 Nouvelle note – ${g.subject}`,
          body: `${child.rows[0].first_name} a obtenu ${g.grade}/${g.maxGrade || 20} en ${g.subject}${bonusMins > 0 ? ` — +${bonusMins} min bonus !` : penaltyMins > 0 ? ` — -${penaltyMins} min` : ''}`,
          data: { type: 'grade', childId, subject: g.subject },
        });

        totalSynced++;
        existingKeys.add(key);
      }

      // Met à jour le timestamp de dernière sync
      await query(
        'UPDATE ent_configs SET last_sync = NOW() WHERE id = $1',
        [config.id]
      );
    }

    logger.info(`[ENT Sync] ${totalSynced} new grades synced for child ${childId}`);
    return { synced: totalSynced };
  } catch (err) {
    logger.error('[ENT Sync] Error:', err.message);
    return { synced: 0, error: err.message };
  }
};

exports.syncGrades = async (req, res) => {
  const { childId } = req.params;
  const result = await syncChildGrades(childId);
  res.json(result);
};

// ── CRON: sync toutes les heures ─────────────────────────────────────────────
exports.startENTCron = () => {
  const cron = require('node-cron');
  cron.schedule('0 * * * *', async () => {
    logger.info('[ENT Cron] Starting grade sync for all children...');
    const children = await query(
      'SELECT DISTINCT child_id FROM ent_configs WHERE is_active = true'
    );
    for (const c of children.rows) {
      await syncChildGrades(c.child_id).catch(err => logger.error('[ENT Cron]', err.message));
    }
    logger.info(`[ENT Cron] Done. ${children.rows.length} children synced.`);
  }, { timezone: 'Europe/Paris' });
};

exports.getENTStatus = async (req, res) => {
  const { childId } = req.params;
  const configs = await query(
    'SELECT platform, username, last_sync, is_active FROM ent_configs WHERE child_id = $1',
    [childId]
  );
  res.json({ configs: configs.rows });
};

exports.deleteENTConfig = async (req, res) => {
  const { childId, platform } = req.params;
  await query('DELETE FROM ent_configs WHERE child_id = $1 AND platform = $2', [childId, platform]);
  res.json({ message: 'Configuration supprimée' });
};
