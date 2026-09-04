const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../config/database');
const { quota } = require('../config/redis');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key_for_dev_mode' });
const mockMode = process.env.NODE_ENV === 'development' && !process.env.ANTHROPIC_API_KEY;
logger.debug('[AI Service] mockMode:', mockMode, 'NODE_ENV:', process.env.NODE_ENV);

// ── EDUCATIONAL LEVELS ─────────────────────────────────────────────────────────
const EDUCATIONAL_LEVELS = {
  'CE1': { age: 7, description: 'Cours Élémentaire 1ère année', complexity: 'très simple' },
  'CE2': { age: 8, description: 'Cours Élémentaire 2ème année', complexity: 'simple' },
  'CM1': { age: 9, description: 'Cours Moyen 1ère année', complexity: 'simple' },
  'CM2': { age: 10, description: 'Cours Moyen 2ème année', complexity: 'simple' },
  '6eme': { age: 11, description: 'Sixième', complexity: 'intermédiaire' },
  '5eme': { age: 12, description: 'Cinquième', complexity: 'intermédiaire' },
  '4eme': { age: 13, description: 'Quatrième', complexity: 'intermédiaire' },
  '3eme': { age: 14, description: 'Troisième', complexity: 'intermédiaire' },
  '2nde': { age: 15, description: 'Seconde', complexity: 'avancé' },
  '1ere': { age: 16, description: 'Première', complexity: 'avancé' },
  'Terminale': { age: 17, description: 'Terminale', complexity: 'très avancé' },
};

const getLevelFromAge = (age) => {
  const levelMap = {
    7: 'CE1', 8: 'CE2', 9: 'CM1', 10: 'CM2',
    11: '6eme', 12: '5eme', 13: '4eme', 14: '3eme',
    15: '2nde', 16: '1ere', 17: 'Terminale'
  };
  return levelMap[age] || 'CM2';
};

