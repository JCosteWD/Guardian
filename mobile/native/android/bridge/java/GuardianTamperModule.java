package com.guardian.native_modules;

import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import com.guardian.security.BehavioralDetectionService;

import java.io.File;

/**
 * GUARDIAN – Bridge React Native ↔ Tamper Detection
 * ===================================================
 * Lance la surveillance comportementale et expose les résultats à JS.
 */
public class GuardianTamperModule extends ReactContextBaseJavaModule
    implements BehavioralDetectionService.ThreatScoreCallback {

    private final ReactApplicationContext reactContext;
    private BehavioralDetectionService detector;

    public GuardianTamperModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() { return "GuardianTamper"; }

    // ── START MONITORING ──────────────────────────────────────────────────────
    @ReactMethod
    public void startMonitoring(com.facebook.react.bridge.ReadableMap config, Promise promise) {
        try {
            detector = new BehavioralDetectionService(reactContext, this);
            detector.startMonitoring();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("TAMPER_ERROR", e.getMessage());
        }
    }

    // ── CHECK INTEGRITY (synchrone rapide) ────────────────────────────────────
    @ReactMethod
    public void checkIntegrity(Promise promise) {
        try {
            WritableMap result = Arguments.createMap();

            // Root via fichiers
            boolean isRooted = checkRootFiles();
            result.putBoolean("isRooted", isRooted);

            // ADB
            boolean adbEnabled = Settings.Global.getInt(
                reactContext.getContentResolver(),
                Settings.Global.ADB_ENABLED, 0) == 1;
            result.putBoolean("adbEnabled", adbEnabled);

            // Emulateur
            boolean isEmulator = Build.FINGERPRINT.startsWith("generic") ||
                Build.MODEL.contains("Emulator") || Build.MODEL.contains("Android SDK");
            result.putBoolean("isEmulator", isEmulator);

            // Bootloader
            String verifiedBoot = Build.VERSION.CODENAME;
            result.putBoolean("integrityVerified", !isRooted && !adbEnabled);

            // Score global
            int score = (isRooted ? 8 : 0) + (adbEnabled ? 7 : 0) + (isEmulator ? 3 : 0);
            result.putInt("threatScore", score);

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("TAMPER_ERROR", e.getMessage());
        }
    }

    // ── CALLBACKS (depuis BehavioralDetectionService) ─────────────────────────
    @Override
    public void onThreatDetected(String threatType, int score, int totalScore) {
        WritableMap params = Arguments.createMap();
        params.putString("type", threatType);
        params.putInt("score", score);
        params.putInt("totalScore", totalScore);
        reactContext.getJSModule(
            com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onTamperDetected", params);
    }

    @Override
    public void onCriticalThreat(String description, int totalScore) {
        WritableMap params = Arguments.createMap();
        params.putString("type", "critical");
        params.putString("description", description);
        params.putInt("totalScore", totalScore);
        reactContext.getJSModule(
            com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onTamperDetected", params);
    }

    private boolean checkRootFiles() {
        String[] paths = {"/system/app/Superuser.apk", "/sbin/su", "/system/bin/su",
            "/system/xbin/su", "/data/local/xbin/su", "/data/adb/magisk"};
        for (String path : paths) {
            if (new File(path).exists()) return true;
        }
        return false;
    }
}
