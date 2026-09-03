package com.guardian.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.guardian.vpn.GuardianVPNService;
import com.guardian.MainActivity;

/**
 * GUARDIAN – Boot Receiver
 * =========================
 * Démarre automatiquement Guardian dès que l'appareil boot.
 * L'enfant ne peut pas contourner Guardian en redémarrant l'appareil.
 *
 * Séquence au démarrage :
 * 1. Démarre le service VPN en arrière-plan
 * 2. Lance l'activité principale Guardian (launcher)
 * 3. Le DevicePolicyManager réapplique les restrictions automatiquement
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "GuardianBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.i(TAG, "Device booted – starting Guardian services");

            // 1. Démarre le VPN en foreground service
            Intent vpnIntent = new Intent(context, GuardianVPNService.class);
            vpnIntent.setAction("START");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(vpnIntent);
            } else {
                context.startService(vpnIntent);
            }

            // 2. Lance l'app principale Guardian
            // Délai de 3s pour laisser le système se stabiliser
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                Intent mainIntent = new Intent(context, MainActivity.class);
                mainIntent.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
                );
                mainIntent.putExtra("from_boot", true);
                context.startActivity(mainIntent);
            }, 3000);

            Log.i(TAG, "Guardian boot sequence initiated");
        }
    }
}
