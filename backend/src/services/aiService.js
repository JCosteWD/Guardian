const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../config/database');
const { quota } = require('../config/redis');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key_for_dev_mode' });

// ── BUILD CHILD CONTEXT ───────────────────────────────────────────────────────
const buildChildContext = async (childId) => {
  const [childRes, gradesRes, quotaRes, behaviorRes] = await Promise.all([
    query(
      `SELECT c.first_name, c.age, c.ai_persona_name, c.ai_tone,
              p.first_name as parent_first_name
       FROM children c JOIN parents p ON p.id = c.parent_id
       WHERE c.id = $1`,
      [childId]
    ),
    query(
      `SELECT subject, grade, max_grade, grade_date
       FROM grades WHERE child_id = $1
       ORDER BY grade_date DESC LIMIT 5`,
      [childId]
    ),
    query(
      `SELECT base_limit_mins, bonus_mins, penalty_mins, used_mins, is_locked, lock_reason
       FROM daily_quotas WHERE child_id = $1 AND quota_date = CURRENT_DATE`,
      [childId]
    ),
    query(
      `SELECT type, description, is_positive, created_at
       FROM behavior_logs WHERE child_id = $1
       ORDER BY created_at DESC LIMIT 3`,
      [childId]
    ),
  ]);

  const child = childRes.rows[0];
  const grades = gradesRes.rows;
  const quotaData = quotaRes.rows[0];
  const behaviors = behaviorRes.rows;

  if (!child) return null;

  const liveQuota = await quota.get(childId);
  const effectiveQuota = liveQuota || quotaData;

  let remainingMins = 0;
  if (effectiveQuota) {
    const total = effectiveQuota.baseLimitMins + effectiveQuota.bonusMins - effectiveQuota.penaltyMins;
    remainingMins = Math.max(0, total - effectiveQuota.usedMins);
  }

  return {
    child,
    grades,
    quota: effectiveQuota,
    remainingMins,
    behaviors,
  };
};

// ── SYSTEM PROMPT BUILDER ─────────────────────────────────────────────────────
const buildSystemPrompt = (ctx) => {
  const { child, grades, quota: q, remainingMins, behaviors } = ctx;

  const toneInstructions = {
    friendly: 'Adopte un ton chaleureux, bienveillant, encourageant. Utilise des emojis avec modération.',
    strict: 'Adopte un ton direct, clair et structuré. Reste bienveillant mais ferme sur les règles.',
    fun: 'Adopte un ton super dynamique, ludique, plein d\'entrain. Utilise des emojis et de l\'humour adapté.',
    calm: 'Adopte un ton doux, calme, rassurant. Parle lentement et clairement.',
  };

  const gradesSummary = grades.length > 0
    ? grades.map(g => `${g.subject}: ${g.grade}/${g.max_grade}`).join(', ')
    : 'Aucune note récente';

  const quotaContext = q
    ? `Temps total autorisé aujourd'hui: ${q.baseLimitMins + q.bonusMins - q.penaltyMins} min. ` +
      `Déjà utilisé: ${q.usedMins} min. ` +
      `Restant: ${remainingMins} min. ` +
      (q.penaltyMins > 0 ? `Pénalité appliquée: -${q.penaltyMins} min. ` : '') +
      (q.bonusMins > 0 ? `Bonus gagné: +${q.bonusMins} min. ` : '') +
      (q.isLocked ? `ACCÈS ACTUELLEMENT VERROUILLÉ. Raison: ${q.lockReason}` : '')
    : 'Pas de données de quota disponibles.';

  const behaviorContext = behaviors.length > 0
    ? behaviors.map(b =>
        `${b.is_positive ? '✅' : '⚠️'} ${b.type}: ${b.description}`
      ).join('\n')
    : '';

  return `Tu es ${child.ai_persona_name || 'Guardian'}, l'assistant personnel et bienveillant de ${child.first_name}, ${child.age} ans.
Tu as été créé pour aider les enfants à comprendre et accepter les règles parentales, les encourager dans leurs études, et créer un dialogue positif.

${toneInstructions[child.ai_tone] || toneInstructions.friendly}

CONTEXTE ACTUEL:
- Enfant: ${child.first_name}, ${child.age} ans
- Parent: ${child.parent_first_name}
- Notes récentes: ${gradesSummary}
- Temps d'écran aujourd'hui: ${quotaContext}
${behaviorContext ? `- Comportements récents:\n${behaviorContext}` : ''}

RÈGLES IMPORTANTES:
1. Tu ne mens jamais à ${child.first_name}. Si du temps a été réduit suite à une mauvaise note importée de Pronote ou entrée par les parents (voir Comportements récents), explique-le ouvertement mais avec énormément d'empathie et d'encouragement.
2. Lorsqu'une restriction de temps est présente (pénalité ou verrouillage), encourage activement l'enfant à réviser la matière concernée.
3. Propose systématiquement de relever un défi éducatif : un quiz de 10 questions adapté à son âge. Annonce clairement le contrat : s'il obtient un score d'au moins 8 bonnes réponses sur 10 (80%), il gagnera automatiquement 15 minutes de temps bonus !
4. Tu encourages toujours chaleureusement les efforts scolaires, même en cas d'erreur ou d'échec.
5. Tu ne contournes JAMAIS les décisions ou règles des parents. Tu es le pont bienveillant entre le parent et l'enfant, pas l'adversaire des parents.
6. Tes réponses sont adaptées à l'âge de l'enfant (${child.age} ans) : utilise un vocabulaire simple, encourageant, coloré d'emojis de façon équilibrée.
7. Reste concis (maximum 4 phrases par réponse de chat) pour garder l'attention de l'enfant.
8. Si ${child.first_name} accepte le défi ou demande un quiz, réponds obligatoirement avec la balise spéciale [QUIZ_REQUESTED: <matière>] à la fin.
9. Si ${child.first_name} est triste, frustré ou en détresse, rassure-le chaleureusement et conseille-lui d'en parler calmement avec ses parents.

CAPACITÉS SPÉCIALES:
- Si ${child.first_name} demande à faire un quiz, réponds avec exactement: [QUIZ_REQUESTED: <matière>]
- Si tu détectes une forte frustration ou tristesse, ajoute à la fin: [MOOD: sad]
- Si ${child.first_name} a été très bien sage, ajoute: [MOOD: happy]`;
};

