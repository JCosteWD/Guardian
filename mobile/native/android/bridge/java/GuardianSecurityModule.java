package com.guardian.native_modules;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;

import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * GUARDIAN – Module de sécurité unifié
 * =====================================
 * Reçoit les broadcasts des services natifs (VPN, Accessibility)
 * et les transmet à JavaScript via des événements React Native.
 *
 * Événements émis vers JS:
 * - "onAppBlocked"        → { packageName }
 * - "onDomainBlocked"     → { domain }
 * - "onTamperDetected"    → { type, details, score }
 * - "onQuotaWarning"      → { remainingMins }
 * - "onZoneChanged"       → { zoneName, zoneType }
 */
public class GuardianSecurityModule extends ReactContextBaseJavaModule
    implements LifecycleEventListener {

    private final ReactApplicationContext reactContext;
    private BroadcastReceiver securityReceiver;

    public GuardianSecurityModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        reactContext.addLifecycleEventListener(this);
    }

    @Override
    public String getName() { return "GuardianSecurity"; }

    @Override
    public void onHostResume() { registerReceiver(); }

    @Override
    public void onHostPause() {}

    @Override
    public void onHostDestroy() { unregisterReceiver(); }

    // ── REGISTER BROADCAST RECEIVER ───────────────────────────────────────────
    private void registerReceiver() {
        if (securityReceiver != null) return;

        securityReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (action == null) return;

                WritableMap params = Arguments.createMap();

                switch (action) {
                    case "com.guardian.LOG_BLOCKED_APP":
                        params.putString("packageName", intent.getStringExtra("package_name"));
                        emit("onAppBlocked", params);
                        break;

                    case "com.guardian.DOMAIN_BLOCKED":
                        params.putString("domain", intent.getStringExtra("domain"));
                        emit("onDomainBlocked", params);
                        break;

                    case "com.guardian.TAMPER_ATTEMPT":
                        params.putString("type", intent.getStringExtra("tamper_type"));
                        params.putString("details", intent.getStringExtra("details"));
                        emit("onTamperDetected", params);
                        break;

                    case "com.guardian.ZONE_CHANGED":
                        params.putString("zoneName", intent.getStringExtra("zone_name"));
                        params.putString("zoneType", intent.getStringExtra("zone_type"));
                        emit("onZoneChanged", params);
                        break;
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction("com.guardian.LOG_BLOCKED_APP");
        filter.addAction("com.guardian.DOMAIN_BLOCKED");
        filter.addAction("com.guardian.TAMPER_ATTEMPT");
        filter.addAction("com.guardian.ZONE_CHANGED");

        reactContext.registerReceiver(securityReceiver, filter);
    }

    private void unregisterReceiver() {
        if (securityReceiver != null) {
            try { reactContext.unregisterReceiver(securityReceiver); }
            catch (Exception ignored) {}
            securityReceiver = null;
        }
    }

    // ── ADD LISTENER (requis par RN pour NativeEventEmitter côté JS) ──────────
    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(Integer count) {}

    private void emit(String event, WritableMap params) {
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(event, params);
    }
}
