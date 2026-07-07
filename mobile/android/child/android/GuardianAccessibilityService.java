package com.guardian.accessibility;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.TextView;
import android.util.Log;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * GUARDIAN – Accessibility Service
 * ==================================
 * Surveille en permanence l'application au premier plan.
 * Affiche un overlay infranchissable quand:
 * - Une app bloquée est ouverte
 * - Le quota de temps est épuisé
 * - L'accès est verrouillé par le parent
 * - L'heure de coucher est dépassée
 *
 * Déclaration dans AndroidManifest.xml :
 * <service android:name=".accessibility.GuardianAccessibilityService"
 *          android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
 *   <intent-filter>
 *     <action android:name="android.accessibilityservice.AccessibilityService" />
 *   </intent-filter>
 *   <meta-data android:name="android.accessibilityservice"
 *              android:resource="@xml/accessibility_service_config" />
 * </service>
 */
public class GuardianAccessibilityService extends AccessibilityService {
    private static final String TAG = "GuardianA11y";
    private static final String GUARDIAN_PACKAGE = "com.guardian.child";

    // État partagé (mis à jour depuis React Native via BroadcastReceiver)
    private static Set<String> blockedPackages = new HashSet<>();
    private static int remainingMins = 120;
    private static boolean isLocked = false;
    private static String lockReason = "";

    private WindowManager windowManager;
    private View blockingOverlay;
    private boolean overlayShowing = false;
    private String lastBlockedPackage = "";

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        Log.i(TAG, "Guardian Accessibility Service started");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        if (event.getPackageName() == null) return;

        String currentPackage = event.getPackageName().toString();

        // Ne jamais bloquer l'app Guardian elle-même
        if (currentPackage.equals(GUARDIAN_PACKAGE)) {
            hideBlockingOverlay();
            return;
        }

        // Ignore les packages système essentiels
        if (isSystemEssential(currentPackage)) return;

        // Vérifie si l'accès est globalement verrouillé
        if (isLocked) {
            showBlockingOverlay(currentPackage, "🔒 " + lockReason, true);
            return;
        }

        // Vérifie le quota de temps
        if (remainingMins <= 0) {
            showBlockingOverlay(currentPackage,
                "⏰ Tu as utilisé tout ton temps d'écran pour aujourd'hui !\nParle à Guardian pour gagner du temps bonus.", false);
            return;
        }

        // Vérifie si l'app est explicitement bloquée
        if (blockedPackages.contains(currentPackage)) {
            showBlockingOverlay(currentPackage,
                "🚫 Tes parents ont bloqué cette application.", false);
            logBlockedAttempt(currentPackage);
            return;
        }

        // Détecte si l'enfant essaie d'accéder aux paramètres pour désactiver le service
        if (isSettingsRelated(currentPackage)) {
            Log.w(TAG, "Settings access attempt detected: " + currentPackage);
            // Redirige vers Guardian
            Intent guardianIntent = new Intent();
            guardianIntent.setClassName(GUARDIAN_PACKAGE, GUARDIAN_PACKAGE + ".MainActivity");
            guardianIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(guardianIntent);
            return;
        }

        hideBlockingOverlay();
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted");
    }

    /**
     * Affiche l'overlay de blocage par-dessus toute app
     */
    private void showBlockingOverlay(String blockedPackage, String message, boolean isParentLock) {
        if (overlayShowing && blockedPackage.equals(lastBlockedPackage)) return;

        hideBlockingOverlay();

        // Crée le layout de blocage
        blockingOverlay = LayoutInflater.from(this).inflate(R.layout.overlay_blocking, null);

        // Configure le message
        TextView messageView = blockingOverlay.findViewById(R.id.block_message);
        messageView.setText(message);

        // Bouton "Parler à Guardian"
        View guardianBtn = blockingOverlay.findViewById(R.id.btn_open_guardian);
        guardianBtn.setOnClickListener(v -> {
            Intent intent = new Intent();
            intent.setClassName(GUARDIAN_PACKAGE, GUARDIAN_PACKAGE + ".MainActivity");
            intent.putExtra("screen", "ai_chat");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        });

        // Type d'overlay selon la version Android
        int overlayType;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            overlayType = WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY;
        } else {
            overlayType = WindowManager.LayoutParams.TYPE_PHONE;
        }

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;

        windowManager.addView(blockingOverlay, params);
        overlayShowing = true;
        lastBlockedPackage = blockedPackage;

        Log.i(TAG, "Blocking overlay shown for: " + blockedPackage);
    }

    private void hideBlockingOverlay() {
        if (overlayShowing && blockingOverlay != null) {
            try {
                windowManager.removeView(blockingOverlay);
            } catch (Exception e) {
                Log.e(TAG, "Error hiding overlay: " + e.getMessage());
            }
            overlayShowing = false;
            lastBlockedPackage = "";
            blockingOverlay = null;
        }
    }

    private boolean isSettingsRelated(String pkg) {
        return pkg.startsWith("com.android.settings") ||
               pkg.equals("com.android.packageinstaller") ||
               pkg.equals("com.google.android.packageinstaller") ||
               pkg.equals("com.android.permissioncontroller") ||
               pkg.startsWith("com.android.vending"); // Play Store
    }

    private boolean isSystemEssential(String pkg) {
        return pkg.equals("com.android.systemui") ||
               pkg.equals("com.android.launcher") ||
               pkg.equals(GUARDIAN_PACKAGE);
    }

    private void logBlockedAttempt(String packageName) {
        // Envoi via BroadcastIntent pour que React Native le log via l'API
        Intent logIntent = new Intent("com.guardian.LOG_BLOCKED_APP");
        logIntent.putExtra("package_name", packageName);
        sendBroadcast(logIntent);
    }

    // ── API STATIQUE (appelée depuis React Native via NativeModule) ───────────
    public static void updateBlockedApps(String[] packages) {
        blockedPackages = new HashSet<>(Arrays.asList(packages));
        Log.i(TAG, "Blocked apps updated: " + blockedPackages.size() + " packages");
    }

    public static void setQuotaStatus(int remaining, boolean locked, String reason) {
        remainingMins = remaining;
        isLocked = locked;
        lockReason = reason != null ? reason : "";
        Log.i(TAG, "Quota status updated: remaining=" + remaining + " locked=" + locked);
    }
}
