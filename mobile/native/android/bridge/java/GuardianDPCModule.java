package com.guardian.native_modules;

import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;
import android.provider.Settings;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import com.guardian.dpc.GuardianAdminReceiver;

/**
 * GUARDIAN – Bridge React Native ↔ Device Policy Controller
 * ===========================================================
 * Expose les fonctions MDM au code JavaScript.
 *
 * Enregistrement dans MainApplication.java:
 * packages.add(new GuardianNativePackage());
 *
 * Utilisation côté JS:
 * const { GuardianDPC } = NativeModules;
 * await GuardianDPC.isDeviceAdmin(); // → boolean
 */
public class GuardianDPCModule extends ReactContextBaseJavaModule {

    private static final int REQUEST_ENABLE_ADMIN = 1001;
    private final DevicePolicyManager dpm;
    private final ComponentName adminComponent;

    public GuardianDPCModule(ReactApplicationContext reactContext) {
        super(reactContext);
        dpm = (DevicePolicyManager) reactContext.getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(reactContext, GuardianAdminReceiver.class);
    }

    @Override
    public String getName() { return "GuardianDPC"; }

    // ── IS DEVICE ADMIN ───────────────────────────────────────────────────────
    @ReactMethod
    public void isDeviceAdmin(Promise promise) {
        try {
            promise.resolve(dpm.isAdminActive(adminComponent));
        } catch (Exception e) {
            promise.reject("DPC_ERROR", e.getMessage());
        }
    }

    // ── REQUEST ADMIN PRIVILEGES ──────────────────────────────────────────────
    @ReactMethod
    public void requestAdminPrivileges(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "Aucune activité disponible");
                return;
            }
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "Guardian a besoin des droits administrateur pour protéger cet appareil.");
            activity.startActivityForResult(intent, REQUEST_ENABLE_ADMIN);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DPC_ERROR", e.getMessage());
        }
    }

    // ── OPEN ADMIN SETTINGS ───────────────────────────────────────────────────
    @ReactMethod
    public void openAdminSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DPC_ERROR", e.getMessage());
        }
    }

    // ── DISABLE APP INSTALLATION ──────────────────────────────────────────────
    @ReactMethod
    public void disableAppInstallation(Promise promise) {
        try {
            if (!dpm.isAdminActive(adminComponent)) {
                promise.reject("NOT_ADMIN", "Guardian n'est pas administrateur");
                return;
            }
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_INSTALL_APPS);
            dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);
            dpm.setUninstallBlocked(adminComponent,
                getReactApplicationContext().getPackageName(), true);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DPC_ERROR", e.getMessage());
        }
    }

    // ── START KIOSK MODE ──────────────────────────────────────────────────────
    @ReactMethod
    public void startKioskMode(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) { promise.reject("NO_ACTIVITY", ""); return; }
            String[] lockTaskPackages = { getReactApplicationContext().getPackageName() };
            dpm.setLockTaskPackages(adminComponent, lockTaskPackages);
            activity.startLockTask();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("KIOSK_ERROR", e.getMessage());
        }
    }

    // ── STOP KIOSK MODE (PIN parent requis côté JS avant d'appeler) ───────────
    @ReactMethod
    public void stopKioskMode(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) activity.stopLockTask();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("KIOSK_ERROR", e.getMessage());
        }
    }

    // ── BLOCK SETTINGS ACCESS ─────────────────────────────────────────────────
    @ReactMethod
    public void blockSettingsAccess(boolean block, Promise promise) {
        try {
            if (!dpm.isAdminActive(adminComponent)) {
                promise.resolve(false); return;
            }
            if (block) {
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN);
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES);
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_SAFE_BOOT);
                dpm.addUserRestriction(adminComponent, UserManager.DISALLOW_FACTORY_RESET);
            } else {
                dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_CONFIG_VPN);
                dpm.clearUserRestriction(adminComponent, UserManager.DISALLOW_DEBUGGING_FEATURES);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DPC_ERROR", e.getMessage());
        }
    }

    // ── GET STATUS ────────────────────────────────────────────────────────────
    @ReactMethod
    public void getStatus(Promise promise) {
        try {
            WritableMap status = Arguments.createMap();
            status.putBoolean("isAdmin", dpm.isAdminActive(adminComponent));
            status.putBoolean("isKiosk", dpm.isLockTaskPermitted(
                getReactApplicationContext().getPackageName()));
            status.putBoolean("installBlocked",
                dpm.getUserRestrictions(adminComponent)
                   .getBoolean(UserManager.DISALLOW_INSTALL_APPS, false));
            promise.resolve(status);
        } catch (Exception e) {
            promise.reject("DPC_ERROR", e.getMessage());
        }
    }
}
