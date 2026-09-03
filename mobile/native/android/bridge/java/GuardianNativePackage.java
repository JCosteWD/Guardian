package com.guardian.native_modules;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * GUARDIAN – Package de tous les modules natifs
 * ===============================================
 * Enregistre tous les NativeModules Guardian auprès de React Native.
 *
 * À ajouter dans MainApplication.java:
 *
 * @Override
 * protected List<ReactPackage> getPackages() {
 *   return Arrays.<ReactPackage>asList(
 *     new MainReactPackage(),
 *     new GuardianNativePackage()   // ← AJOUTER ICI
 *   );
 * }
 */
public class GuardianNativePackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        return Arrays.<NativeModule>asList(
            new GuardianDPCModule(reactContext),
            new GuardianVPNModule(reactContext),
            new GuardianAccessibilityModule(reactContext),
            new GuardianTamperModule(reactContext),
            new GuardianLocationModule(reactContext),
            new GuardianSecurityModule(reactContext)
        );
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