// ── CHAT ──────────────────────────────────────────────────────────────────────
exports.chat = async (req, res) => {
  const childId = req.child.id;
  const { message, sessionId } = req.body;

  // Vérifie le plan (IA = premium)
  if (req.child.subscription_plan !== 'premium') {
    return res.status(403).json({
      error: 'L\'assistant IA est disponible avec le plan Premium',
      code: 'UPGRADE_REQUIRED',
    });
  }

  try {
    const ctx = await buildChildContext(childId);
    if (!ctx) return res.status(404).json({ error: 'Profil introuvable' });

    const systemPrompt = buildSystemPrompt(ctx);

    // Charge l'historique de la conversation
    let conversation;
    if (sessionId) {
      const convResult = await query(
        'SELECT messages FROM ai_conversations WHERE id = $1 AND child_id = $2',
        [sessionId, childId]
      );
      conversation = convResult.rows[0];
    }

    const history = conversation?.messages || [];
    const messages = [...history, { role: 'user', content: message }];

    // Appel à l'API Anthropic
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-opus-4-5',
      max_tokens: parseInt(process.env.AI_MAX_TOKENS) || 1024,
      system: systemPrompt,
      messages,
    });

    const aiResponse = response.content[0].text;

    // Parse les commandes spéciales
    let quizRequested = null;
    let mood = null;

    const quizMatch = aiResponse.match(/\[QUIZ_REQUESTED:\s*([^\]]+)\]/);
    if (quizMatch) quizRequested = quizMatch[1].trim();

    const moodMatch = aiResponse.match(/\[MOOD:\s*(\w+)\]/);
    if (moodMatch) mood = moodMatch[1];

    // Nettoie la réponse des balises internes
    const cleanResponse = aiResponse
      .replace(/\[QUIZ_REQUESTED:[^\]]+\]/g, '')
      .replace(/\[MOOD:[^\]]+\]/g, '')
      .trim();

    // Met à jour l'historique
    const updatedHistory = [
      ...messages,
      { role: 'assistant', content: cleanResponse },
    ].slice(-20); // Garde les 20 derniers messages

    // Sauvegarde la conversation
    if (sessionId) {
      await query(
        'UPDATE ai_conversations SET messages = $1, mood_detected = $2, updated_at = NOW() WHERE id = $3',
        [JSON.stringify(updatedHistory), mood, sessionId]
      );
    } else {
      const newConv = await query(
        `INSERT INTO ai_conversations (child_id, messages, mood_detected)
         VALUES ($1, $2, $3) RETURNING id`,
        [childId, JSON.stringify(updatedHistory), mood]
      );
      // Retourne le sessionId pour les prochains messages
    }

    // Log l'événement IA
    await query(
      `INSERT INTO activity_events (child_id, event_type, payload)
       VALUES ($1, 'ai_chat', $2)`,
      [childId, JSON.stringify({ message: message.substring(0, 100), mood })]
    );

    res.json({
      response: cleanResponse,
      sessionId: sessionId || null,
      quizRequested,
      mood,
      remainingMins: ctx.remainingMins,
    });
  } catch (err) {
    logger.error('AI chat error:', err);
    res.status(500).json({ error: 'L\'assistant est momentanément indisponible' });
  }
};

