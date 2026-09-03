# Guardian iOS Native Modules

Fichiers Swift pour les modules React Native sur iOS.
Voir la transcription de session pour `GuardianNativeModules.swift` et `CrossPlatformSecurityService.js`.

## Modules disponibles
- `GuardianDPCModule` — Screen Time API (Family Controls)
- `GuardianVPNModule` — Network Extension (NEVPNManager)
- `GuardianKeychainModule` — Secure Enclave + Keychain
- `GuardianScreenTimeModule` — DeviceActivityMonitor

## Entitlement requis (Apple)
`com.apple.developer.family-controls` — demander à Apple via votre App Store Connect.

## Limitations iOS vs Android
| Fonctionnalité | Android | iOS |
|---|---|---|
| Bloquer désinstallation | ✅ MDM | ❌ Non disponible |
| VPN always-on | ✅ | ✅ (mais désactivable) |
| Overlay sur apps | ✅ AccessibilityService | ❌ |
| Screen Time API | ✅ Usage Stats | ✅ Family Controls |
| Secure storage | ✅ Keystore/TEE | ✅ Secure Enclave |
