// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Internationalisation complète (i18n)
// ══════════════════════════════════════════════════════════════════════════════
// Utilise react-i18next pour React Native et React web.
//
// Langues supportées:
//   fr → Français (défaut)
//   en → English
//   es → Español
//   ar → العربية (RTL)
//
// Installation:
//   npm install react-i18next i18next i18next-react-native-language-detector
//   npm install @react-native-async-storage/async-storage  (déjà installé)

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── TRADUCTIONS ────────────────────────────────────────────────────────────────
const resources = {

  // ── FRANÇAIS ─────────────────────────────────────────────────────────────────
  fr: {
    translation: {
      // App general
      app: {
        name: 'Guardian',
        tagline: 'Contrôle parental intelligent',
        loading: 'Chargement...',
        error: 'Une erreur est survenue',
        retry: 'Réessayer',
        save: 'Sauvegarder',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        delete: 'Supprimer',
        edit: 'Modifier',
        add: 'Ajouter',
        close: 'Fermer',
        back: '← Retour',
        next: 'Suivant →',
        done: 'Terminé',
        yes: 'Oui',
        no: 'Non',
        ok: 'OK',
      },

      // Auth
      auth: {
        login: 'Connexion',
        register: "Créer un compte",
        logout: 'Déconnexion',
        email: 'Adresse email',
        password: 'Mot de passe',
        confirmPassword: 'Confirmer le mot de passe',
        firstName: 'Prénom',
        lastName: 'Nom',
        phone: 'Téléphone (optionnel)',
        forgotPassword: 'Mot de passe oublié ?',
        noAccount: "Pas encore de compte ? Créer un compte",
        hasAccount: "Déjà un compte ? Se connecter",
        loginError: 'Email ou mot de passe incorrect',
        pinLabel: 'Code PIN parental',
        pinPlaceholder: '4 à 8 chiffres',
        twoFALabel: "Code d'authentification (2FA)",
        twoFARequired: 'Code 2FA requis',
        parentSpace: 'Espace parent',
      },

      // Onboarding
      onboarding: {
        skip: 'Passer',
        start: 'Commencer →',
        slide1: {
          title: 'Bienvenue dans\nGuardian',
          body: "Le contrôle parental qui protège vraiment. Impossible à contourner, simple à utiliser.",
        },
        slide2: {
          title: "Gérez le temps\nd'écran",
          body: 'Définissez des quotas quotidiens, des plages horaires et l\'heure du coucher.',
        },
        slide3: {
          title: 'Sécurité\nAndroid réelle',
          body: 'VPN local et droits administrateur empêchent tout contournement.',
        },
        slide4: {
          title: "L'IA Guardian\nbienveillante",
          body: "Votre enfant peut parler à l'IA pour comprendre ses restrictions et gagner du temps.",
        },
        slide5: {
          title: 'Notes &\ncomportement',
          body: 'Saisissez une note en 2 clics. Guardian ajuste le temps automatiquement.',
        },
      },

      // Dashboard parent
      dashboard: {
        title: "Tableau de bord",
        children: 'enfant(s)',
        online: 'En ligne',
        offlineStatus: 'Hors ligne',
        usedToday: 'min utilisées',
        remaining: 'min restantes',
        locked: 'Bloqué',
        quota: 'Temps d\'écran',
        addChild: 'Ajouter un enfant',
        quickActions: 'Actions rapides',
        noChildren: 'Aucun enfant configuré',
        noChildrenSub: 'Cliquez sur "Ajouter un enfant" pour commencer.',
        alerts: 'Alertes',
        noAlerts: 'Aucune alerte',
        noAlertsSub: 'Les notifications apparaîtront ici en temps réel.',
        liveStatus: 'Temps réel',
      },

      // Children
      children: {
        newProfile: 'Nouveau profil enfant',
        age: 'ans',
        deviceName: 'Appareil non couplé',
        step1: 'Infos',
        step2: 'Avatar',
        step3: 'IA',
        step4: 'Couplage',
        firstName: 'Prénom',
        agePicker: 'Âge',
        avatarColor: 'Couleur',
        avatarEmoji: 'Avatar',
        aiPersona: "Nom de l'IA",
        aiTone: 'Ton de communication',
        aiTones: {
          friendly: 'Chaleureux 😊',
          fun: 'Fun 🎉',
          calm: 'Calme 🌿',
          strict: 'Structuré 📋',
        },
        pairingTitle: 'Coupler l\'appareil',
        pairingSub: 'Installez Guardian Enfant sur l\'appareil et entrez ce code.',
        pairingExpiry: '⏳ Ce code expire dans 24h',
        pairingDone: '✅ Terminé',
      },

      // Rules
      rules: {
        screenTime: 'Temps d\'écran',
        weekdays: 'Jours de semaine',
        weekends: 'Week-end',
        bedtime: 'Heure du coucher',
        bedtimeStart: 'Blocage à partir de',
        bedtimeEnd: 'Déverrouillage à',
        schoolMode: 'Mode école',
        schoolModeSub: 'Bloque tout de 8h à 17h en semaine',
        appRules: 'Applications',
        urlFilters: 'Sites web',
        categories: 'Catégories',
        blockSite: 'Bloquer un site',
        sitePlaceholder: 'exemple.com',
        blockBtn: 'Bloquer',
        savedSuccess: 'Règles sauvegardées !',
        catAdult: 'Contenu adulte',
        catViolence: 'Violence',
        catGambling: "Jeux d'argent",
        catDrugs: 'Drogues / Alcool',
        catSocial: 'Réseaux sociaux',
        catGaming: 'Jeux vidéo',
        catStreaming: 'Vidéos / Streaming',
        catChat: 'Chat / Messagerie',
        catShopping: 'Shopping',
      },

      // Grades
      grades: {
        title: 'Notes scolaires',
        subject: 'Matière',
        grade: 'Note /20',
        autoRule: "Règle d'auto-ajustement",
        recent: 'Notes récentes',
        noGrades: 'Aucune note enregistrée',
        subjects: {
          maths: 'Maths',
          french: 'Français',
          history: 'Histoire',
          science: 'Sciences',
          english: 'Anglais',
          sport: 'Sport',
        },
      },

      // AI
      ai: {
        name: 'Guardian',
        online: '🟢 En ligne',
        typing: "✍️ En train d'écrire...",
        placeholder: 'Parle à Guardian...',
        quizTitle: '📚 Quiz',
        quizProgress: '{{current}} / {{total}}',
        quizBonus: '+{{mins}} min si tu réussis !',
        quizPassed: '🎉 Bravo ! +{{mins}} min gagnées !',
        quizFailed: 'Pas encore cette fois. Continue tes efforts !',
        suggestions: [
          "Pourquoi ai-je moins de temps ?",
          'Je veux faire un quiz',
          'Comment gagner du bonus ?',
          "J'ai besoin d'aide pour réviser",
        ],
        premiumRequired: "L'assistant IA est disponible avec le plan Premium",
      },

      // Blocking overlay
      blocking: {
        quotaTitle: 'Temps écoulé !',
        quotaMsg: "{{name}}, tu as utilisé tout ton temps d'écran pour aujourd'hui !",
        lockedTitle: 'Accès restreint',
        lockedMsg: 'Tes parents ont restreint l\'accès à cet appareil.',
        appTitle: '{{app}} bloquée',
        appMsg: 'Tes parents ont décidé de bloquer cette application.',
        bedtimeTitle: 'Bonne nuit !',
        bedtimeMsg: "{{name}}, c'est l'heure de dormir. À demain matin !",
        schoolTitle: 'Mode école activé',
        schoolMsg: 'Concentre-toi sur tes cours !',
        ctaGuardian: '🛡️ Parler à Guardian',
        ctaQuiz: 'Je veux faire un quiz pour gagner du temps',
        footer: '🛡️ Guardian · Protégé par tes parents',
      },

      // Rewards
      rewards: {
        title: 'Mes récompenses',
        level: 'Niveau {{n}}',
        points: '{{n}} points',
        streak: '{{n}} jours d\'affilée',
        streakRecord: 'Record : {{n}} jours',
        badges: 'Badges',
        history: 'Historique récent',
        noHistory: 'Aucune récompense encore',
        levelProgress: 'Niveau {{n}} → {{next}}',
      },

      // Subscription
      subscription: {
        title: 'Abonnement',
        current: 'Plan actuel : {{plan}}',
        free: 'Gratuit',
        family: 'Family',
        premium: 'Premium + IA',
        monthly: '/mois',
        noCommitment: 'Sans engagement',
        trial: '🎁 Essai gratuit 14 jours · Sans CB requise',
        upgrade: 'Passer à {{plan}} →',
        currentPlan: '✓ Plan actuel',
        cancelSub: 'Annuler l\'abonnement',
        cancelConfirm: 'Votre abonnement restera actif jusqu\'à la fin de la période en cours.',
        legal: 'Sans engagement · Annulation à tout moment · Paiement sécurisé via Stripe',
        renewsOn: 'Renouvellement : {{date}}',
        cancelScheduled: '⚠️ Annulation programmée',
      },

      // Settings
      settings: {
        title: 'Paramètres',
        profile: 'Mon profil',
        password: 'Mot de passe',
        pin: 'Code PIN parental',
        notifications: 'Notifications push',
        privacy: 'Confidentialité',
        export: 'Exporter mes données',
        deleteAccount: 'Supprimer mon compte',
        deleteConfirm: 'Toutes vos données seront effacées définitivement (RGPD Art. 17).',
        logout: 'Déconnexion',
        logoutConfirm: 'Voulez-vous vous déconnecter ?',
        version: 'Guardian v4.0',
        support: 'Aide & Support',
        terms: "Conditions d'utilisation",
        privacy_policy: 'Politique de confidentialité',
      },

      // Geofencing
      geofencing: {
        title: 'Géofencing',
        addZone: 'Ajouter une zone',
        noZones: 'Aucune zone configurée',
        noZonesSub: "Ajoutez l'école, la maison ou chez les grands-parents.",
        zoneSafe: 'Zone sûre',
        zoneSchool: 'École',
        zoneRestricted: 'Zone restreinte',
        radius: 'Rayon de détection',
        history: 'Historique 24h',
        noHistory: 'Aucun déplacement enregistré',
        coordHint: '💡 Recherchez l\'adresse sur Google Maps → appui long.',
      },

      // Family
      family: {
        title: 'Famille',
        subtitle: 'Gérez les adultes qui ont accès à Guardian',
        invite: 'Inviter un membre',
        roleParent: 'Parent',
        roleGuardian: 'Gardien',
        roleObserver: 'Observateur',
        admin: '👑 Admin',
        active: '● Actif',
        pending: '○ En attente',
        remove: 'Retirer',
        removeConfirm: 'Ce membre n\'aura plus accès à votre espace Guardian.',
        noMembers: 'Aucun membre invité',
        noMembersSub: "Invitez l'autre parent, les grands-parents ou un adulte de confiance.",
        planRequired: 'Le multi-parent est disponible à partir du plan Family.',
      },

      // Errors
      errors: {
        network: 'Erreur réseau. Vérifiez votre connexion.',
        server: 'Erreur serveur. Réessayez dans un moment.',
        notFound: 'Ressource introuvable.',
        unauthorized: 'Session expirée. Reconnectez-vous.',
        forbidden: 'Accès refusé.',
        validation: 'Veuillez vérifier les champs saisis.',
      },
    }
  },

  // ── ENGLISH ──────────────────────────────────────────────────────────────────
  en: {
    translation: {
      app: {
        name: 'Guardian',
        tagline: 'Smart Parental Control',
        loading: 'Loading...',
        error: 'An error occurred',
        retry: 'Retry',
        save: 'Save',
        cancel: 'Cancel',
        confirm: 'Confirm',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        close: 'Close',
        back: '← Back',
        next: 'Next →',
        done: 'Done',
        yes: 'Yes', no: 'No', ok: 'OK',
      },
      auth: {
        login: 'Sign In',
        register: 'Create Account',
        logout: 'Sign Out',
        email: 'Email address',
        password: 'Password',
        confirmPassword: 'Confirm password',
        firstName: 'First name',
        lastName: 'Last name',
        phone: 'Phone (optional)',
        forgotPassword: 'Forgot password?',
        noAccount: "No account? Create one",
        hasAccount: "Already have an account? Sign in",
        loginError: 'Incorrect email or password',
        pinLabel: 'Parental PIN',
        pinPlaceholder: '4 to 8 digits',
        twoFALabel: '2FA authentication code',
        twoFARequired: '2FA code required',
        parentSpace: 'Parent area',
      },
      dashboard: {
        title: 'Dashboard',
        children: 'child(ren)',
        online: 'Online',
        offlineStatus: 'Offline',
        usedToday: 'min used',
        remaining: 'min left',
        locked: 'Locked',
        quota: 'Screen time',
        addChild: 'Add a child',
        quickActions: 'Quick actions',
        noChildren: 'No children configured',
        noChildrenSub: 'Click "Add a child" to get started.',
        alerts: 'Alerts',
        noAlerts: 'No alerts',
        noAlertsSub: 'Notifications will appear here in real time.',
        liveStatus: 'Live',
      },
      ai: {
        name: 'Guardian',
        online: '🟢 Online',
        typing: '✍️ Typing...',
        placeholder: 'Talk to Guardian...',
        premiumRequired: 'The AI assistant is available with the Premium plan',
      },
      blocking: {
        quotaTitle: 'Time is up!',
        quotaMsg: '{{name}}, you\'ve used all your screen time for today!',
        lockedTitle: 'Access restricted',
        lockedMsg: 'Your parents have restricted access to this device.',
        ctaGuardian: '🛡️ Talk to Guardian',
        footer: '🛡️ Guardian · Protected by your parents',
      },
      subscription: {
        title: 'Subscription',
        current: 'Current plan: {{plan}}',
        free: 'Free',
        family: 'Family',
        premium: 'Premium + AI',
        monthly: '/month',
        trial: '🎁 14-day free trial · No credit card required',
        upgrade: 'Switch to {{plan}} →',
        currentPlan: '✓ Current plan',
        cancelSub: 'Cancel subscription',
        legal: 'No commitment · Cancel anytime · Secure payment via Stripe',
      },
      errors: {
        network: 'Network error. Check your connection.',
        server: 'Server error. Please try again later.',
        notFound: 'Resource not found.',
        unauthorized: 'Session expired. Please sign in again.',
        forbidden: 'Access denied.',
        validation: 'Please check the fields entered.',
      },
    }
  },

  // ── ESPAÑOL ───────────────────────────────────────────────────────────────────
  es: {
    translation: {
      app: {
        name: 'Guardian',
        tagline: 'Control parental inteligente',
        loading: 'Cargando...',
        error: 'Se produjo un error',
        retry: 'Reintentar',
        save: 'Guardar',
        cancel: 'Cancelar',
        back: '← Volver',
        next: 'Siguiente →',
        done: 'Hecho',
      },
      auth: {
        login: 'Iniciar sesión',
        register: 'Crear cuenta',
        logout: 'Cerrar sesión',
        email: 'Correo electrónico',
        password: 'Contraseña',
        loginError: 'Email o contraseña incorrectos',
        parentSpace: 'Área de padres',
      },
      dashboard: {
        title: 'Panel de control',
        addChild: 'Agregar un niño',
        remaining: 'min restantes',
        locked: 'Bloqueado',
        liveStatus: 'En vivo',
      },
      blocking: {
        quotaTitle: '¡Tiempo agotado!',
        quotaMsg: '{{name}}, ¡has usado todo tu tiempo de pantalla por hoy!',
        lockedTitle: 'Acceso restringido',
        ctaGuardian: '🛡️ Hablar con Guardian',
        footer: '🛡️ Guardian · Protegido por tus padres',
      },
      subscription: {
        title: 'Suscripción',
        free: 'Gratuito',
        family: 'Familia',
        premium: 'Premium + IA',
        monthly: '/mes',
        trial: '🎁 Prueba gratis 14 días · Sin tarjeta requerida',
      },
    }
  },

  // ── ARABIC (RTL) ──────────────────────────────────────────────────────────────
  ar: {
    translation: {
      app: {
        name: 'جارديان',
        tagline: 'رقابة أبوية ذكية',
        loading: 'جار التحميل...',
        error: 'حدث خطأ',
        retry: 'إعادة المحاولة',
        save: 'حفظ',
        cancel: 'إلغاء',
        back: 'رجوع →',
        next: '← التالي',
        done: 'تم',
      },
      auth: {
        login: 'تسجيل الدخول',
        register: 'إنشاء حساب',
        logout: 'تسجيل الخروج',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        loginError: 'البريد أو كلمة المرور غير صحيحة',
        parentSpace: 'منطقة الوالدين',
      },
      dashboard: {
        title: 'لوحة التحكم',
        addChild: 'إضافة طفل',
        remaining: 'دقيقة متبقية',
        locked: 'محظور',
        liveStatus: 'مباشر',
      },
      blocking: {
        quotaTitle: '!انتهى الوقت',
        quotaMsg: '{{name}}، لقد استخدمت كل وقت الشاشة لهذا اليوم!',
        lockedTitle: 'الوصول مقيد',
        ctaGuardian: '🛡️ تحدث مع جارديان',
        footer: '🛡️ جارديان · محمي من قبل والديك',
      },
    }
  },
};

// ── INIT i18n ──────────────────────────────────────────────────────────────────
const LANG_KEY = 'guardian_language';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved) { callback(saved); return; }
    // Détecte la langue du système
    const { NativeModules, Platform } = require('react-native');
    const locale = Platform.OS === 'ios'
      ? NativeModules.SettingsManager?.settings?.AppleLocale
      : NativeModules.I18nManager?.localeIdentifier;
    const lang = locale?.substring(0, 2) || 'fr';
    const supported = ['fr', 'en', 'es', 'ar'];
    callback(supported.includes(lang) ? lang : 'fr');
  },
  init: () => {},
  cacheUserLanguage: async (lng) => {
    await AsyncStorage.setItem(LANG_KEY, lng);
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    ns: ['translation'],
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export const changeLanguage = async (lang) => {
  await i18n.changeLanguage(lang);
};

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'en', label: 'English',  flag: '🇬🇧', rtl: false },
  { code: 'es', label: 'Español',  flag: '🇪🇸', rtl: false },
  { code: 'ar', label: 'العربية',  flag: '🇸🇦', rtl: true  },
];

export default i18n;
