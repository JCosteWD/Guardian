// ── PRONOTE CONTROLLER ─────────────────────────────────────────────────────────────
// Contrôleur pour l'intégration Pronote avec mode démo

const pronoteService = require('../services/pronoteService');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

// ── HELPER: GET PRONOTE SESSION FROM CONFIG (MODE HYBRIDE) ───────────────────────
async function getPronoteSession(childId) {
  try {
    const activeSession = pronoteService.getActiveSession(childId);
    if (activeSession) return activeSession;

    // En mode démo, essayer de récupérer la configuration réelle
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      const config = await query(
        'SELECT school_url, username, password_enc, cas_type FROM pronote_configs WHERE child_id = $1',
        [childId]
      );

      // Si une configuration existe, l'utiliser (mode hybride)
      if (config.rows[0]) {
        logger.info('[getPronoteSession] Configuration réelle trouvée - Mode hybride');
        const configData = config.rows[0];
        
        // Déchiffrer le mot de passe
        const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(32));
        const [ivHex, tagHex, encHex] = configData.password_enc.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const password = decipher.update(enc) + decipher.final('utf8');

        // Créer une session Pronote réelle
        const loginResult = await pronoteService.login(
          configData.school_url,
          configData.username,
          password,
          configData.cas_type || 'none',
          true // forceReal = true en mode hybride
        );

        if (!loginResult.success) {
          logger.warn('[getPronoteSession] Échec connexion réelle, fallback vers démo');
          return null; // Retourner null pour utiliser le mode démo
        }

        return loginResult.session;
      } else {
        logger.info('[getPronoteSession] Aucune configuration réelle - Mode démo');
        return null; // Pas de configuration, utiliser le mode démo
      }
    }

    // Mode production - configuration obligatoire
    const config = await query(
      'SELECT school_url, username, password_enc, cas_type FROM pronote_configs WHERE child_id = $1',
      [childId]
    );

    if (!config.rows[0]) {
      throw new Error('Configuration Pronote non trouvée');
    }

    const configData = config.rows[0];
    
    // Déchiffrer le mot de passe
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(32));
    const [ivHex, tagHex, encHex] = configData.password_enc.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const password = decipher.update(enc) + decipher.final('utf8');

    // Créer une session Pronote
    const loginResult = await pronoteService.login(
      configData.school_url,
      configData.username,
      password,
      configData.cas_type || 'none'
    );

    if (!loginResult.success) {
      throw new Error(loginResult.message);
    }

    return loginResult.session;
  } catch (err) {
    logger.error('[getPronoteSession] Error:', err);
    throw err;
  }
}