// ── BUILD EDUCATIONAL SYSTEM PROMPT ─────────────────────────────────────────────
const buildEducationalSystemPrompt = (childName, childAge, educationalLevel, recentGrades, subjects) => {
  const levelInfo = EDUCATIONAL_LEVELS[educationalLevel] || EDUCATIONAL_LEVELS['CM2'];

  return `Tu es Guardian, un assistant pédagogique IA expert créé pour accompagner ${childName}, ${childAge} ans (${educationalLevel} - ${levelInfo.description}).

TON RÔLE PRINCIPAL:
Tu es un tuteur personnel bienveillant et patient. Ta mission est d'aider ${childName} à comprendre, apprendre et progresser dans toutes les matières scolaires, du niveau ${educationalLevel}.

NIVEAU SCOLAIRE: ${educationalLevel}
Âge de l'élève: ${childAge} ans
Complexité des explications: ${levelInfo.complexity}

${recentGrades && recentGrades.length > 0 ? `NOTES RÉCENTES:
${recentGrades.map(g => `${g.subject}: ${g.grade}/${g.max_grade}`).join(', ')}` : ''}

${subjects && subjects.length > 0 ? `MATIÈRES SUIVIES: ${subjects.join(', ')}` : ''}

PRINCIPES PÉDAGOGIQUES FONDAMENTAUX:

1. ADAPTATION DU NIVEAU:
   - Pour CE1-CM2: Utilise un langage simple, des analogies concrètes, des exemples du quotidien. Évite le jargon.
   - Pour 6ème-3ème: Introduis progressivement le vocabulaire spécifique, utilise des exemples plus abstraits.
   - Pour 2nde-Terminale: Utilise un langage précis, des concepts formels, des raisonnements complexes.

2. MÉTHODE D'EXPLICATION:
   - Commence par une explication simple et intuitive
   - Donne 2-3 exemples concrets adaptés au niveau
   - Propose un exercice d'application immédiat
   - Vérifie la compréhension avec une question de contrôle
   - Si l'élève ne comprend pas, reformule différemment

3. STRUCTURE DES RÉPONSES:
   - Introduction brève et engageante
   - Explication progressive (étape par étape)
   - Exemples illustratifs
   - Résumé des points clés
   - Proposition d'exercice ou d'approfondissement

4. TON ET STYLE:
   - Encourageant et positif ("Excellent question !", "Tu as raison de te poser cette question")
   - Patient et compréhensif ("C'est normal de ne pas comprendre tout de suite")
   - Motivant ("Tu es capable de comprendre ça")
   - Utilise des emojis modérément pour rendre le texte plus vivant

5. GESTION DES ERREURS:
   - Ne jamais dire "c'est faux" de manière brutale
   - Reformuler: "Presque ! Voici une autre façon de voir..."
   - Expliquer pourquoi la réponse n'est pas correcte
   - Donner une chance de se corriger

6. MATIÈRES COUVERTES:
   - MATHÉMATIQUES: Calcul, algèbre, géométrie, statistiques, fonctions (adapté au niveau)
   - FRANÇAIS: Grammaire, conjugaison, orthographe, littérature, analyse de texte
   - HISTOIRE-GÉOGRAPHIE: Périodes historiques, géographie physique et humaine
   - SCIENCES: Physique, chimie, biologie, SVT (adapté au niveau)
   - LANGUES: Anglais, espagnol, allemand (grammaire, vocabulaire)
   - PHILOSOPHIE (pour lycée): Concepts fondamentaux, raisonnement
   - SPÉCIALITÉS (Terminale): Maths expertes, SVT, HGGSP, etc.

7. TECHNIQUES PÉDAGOGIQUES:
   - Socratic method: poser des questions guidées pour mener à la réponse
   - Analogies: comparer des concepts abstraits à des situations concrètes
   - Visualisation: décrire des schémas mentaux
   - Métacognition: apprendre à apprendre (méthodes de mémorisation, organisation)

8. INTERACTION AVEC LES RÈGLES PARENTALES:
   - Si l'élève demande pourquoi son temps d'écran est réduit: expliquer avec empathie que c'est pour l'aider à trouver un équilibre
   - Proposer des quiz éducatifs pour gagner du temps bonus
   - Encourager l'autonomie dans les devoirs

FORMAT DES RÉPONSES:
- Maximum 5-6 phrases par réponse pour garder l'attention
- Utilise des listes à puces pour les étapes
- Formatage clair avec des émojis pour les points importants
- Termine par une question pour vérifier la compréhension ou proposer la suite

EXEMPLE DE RÉPONSE (niveau CM2 - fractions):
"Les fractions, c'est comme partager une pizza ! 🍕
1. Le chiffre du bas (dénominateur) = combien de parts on partage
2. Le chiffre du haut (numérateur) = combien de parts on prend
Exemple: 3/4 = on partage en 4, on prend 3 parts
Essaye: si on partage en 6 et on prend 2, quelle fraction c'est ?"

CAPACITÉS SPÉCIALES:
- Détecte si l'élève est frustré/triste → réponds avec empathie et propose de parler aux parents
- Propose systématiquement des quiz pour gagner du temps bonus quand approprié
- Adapte la complexité en fonction des réponses de l'élève

RAPPEL: Tu es là pour aider ${childName} à progresser, pas pour juger. Chaque erreur est une opportunité d'apprendre !`;
};

