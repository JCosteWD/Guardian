package com.guardian.dpc;

import android.app.admin.DeviceAdminReceiver;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.UserManager;
import android.util.Log;

/**
 * GUARDIAN – Device Admin Receiver
 * =================================
 * Permet à Guardian d'agir comme administrateur de l'appareil.
 * Une fois activé, l'enfant ne peut pas désinstaller l'app sans
 * désactiver d'abord l'administration (ce qui nécessite le PIN parent).
 *
 * Déclaration dans AndroidManifest.xml :
 * <receiver android:name=".dpc.GuardianAdminReceiver"
 *           android:permission="android.permission.BIND_DEVICE_ADMIN">
 *   <meta-data android:name="android.app.device_admin"
 *              android:resource="@xml/device_admin_policies" />
 *   <intent-filter>
 *     <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
 *   </intent-filter>
 * </receiver>
 */
public class GuardianAdminReceiver extends DeviceAdminReceiver {
    private static final String TAG = "GuardianDPC";

    @Override
    public void onEnabled(Context context, Intent intent) {
        Log.i(TAG, "Device Admin enabled – applying security policies");
        applySecurityPolicies(context);
    }

    @Override
    public void onDisableRequested(Context context, Intent intent) {
        // Intercepte la tentative de désactivation – alerte le parent
        Log.w(TAG, "Disable requested – notifying parent");
        notifyParentTamperAttempt(context, "disable_admin");
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        Log.w(TAG, "Device Admin disabled");
    }

    /**
     * Applique toutes les restrictions de sécurité dès l'activation
     */
    private void applySecurityPolicies(Context context) {
        DevicePolicyManager dpm = (DevicePolicyManager)
            context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(context, GuardianAdminReceiver.class);

        try {
            // ── BLOQUER L'INSTALLATION DE NOUVELLES APPS ──────────────────
            // Empêche d'installer un nouveau navigateur pour contourner les filtres
            dpm.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_APPS);
            dpm.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES);

            // ── BLOQUER LA DÉSINSTALLATION DE GUARDIAN ────────────────────
            dpm.setUninstallBlocked(admin, context.getPackageName(), true);

            // ── BLOQUER LA CONFIGURATION RÉSEAU ──────────────────────────
            // Empêche de désactiver le VPN Guardian ou changer le WiFi
            dpm.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_VPN);
            dpm.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_WIFI);
            dpm.addUserRestriction(admin, UserManager.DISALLOW_CONFIG_MOBILE_NETWORKS);

            // ── BLOQUER LE MODE DÉVELOPPEUR ───────────────────────────────
            // Empêche l'ADB qui pourrait bypasser les restrictions
            dpm.addUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES);
            dpm.addUserRestriction(admin, UserManager.DISALLOW_USB_FILE_TRANSFER);

            // ── BLOQUER LES PARAMÈTRES SENSIBLES ─────────────────────────
            dpm.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET);
            dpm.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT);

            // ── ALWAYS-ON VPN ─────────────────────────────────────────────
            // Force le VPN Guardian en permanence (Android 8+)
            dpm.setAlwaysOnVpnPackage(admin, context.getPackageName(), true, null);

            Log.i(TAG, "All security policies applied successfully");

        } catch (Exception e) {
            Log.e(TAG, "Failed to apply policies: " + e.getMessage());
        }
    }

    private void notifyParentTamperAttempt(Context context, String type) {
        // Envoie une notification via WorkManager (fonctionne même en background)
        Intent notifyIntent = new Intent(context, TamperNotificationWorker.class);
        notifyIntent.putExtra("tamper_type", type);
        context.startService(notifyIntent);
    }
}
