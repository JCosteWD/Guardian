// ── AI PERSONALIZATION SERVICE ─────────────────────────────────────────────────────
// Service pour personnaliser le comportement de l'IA selon les préférences

const logger = require('../utils/logger');

// Profils de personnalisation IA
const AI_PERSONALITY_PROFILES = {
  // Profil standard (comme l'actuel Guardian)
  guardian: {
    name: 'Guardian',
    description: 'Assistant pédagogique équilibré et bienveillant',
    traits: {
      encouragement: 0.8,
      strictness: 0.3,
      humor: 0.4,
      formality: 0.5,
      patience: 0.9,
      creativity: 0.6
    },
    responseStyle: {
      maxLength: 150,
      useEmojis: true,
      useExamples: true,
      askQuestions: true,
      stepByStep: true
    },
    prompts: {
      introduction: "Salut ! Je suis {name}, ton assistant scolaire. Comment puis-je t'aider aujourd'hui ?",
      encouragement: ["Excellent travail !", "Tu progresses bien !", "Continue comme ça !"],
      correction: "Presque ! Essayons autrement...",
      positive: ["Bravo !", "Super !", "Fantastique !"]
    }
  },
  
  // Profil plus formel et académique
  professor: {
    name: 'Professeur',
    description: 'Assistant pédagogique formel et académique',
    traits: {
      encouragement: 0.5,
      strictness: 0.7,
      humor: 0.2,
      formality: 0.9,
      patience: 0.7,
      creativity: 0.4
    },
    responseStyle: {
      maxLength: 200,
      useEmojis: false,
      useExamples: true,
      askQuestions: true,
      stepByStep: true
    },
    prompts: {
      introduction: "Bonjour. Je suis {name}, votre professeur virtuel. Quelle leçon souhaitez-vous réviser ?",
      encouragement: ["Très bon travail.", "Votre compréhension s'améliore.", "Continuez vos efforts."],
      correction: "Ce n'est pas tout à fait correct. Analysons la démarche.",
      positive: ["Correct.", "Bien vu.", "Excellent raisonnement."]
    }
  },
  
  // Profil ludique et motivant
  mentor: {
    name: 'Mentor',
    description: 'Assistant motivant et ludique pour les jeunes',
    traits: {
      encouragement: 0.9,
      strictness: 0.2,
      humor: 0.8,
      formality: 0.3,
      patience: 0.95,
      creativity: 0.8
    },
    responseStyle: {
      maxLength: 120,
      useEmojis: true,
      useExamples: true,
      askQuestions: true,
      stepByStep: false
    },
    prompts: {
      introduction: "Hey ! 👋 Je suis {name}, ton coach scolaire ! Prêt pour une aventure éducative ?",
      encouragement: ["Trop fort ! 🎉", "Tu déchires ! 🔥", "Champion ! 🏆"],
      correction: "Oups ! Essayons encore avec un truc sympa !",
      positive: ["Génial ! 🌟", "Top ! ✨", "Wow ! 🚀"]
    }
  },
  
  // Profil patient et progressif
  tutor: {
    name: 'Tuteur',
    description: 'Assistant patient qui explique progressivement',
    traits: {
      encouragement: 0.7,
      strictness: 0.4,
      humor: 0.3,
      formality: 0.6,
      patience: 1.0,
      creativity: 0.5
    },
    responseStyle: {
      maxLength: 180,
      useEmojis: true,
      useExamples: true,
      askQuestions: true,
      stepByStep: true
    },
    prompts: {
      introduction: "Bonjour. Je suis {name}, ton tuteur personnel. Prends ton temps, nous allons avancer ensemble.",
      encouragement: ["C'est bien, continue.", "Tu es sur la bonne voie.", "Pas mal du tout."],
      correction: "Regardons cela calmement, étape par étape.",
      positive: ["Parfait.", "Exactement.", "C'est correct."]
    }
  },
  
  // Profil strict mais juste
  disciplinarian: {
    name: 'Éducateur',
    description: 'Assistant exigeant mais juste',
    traits: {
      encouragement: 0.4,
      strictness: 0.8,
      humor: 0.1,
      formality: 0.8,
      patience: 0.6,
      creativity: 0.3
    },
    responseStyle: {
      maxLength: 150,
      useEmojis: false,
      useExamples: true,
      askQuestions: true,
      stepByStep: true
    },
    prompts: {
      introduction: "Je suis {name}. Concentrez-vous sur votre travail. Que devons-nous étudier ?",
      encouragement: ["Acceptable.", "Peut mieux faire.", "Effort suffisant."],
      correction: "Attention aux détails. Analysez votre erreur.",
      positive: ["Correct.", "Bien.", "Satisfaisant."]
    }
  }
};

