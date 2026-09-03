// ── AI SERVICE ENHANCED (Version avec intégration académique et personnalisation) ─────────────────────────────────────────────
// Exemple d'intégration des services académiques et de personnalisation

const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../config/database');
const { quota } = require('../config/redis');
const logger = require('../utils/logger');
const academicIntegration = require('./academicIntegration');
const aiPersonalization = require('./aiPersonalization');

const mockMode = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true' || !process.env.ANTHROPIC_API_KEY;
const client = mockMode ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── CHAT AVEC INTÉGRATION ACADEMIQUE ─────────────────────────────────────────────
exports.chatWithAcademicContext = async (req, res) => {
  const childId = req.child?.id || req.body.childId || 'child-1';
  const { message, sessionId, conversationHistory: clientHistory, userProfile } = req.body;

  logger.debug('[AI Chat with Academic Context] Request received:', { childId, message: message?.substring(0, 50) });

  try {
    // Récupérer le profil de l'enfant
    let childName = 'Enfant';
    let childAge = 10;
    let educationalLevel = 'CM2';
    let grades = [];
    let conversationHistory = clientHistory || [];
    
    // Toujours utiliser mock mode en développement pour l'instant
    if (process.env.NODE_ENV === 'development') {
      childName = 'Enfant';
      childAge = 10;
      educationalLevel = 'CM2';
      
      // Détecter le sujet principal du message
      const subject = detectSubject(message);
      
      // Récupérer le contexte académique
      const academicContext = await academicIntegration.getAcademicContextForAI(
        subject, 
        message.substring(0, 50), 
        educationalLevel
      );
      
      // Obtenir le profil de personnalisation
      const profile = userProfile ? aiPersonalization.createCustomProfile(childId, userProfile) : aiPersonalization.getProfile('guardian');
      
      // Générer le prompt système personnalisé
      const systemPrompt = aiPersonalization.generatePersonalizedSystemPrompt(
        { name: childName, age: childAge, level: educationalLevel },
        profile,
        academicContext
      );
      
      logger.debug('[AI Chat] Using academic context and personalized profile');
      
      // Utiliser les réponses mock enrichies avec le contexte académique
      let aiResponse = getMockAIResponseWithContext(message, childName, childAge, educationalLevel, conversationHistory, academicContext, profile);
      
      // Adapter la réponse au profil
      aiResponse = aiPersonalization.adaptResponseToProfile(aiResponse, profile);
      
      res.json({
        response: aiResponse,
        sessionId: sessionId || null,
        academicContext: !!academicContext,
        profile: profile.name,
        remainingMins: 120,
        educationalLevel,
      });
      return;
    }
    
    // Production mode avec Anthropic API et contexte académique
    const ctx = await buildChildContext(childId);
    if (!ctx) return res.status(404).json({ error: 'Profil introuvable' });

    childName = ctx.child.first_name;
    childAge = ctx.child.age;
    educationalLevel = ctx.educationalLevel;
    grades = ctx.grades;

    // Détecter le sujet
    const subject = detectSubject(message);
    
    // Récupérer le contexte académique
    const academicContext = await academicIntegration.getAcademicContextForAI(
      subject, 
      message.substring(0, 50), 
      educationalLevel
    );
    
    // Obtenir le profil de personnalisation
    const profile = userProfile ? aiPersonalization.createCustomProfile(childId, userProfile) : aiPersonalization.getProfile('guardian');
    
    // Générer le prompt système personnalisé avec contexte académique
    const systemPrompt = aiPersonalization.generatePersonalizedSystemPrompt(
      { name: childName, age: childAge, level: educationalLevel },
      profile,
      academicContext
    );

    // Charger l'historique de conversation
    let conversation;
    if (sessionId) {
      const convResult = await query(
        'SELECT messages FROM ai_conversations WHERE id = $1 AND child_id = $2',
        [sessionId, childId]
      );
      conversation = convResult.rows[0];
      conversationHistory = conversation?.messages || [];
    }

    const history = conversationHistory || [];
    const messages = [...history, { role: 'user', content: message }];

    // Call Anthropic API avec le prompt enrichi
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'claude-opus-4-5',
      max_tokens: parseInt(process.env.AI_MAX_TOKENS) || 2000,
      system: systemPrompt,
      messages,
    });

    let aiResponse = response.content[0].text;

    // Adapter la réponse au profil
    aiResponse = aiPersonalization.adaptResponseToProfile(aiResponse, profile);

    // Parse special commands
    let quizRequested = null;
    let mood = null;

    const quizMatch = aiResponse.match(/\[QUIZ_REQUESTED:\s*([^\]]+)\]/);
    if (quizMatch) quizRequested = quizMatch[1].trim();

    const moodMatch = aiResponse.match(/\[MOOD:\s*(\w+)\]/);
    if (moodMatch) mood = moodMatch[1];

    // Clean response
    aiResponse = aiResponse
      .replace(/\[QUIZ_REQUESTED:[^\]]+\]/g, '')
      .replace(/\[MOOD:[^\]]+\]/g, '')
      .trim();

    // Update history
    const updatedHistory = [
      ...messages,
      { role: 'assistant', content: aiResponse },
    ].slice(-20);

    // Save conversation
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
    }

    // Log AI event
    await query(
      `INSERT INTO activity_events (child_id, event_type, payload)
       VALUES ($1, 'ai_chat', $2)`,
      [childId, JSON.stringify({ message: message.substring(0, 100), mood, educationalLevel, academicContext: !!academicContext })]
    );

    res.json({
      response: aiResponse,
      sessionId: sessionId || newConv?.rows[0]?.id || null,
      quizRequested,
      mood,
      remainingMins: ctx.remainingMins,
      educationalLevel,
      academicContext: !!academicContext,
      profile: profile.name
    });
  } catch (err) {
    logger.error('[AI Chat with Academic Context] Error:', err);
    res.status(500).json({ error: 'L\'assistant est momentanément indisponible' });
  }
};