// ── MOCK AI RESPONSES (for development without API key) ─────────────────────
const getMockAIResponse = (message, childName, childAge, educationalLevel, conversationHistory = []) => {
  const lowerMessage = message.toLowerCase();
  const level = educationalLevel || getLevelFromAge(childAge);

  const lastMessage = conversationHistory[conversationHistory.length - 2]?.content?.toLowerCase() || '';

  if (lastMessage.includes('fraction') && lastMessage.includes('essaie') && lastMessage.includes('quelle fraction')) {
    const match = lastMessage.match(/partage en (\d+).*prend (\d+)/);
    if (match) {
      const expectedDenominator = parseInt(match[1]);
      const expectedNumerator = parseInt(match[2]);
      const expectedAnswer = `${expectedNumerator}/${expectedDenominator}`;

      if (lowerMessage.includes(expectedAnswer) || lowerMessage.includes(`${expectedNumerator}/${expectedDenominator}`)) {
        return `🎉 Exactement ! C'est ${expectedAnswer} ! Tu as bien compris le principe des fractions. Le chiffre du bas (${expectedDenominator}) indique le nombre total de parts, et celui du haut (${expectedNumerator}) indique combien tu en prends. Veux-tu essayer un exercice d'addition de fractions ?`;
      } else {
        return `Presque ! Regarde: on a partagé en ${expectedDenominator} parts et on en prend ${expectedNumerator}. Donc la fraction est ${expectedNumerator}/${expectedDenominator}. Le chiffre du bas = total des parts, celui du haut = parts prises. Essaie encore avec un autre exemple: si on partage en 5 et on prend 2, quelle fraction c'est ?`;
      }
    }
  }

  if (lastMessage.includes('équation') && lastMessage.includes('essaie')) {
    if (lowerMessage.includes('4') && lastMessage.includes('2x + 3 = 11')) {
      return `✅ Bravo ! x = 4 est correct ! Tu as bien isolé l'inconnue. D'abord tu as enlevé 3 des deux côtés (2x = 8), puis divisé par 2 (x = 4). Veux-tu essayer une équation un peu plus difficile ?`;
    }
    return `Pas tout à fait... Pour résoudre 2x + 3 = 11, il faut d'abord enlever 3 des deux côtés: 2x = 8, puis diviser par 2: x = 4. Essaie encore !`;
  }

  if (lowerMessage.includes('pourquoi') && (lowerMessage.includes('temps') || lowerMessage.includes('réduit') || lowerMessage.includes('bloqué'))) {
    return `Salut ${childName} ! 💙 Je comprends que tu sois frustré(e). Tes parents ont réduit ton temps d'écran parce qu'ils veulent t'aider à trouver un bon équilibre. Ce n'est pas une punition, c'est pour t'encourager à passer du temps sur d'autres activités importantes ! 🌟`;
  }

  if (lowerMessage.includes('quiz') || lowerMessage.includes('défi') || lowerMessage.includes('test')) {
    return `Super idée ${childName} ! 🎯 Je peux te proposer un quiz amusant adapté à ton niveau (${level}). Si tu obtiens 8/10, tu gagneras 15 minutes bonus ! Veux-tu faire un quiz sur les maths, la géographie, ou la culture générale ? [QUIZ_REQUESTED: culture générale]`;
  }

  if (lowerMessage.includes('aide') || lowerMessage.includes('devoirs') || lowerMessage.includes('réviser')) {
    return `Je suis là pour t'aider ${childName} ! 📚 Qu'est-ce que tu dois réviser aujourd'hui ? Je peux t'expliquer ou te proposer des exercices adaptés à ton niveau (${level}). N'hésite pas à me dire quelle matière te pose problème !`;
  }

  if (lowerMessage.includes('triste') || lowerMessage.includes('énervé') || lowerMessage.includes('frustré')) {
    return `Je vois que tu ne te sens pas bien ${childName}... 💙 C'est normal d'avoir des moments difficiles. Parles-en calmement avec tes parents, ils sont là pour t'écouter et t'aider. Tu n'es pas seul(e) ! [MOOD: sad]`;
  }

  if (lowerMessage.includes('bonjour') || lowerMessage.includes('salut') || lowerMessage.includes('hello')) {
    return `Bonjour ${childName} ! 👋 Je suis Guardian, ton tuteur IA personnel. Je suis là pour t'aider avec tes leçons (niveau ${level}), t'expliquer tes devoirs, ou te proposer des quiz pour gagner du temps bonus ! Comment puis-je t'aider ?`;
  }

  if (lowerMessage.includes('présente') || lowerMessage.includes('qui es-tu') || lowerMessage.includes('détails')) {
    return `Je suis Guardian, ton assistant pédagogique IA expert ! 🤖 Je suis spécialisé dans l'accompagnement scolaire du CE1 à la Terminale. Je peux : expliquer toutes tes matières (maths, français, histoire, sciences...), t'aider à comprendre tes leçons, préparer tes examens, et te proposer des quiz pour gagner du temps bonus. Ton niveau actuel : ${level}. Sur quoi veux-tu travailler ?`;
  }

  if (lowerMessage.includes('fraction')) {
    if (['CE1', 'CE2', 'CM1', 'CM2'].includes(level)) {
      return `Les fractions, c'est comme partager une pizza ! 🍕 Imagine que tu as 1 pizza. Si tu la coupes en 4 parts égales et tu en prends 1, tu as 1/4 de la pizza. Le chiffre du bas (4) dit combien de parts au total, et celui du haut (1) dit combien tu en prends. Essaie: si on partage en 8 et on prend 3, quelle fraction c'est ?`;
    } else {
      return `Les fractions représentent une partie d'un tout ! 📐 Pour ton niveau (${level}): le numérateur (chiffre du haut) indique les parts prises, le dénominateur (chiffre du bas) indique le total des parts. Exemple: 3/4 = 3 parts sur 4 au total. Pour additionner des fractions, il faut le même dénominateur. Veux-tu que je t'explique comment faire ?`;
    }
  }

  if (lowerMessage.includes('multiplication') || lowerMessage.includes('fois')) {
    return `La multiplication, c'est une addition répétée ! ✖️ Par exemple, 3 × 4 = 4 + 4 + 4 = 12. C'est super utile pour calculer rapidement. Au niveau ${level}, on utilise aussi la multiplication pour les aires, les volumes, ou les proportions. Veux-tu un exercice de multiplication ?`;
  }

  if (lowerMessage.includes('équation') || lowerMessage.includes('x')) {
    if (['6eme', '5eme', '4eme', '3eme'].includes(level)) {
      return `Une équation, c'est comme une balance à équilibre ! ⚖️ Le but est de trouver la valeur de x qui rend les deux côtés égaux. Par exemple: 2x + 3 = 11. On cherche x. D'abord, on enlève 3 des deux côtés: 2x = 8. Ensuite, on divise par 2: x = 4. Vérifie: 2×4 + 3 = 11 ✓ Veux-tu essayer une autre équation ?`;
    } else {
      return `Les équations sont au cœur de l'algèbre ! 🔢 Pour ton niveau (${level}), on manipule des équations plus complexes (second degré, systèmes, etc.). Le principe reste le même: isoler l'inconnue. Quelle type d'équation te pose problème ?`;
    }
  }

  if (lowerMessage.includes('addition') || lowerMessage.includes('soustraction')) {
    return `Les additions et soustractions sont la base des calculs ! ➕➖ Pour ton niveau (${level}), on travaille avec des nombres entiers, puis des décimaux. L'addition combine des quantités, la soustraction en retire. Veux-tu un exercice de calcul ?`;
  }

  if (lowerMessage.includes('division') || lowerMessage.includes('diviser')) {
    return `La division, c'est partager en parts égales ! ➗ Par exemple, 12 ÷ 3 = 4 signifie qu'on partage 12 en 3 parts égales, chaque part vaut 4. C'est l'inverse de la multiplication. Veux-tu essayer un exercice de division ?`;
  }

  if (lowerMessage.includes('géométrie') || lowerMessage.includes('triangle') || lowerMessage.includes('carré') || lowerMessage.includes('cercle')) {
    return `La géométrie, c'est l'étude des formes ! 🔷 Au niveau ${level}, on apprend à reconnaître les figures (triangles, carrés, cercles), calculer des périmètres et des aires. Quelle forme géométrique t'intéresse ?`;
  }

  if (lowerMessage.includes('grammaire') || lowerMessage.includes('accord') || lowerMessage.includes('sujet') || lowerMessage.includes('verbe')) {
    return `La grammaire, c'est la structure de la langue ! 📖 Au niveau ${level}, on apprend les accords (sujet-verbe, nom-adjectif), les types de phrases, et les fonctions grammaticales. Quel point de grammaire te pose problème ?`;
  }

  if (lowerMessage.includes('conjugaison') || lowerMessage.includes('temps') || lowerMessage.includes('verbe')) {
    return `La conjugaison, c'est accorder le verbe avec le sujet ! ⏰ Au niveau ${level}, on maîtrise les temps simples (présent, imparfait, futur) et les temps composés (passé composé). Quel temps de conjugaison veux-tu travailler ?`;
  }

  if (lowerMessage.includes('orthographe')) {
    return `L'orthographe, c'est écrire correctement ! ✍️ Au niveau ${level}, on travaille les règles d'orthographe grammaticale et les mots difficiles. Quel type d'erreur d'orthographe fais-tu souvent ?`;
  }

  if (lowerMessage.includes('lecture') || lowerMessage.includes('texte') || lowerMessage.includes('compréhension')) {
    return `La compréhension de texte, c'est comprendre ce qu'on lit ! 📖 Au niveau ${level}, on apprend à repérer les informations importantes, comprendre le sens global, et analyser un texte. Quel type de texte lis-tu ?`;
  }

  if (lowerMessage.includes('révolution') || lowerMessage.includes('guerre') || lowerMessage.includes('roi') || lowerMessage.includes('empereur')) {
    return `L'histoire, c'est comprendre notre passé ! 🏛️ Au niveau ${level}, on étudie les grandes périodes (Antiquité, Moyen Âge, Temps modernes, Époque contemporaine). Quelle période historique t'intéresse ?`;
  }

  if (lowerMessage.includes('carte') || lowerMessage.includes('pays') || lowerMessage.includes('capitale') || lowerMessage.includes('continent')) {
    return `La géographie, c'est connaître le monde ! 🗺️ Au niveau ${level}, on apprend à lire des cartes, reconnaître les pays et leurs capitales, comprendre les climats et les paysages. Quel pays ou continent veux-tu découvrir ?`;
  }

  if (lowerMessage.includes('atome') || lowerMessage.includes('molécule') || lowerMessage.includes('réaction')) {
    return `La chimie, c'est l'étude de la matière ! ⚗️ Au niveau ${level}, on découvre les atomes, les molécules, et les réactions chimiques. C'est comme de la cuisine à l'échelle microscopique ! Quel sujet chimique t'intrigue ?`;
  }

  if (lowerMessage.includes('force') || lowerMessage.includes('vitesse') || lowerMessage.includes('énergie') || lowerMessage.includes('gravité')) {
    return `La physique, c'est comprendre comment fonctionne l'univers ! ⚡ Au niveau ${level}, on étudie les forces, le mouvement, l'électricité, et la lumière. C'est la science des lois de la nature. Quel phénomène physique veux-tu comprendre ?`;
  }

  if (lowerMessage.includes('cellule') || lowerMessage.includes('adn') || lowerMessage.includes('gène') || lowerMessage.includes('évolution')) {
    return `La biologie, c'est l'étude du vivant ! 🧬 Au niveau ${level}, on découvre les cellules, l'ADN, les organes, et le fonctionnement du corps humain. C'est fascinant de comprendre comment on est fait ! Quel sujet biologique t'intéresse ?`;
  }

  if (lowerMessage.includes('planète') || lowerMessage.includes('étoile') || lowerMessage.includes('système solaire') || lowerMessage.includes('univers')) {
    return `L'astronomie, c'est l'étude de l'univers ! 🌌 Au niveau ${level}, on apprend le système solaire, les planètes, les étoiles, et les galaxies. Notre Terre est une petite planète dans un immense univers ! Quel sujet astronomique t'intrigue ?`;
  }

  if (lowerMessage.includes('liberté') || lowerMessage.includes('bonheur') || lowerMessage.includes('conscience') || lowerMessage.includes('vérité')) {
    if (['2nde', '1ere', 'Terminale'].includes(level)) {
      return `C'est une question philosophique fondamentale ! 🧠 Au niveau ${level}, on réfléchit sur ces concepts avec les grands philosophes. Par exemple, la liberté: est-ce qu'on est vraiment libre ou déterminé ? Quelle aspect veux-tu approfondir ?`;
    }
    return `C'est une question profonde ! Pour l'approfondir, on étudie généralement la philosophie à partir de la Seconde. En attendant, je peux t'aider avec les autres matières. Qu'est-ce qui t'intéresse ?`;
  }

  if (lowerMessage.includes('math') || lowerMessage.includes('maths') || lowerMessage.includes('calcul')) {
    return `Les maths, c'est comme un jeu de logique ! 🔢 Au niveau ${level}, je peux t'aider avec: calculs, fractions, équations, fonctions, géométrie, statistiques, probabilités. Quel sujet te pose problème ?`;
  }

  if (lowerMessage.includes('français') || lowerMessage.includes('littérature')) {
    return `Le français, c'est la base de tout ! 📖 Au niveau ${level}, je peux t'aider avec: grammaire (accords, types de phrases), conjugaison (temps, modes), orthographe, analyse de texte, figures de style. Sur quel sujet as-tu besoin d'aide ?`;
  }

  if (lowerMessage.includes('histoire') || lowerMessage.includes('géographie')) {
    return `L'histoire et la géographie, c'est passionnant ! 🌍 Au niveau ${level}, on étudie: périodes historiques, civilisations, géographie physique (climats, reliefs), géographie humaine (population, économie). Qu'est-ce qui t'intéresse ?`;
  }

  if (lowerMessage.includes('science') || lowerMessage.includes('physique') || lowerMessage.includes('chimie') || lowerMessage.includes('biologie') || lowerMessage.includes('svt')) {
    return `Les sciences, c'est magique ! 🔬 Au niveau ${level}, je peux t'expliquer: physique (forces, électricité, lumière), chimie (atomes, réactions), biologie (cellules, ADN), SVT (écosystèmes, corps humain). Quel sujet scientifique t'intrigue ?`;
  }

  if (lowerMessage.includes('philosophie') || lowerMessage.includes('philo')) {
    if (['2nde', '1ere', 'Terminale'].includes(level)) {
      return `La philosophie, c'est l'art de penser ! 🧠 Au niveau ${level}, on étudie: concepts fondamentaux (liberté, bonheur, conscience), raisonnement logique, grands philosophes. Quelle question philosophique te préoccupe ?`;
    }
    return `La philosophie, c'est passionnant mais on l'étudie généralement à partir de la Seconde ! 🧠 Pour l'instant, je peux t'aider avec les autres matières. Qu'est-ce qui t'intéresse ?`;
  }

  const defaultResponses = [
    `C'est une excellente question ${childName} ! Je suis là pour t'aider au niveau ${level}. Dis-moi en plus sur ce que tu veux apprendre ! 🌟`,
    `Je comprends ${childName} ! Je peux t'expliquer n'importe quelle matière adaptée à ton niveau (${level}). De quoi as-tu besoin ?`,
    `Intéressant ${childName} ! N'hésite pas à me poser tes questions sur tes études. Je suis là pour t'accompagner dans ton apprentissage ! 💙`,
  ];

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

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

    let aiResponse;
    if (mockMode) {
      aiResponse = getMockAIResponse(
        message,
        ctx.child.first_name,
        ctx.child.age,
        getLevelFromAge(ctx.child.age),
        messages
      );
    } else {
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'claude-opus-4-5',
        max_tokens: parseInt(process.env.AI_MAX_TOKENS) || 1024,
        system: systemPrompt,
        messages,
      });
      aiResponse = response.content[0].text;
    }

    let quizRequested = null;
    let mood = null;

    const quizMatch = aiResponse.match(/\[QUIZ_REQUESTED:\s*([^\]]+)\]/);
    if (quizMatch) quizRequested = quizMatch[1].trim();

    const moodMatch = aiResponse.match(/\[MOOD:\s*(\w+)\]/);
    if (moodMatch) mood = moodMatch[1];

    const cleanResponse = aiResponse
      .replace(/\[QUIZ_REQUESTED:[^\]]+\]/g, '')
      .replace(/\[MOOD:[^\]]+\]/g, '')
      .trim();

    const updatedHistory = [
      ...messages,
      { role: 'assistant', content: cleanResponse },
    ].slice(-20);

    if (sessionId) {
      await query(
        'UPDATE ai_conversations SET messages = $1, mood_detected = $2, updated_at = NOW() WHERE id = $3',
        [JSON.stringify(updatedHistory), mood, sessionId]
      );
    } else {
      await query(
        `INSERT INTO ai_conversations (child_id, messages, mood_detected)
         VALUES ($1, $2, $3) RETURNING id`,
        [childId, JSON.stringify(updatedHistory), mood]
      );
    }

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

    let quizData;
    if (mockMode) {
      quizData = {
        subject: subject || 'Culture générale',
        questions: Array.from({ length: numQuestions }, (_, i) => ({
          id: i + 1,
          question: `Question ${i + 1} de ${subject || 'culture générale'} pour ${child.age} ans ?`,
          options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
          correct: 0,
          explanation: 'Bravo, bonne réponse !',
        })),
      };
    } else {
      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      try {
        const text = response.content[0].text.replace(/```json|```/g, '').trim();
        quizData = JSON.parse(text);
      } catch {
        return res.status(500).json({ error: 'Erreur de génération du quiz' });
      }
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
  const { quizId, answers } = req.body;

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

    await query(
      `UPDATE quizzes SET status = $1, score = $2, correct_answers = $3, completed_at = NOW()
       WHERE id = $4`,
      [passed ? 'passed' : 'failed', score, correct, quizId]
    );

    if (passed) {
      await quota.addBonus(childId, quiz.time_bonus_mins);

      await query(
        `UPDATE daily_quotas SET bonus_mins = bonus_mins + $1
         WHERE child_id = $2 AND quota_date = CURRENT_DATE`,
        [quiz.time_bonus_mins, childId]
      );

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
    }

    let aiTextMessage = passed
      ? `Félicitations ! Tu as réussi le quiz avec un score de ${correct}/${questions.length} et gagné ${quiz.time_bonus_mins} min bonus !`
      : `Tu as obtenu ${correct}/${questions.length}. N'hésite pas à réessayer bientôt !`;

    if (!mockMode) {
      const encouragementPrompt = `${req.child.first_name} vient de terminer un quiz sur "${quiz.subject}".
Score: ${correct}/${questions.length} (${Math.round(score * 100)}%).
${passed ? `BRAVO ! Il/elle a gagné ${quiz.time_bonus_mins} minutes bonus !` : `Ce n'est pas suffisant (minimum: ${Math.round(quiz.pass_threshold * 100)}%). Reste encourageant.`}
Génère UN message d'encouragement court (2-3 phrases max), adapté à ${req.child.age} ans.`;

      const aiMsg = await client.messages.create({
        model: process.env.AI_MODEL || 'claude-opus-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: encouragementPrompt }],
      });
      aiTextMessage = aiMsg.content[0].text;
    }

    res.json({
      passed,
      score: Math.round(score * 100),
      correct,
      total: questions.length,
      bonusMins: passed ? quiz.time_bonus_mins : 0,
      results,
      aiMessage: aiTextMessage,
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

    if (mockMode) {
      return `Rapport hebdomadaire pour ${child.rows[0].first_name} : Bilan très positif cette semaine avec une bonne régularité !`;
    }

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