// ── TEST CONNEXION PRONOTE ───────────────────────────────────────────────────────
exports.testConnection = async (req, res) => {
  const { schoolUrl, username, password, casType } = req.body;

  try {
    logger.info('[Pronote Controller] Test connexion demandé', { username, schoolUrl });

    // En mode hybride, tester toujours la vraie connexion si des identifiants sont fournis
    const result = await pronoteService.testConnection(schoolUrl, username, password, casType);

    if (result.success) {
      if (req.body.childId && result.session) {
        pronoteService.setActiveSession(req.body.childId, result.session);
      }
      const mode = result.message.includes('mode réel') ? 'REAL' : 'DEMO';
      const modeMessage = mode === 'REAL' 
        ? '🎉 Connexion réussie au vrai compte Pronote !' 
        : '🧪 Mode démo actif - Données simulées';
      
      res.json({
        success: true,
        message: result.message,
        student: result.student,
        mode: mode,
        modeMessage: modeMessage,
        isRealAccount: mode === 'REAL',
        isDemoAccount: mode === 'DEMO',
        dataSource: mode === 'REAL' ? 'PRONOTE_RÉEL' : 'DONNÉES_SIMULÉES',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(401).json({
        success: false,
        message: result.message,
        mode: 'ERROR',
        modeMessage: '❌ Erreur de connexion',
        isRealAccount: false,
        isDemoAccount: false,
        dataSource: 'AUCUNE',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    logger.error('[Pronote Controller] testConnection error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test de connexion',
      error: err.message
    });
  }
};

// ── SAUVEGARDE CONFIGURATION PRONOTE ───────────────────────────────────────────────
exports.savePronoteConfig = async (req, res) => {
  const { childId } = req.params;
  const { schoolUrl, username, password, casType, autoSync } = req.body;

  try {
    logger.info('[Pronote Controller] Sauvegarde configuration', { childId, username });

    // Vérifier que l'enfant appartient au parent
    if (process.env.DEMO_MODE !== 'true' && process.env.NODE_ENV !== 'development') {
      const ownership = await query(
        'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
        [childId, req.user.id]
      );
      if (!ownership.rows[0]) {
        return res.status(403).json({ error: 'Enfant non trouvé ou accès refusé' });
      }
    }

    // Chiffrer le mot de passe
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(32));
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const passwordEnc = `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;

    // Mode hybride : sauvegarder réellement les identifiants même en mode démo
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.info('[Pronote Controller] Mode hybride - Sauvegarde réelle des identifiants');
      
      try {
        // Sauvegarder en base de données pour le mode hybride
        await query(
          `INSERT INTO pronote_configs (child_id, school_url, username, password_enc, cas_type, auto_sync)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (child_id) DO UPDATE SET
             school_url = EXCLUDED.school_url,
             username = EXCLUDED.username,
             password_enc = EXCLUDED.password_enc,
             cas_type = EXCLUDED.cas_type,
             auto_sync = EXCLUDED.auto_sync`,
          [childId, schoolUrl, username, passwordEnc, casType || 'none', autoSync || false]
        );

        return res.json({
          success: true,
          message: 'Configuration Pronote sauvegardée (mode hybride - identifiants réels enregistrés)',
          config: {
            childId,
            schoolUrl,
            username: username.substring(0, 3) + '***',
            casType,
            autoSync: autoSync || false,
            lastSync: new Date().toISOString(),
            mode: 'HYBRID'
          }
        });
      } catch (dbErr) {
        // Si la base de données n'est pas disponible (mode dégradé), simuler la sauvegarde
        logger.warn('[Pronote Controller] Base de données non disponible - Simulation sauvegarde');
        return res.json({
          success: true,
          message: 'Configuration Pronote sauvegardée (simulation - base de données non disponible)',
          config: {
            childId,
            schoolUrl,
            username: username.substring(0, 3) + '***',
            casType,
            autoSync: autoSync || false,
            lastSync: new Date().toISOString(),
            mode: 'SIMULATION'
          }
        });
      }
    }

    // Mode production - sauvegarder en base de données
    await query(
      `INSERT INTO pronote_configs (child_id, school_url, username, password_enc, cas_type, auto_sync)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (child_id) DO UPDATE SET
         school_url = EXCLUDED.school_url,
         username = EXCLUDED.username,
         password_enc = EXCLUDED.password_enc,
         cas_type = EXCLUDED.cas_type,
         auto_sync = EXCLUDED.auto_sync`,
      [childId, schoolUrl, username, passwordEnc, casType || 'none', autoSync || false]
    );

    res.json({
      success: true,
      message: 'Configuration Pronote sauvegardée avec succès',
      config: {
        childId,
        schoolUrl,
        username: username.substring(0, 3) + '***',
        casType,
        autoSync: autoSync || false,
        lastSync: new Date().toISOString(),
        mode: 'PRODUCTION'
      }
    });
  } catch (err) {
    logger.error('[Pronote Controller] savePronoteConfig error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la sauvegarde de la configuration',
      error: err.message
    });
  }
};

// ── SYNCHRONISATION NOTES PRONOTE ───────────────────────────────────────────────
exports.syncGrades = async (req, res) => {
  const { childId } = req.params;

  try {
    logger.info('[Pronote Controller] Synchronisation notes demandée', { childId });

    let session;
    try {
      session = await getPronoteSession(childId);
    } catch (sessionError) {
      if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
        logger.warn('[Pronote Controller] Session réelle indisponible - Synchronisation démo', sessionError.message);
        session = null;
      } else {
        throw sessionError;
      }
    }
    
    // Récupérer les données de synchronisation
    const syncData = await pronoteService.syncStudentData(session);

    // Déterminer le mode utilisé
    const isRealMode = session !== null;
    const mode = isRealMode ? 'REAL' : 'DEMO';
    const modeMessage = isRealMode 
      ? '🎉 Synchronisation depuis le vrai compte Pronote !' 
      : '🧪 Synchronisation en mode démo - Données simulées';

    // En mode démo, simuler l'insertion en base de données
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development' && !isRealMode) {
      logger.warn('[Pronote Controller] Mode démo - Simulation insertion notes');
      
      // Calculer les ajustements de temps d'écran
      const adjustments = syncData.grades.map(grade => {
        const percentage = (grade.grade / grade.maxGrade) * 100;
        let penaltyMins = 0, bonusMins = 0;
        
        if (percentage < 30) penaltyMins = 60;
        else if (percentage < 50) penaltyMins = 30;
        else if (percentage >= 90) bonusMins = 30;
        else if (percentage >= 80) bonusMins = 15;

        return {
          ...grade,
          percentage,
          penaltyMins,
          bonusMins,
          adjustment: bonusMins > 0 ? `+${bonusMins} min bonus` : penaltyMins > 0 ? `-${penaltyMins} min restriction` : 'Aucun ajustement'
        };
      });

      return res.json({
        success: true,
        message: `Synchronisation terminée (mode démo): ${syncData.grades.length} notes importées`,
        mode: mode,
        modeMessage: modeMessage,
        isRealAccount: isRealMode,
        isDemoAccount: !isRealMode,
        dataSource: isRealMode ? 'PRONOTE_RÉEL' : 'DONNÉES_SIMULÉES',
        grades: adjustments,
        homework: syncData.homework,
        schedule: syncData.schedule,
        absences: syncData.absences,
        statistics: {
          totalGrades: syncData.grades.length,
          average: syncData.grades.reduce((sum, g) => sum + (g.grade / g.maxGrade), 0) / syncData.grades.length * 20,
          bestGrade: Math.max(...syncData.grades.map(g => g.grade / g.maxGrade)),
          worstGrade: Math.min(...syncData.grades.map(g => g.grade / g.maxGrade))
        }
      });
    }

    // Mode production - insérer les notes en base de données
    let syncedCount = 0;
    for (const grade of syncData.grades) {
      await query(
        `INSERT INTO grades (child_id, subject, grade, max_grade, grade_date, notes, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'pronote')
         ON CONFLICT DO NOTHING`,
        [childId, grade.subject, grade.grade, grade.maxGrade, grade.date, grade.comment]
      );
      syncedCount++;
    }

    res.json({
      success: true,
      message: `${syncedCount} notes synchronisées depuis Pronote`,
      mode: mode,
      modeMessage: modeMessage,
      isRealAccount: isRealMode,
      isDemoAccount: !isRealMode,
      dataSource: isRealMode ? 'PRONOTE_RÉEL' : 'DONNÉES_SIMULÉES',
      grades: syncData.grades,
      homework: syncData.homework,
      lastSync: syncData.lastSync
    });
  } catch (err) {
    logger.error('[Pronote Controller] syncGrades error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation des notes',
      error: err.message
    });
  }
};

// ── OBTENIR STATUT PRONOTE ───────────────────────────────────────────────────────────
exports.getPronoteStatus = async (req, res) => {
  const { childId } = req.params;

  try {
    // En mode démo, retourner un statut simulé
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('[Pronote Controller] Mode démo - Statut simulé');
      
      // Vérifier si une configuration réelle existe
      let hasRealConfig = false;
      try {
        const config = await query(
          'SELECT id FROM pronote_configs WHERE child_id = $1',
          [childId]
        );
        hasRealConfig = config.rows.length > 0;
      } catch (err) {
        // Base de données non disponible
      }
      
      const mode = hasRealConfig ? 'HYBRID_WITH_CONFIG' : 'DEMO';
      const modeMessage = hasRealConfig 
        ? '🔄 Mode hybride - Configuration Pronote présente (connectez-vous pour utiliser les vraies données)' 
        : '🧪 Mode démo pur - Aucune configuration Pronote';
      
      return res.json({
        connected: true,
        platform: 'pronote',
        mode: mode,
        modeMessage: modeMessage,
        isRealAccount: false,
        isDemoAccount: true,
        dataSource: 'DONNÉES_SIMULÉES',
        hasRealConfig: hasRealConfig,
        lastSync: new Date(Date.now() - 3600000).toISOString(), // 1 heure avant
        autoSync: true,
        student: {
          firstName: 'Ethan',
          lastName: 'Martin',
          class: '3ème B',
          school: 'Collège Victor Hugo'
        },
        statistics: {
          totalGrades: 8,
          average: 13.5,
          bestSubject: 'Mathématiques',
          needsImprovement: 'Anglais'
        }
      });
    }

    // Mode production - interroger la base de données
    const config = await query(
      'SELECT school_url, username, last_sync, auto_sync FROM pronote_configs WHERE child_id = $1',
      [childId]
    );

    if (!config.rows[0]) {
      return res.json({
        connected: false,
        message: 'Aucune configuration Pronote trouvée'
      });
    }

    const grades = await query(
      'SELECT COUNT(*), AVG(grade/max_grade::float) as average FROM grades WHERE child_id = $1 AND source = \'pronote\'',
      [childId]
    );

    res.json({
      connected: true,
      platform: 'pronote',
      mode: 'PRODUCTION',
      modeMessage: '🎉 Mode production - Connexion au vrai compte Pronote',
      isRealAccount: true,
      isDemoAccount: false,
      dataSource: 'PRONOTE_RÉEL',
      lastSync: config.rows[0].last_sync,
      autoSync: config.rows[0].auto_sync,
      schoolUrl: config.rows[0].school_url,
      statistics: {
        totalGrades: parseInt(grades.rows[0].count),
        average: (grades.rows[0].average || 0) * 20
      }
    });
  } catch (err) {
    logger.error('[Pronote Controller] getPronoteStatus error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut Pronote',
      error: err.message
    });
  }
};

// ── SUPPRIMER CONFIGURATION PRONOTE ───────────────────────────────────────────────
exports.deletePronoteConfig = async (req, res) => {
  const { childId } = req.params;

  try {
    logger.info('[Pronote Controller] Suppression configuration', { childId });
    await pronoteService.removeActiveSession(childId);

    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('[Pronote Controller] Mode démo - Simulation suppression');
      return res.json({
        success: true,
        message: 'Configuration Pronote supprimée (mode démo)'
      });
    }

    await query('DELETE FROM pronote_configs WHERE child_id = $1', [childId]);

    res.json({
      success: true,
      message: 'Configuration Pronote supprimée avec succès'
    });
  } catch (err) {
    logger.error('[Pronote Controller] deletePronoteConfig error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la configuration',
      error: err.message
    });
  }
};

// ── OBTENIR DEVOIRS PRONOTE ───────────────────────────────────────────────────────
exports.getHomework = async (req, res) => {
  const { childId } = req.params;
  const { daysAhead = 7 } = req.query;

  try {
    logger.info('[Pronote Controller] Récupération devoirs', { childId, daysAhead });

    const session = (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') ? null : await getPronoteSession(childId);
    const homework = await pronoteService.getHomework(session, parseInt(daysAhead));
    
    const isRealMode = session !== null;
    const mode = isRealMode ? 'REAL' : 'DEMO';
    const modeMessage = isRealMode 
      ? '🎉 Devoirs depuis le vrai compte Pronote !' 
      : '🧪 Devoirs en mode démo - Données simulées';

    res.json({
      success: true,
      homework,
      count: homework.length,
      urgent: homework.filter(hw => hw.priority === 'urgent').length,
      mode: mode,
      modeMessage: modeMessage,
      isRealAccount: isRealMode,
      isDemoAccount: !isRealMode,
      dataSource: isRealMode ? 'PRONOTE_RÉEL' : 'DONNÉES_SIMULÉES'
    });
  } catch (err) {
    logger.error('[Pronote Controller] getHomework error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des devoirs',
      error: err.message
    });
  }
};

// ── OBTENIR EMPLOI DU TEMPS PRONOTE ───────────────────────────────────────────────
exports.getSchedule = async (req, res) => {
  const { childId } = req.params;

  try {
    logger.info('[Pronote Controller] Récupération emploi du temps', { childId });

    const session = (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') ? null : await getPronoteSession(childId);
    const schedule = await pronoteService.getSchedule(session);
    
    const isRealMode = session !== null;
    const mode = isRealMode ? 'REAL' : 'DEMO';
    const modeMessage = isRealMode 
      ? '🎉 Emploi du temps depuis le vrai compte Pronote !' 
      : '🧪 Emploi du temps en mode démo - Données simulées';

    res.json({
      success: true,
      schedule,
      weekDays: Object.keys(schedule),
      mode: mode,
      modeMessage: modeMessage,
      isRealAccount: isRealMode,
      isDemoAccount: !isRealMode,
      dataSource: isRealMode ? 'PRONOTE_RÉEL' : 'DONNÉES_SIMULÉES'
    });
  } catch (err) {
    logger.error('[Pronote Controller] getSchedule error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'emploi du temps',
      error: err.message
    });
  }
};

// ── OBTENIR ABSENCES PRONOTE ───────────────────────────────────────────────────────
exports.getAbsences = async (req, res) => {
  const { childId } = req.params;

  try {
    logger.info('[Pronote Controller] Récupération absences', { childId });

    const session = (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') ? null : await getPronoteSession(childId);
    const absences = await pronoteService.getAbsences(session);
    
    const isRealMode = session !== null;
    const mode = isRealMode ? 'REAL' : 'DEMO';
    const modeMessage = isRealMode 
      ? '🎉 Absences depuis le vrai compte Pronote !' 
      : '🧪 Absences en mode démo - Données simulées';

    res.json({
      success: true,
      absences,
      total: absences.length,
      justified: absences.filter(a => a.justified).length,
      unjustified: absences.filter(a => !a.justified).length,
      mode: mode,
      modeMessage: modeMessage,
      isRealAccount: isRealMode,
      isDemoAccount: !isRealMode,
      dataSource: isRealMode ? 'PRONOTE_RÉEL' : 'DONNÉES_SIMULÉES'
    });
  } catch (err) {
    logger.error('[Pronote Controller] getAbsences error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des absences',
      error: err.message
    });
  }
};

// ── INFORMATIONS SYSTÈME PRONOTE ───────────────────────────────────────────────────
exports.getSystemInfo = async (req, res) => {
  try {
    const info = pronoteService.getSyncStatistics();

    const currentMode = (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') 
        ? (pronoteService.hybridMode ? 'HYBRID' : 'DEMO') 
        : 'PRODUCTION';
    
    const modeMessage = currentMode === 'HYBRID' 
      ? '🔄 Mode hybride - Démo avec possibilité d\'utiliser de vrais identifiants Pronote'
      : currentMode === 'DEMO'
      ? '🧪 Mode démo - Données simulées uniquement'
      : '🎉 Mode production - Connexion au vrai compte Pronote';

    res.json({
      success: true,
      system: info,
      features: {
        grades: true,
        homework: true,
        schedule: true,
        absences: true,
        bulletins: false, // Pas encore implémenté
        evaluations: false // Pas encore implémenté
      },
      apiVersion: '1.0.0',
      demoMode: process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development',
      hybridMode: pronoteService.hybridMode,
      mode: currentMode,
      modeMessage: modeMessage,
      isRealAccount: currentMode === 'PRODUCTION',
      isDemoAccount: currentMode === 'DEMO' || currentMode === 'HYBRID',
      dataSource: currentMode === 'PRODUCTION' ? 'PRONOTE_RÉEL' : 'DONNÉES_SIMULÉES'
    });
  } catch (err) {
    logger.error('[Pronote Controller] getSystemInfo error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations système',
      error: err.message
    });
  }
};
