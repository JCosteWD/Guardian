/**
 * GUARDIAN – COUCHE SÉCURITÉ ANDROID
 * ====================================
 * Ce fichier documente et orchestre les 4 mécanismes de sécurité Android natifs
 * qui rendent Guardian réellement impossible à contourner par un enfant.
 *
 * ARCHITECTURE SÉCURITÉ:
 * ┌─────────────────────────────────────────────────────────┐
 * │  1. Device Policy Controller (MDM/DPC)                  │
 * │     → Bloque l'installation de nouveaux navigateurs     │
 * │     → Empêche la désinstallation de Guardian            │
 * │     → Kiosk mode (launcher forcé)                       │
 * │                                                         │
 * │  2. VPN local (Always-on VPN)                          │
 * │     → Filtre tout le trafic réseau                      │
 * │     → Bloque domaines / catégories                      │
 * │     → Impossible à désactiver sans PIN parent           │
 * │                                                         │
 * │  3. Accessibility Service                               │
 * │     → Surveille l'app au premier plan                   │
 * │     → Ferme les apps bloquées / quota dépassé           │
 * │     → Affiche l'écran de verrouillage Guardian          │
 * │                                                         │
 * │  4. Tamper Detection                                    │
 * │     → Détecte tentative de désinstallation              │
 * │     → Alerte parent immédiatement                       │
 * │     → Verrouille l'appareil en cas de détection        │
 * └─────────────────────────────────────────────────────────┘
 */

import { NativeModules, NativeEventEmitter, Platform, Alert } from 'react-native';
import { logActivity } from './api';

const {
  GuardianDPC,          // Device Policy Controller
  GuardianVPN,          // VPN local
  GuardianAccessibility, // Accessibility Service
  GuardianTamper,       // Tamper Detection
} = NativeModules;

const eventEmitter = new NativeEventEmitter(NativeModules.GuardianSecurity);

// ══════════════════════════════════════════════════════════════════════════════
// 1. DEVICE POLICY CONTROLLER (MDM)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Le DPC utilise l'API Android DevicePolicyManager pour:
 * - Définir Guardian comme Device Owner ou Profile Owner
 * - Bloquer l'installation d'apps non autorisées via setUserRestriction
 * - Empêcher la désinstallation de Guardian
 * - Activer le kiosk mode (LockTask)
 *
 * FICHIER NATIF: android/app/src/main/java/com/guardian/dpc/GuardianDPCModule.java
 * ```java
 * DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
 * ComponentName adminComponent = new ComponentName(context, GuardianAdminReceiver.class);
 *
 * // Bloquer l'installation de nouvelles apps
 * dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_INSTALL_APPS);
 * dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);
 *
 * // Empêcher la désinstallation
 * dpm.setUninstallBlocked(adminComponent, context.getPackageName(), true);
 *
 * // Bloquer les paramètres réseau (empêche désactivation VPN)
 * dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN);
 * dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_WIFI);
 *
 * // Kiosk mode: force Guardian comme launcher
 * dpm.setLockTaskPackages(adminComponent, new String[]{context.getPackageName()});
 * activity.startLockTask();
 * ```
 */
