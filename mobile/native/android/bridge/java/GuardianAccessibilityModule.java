package com.guardian.native_modules;

import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.guardian.accessibility.GuardianAccessibilityService;

/**
 * GUARDIAN – Bridge React Native ↔ Accessibility Service
 * ========================================================
 * Vérifie si le service d'accessibilité est actif,
 * met à jour les apps bloquées et l'état du quota en temps réel.
 */
public class GuardianAccessibilityModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public GuardianAccessibilityModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() { return "GuardianAccessibility"; }

    // ── IS ENABLED ────────────────────────────────────────────────────────────
    @ReactMethod
    public void isEnabled(Promise promise) {
        try {
            String accessibilityEnabled = Settings.Secure.getString(
                reactContext.getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            boolean enabled = accessibilityEnabled != null &&
                accessibilityEnabled.contains(
                    reactContext.getPackageName() + "/" +
                    GuardianAccessibilityService.class.getName()
                );
            promise.resolve(enabled);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    // ── OPEN ACCESSIBILITY SETTINGS ───────────────────────────────────────────
    @ReactMethod
    public void openAccessibilitySettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("A11Y_ERROR", e.getMessage());
        }
    }

    // ── UPDATE BLOCKED APPS ───────────────────────────────────────────────────
    @ReactMethod
    public void updateBlockedApps(ReadableArray packages, Promise promise) {
        try {
            String[] packageArray = new String[packages.size()];
            for (int i = 0; i < packages.size(); i++) {
                packageArray[i] = packages.getString(i);
            }
            GuardianAccessibilityService.updateBlockedApps(packageArray);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("A11Y_ERROR", e.getMessage());
        }
    }

    // ── SET QUOTA STATUS ──────────────────────────────────────────────────────
    @ReactMethod
    public void setQuotaStatus(ReadableMap status, Promise promise) {
        try {
            int remainingMins = status.hasKey("remainingMins") ? status.getInt("remainingMins") : 120;
            boolean isLocked  = status.hasKey("isLocked") && status.getBoolean("isLocked");
            String lockReason = status.hasKey("lockReason") ? status.getString("lockReason") : "";

            GuardianAccessibilityService.setQuotaStatus(remainingMins, isLocked, lockReason);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("A11Y_ERROR", e.getMessage());
        }
    }

    // ── EMIT EVENT TO JS (appelé depuis Java natif) ───────────────────────────
    public void emitAppBlocked(String packageName) {
        com.facebook.react.bridge.WritableMap params = com.facebook.react.bridge.Arguments.createMap();
        params.putString("packageName", packageName);
        sendEvent("onAppBlocked", params);
    }

    public void emitTamperDetected(String type, String details) {
        com.facebook.react.bridge.WritableMap params = com.facebook.react.bridge.Arguments.createMap();
        params.putString("type", type);
        params.putString("details", details);
        sendEvent("onTamperDetected", params);
    }

    private void sendEvent(String eventName, com.facebook.react.bridge.WritableMap params) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }
}
