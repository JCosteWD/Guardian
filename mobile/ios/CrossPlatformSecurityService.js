// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Service de sécurité cross-platform (iOS + Android unifié)
// ══════════════════════════════════════════════════════════════════════════════
import { Platform, NativeModules, NativeEventEmitter, Alert } from 'react-native';

const {
  GuardianDPC, GuardianVPN, GuardianAccessibility,
  GuardianTamper, GuardianSecurity, GuardianKeychain,
} = NativeModules;

const isAndroid = Platform.OS === 'android';
const isIOS     = Platform.OS === 'ios';

let securityEmitter = null;
if (isAndroid && GuardianSecurity) {
  securityEmitter = new NativeEventEmitter(GuardianSecurity);
}

export const SecurityService = {

  async initialize() {
    if (isAndroid) await this.initAndroid();
    else if (isIOS) await this.initIOS();
  },

  async initAndroid() {
    try {
      const isAdmin = await GuardianDPC?.isDeviceAdmin?.();
      if (!isAdmin) {
        await GuardianDPC?.requestAdminPrivileges?.();
      } else {
        await GuardianDPC?.disableAppInstallation?.();
        await GuardianDPC?.blockSettingsAccess?.(true);
      }
      const a11y = await GuardianAccessibility?.isEnabled?.();
      if (!a11y) {
        Alert.alert('⚙️ Permission requise',
          'Activez le service Guardian dans les paramètres d\'accessibilité.',
          [{ text: 'Ouvrir', onPress: () => GuardianAccessibility?.openAccessibilitySettings?.() }]);
      }
      await GuardianTamper?.startMonitoring?.({});
      const vpn = await GuardianVPN?.isRunning?.();
      if (!vpn) await GuardianVPN?.start?.({ blockedCategories: ['adult','violence','gambling'] });
    } catch (err) { console.warn('[Security] Android init error:', err); }
  },

  async initIOS() {
    try {
      const ok = await GuardianDPC?.isAuthorized?.();
      if (!ok) await GuardianDPC?.requestAuthorization?.();
    } catch (err) { console.warn('[Security] iOS init error:', err); }
  },

  async storeSecure(key, value) {
    if (isIOS && GuardianKeychain) return GuardianKeychain.store(key, value);
    const { default: ES } = await import('react-native-encrypted-storage');
    return ES.setItem(key, value);
  },

  async getSecure(key) {
    if (isIOS && GuardianKeychain) return GuardianKeychain.retrieve(key);
    const { default: ES } = await import('react-native-encrypted-storage');
    return ES.getItem(key);
  },

  async deleteSecure(key) {
    if (isIOS && GuardianKeychain) return GuardianKeychain.delete(key);
    const { default: ES } = await import('react-native-encrypted-storage');
    return ES.removeItem(key);
  },

  async updateQuotaStatus({ remainingMins, isLocked, lockReason, blockedApps = [] }) {
    if (isAndroid) {
      await GuardianAccessibility?.setQuotaStatus?.({ remainingMins, isLocked, lockReason });
      if (blockedApps.length > 0) await GuardianVPN?.updateBlocklist?.({ blockedDomains: blockedApps });
    } else if (isIOS) {
      if (isLocked) await GuardianDPC?.lockDevice?.(lockReason || 'Temps d\'écran épuisé');
    }
  },

  async blockCategories(categories) {
    if (isAndroid) return GuardianVPN?.updateBlocklist?.({ blockedCategories: categories });
    if (isIOS)     return GuardianDPC?.blockCategories?.(categories);
  },

  async checkIntegrity() {
    if (isAndroid) return GuardianTamper?.checkIntegrity?.();
    return Promise.resolve({ isJailbroken: false, threatScore: 0 });
  },

  addListener(event, callback) {
    if (isAndroid && securityEmitter) return securityEmitter.addListener(event, callback);
    return { remove: () => {} };
  },

  async startVPN(config = {}) {
    return GuardianVPN?.start?.(config);
  },

  async stopVPN()       { return GuardianVPN?.stop?.(); },
  async isVPNRunning()  { return GuardianVPN?.isRunning?.() ?? false; },

  getCapabilities() {
    return {
      platform:              Platform.OS,
      canPreventUninstall:   isAndroid,
      canBlockAppInstall:    isAndroid,
      hasOverlaySupport:     isAndroid,
      hasAlwaysOnVPN:        isAndroid,
      hasKeystoreHardware:   isAndroid,
      hasBehavioralDetection:isAndroid,
      hasScreenTimeAPI:      isIOS,
      hasKeychain:           isIOS,
      hasSecureEnclave:      isIOS,
      hasNetworkExtension:   isIOS,
      hasPushNotifications:  true,
      hasGeolocation:        true,
    };
  },
};

export default SecurityService;