// ── DÉTECTION DE SUJET ─────────────────────────────────────────────────────────────
function detectSubject(message) {
  const subjectKeywords = {
    'mathématiques': ['math', 'calcul', 'équation', 'fraction', 'addition', 'soustraction', 'multiplication', 'division', 'géométrie', 'algèbre'],
    'français': ['français', 'grammaire', 'conjugaison', 'orthographe', 'lecture', 'texte', 'littérature'],
    'histoire': ['histoire', 'époque', 'roi', 'guerre', 'révolution', 'siècle'],
    'géographie': ['géographie', 'carte', 'pays', 'capitale', 'continent', 'climat'],
    'sciences': ['science', 'physique', 'chimie', 'biologie', 'expérience', 'atome', 'molécule'],
    'anglais': ['anglais', 'english', 'vocabulary', 'grammar'],
    'philosophie': ['philosophie', 'philo', 'concept', 'raisonnement']
  };

  const lowerMessage = message.toLowerCase();
  
  for (const [subject, keywords] of Object.entries(subjectKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return subject;
    }
  }
  
  return 'général';
}

// ── MOCK AI RESPONSE WITH CONTEXT ─────────────────────────────────────────────────
function getMockAIResponseWithContext(message, childName, childAge, educationalLevel, conversationHistory, academicContext, profile) {
  const lowerMessage = message.toLowerCase();
  const level = educationalLevel || 'CM2';
  
  // Incorporer le contexte académique dans la réponse
  let contextAddition = '';
  if (academicContext && academicContext.includes('WIKIPEDIA')) {
    contextAddition = "D'après les sources académiques officielles, ";
  }
  
  // Basé sur le profil existant mais avec le contexte académique
  const baseResponse = getMockAIResponse(message, childName, childAge, educationalLevel, conversationHistory);
  
  // Ajouter une référence académique si disponible
  if (academicContext && !baseResponse.includes('selon') && !baseResponse.includes('officiel')) {
    const academicAdditions = [
      " Selon les programmes officiels, c'est exactement ce qu'on apprend à ce niveau.",
      " Les sources académiques confirment cette approche.",
      " C'est conforme au programme scolaire actuel."
    ];
    const randomAddition = academicAdditions[Math.floor(Math.random() * academicAdditions.length)];
    return baseResponse + randomAddition;
  }
  
  return baseResponse;
}

// Importer la fonction mock existante
function getMockAIResponse(message, childName, childAge, educationalLevel, conversationHistory = []) {
  // Utiliser la logique existante du aiService.js
  // Pour simplifier, on retourne une réponse de base
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut')) {
    return `Bonjour ${childName} ! 👋 Je suis là pour t'aider avec tes études. Comment puis-je t'aider aujourd'hui ?`;
  }
  
  if (lowerMessage.includes('aide') || lowerMessage.includes('devoirs')) {
    return `Je suis là pour t'aider ${childName} ! 📚 Qu'est-ce que tu dois réviser aujourd'hui ?`;
  }
  
  if (lowerMessage.includes('math') || lowerMessage.includes('calcul')) {
    return `Les maths, c'est comme un jeu de logique ! 🔢 Dis-moi ce qui te pose problème en mathématiques.`;
  }
  
  return `C'est une excellente question ${childName} ! Je suis là pour t'aider. Dis-moi en plus sur ce que tu veux apprendre ! 🌟`;
}

// ── API ENDPOINT POUR CONFIGURER LE PROFIL IA ─────────────────────────────────────
exports.configureAIProfile = async (req, res) => {
  const { childId } = req.params;
  const { profileName, customProfile } = req.body;

  try {
    let profile;
    
    if (customProfile) {
      // Valider le profil personnalisé
      const validation = aiPersonalization.validateProfile(customProfile);
      if (!validation.isValid) {
        return res.status(400).json({ 
          error: 'Profil invalide', 
          errors: validation.errors,
          warnings: validation.warnings 
        });
      }
      
      profile = aiPersonalization.createCustomProfile(childId, customProfile);
    } else if (profileName) {
      profile = aiPersonalization.getProfile(profileName);
    } else {
      profile = aiPersonalization.getProfile('guardian');
    }

    // Sauvegarder la préférence en base de données
    try {
      await query(
        'UPDATE children SET ai_persona_name = $1, ai_tone = $2 WHERE id = $3',
        [profile.name, profileName || 'custom', childId]
      );
    } catch (dbErr) {
      logger.warn('Failed to save AI profile preference:', dbErr.message);
    }

    res.json({
      success: true,
      profile: profile.name,
      description: profile.description
    });
  } catch (err) {
    logger.error('configureAIProfile error:', err);
    res.status(500).json({ error: 'Erreur lors de la configuration du profil IA' });
  }
};

// ── API ENDPOINT POUR OBTENIR LES PROFILS DISPONIBLES ─────────────────────────────
exports.getAvailableProfiles = async (req, res) => {
  try {
    const profiles = aiPersonalization.getAvailableProfiles();
    res.json({ profiles });
  } catch (err) {
    logger.error('getAvailableProfiles error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des profils' });
  }
};

// ── API ENDPOINT POUR RECHERCHE ACADEMIQUE ───────────────────────────────────────
exports.searchAcademicContent = async (req, res) => {
  const { query, subject, level } = req.query;

  try {
    const results = await academicIntegration.searchAcademicContent(query, subject, level);
    res.json(results);
  } catch (err) {
    logger.error('searchAcademicContent error:', err);
    res.status(500).json({ error: 'Erreur lors de la recherche académique' });
  }
};