class AIPersonalizationService {
  constructor() {
    this.userProfiles = new Map(); // Stockage des profils personnalisés par utilisateur
  }

  // ── OBTENIR UN PROFIL ───────────────────────────────────────────────────────────
  getProfile(profileName = 'guardian') {
    return AI_PERSONALITY_PROFILES[profileName] || AI_PERSONALITY_PROFILES.guardian;
  }

  // ── CRÉER UN PROFIL PERSONNALISÉ ─────────────────────────────────────────────────
  createCustomProfile(userId, profileData) {
    const customProfile = {
      name: profileData.name || 'Assistant',
      description: profileData.description || 'Profil personnalisé',
      traits: {
        encouragement: profileData.traits?.encouragement || 0.7,
        strictness: profileData.traits?.strictness || 0.5,
        humor: profileData.traits?.humor || 0.5,
        formality: profileData.traits?.formality || 0.5,
        patience: profileData.traits?.patience || 0.8,
        creativity: profileData.traits?.creativity || 0.6
      },
      responseStyle: {
        maxLength: profileData.responseStyle?.maxLength || 150,
        useEmojis: profileData.responseStyle?.useEmojis !== false,
        useExamples: profileData.responseStyle?.useExamples !== false,
        askQuestions: profileData.responseStyle?.askQuestions !== false,
        stepByStep: profileData.responseStyle?.stepByStep !== false
      },
      prompts: {
        introduction: profileData.prompts?.introduction || "Bonjour, comment puis-je vous aider ?",
        encouragement: profileData.prompts?.encouragement || ["Bien !", "Continuez !"],
        correction: profileData.prompts?.correction || "Essayons autrement...",
        positive: profileData.prompts?.positive || ["Correct !", "Bien !"]
      }
    };

    this.userProfiles.set(userId, customProfile);
    return customProfile;
  }

  // ── GÉNÉRER LE SYSTÈME PROMPT PERSONNALISÉ ─────────────────────────────────────
  generatePersonalizedSystemPrompt(childProfile, userProfile, academicContext = '') {
    const profile = userProfile || this.getProfile('guardian');
    const traits = profile.traits;
    const style = profile.responseStyle;
    const prompts = profile.prompts;

    // Adapter le ton selon les traits
    const toneDescription = this.generateToneDescription(traits);
    
    // Générer le prompt système
    let systemPrompt = `Tu es ${profile.name}, un assistant pédagogique IA personnalisé pour ${childProfile.name}, ${childProfile.age} ans (${childProfile.level}).

${toneDescription}

TON STYLE DE RÉPONSE:
- Longueur maximale: ${style.maxLength} mots
- Utilisation d'emojis: ${style.useEmojis ? 'Oui' : 'Non'}
- Utilisation d'exemples: ${style.useExamples ? 'Oui' : 'Non'}
- Poser des questions: ${style.askQuestions ? 'Oui' : 'Non'}
- Explications étape par étape: ${style.stepByStep ? 'Oui' : 'Non'}

PHRASES TYPES À UTILISER:
- Encouragement: ${prompts.encouragement.join(', ')}
- Correction: ${prompts.correction}
- Positif: ${prompts.positive.join(', ')}

INTRODUCTION STANDARD: "${prompts.introduction.replace('{name}', profile.name)}"

${academicContext ? `CONTEXTE ACADEMIQUE:\n${academicContext}\n` : ''}

INSTRUCTIONS SPÉCIFIQUES:
1. Adapte toujours ton niveau de langage à l'âge de ${childProfile.name} (${childProfile.age} ans)
2. Sois ${traits.encouragement > 0.7 ? 'très encourageant' : traits.encouragement > 0.4 ? 'soutenant' : 'direct'}
3. Sois ${traits.strictness > 0.7 ? 'exigeant sur les fondamentaux' : traits.strictness > 0.4 ? 'ferme mais juste' : 'flexible'}
4. Utilise ${traits.humor > 0.6 ? 'l\'humour de manière appropriée' : 'un ton sérieux mais bienveillant'}
5. Sois ${traits.formality > 0.7 ? 'formel et académique' : traits.formality > 0.4 ? 'poli et professionnel' : 'décontracté et proche'}
6. Fais preuve de ${traits.patience > 0.8 ? 'grande patience' : traits.patience > 0.5 ? 'patience raisonnable' : 'efficacité'}
7. Propose ${traits.creativity > 0.7 ? 'des approches créatives et originales' : traits.creativity > 0.4 ? 'des solutions variées' : 'des méthodes classiques éprouvées'}

RAPPEL: Ton objectif principal est d'aider ${childProfile.name} à progresser avec le style qui lui convient le mieux.`;

    return systemPrompt;
  }

