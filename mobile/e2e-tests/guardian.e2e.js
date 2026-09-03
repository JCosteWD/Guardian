// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Tests E2E Detox
// ══════════════════════════════════════════════════════════════════════════════
// Tests end-to-end pour les parcours critiques des apps React Native.
//
// Installation:
//   npm install -D detox @config-plugins/detox
//   npx detox build --configuration android.emu.debug
//   npx detox test --configuration android.emu.debug
//
// .detoxrc.js (à la racine du projet):
// module.exports = {
//   testRunner: { $0: 'jest', args: { config: 'e2e/jest.config.js' } },
//   apps: {
//     'android.debug': { type: 'android.apk', binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk', build: 'cd android && ./gradlew assembleDebug' },
//   },
//   devices: {
//     emulator: { type: 'android.emulator', device: { avdName: 'Pixel_6_API_33' } },
//   },
//   configurations: {
//     'android.emu.debug': { device: 'emulator', app: 'android.debug' },
//   },
// };

const { device, element, by, expect, waitFor } = require('detox');

// ── HELPERS ────────────────────────────────────────────────────────────────────
const tap    = async (testID) => element(by.id(testID)).tap();
const type   = async (testID, text) => { await element(by.id(testID)).clearText(); await element(by.id(testID)).typeText(text); };
const visible = async (testID) => expect(element(by.id(testID))).toBeVisible();
const sleep  = (ms) => new Promise(r => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════════════════════
// APP PARENT – Tests parcours complets
// ══════════════════════════════════════════════════════════════════════════════
describe('Guardian Parent App', () => {

  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  // ── ONBOARDING ─────────────────────────────────────────────────────────────
  describe('Onboarding', () => {
    it('affiche le premier écran d\'onboarding', async () => {
      await visible('onboarding-slide-1');
      await visible('onboarding-title-1');
    });

    it('navigue entre les slides', async () => {
      await tap('onboarding-next-btn');
      await visible('onboarding-slide-2');
      await tap('onboarding-next-btn');
      await visible('onboarding-slide-3');
    });

    it('peut ignorer l\'onboarding', async () => {
      await device.launchApp({ newInstance: true });
      await tap('onboarding-skip-btn');
      await visible('login-screen');
    });
  });

  // ── AUTHENTIFICATION ────────────────────────────────────────────────────────
  describe('Authentification', () => {
    it('affiche une erreur avec de mauvais identifiants', async () => {
      await visible('login-screen');
      await type('login-email-input', 'wrong@email.com');
      await type('login-password-input', 'wrongpassword');
      await tap('login-submit-btn');
      await waitFor(element(by.id('login-error-banner'))).toBeVisible().withTimeout(5000);
    });

    it('se connecte avec des identifiants valides', async () => {
      await type('login-email-input', process.env.TEST_PARENT_EMAIL || 'test@guardian.com');
      await type('login-password-input', process.env.TEST_PARENT_PASSWORD || 'Password123');
      await tap('login-submit-btn');
      await waitFor(element(by.id('dashboard-screen'))).toBeVisible().withTimeout(8000);
    });
  });

  // ── DASHBOARD ───────────────────────────────────────────────────────────────
  describe('Dashboard', () => {
    it('affiche la liste des enfants', async () => {
      await visible('dashboard-screen');
      await visible('children-list');
    });

    it('affiche les quotas de temps en temps réel', async () => {
      await visible('quota-bar-container');
    });

    it('ouvre le profil d\'un enfant', async () => {
      await element(by.id('child-card-0')).tap();
      await waitFor(element(by.id('child-details-screen'))).toBeVisible().withTimeout(3000);
      await device.pressBack();
    });
  });

  // ── ACTIONS RAPIDES ─────────────────────────────────────────────────────────
  describe('Quick Actions', () => {
    it('applique -30 min à un enfant', async () => {
      await element(by.id('quick-action-minus30-0')).tap();
      await waitFor(element(by.id('action-feedback-toast'))).toBeVisible().withTimeout(3000);
      await waitFor(element(by.id('action-feedback-toast'))).toBeNotVisible().withTimeout(5000);
    });

    it('applique +30 min bonus', async () => {
      await element(by.id('quick-action-plus30-0')).tap();
      await waitFor(element(by.id('action-feedback-toast'))).toBeVisible().withTimeout(3000);
    });

    it('active le mode devoirs', async () => {
      await element(by.id('quick-action-homework-0')).tap();
      await waitFor(element(by.id('action-feedback-toast'))).toBeVisible().withTimeout(3000);
    });
  });

  // ── SAISIE DE NOTE ──────────────────────────────────────────────────────────
  describe('Saisie de note', () => {
    it('ouvre le formulaire de note', async () => {
      await tap('add-grade-btn');
      await visible('grade-input-modal');
    });

    it('sélectionne une matière', async () => {
      await tap('subject-chip-Maths');
      await visible('subject-chip-Maths-selected');
    });

    it('saisit une note et valide', async () => {
      await tap('grade-value-14');
      await tap('grade-submit-btn');
      await waitFor(element(by.id('grade-success-toast'))).toBeVisible().withTimeout(5000);
    });
  });

  // ── AJOUT D'ENFANT ──────────────────────────────────────────────────────────
  describe('Ajout d\'enfant', () => {
    it('navigue vers l\'ajout d\'enfant', async () => {
      await tap('add-child-btn');
      await visible('add-child-screen');
    });

    it('remplit le formulaire étape 1', async () => {
      await type('child-firstname-input', 'TestEnfant');
      await tap('age-increment-btn'); // Age: 11
      await tap('add-child-next-btn');
      await visible('add-child-step-2');
    });

    it('sélectionne un avatar', async () => {
      await tap('avatar-color-1');
      await tap('avatar-emoji-1');
      await tap('add-child-next-btn');
      await visible('add-child-step-3');
    });

    it('configure l\'IA et crée le profil', async () => {
      await tap('ai-tone-friendly');
      await tap('create-child-btn');
      await waitFor(element(by.id('pairing-code-screen'))).toBeVisible().withTimeout(8000);
    });

    it('affiche le code de couplage', async () => {
      await visible('pairing-code-display');
    });
  });

  // ── PARAMÈTRES ──────────────────────────────────────────────────────────────
  describe('Paramètres', () => {
    it('navigue vers les paramètres', async () => {
      await tap('settings-tab');
      await visible('settings-screen');
    });

    it('configure un PIN', async () => {
      await type('pin-input', '1234');
      await tap('pin-save-btn');
      await waitFor(element(by.id('pin-success-toast'))).toBeVisible().withTimeout(3000);
    });

    it('affiche le sélecteur de langue', async () => {
      await tap('language-settings-btn');
      await visible('language-screen');
      await tap('language-fr-option');
      await device.pressBack();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// APP ENFANT – Tests parcours complets
// ══════════════════════════════════════════════════════════════════════════════
describe('Guardian Child App', () => {

  beforeAll(async () => {
    // L'app enfant utilise un apk différent
    await device.launchApp({
      newInstance: true,
      launchArgs: { DETOX_TEST_MODE: '1', MOCK_DEVICE_ID: 'test-device-e2e' },
    });
  });

  // ── COUPLAGE ────────────────────────────────────────────────────────────────
  describe('Écran de couplage', () => {
    it('affiche l\'écran de scan QR', async () => {
      await visible('qr-scan-screen');
    });

    it('peut entrer un code manuellement', async () => {
      await tap('manual-code-btn');
      await visible('manual-code-modal');
    });
  });

  // ── LAUNCHER ────────────────────────────────────────────────────────────────
  describe('Launcher enfant', () => {
    beforeAll(async () => {
      // Simule un appareil déjà couplé
      await device.launchApp({
        newInstance: true,
        launchArgs: { MOCK_CHILD_ID: 'test-child-e2e', MOCK_PAIRED: '1' },
      });
    });

    it('affiche l\'écran d\'accueil', async () => {
      await waitFor(element(by.id('child-home-screen'))).toBeVisible().withTimeout(10000);
    });

    it('affiche le quota de temps', async () => {
      await visible('quota-ring');
      await visible('time-remaining-text');
    });

    it('affiche la grille des apps', async () => {
      await visible('apps-grid');
    });

    it('empêche le retour arrière (launcher sécurisé)', async () => {
      await device.pressBack();
      // L'app doit toujours être visible
      await visible('child-home-screen');
    });
  });

  // ── CHAT IA ─────────────────────────────────────────────────────────────────
  describe('Chat avec l\'IA Guardian', () => {
    it('ouvre le chat IA', async () => {
      await tap('guardian-ai-btn');
      await waitFor(element(by.id('ai-chat-screen'))).toBeVisible().withTimeout(3000);
    });

    it('affiche le message de bienvenue', async () => {
      await visible('ai-welcome-message');
    });

    it('envoie un message et reçoit une réponse', async () => {
      await type('ai-message-input', 'Pourquoi ai-je moins de temps ?');
      await tap('ai-send-btn');
      await waitFor(element(by.id('ai-response-0'))).toBeVisible().withTimeout(15000);
    });

    it('affiche les suggestions rapides', async () => {
      await visible('ai-suggestions-container');
    });

    it('utilise une suggestion rapide', async () => {
      await element(by.id('ai-suggestion-0')).tap();
      await waitFor(element(by.id('ai-response-1'))).toBeVisible().withTimeout(15000);
    });
  });

  // ── BLOCAGE ─────────────────────────────────────────────────────────────────
  describe('Écran de blocage', () => {
    it('affiche l\'overlay de blocage quand le quota est épuisé', async () => {
      // Simule un quota épuisé via launchArgs
      await device.launchApp({
        newInstance: false,
        launchArgs: { MOCK_QUOTA_REMAINING: '0' },
      });
      await waitFor(element(by.id('blocking-overlay'))).toBeVisible().withTimeout(5000);
    });

    it('affiche le bouton Guardian', async () => {
      await visible('blocking-cta-btn');
    });

    it('ouvre le chat IA depuis l\'overlay', async () => {
      await tap('blocking-cta-btn');
      await waitFor(element(by.id('ai-chat-screen'))).toBeVisible().withTimeout(3000);
    });
  });

  // ── RÉCOMPENSES ────────────────────────────────────────────────────────────
  describe('Écran récompenses', () => {
    it('navigue vers les récompenses', async () => {
      await device.launchApp({ launchArgs: { MOCK_PAIRED: '1', SCREEN: 'rewards' } });
      await waitFor(element(by.id('rewards-screen'))).toBeVisible().withTimeout(5000);
    });

    it('affiche le ring de niveau', async () => {
      await visible('level-ring');
    });

    it('affiche les badges', async () => {
      await visible('badges-grid');
    });
  });
});