// ── GENERATE QUIZ ─────────────────────────────────────────────────────────────
exports.generateQuiz = async (req, res) => {
  const childId = req.child.id;
  const { subject, numQuestions = 10, timeBonusMins = 15, passThreshold = 0.8 } = req.body;

  if (req.child.subscription_plan !== 'premium') {
    return res.status(403).json({ error: 'Quiz disponible avec le plan Premium', code: 'UPGRADE_REQUIRED' });
  }

  try {
    const childResult = await query(
      'SELECT first_name, age FROM children WHERE id = $1',
      [childId]
    );
    const child = childResult.rows[0];

    const prompt = `Génère un quiz pour ${child.first_name}, ${child.age} ans.
Matière: ${subject || 'culture générale adapté à son âge'}
Nombre de questions: ${numQuestions}
Niveau: adapté à ${child.age} ans, français.

Retourne UNIQUEMENT un JSON valide (pas de markdown) avec cette structure exacte:
{
  "subject": "Nom de la matière",
  "questions": [
    {
      "id": 1,
      "question": "Question ?",
      "options": ["A. Réponse 1", "B. Réponse 2", "C. Réponse 3", "D. Réponse 4"],
      "correct": 0,
      "explanation": "Explication courte et encourageante"
    }
  ]
}`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    let quizData;
    try {
      const text = response.content[0].text.replace(/```json|```/g, '').trim();
      quizData = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: 'Erreur de génération du quiz' });
    }

    const quizResult = await query(
      `INSERT INTO quizzes
         (child_id, subject, questions, num_questions, time_bonus_mins, pass_threshold)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, subject, num_questions, time_bonus_mins, expires_at`,
      [
        childId,
        quizData.subject,
        JSON.stringify(quizData.questions),
        numQuestions,
        timeBonusMins,
        passThreshold,
      ]
    );

    res.json({
      quiz: {
        id: quizResult.rows[0].id,
        subject: quizData.subject,
        numQuestions,
        timeBonusMins,
        passThreshold,
        expiresAt: quizResult.rows[0].expires_at,
        questions: quizData.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          // Ne pas envoyer la bonne réponse au client !
        })),
      },
    });
  } catch (err) {
    logger.error('generateQuiz error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du quiz' });
  }
};