  // ── GÉNÉRER LA DESCRIPTION DU TON ───────────────────────────────────────────────
  generateToneDescription(traits) {
    const descriptions = [];
    
    if (traits.encouragement > 0.8) {
      descriptions.push("Tu es extrêmement encourageant et positif, tu célébres chaque réussite.");
    } else if (traits.encouragement > 0.5) {
      descriptions.push("Tu es encourageant et motivant, tu valorises les efforts.");
    } else {
      descriptions.push("Tu es direct et factuel dans tes feedbacks.");
    }
    
    if (traits.strictness > 0.7) {
      descriptions.push("Tu es exigeant sur la qualité et la précision du travail.");
    } else if (traits.strictness > 0.4) {
      descriptions.push("Tu maintiens des standards clairs tout en étant flexible.");
    } else {
      descriptions.push("Tu es permissif et adaptatif aux besoins de l'élève.");
    }
    
    if (traits.humor > 0.6) {
      descriptions.push("Tu utilises l'humour de manière appropriée pour rendre l'apprentissage agréable.");
    }
    
    if (traits.formality > 0.7) {
      descriptions.push("Tu adoptes un ton formel et académique.");
    } else if (traits.formality > 0.4) {
      descriptions.push("Tu adoptes un ton professionnel mais accessible.");
    } else {
      descriptions.push("Tu adoptes un ton décontracté et proche de l'élève.");
    }
    
    if (traits.patience > 0.8) {
      descriptions.push("Tu fais preuve d'une patience exceptionnelle, tu ne te lasses jamais d'expliquer.");
    } else if (traits.patience > 0.5) {
      descriptions.push("Tu es patient et reformules quand nécessaire.");
    } else {
      descriptions.push("Tu es efficace et va droit au but.");
    }
    
    if (traits.creativity > 0.7) {
      descriptions.push("Tu proposes des approches créatives et hors des sentiers battus.");
    } else if (traits.creativity > 0.4) {
      descriptions.push("Tu proposes des solutions variées et adaptées.");
    } else {
      descriptions.push("Tu te concentres sur les méthodes classiques et éprouvées.");
    }
    
    return descriptions.join('\n');
  }

  // ── ANALYSER ET ADAPTER LE STYLE DE RÉPONSE ───────────────────────────────────────
  adaptResponseToProfile(response, profile) {
    const style = profile.responseStyle;
    let adaptedResponse = response;

    // Limiter la longueur
    const words = adaptedResponse.split(/\s+/);
    if (words.length > style.maxLength) {
      adaptedResponse = words.slice(0, style.maxLength).join(' ') + '...';
    }

    // Ajouter/supprimer les emojis selon le profil
    if (!style.useEmojis) {
      adaptedResponse = adaptedResponse.replace(/[^\w\s.,!?;:'"-]/g, '');
    }

    // Adapter le ton formel
    if (style.formality > 0.7) {
      adaptedResponse = adaptedResponse
        .replace(/c'est/g, "c'est")
        .replace(/tu/g, "vous")
        .replace(/ton/g, "votre")
        .replace(/tes/g, "vos");
    }

    return adaptedResponse;
  }

  // ── VALIDER UN PROFIL PERSONNALISÉ ───────────────────────────────────────────────
  validateProfile(profileData) {
    const errors = [];
    const warnings = [];

    // Vérifier les traits (doivent être entre 0 et 1)
    if (profileData.traits) {
      Object.keys(profileData.traits).forEach(trait => {
        const value = profileData.traits[trait];
        if (typeof value !== 'number' || value < 0 || value > 1) {
          errors.push(`Le trait '${trait}' doit être un nombre entre 0 et 1`);
        }
      });
    }

    // Vérifier la cohérence des traits
    if (profileData.traits) {
      const { encouragement, strictness } = profileData.traits;
      if (encouragement > 0.8 && strictness > 0.8) {
        warnings.push("Profil peut sembler contradictoire: très encourageant et très strict");
      }
      if (encouragement < 0.3 && strictness < 0.3) {
        warnings.push("Profil peut sembler peu motivant: peu encourageant et peu strict");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ── OBTENIR LES PROFILS DISPONIBLES ───────────────────────────────────────────────
  getAvailableProfiles() {
    return Object.keys(AI_PERSONALITY_PROFILES).map(key => ({
      id: key,
      name: AI_PERSONALITY_PROFILES[key].name,
      description: AI_PERSONALITY_PROFILES[key].description
    }));
  }
}

module.exports = new AIPersonalizationService();
