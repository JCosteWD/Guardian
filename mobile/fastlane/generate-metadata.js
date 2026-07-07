# ══════════════════════════════════════════════════════════════════════════════
# GUARDIAN – Métadonnées Play Store (Fastlane supply format)
# ══════════════════════════════════════════════════════════════════════════════
# Structure Fastlane attendue:
# fastlane/metadata/android/
#   fr-FR/
#     title.txt
#     short_description.txt
#     full_description.txt
#     changelogs/
#       1.txt  (versionCode 1)
#       2.txt  (versionCode 2)
#   en-US/
#     ...

# Exécuter ce script pour créer la structure:
# node fastlane/generate-metadata.js

const fs   = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'metadata/android');

const LOCALES = {
  'fr-FR': {
    title: 'Guardian – Contrôle Parental IA',
    short_description: 'Protégez vos enfants avec l\'IA Guardian. Impossible à contourner, simple à utiliser.',
    full_description: `🛡️ GUARDIAN — Le contrôle parental qui protège vraiment

Guardian est la seule application de contrôle parental qui combine une sécurité Android infranchissable avec une intelligence artificielle bienveillante.

✅ SÉCURITÉ RÉELLE
• Empêche l'installation de nouveaux navigateurs
• VPN local : filtre TOUS les sites, impossible à désactiver
• Service d'accessibilité : bloque les apps instantanément
• Démarre automatiquement au redémarrage

⏰ TEMPS D'ÉCRAN INTELLIGENT
• Quotas quotidiens différents semaine/week-end
• Heure du coucher automatique
• Mode école : blocage total pendant les heures de classe
• Réglages en 1 clic depuis votre téléphone

📝 NOTES → AJUSTEMENT AUTOMATIQUE
• Saisissez une note, le temps s'ajuste immédiatement
• Connectez Pronote ou EcoleDirecte pour la synchronisation automatique
• Bonne note = bonus de temps. Mauvaise note = motivation à réviser.

🤖 L'IA GUARDIAN (Plan Premium)
• Votre enfant comprend POURQUOI son temps est réduit
• Quiz adaptatifs pour gagner du temps bonus
• Détecte si votre enfant est en difficulté → vous alerte
• Journal de bord hebdomadaire personnalisé

📍 GÉOFENCING
• Alertes automatiques : arrivée à l'école, retour à la maison
• Règles différentes selon la localisation

👨‍👩‍👧 MULTI-PARENT
• Invitez l'autre parent, les grands-parents
• Droits différenciés par personne

🏆 GAMIFICATION
• Badges, points, niveaux pour motiver les enfants
• L'IA encourage les progrès

💎 PLANS
• Gratuit : 1 enfant, contrôles basiques
• Family 4,99€/mois : 3 enfants, géofencing, multi-parent
• Premium 9,99€/mois : tout + IA Guardian complète

Essai gratuit 14 jours. Sans engagement. Sans publicité.
Conforme RGPD. Données chiffrées AES-256.`,
    changelogs: {
      1: `Version 1.0 — Lancement Guardian\n• Contrôle du temps d'écran\n• Blocage d'applications\n• Filtre web VPN local`,
      2: `Version 2.0 — IA Guardian\n• Assistant IA bienveillant\n• Quiz adaptatifs pour gagner du temps\n• Gamification : badges et niveaux`,
      3: `Version 3.0 — Géofencing & Multi-parent\n• Zones GPS intelligentes\n• Invitez d'autres adultes\n• Intégration Pronote et EcoleDirecte`,
      4: `Version 4.0 — Design & Offline\n• Nouveau design système\n• Mode hors ligne\n• Notifications deep links\n• i18n : FR, EN, ES, AR`,
    },
  },

  'en-US': {
    title: 'Guardian – Smart Parental Control',
    short_description: 'Protect your children with Guardian AI. Impossible to bypass, simple to use.',
    full_description: `🛡️ GUARDIAN — The Parental Control That Actually Works

Guardian is the only parental control app that combines impenetrable Android security with a caring AI assistant.

✅ REAL SECURITY
• Prevents installing alternative browsers to bypass filters
• Local VPN: filters ALL websites, impossible to disable
• Accessibility service: blocks apps instantly
• Auto-restarts on device reboot

⏰ SMART SCREEN TIME
• Different daily limits for weekdays and weekends
• Automatic bedtime
• School mode: full block during class hours
• One-tap adjustments from your phone

📝 GRADES → AUTOMATIC ADJUSTMENT
• Enter a grade, screen time adjusts immediately
• Connect school platforms for automatic sync
• Good grade = bonus time. Bad grade = motivation to study.

🤖 GUARDIAN AI (Premium Plan)
• Your child understands WHY their time was reduced
• Adaptive quizzes to earn bonus time
• Detects if your child is struggling → alerts you
• Personalized weekly journal

📍 GEOFENCING
• Automatic alerts: arrived at school, back home
• Different rules based on location

👨‍👩‍👧 MULTI-PARENT
• Invite the other parent, grandparents
• Different permissions per person

💎 PLANS
• Free: 1 child, basic controls
• Family €4.99/month: 3 children, geofencing, multi-parent
• Premium €9.99/month: everything + full Guardian AI

14-day free trial. No commitment. No ads.
GDPR compliant. AES-256 encrypted data.`,
    changelogs: {
      1: `Version 1.0 — Guardian Launch\n• Screen time control\n• App blocking\n• Local VPN web filter`,
      2: `Version 2.0 — Guardian AI\n• Caring AI assistant\n• Adaptive quizzes for bonus time\n• Gamification: badges and levels`,
      3: `Version 3.0 — Geofencing & Multi-parent\n• Smart GPS zones\n• Invite other trusted adults\n• School platform integration`,
      4: `Version 4.0 — Design & Offline\n• New design system\n• Offline mode\n• Deep link notifications\n• i18n: FR, EN, ES, AR`,
    },
  },

  'es-ES': {
    title: 'Guardian – Control Parental IA',
    short_description: 'Protege a tus hijos con Guardian IA. Imposible de eludir, fácil de usar.',
    full_description: `🛡️ GUARDIAN — El Control Parental que Realmente Funciona

Guardian combina seguridad Android inexpugnable con una IA asistente comprensiva.

✅ SEGURIDAD REAL
• Impide instalar navegadores alternativos
• VPN local: filtra TODOS los sitios web
• Servicio de accesibilidad: bloquea apps al instante

⏰ TIEMPO DE PANTALLA INTELIGENTE
• Límites diarios diferentes entre semana y fin de semana
• Hora de dormir automática
• Modo escuela: bloqueo total en horario de clase

🤖 IA GUARDIAN (Plan Premium)
• Tu hijo entiende POR QUÉ se redujo su tiempo
• Quizzes adaptativos para ganar tiempo extra
• Detecta si tu hijo está en dificultades → te alerta

💎 PLANES
• Gratis: 1 hijo, controles básicos
• Family 4,99€/mes: 3 hijos, geofencing
• Premium 9,99€/mes: todo + IA Guardian completa

Prueba gratuita 14 días. Sin compromiso.`,
    changelogs: {
      1: `Versión 1.0 — Lanzamiento Guardian`,
      2: `Versión 2.0 — IA Guardian\n• Asistente IA\n• Quizzes adaptativos\n• Gamificación`,
      3: `Versión 3.0 — Geofencing y multi-padres`,
      4: `Versión 4.0 — Diseño y modo sin conexión`,
    },
  },
};

// Génère la structure des fichiers
Object.entries(LOCALES).forEach(([locale, content]) => {
  const localeDir = path.join(BASE, locale);
  const changelogDir = path.join(localeDir, 'changelogs');

  fs.mkdirSync(changelogDir, { recursive: true });

  fs.writeFileSync(path.join(localeDir, 'title.txt'),             content.title.substring(0, 50));
  fs.writeFileSync(path.join(localeDir, 'short_description.txt'), content.short_description.substring(0, 80));
  fs.writeFileSync(path.join(localeDir, 'full_description.txt'),  content.full_description.substring(0, 4000));

  Object.entries(content.changelogs).forEach(([version, text]) => {
    fs.writeFileSync(path.join(changelogDir, `${version}.txt`), text.substring(0, 500));
  });

  console.log(`✅ Metadata generated for ${locale}`);
});

console.log('\n📁 Structure created at fastlane/metadata/android/');
console.log('Run: fastlane supply --metadata_path fastlane/metadata/android');

module.exports = LOCALES;