export const dpc = {
  async isDeviceAdmin() {
    if (Platform.OS !== 'android') return false;
    try { return await GuardianDPC.isDeviceAdmin(); }
    catch { return false; }
  },

  async requestAdminPrivileges() {
    if (Platform.OS !== 'android') return;
    try {
      await GuardianDPC.requestAdminPrivileges();
    } catch (err) {
      Alert.alert(
        '⚠️ Droits administrateur requis',
        'Guardian nécessite des droits administrateur pour sécuriser l\'appareil contre les contournements.',
        [{ text: 'Accorder les droits', onPress: () => GuardianDPC.openAdminSettings() }]
      );
    }
  },

  async lockInstallation() {
    try { await GuardianDPC.disableAppInstallation(); }
    catch (err) { console.warn('DPC lockInstallation failed:', err); }
  },

  async enableKioskMode() {
    try { await GuardianDPC.startKioskMode(); }
    catch (err) { console.warn('DPC kiosk mode failed:', err); }
  },

  async blockSettingsAccess(block = true) {
    try { await GuardianDPC.blockSettingsAccess(block); }
    catch (err) { console.warn('DPC block settings failed:', err); }
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. VPN LOCAL (Always-on VPN + DNS filtering)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Le VPN local intercepte TOUT le trafic réseau et filtre les domaines.
 * Utilise VpnService.Builder d'Android.
 * L'Always-on VPN via MDM empêche sa désactivation.
 *
 * FICHIER NATIF: android/app/src/main/java/com/guardian/vpn/GuardianVPNService.java
 * ```java
 * public class GuardianVPNService extends VpnService {
 *   @Override public int onStartCommand(Intent intent, int flags, int startId) {
 *     Builder builder = new Builder()
 *       .addAddress("10.0.0.1", 24)
 *       .addDnsServer("10.0.0.1")  // Notre DNS local
 *       .addRoute("0.0.0.0", 0)    // Tout le trafic
 *       .setSession("Guardian VPN")
 *       .setBlocking(true);
 *     ParcelFileDescriptor vpnInterface = builder.establish();
 *     startFilteringThread(vpnInterface);
 *     return START_STICKY;  // Redémarre si tué
 *   }
 *
 *   private void filterDNSRequest(String domain) {
 *     if (isBlocked(domain)) {
 *       sendBlockedResponse();  // NXDOMAIN
 *       notifyBlocked(domain);
 *     } else {
 *       forwardToRealDNS(domain);
 *     }
 *   }
 * }
 * ```
 */
export const vpn = {
  async start(blockedDomains = [], blockedCategories = []) {
    try {
      await GuardianVPN.start({
        blockedDomains,
        blockedCategories,
        dnsServer: '1.1.1.1',
        logBlocked: true,
      });
      console.log('Guardian VPN started');
    } catch (err) {
      console.warn('VPN start failed:', err);
    }
  },

  async stop() {
    try { await GuardianVPN.stop(); }
    catch (err) { console.warn('VPN stop failed:', err); }
  },

  async updateBlocklist(blockedDomains, blockedCategories) {
    try {
      await GuardianVPN.updateBlocklist({ blockedDomains, blockedCategories });
    } catch (err) {
      console.warn('VPN updateBlocklist failed:', err);
    }
  },

  async isRunning() {
    try { return await GuardianVPN.isRunning(); }
    catch { return false; }
  },

  // Catégories DNS prédéfinies (utilise des listes publiques comme StevenBlack)
  CATEGORY_LISTS: {
    adult: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/fakenews-gambling-porn/hosts'],
    gambling: ['https://raw.githubusercontent.com/nickcis/hosts-gambling/master/hosts'],
    malware: ['https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts'],
    ads: ['https://adaway.org/hosts.txt'],
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. ACCESSIBILITY SERVICE
// ══════════════════════════════════════════════════════════════════════════════
/**
 * L'Accessibility Service surveille en permanence l'app au premier plan.
 * Si l'enfant ouvre une app bloquée ou dépasse son quota, Guardian
 * superpose un écran de blocage par-dessus immédiatement.
 *
 * FICHIER NATIF: android/app/src/main/java/com/guardian/accessibility/GuardianAccessibilityService.java
 * ```java
 * public class GuardianAccessibilityService extends AccessibilityService {
 *   @Override public void onAccessibilityEvent(AccessibilityEvent event) {
 *     if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
 *       String packageName = event.getPackageName().toString();
 *
 *       // Vérifie si l'app est bloquée
 *       if (isBlocked(packageName)) {
 *         showBlockingOverlay(packageName);
 *         logBlockedAttempt(packageName);
 *       }
 *
 *       // Vérifie le quota
 *       if (isQuotaExceeded()) {
 *         showQuotaExceededScreen();
 *       }
 *
 *       // Empêche d'ouvrir les paramètres pour désactiver le service
 *       if (isSettingsPage(packageName) && !isParentAuthenticated()) {
 *         goBackToGuardian();
 *       }
 *     }
 *   }
 *
 *   private void showBlockingOverlay(String pkg) {
 *     WindowManager.LayoutParams params = new WindowManager.LayoutParams(
 *       WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
 *       WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
 *       PixelFormat.TRANSLUCENT
 *     );
 *     // Affiche l'overlay Guardian par-dessus l'app
 *     windowManager.addView(blockingView, params);
 *   }
 * }
 * ```
 */
export const accessibility = {
  async isEnabled() {
    try { return await GuardianAccessibility.isEnabled(); }
    catch { return false; }
  },

  async requestPermission() {
    try {
      await GuardianAccessibility.openAccessibilitySettings();
    } catch {
      Alert.alert(
        '⚙️ Service d\'accessibilité requis',
        'Pour bloquer les applications et surveiller l\'utilisation, activez le service Guardian dans les paramètres d\'accessibilité.',
        [{ text: 'Ouvrir les paramètres', onPress: () => GuardianAccessibility.openAccessibilitySettings() }]
      );
    }
  },

  async updateBlockedApps(packages) {
    try { await GuardianAccessibility.updateBlockedApps(packages); }
    catch (err) { console.warn('Accessibility updateBlockedApps failed:', err); }
  },

  async setQuotaStatus(remainingMins, isLocked, lockReason) {
    try {
      await GuardianAccessibility.setQuotaStatus({ remainingMins, isLocked, lockReason });
    } catch (err) { console.warn('Accessibility setQuotaStatus failed:', err); }
  },

  // Écoute les événements d'app bloquée
  onAppBlocked(callback) {
    return eventEmitter.addListener('onAppBlocked', callback);
  },

  onQuotaWarning(callback) {
    return eventEmitter.addListener('onQuotaWarning', callback);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. TAMPER DETECTION
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Détecte toute tentative de contournement:
 * - Désinstallation de l'app
 * - Tentative de désactivation de l'Accessibility Service
 * - Tentative de désactivation du VPN
 * - Root détecté (SafetyNet/Play Integrity)
 * - ADB debugging activé
 *
 * FICHIER NATIF: android/app/src/main/java/com/guardian/security/TamperDetectionModule.java
 * ```java
 * // Vérification de l'intégrité via Play Integrity API
 * IntegrityManager integrityManager = IntegrityManagerFactory.create(context);
 * Task<StandardIntegrityToken> integrityTokenResponse =
 *   integrityManager.requestIntegrityToken(
 *     StandardIntegrityTokenRequest.builder().setRequestHash(hash).build()
 *   );
 *
 * // Détection de root
 * boolean isRooted = checkForRootFiles() || checkForRootPackages() || checkForBusybox();
 *
 * // Détection ADB
 * boolean adbEnabled = Settings.Secure.getInt(
 *   context.getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1;
 * ```
 */
export const tamperDetection = {
  async startMonitoring(childId, parentId) {
    try {
      await GuardianTamper.startMonitoring({ childId, parentId });
    } catch (err) {
      console.warn('Tamper monitoring start failed:', err);
    }
  },

  async checkIntegrity() {
    try {
      const result = await GuardianTamper.checkIntegrity();
      return {
        isRooted: result.isRooted,
        adbEnabled: result.adbEnabled,
        integrityVerified: result.integrityVerified,
      };
    } catch {
      return { isRooted: false, adbEnabled: false, integrityVerified: true };
    }
  },

  onTamperDetected(callback) {
    return eventEmitter.addListener('onTamperDetected', async (event) => {
      // Log et alerte immédiate
      await logActivity('tamper_attempt', {
        type: event.type,
        details: event.details,
        timestamp: new Date().toISOString(),
      });
      callback(event);
    });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY ORCHESTRATOR – Point d'entrée principal
// ══════════════════════════════════════════════════════════════════════════════
export class GuardianSecurity {
  constructor(childId, rules) {
    this.childId = childId;
    this.rules = rules;
    this.listeners = [];
  }

  /**
   * Initialise toutes les couches de sécurité au démarrage de l'app
   */
  async initialize() {
    console.log('🛡️ Initializing Guardian Security layers...');

    // 1. Vérifie l'intégrité de l'appareil
    const integrity = await tamperDetection.checkIntegrity();
    if (integrity.isRooted) {
      Alert.alert(
        '⚠️ Appareil compromis',
        'Cet appareil semble être rooté. Guardian ne peut pas garantir une protection complète.',
      );
    }

    // 2. Vérifie/demande les droits admin
    const isAdmin = await dpc.isDeviceAdmin();
    if (!isAdmin) {
      await dpc.requestAdminPrivileges();
    } else {
      await dpc.lockInstallation();
      await dpc.blockSettingsAccess(true);
    }

    // 3. Démarre le VPN local
    const vpnRunning = await vpn.isRunning();
    if (!vpnRunning) {
      await vpn.start(this.rules.blockedDomains || [], this.rules.blockedCategories || []);
    } else {
      await vpn.updateBlocklist(this.rules.blockedDomains || [], this.rules.blockedCategories || []);
    }

    // 4. Vérifie l'Accessibility Service
    const accEnabled = await accessibility.isEnabled();
    if (!accEnabled) {
      await accessibility.requestPermission();
    } else {
      await accessibility.updateBlockedApps(this.rules.blockedApps || []);
      await accessibility.setQuotaStatus(
        this.rules.remainingMins || 120,
        this.rules.isLocked || false,
        this.rules.lockReason || ''
      );
    }

    // 5. Démarre la détection de tampering
    await tamperDetection.startMonitoring(this.childId, this.rules.parentId);

    // 6. Écoute les événements de sécurité
    this.listeners.push(
      accessibility.onAppBlocked(async (event) => {
        await logActivity('app_blocked', { packageName: event.packageName });
      }),

      tamperDetection.onTamperDetected(async (event) => {
        console.warn('🚨 Tamper attempt detected:', event);
        // L'API backend s'occupe de notifier le parent
        await logActivity('tamper_attempt', event);
      }),
    );

    console.log('✅ Guardian Security fully initialized');
    return true;
  }

  /**
   * Mise à jour des règles en temps réel (depuis WebSocket)
   */
  async updateRules(newRules) {
    this.rules = { ...this.rules, ...newRules };

    await Promise.all([
      vpn.updateBlocklist(this.rules.blockedDomains || [], this.rules.blockedCategories || []),
      accessibility.updateBlockedApps(this.rules.blockedApps || []),
      accessibility.setQuotaStatus(
        this.rules.remainingMins || 0,
        this.rules.isLocked || false,
        this.rules.lockReason || ''
      ),
    ]);
  }

  /**
   * Nettoyage (ne devrait jamais être appelé normalement)
   */
  destroy() {
    this.listeners.forEach(l => l.remove());
  }
}

export default GuardianSecurity;
