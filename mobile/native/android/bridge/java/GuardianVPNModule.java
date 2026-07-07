package com.guardian.native_modules;

import android.app.Activity;
import android.content.Intent;
import android.net.VpnService;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import com.guardian.vpn.GuardianVPNService;

/**
 * GUARDIAN – Bridge React Native ↔ VPN Service
 * ==============================================
 * Démarre/arrête le VPN local Guardian depuis JavaScript.
 * Passe la blocklist (domaines + catégories) au service natif.
 */
public class GuardianVPNModule extends ReactContextBaseJavaModule {

    private static final int REQUEST_VPN_PERMISSION = 1002;
    private final ReactApplicationContext reactContext;

    public GuardianVPNModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() { return "GuardianVPN"; }

    // ── START VPN ─────────────────────────────────────────────────────────────
    @ReactMethod
    public void start(ReadableMap config, Promise promise) {
        try {
            // Vérifie/demande la permission VPN
            Intent prepare = VpnService.prepare(reactContext);
            if (prepare != null) {
                Activity activity = getCurrentActivity();
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "Aucune activité disponible");
                    return;
                }
                activity.startActivityForResult(prepare, REQUEST_VPN_PERMISSION);
                // La promise sera résolue après l'activité via ActivityEventListener
                promise.resolve(false); // En attente de permission
                return;
            }

            // Lance le service VPN
            Intent intent = new Intent(reactContext, GuardianVPNService.class);
            intent.setAction("START");

            // Passe la blocklist
            if (config.hasKey("blockedDomains")) {
                ReadableArray domains = config.getArray("blockedDomains");
                String[] domainArray = new String[domains.size()];
                for (int i = 0; i < domains.size(); i++) domainArray[i] = domains.getString(i);
                intent.putExtra("blocked_domains", domainArray);
            }
            if (config.hasKey("blockedCategories")) {
                ReadableArray cats = config.getArray("blockedCategories");
                String[] catArray = new String[cats.size()];
                for (int i = 0; i < cats.size(); i++) catArray[i] = cats.getString(i);
                intent.putExtra("blocked_categories", catArray);
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent);
            } else {
                reactContext.startService(intent);
            }

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("VPN_ERROR", e.getMessage());
        }
    }

    // ── STOP VPN ──────────────────────────────────────────────────────────────
    @ReactMethod
    public void stop(Promise promise) {
        try {
            Intent intent = new Intent(reactContext, GuardianVPNService.class);
            intent.setAction("STOP");
            reactContext.startService(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("VPN_ERROR", e.getMessage());
        }
    }

    // ── IS RUNNING ────────────────────────────────────────────────────────────
    @ReactMethod
    public void isRunning(Promise promise) {
        try {
            android.app.ActivityManager am = (android.app.ActivityManager)
                reactContext.getSystemService(android.content.Context.ACTIVITY_SERVICE);
            for (android.app.ActivityManager.RunningServiceInfo service :
                     am.getRunningServices(Integer.MAX_VALUE)) {
                if (GuardianVPNService.class.getName().equals(service.service.getClassName())) {
                    promise.resolve(true);
                    return;
                }
            }
            promise.resolve(false);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    // ── UPDATE BLOCKLIST ──────────────────────────────────────────────────────
    @ReactMethod
    public void updateBlocklist(ReadableMap config, Promise promise) {
        try {
            String[] domains = new String[0];
            String[] categories = new String[0];

            if (config.hasKey("blockedDomains")) {
                ReadableArray arr = config.getArray("blockedDomains");
                domains = new String[arr.size()];
                for (int i = 0; i < arr.size(); i++) domains[i] = arr.getString(i);
            }
            if (config.hasKey("blockedCategories")) {
                ReadableArray arr = config.getArray("blockedCategories");
                categories = new String[arr.size()];
                for (int i = 0; i < arr.size(); i++) categories[i] = arr.getString(i);
            }

            GuardianVPNService.updateBlocklist(domains, categories);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("VPN_ERROR", e.getMessage());
        }
    }
}
