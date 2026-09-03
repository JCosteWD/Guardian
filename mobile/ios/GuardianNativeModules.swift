// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN iOS – Modules natifs Swift (Screen Time + VPN + Keychain)
// ══════════════════════════════════════════════════════════════════════════════
// Voir documentation complète dans ios-native/README.md
// Entitlement requis : com.apple.developer.family-controls

import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity
import NetworkExtension
import Security
import React

// ── GuardianDPC: Screen Time API ──────────────────────────────────────────────
@objc(GuardianDPC)
class GuardianDPCModule: NSObject {
  private let store = ManagedSettingsStore()
  private var authCenter = AuthorizationCenter.shared

  @objc func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    Task {
      do { try await authCenter.requestAuthorization(for: .child); resolve(true) }
      catch { reject("DPC_ERROR", error.localizedDescription, error) }
    }
  }

  @objc func isAuthorized(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(authCenter.status == .approved)
  }

  @objc func blockCategories(_ categories: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    var set = Set<ActivityCategory>()
    let map: [String: ActivityCategory] = ["social": .socialNetworking, "games": .games, "streaming": .entertainment]
    categories.forEach { if let c = map[$0] { set.insert(c) } }
    store.application.blockedActivityCategories = set
    resolve(true)
  }

  @objc func lockDevice(_ reason: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      NotificationCenter.default.post(name: Notification.Name("GuardianLockScreen"), object: nil, userInfo: ["reason": reason])
      resolve(true)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}

// ── GuardianVPN: Network Extension ────────────────────────────────────────────
@objc(GuardianVPN)
class GuardianVPNModule: NSObject {
  @objc func start(_ config: NSDictionary, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let mgr = NEVPNManager.shared()
    mgr.loadFromPreferences { error in
      if let e = error { reject("VPN_ERROR", e.localizedDescription, e); return }
      let proto = NEVPNProtocolIKEv2()
      proto.serverAddress = config["serverAddress"] as? String ?? "vpn.guardian-app.com"
      proto.username = "guardian"
      proto.authenticationMethod = .none
      proto.disconnectOnSleep = false
      mgr.protocolConfiguration = proto
      mgr.localizedDescription = "Guardian DNS Filter"
      mgr.isEnabled = true
      mgr.isOnDemandEnabled = true
      let rule = NEOnDemandRuleConnect(); rule.interfaceTypeMatch = .any
      mgr.onDemandRules = [rule]
      mgr.saveToPreferences { err in
        if let e = err { reject("VPN_ERROR", e.localizedDescription, e); return }
        do { try mgr.connection.startVPNTunnel(); resolve(true) }
        catch { reject("VPN_ERROR", error.localizedDescription, error) }
      }
    }
  }

  @objc func stop(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NEVPNManager.shared().connection.stopVPNTunnel(); resolve(true)
  }

  @objc func isRunning(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let s = NEVPNManager.shared().connection.status
    resolve(s == .connected || s == .connecting)
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}

// ── GuardianKeychain: Secure Enclave ──────────────────────────────────────────
@objc(GuardianKeychain)
class GuardianKeychainModule: NSObject {
  @objc func store(_ key: String, value: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let data = value.data(using: .utf8) else { reject("KEYCHAIN_ERROR", "Encoding failed", nil); return }
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecAttrService as String: "com.guardian.app", kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
    SecItemDelete(q as CFDictionary)
    resolve(SecItemAdd(q as CFDictionary, nil) == errSecSuccess)
  }

  @objc func retrieve(_ key: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecAttrService as String: "com.guardian.app", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
    var result: AnyObject?
    let status = SecItemCopyMatching(q as CFDictionary, &result)
    if status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) { resolve(value) }
    else if status == errSecItemNotFound { resolve(nil) }
    else { reject("KEYCHAIN_ERROR", "Status: \(status)", nil) }
  }

  @objc func delete(_ key: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecAttrService as String: "com.guardian.app"]
    SecItemDelete(q as CFDictionary); resolve(true)
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }
}

// ── GuardianIOSBridge.m (à créer séparément) ──────────────────────────────────
/*
#import <React/RCTBridgeModule.h>
RCT_EXTERN_MODULE(GuardianDPC, NSObject)
RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isAuthorized:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(blockCategories:(NSArray *)categories resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(lockDevice:(NSString *)reason resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_MODULE(GuardianVPN, NSObject)
RCT_EXTERN_METHOD(start:(NSDictionary *)config resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stop:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isRunning:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_MODULE(GuardianKeychain, NSObject)
RCT_EXTERN_METHOD(store:(NSString *)key value:(NSString *)value resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(retrieve:(NSString *)key resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(delete:(NSString *)key resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
*/