// ── SUBMIT QUIZ ───────────────────────────────────────────────────────────────
exports.submitQuiz = async (req, res) => {
  const childId = req.child.id;
  const { quizId, answers } = req.body; // answers: { questionId: selectedIndex }

  try {
    const quizResult = await query(
      `SELECT * FROM quizzes
       WHERE id = $1 AND child_id = $2 AND status = 'pending' AND expires_at > NOW()`,
      [quizId, childId]
    );

    const quiz = quizResult.rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz non trouvé ou expiré' });

    const questions = quiz.questions;
    let correct = 0;

    const results = questions.map((q) => {
      const selected = answers[q.id];
      const isCorrect = selected === q.correct;
      if (isCorrect) correct++;
      return {
        questionId: q.id,
        question: q.question,
        selected,
        correct: q.correct,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const score = correct / questions.length;
    const passed = score >= quiz.pass_threshold;

    // Met à jour le quiz
    await query(
      `UPDATE quizzes SET status = $1, score = $2, correct_answers = $3, completed_at = NOW()
       WHERE id = $4`,
      [passed ? 'passed' : 'failed', score, correct, quizId]
    );

    // Si réussi, ajoute le bonus
    if (passed) {
      await quota.addBonus(childId, quiz.time_bonus_mins);

      await query(
        `UPDATE daily_quotas SET bonus_mins = bonus_mins + $1
         WHERE child_id = $2 AND quota_date = CURRENT_DATE`,
        [quiz.time_bonus_mins, childId]
      );

      // Notifie le parent
      const child = await query(
        'SELECT first_name, parent_id FROM children WHERE id = $1', [childId]
      );
      if (child.rows[0]) {
        await query(
          `INSERT INTO behavior_logs (child_id, parent_id, type, description, impact_mins, is_positive)
           VALUES ($1, $2, 'quiz_bonus', $3, $4, true)`,
          [childId, child.rows[0].parent_id,
           `Quiz "${quiz.subject}" réussi : ${correct}/${questions.length}`,
           quiz.time_bonus_mins]
        );
      }

      // Notif push parent
      const { notificationService } = require('../services/notificationService');
    }

    // Génère un message d'encouragement via IA
    const encouragementPrompt = `${req.child.first_name} vient de terminer un quiz sur "${quiz.subject}".
Score: ${correct}/${questions.length} (${Math.round(score * 100)}%).
${passed ? `BRAVO ! Il/elle a gagné ${quiz.time_bonus_mins} minutes bonus !` : `Ce n'est pas suffisant (minimum: ${Math.round(quiz.pass_threshold * 100)}%). Reste encourageant.`}
Génère UN message d'encouragement court (2-3 phrases max), adapté à ${req.child.age} ans.`;

    const aiMsg = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-opus-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: encouragementPrompt }],
    });

    res.json({
      passed,
      score: Math.round(score * 100),
      correct,
      total: questions.length,
      bonusMins: passed ? quiz.time_bonus_mins : 0,
      results,
      aiMessage: aiMsg.content[0].text,
    });
  } catch (err) {
    logger.error('submitQuiz error:', err);
    res.status(500).json({ error: 'Erreur lors de la soumission du quiz' });
  }
};

// ── WEEKLY REPORT (Premium) ───────────────────────────────────────────────────
exports.generateWeeklyReport = async (parentId, childId) => {
  try {
    const [child, weekStats, grades, quizzes, behaviors] = await Promise.all([
      query('SELECT first_name, age FROM children WHERE id = $1', [childId]),
      query(
        `SELECT DATE(created_at) as day,
                SUM(duration_secs) / 60 as screen_mins,
                COUNT(*) as events
         FROM activity_events
         WHERE child_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY DATE(created_at)`,
        [childId]
      ),
      query('SELECT * FROM grades WHERE child_id = $1 ORDER BY grade_date DESC LIMIT 10', [childId]),
      query(`SELECT * FROM quizzes WHERE child_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`, [childId]),
      query(`SELECT * FROM behavior_logs WHERE child_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`, [childId]),
    ]);

    const prompt = `Tu es Guardian. Génère un rapport hebdomadaire bienveillant pour les parents de ${child.rows[0].first_name} (${child.rows[0].age} ans).

Données de la semaine:
- Temps d'écran: ${JSON.stringify(weekStats.rows)}
- Notes: ${JSON.stringify(grades.rows)}
- Quiz: ${quizzes.rows.length} tentative(s)
- Comportements: ${JSON.stringify(behaviors.rows)}

Génère un rapport structuré avec:
1. Résumé global (positif d'abord)
2. Points d'attention
3. Recommandations concrètes pour la semaine prochaine

Ton: bienveillant, constructif, factuel. 200-300 mots.`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
  } catch (err) {
    logger.error('generateWeeklyReport error:', err);
    return null;
  }
};
