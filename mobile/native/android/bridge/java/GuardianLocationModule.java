package com.guardian.native_modules;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.google.android.gms.location.*;

/**
 * GUARDIAN – Bridge React Native ↔ Location (FusedLocationProvider)
 * ==================================================================
 * Utilise le FusedLocationProviderClient de Google Play Services
 * pour un tracking optimisé en termes de batterie.
 */
public class GuardianLocationModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;
    private FusedLocationProviderClient fusedClient;
    private LocationCallback locationCallback;
    private boolean isTracking = false;

    public GuardianLocationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        fusedClient = LocationServices.getFusedLocationProviderClient(reactContext);
    }

    @Override
    public String getName() { return "GuardianLocation"; }

    // ── START TRACKING ────────────────────────────────────────────────────────
    @ReactMethod
    public void startTracking(ReadableMap config, Promise promise) {
        if (isTracking) { promise.resolve(true); return; }

        // Vérifie les permissions
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION_DENIED", "Permission de localisation non accordée");
            return;
        }

        try {
            long intervalMs       = config.hasKey("intervalMs") ? (long)config.getDouble("intervalMs") : 300000L;
            long fastestIntervalMs = config.hasKey("fastestIntervalMs") ? (long)config.getDouble("fastestIntervalMs") : 60000L;
            float smallestDisplacement = config.hasKey("smallestDisplacement") ? (float)config.getDouble("smallestDisplacement") : 50f;

            LocationRequest locationRequest = LocationRequest.create()
                .setInterval(intervalMs)
                .setFastestInterval(fastestIntervalMs)
                .setSmallestDisplacement(smallestDisplacement)
                .setPriority(LocationRequest.PRIORITY_BALANCED_POWER_ACCURACY);

            locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult result) {
                    if (result == null) return;
                    Location loc = result.getLastLocation();
                    if (loc == null) return;

                    WritableMap params = Arguments.createMap();
                    params.putDouble("latitude", loc.getLatitude());
                    params.putDouble("longitude", loc.getLongitude());
                    params.putInt("accuracyMeters", (int) loc.getAccuracy());
                    params.putDouble("timestamp", loc.getTime());

                    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("onLocationUpdate", params);
                }
            };

            fusedClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
            isTracking = true;
            promise.resolve(true);

        } catch (Exception e) {
            promise.reject("LOCATION_ERROR", e.getMessage());
        }
    }

    // ── STOP TRACKING ─────────────────────────────────────────────────────────
    @ReactMethod
    public void stopTracking(Promise promise) {
        try {
            if (locationCallback != null) {
                fusedClient.removeLocationUpdates(locationCallback);
                locationCallback = null;
            }
            isTracking = false;
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("LOCATION_ERROR", e.getMessage());
        }
    }

    // ── GET LAST KNOWN LOCATION ───────────────────────────────────────────────
    @ReactMethod
    public void getLastLocation(Promise promise) {
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            promise.reject("PERMISSION_DENIED", "");
            return;
        }
        fusedClient.getLastLocation().addOnSuccessListener(location -> {
            if (location == null) { promise.resolve(null); return; }
            WritableMap map = Arguments.createMap();
            map.putDouble("latitude", location.getLatitude());
            map.putDouble("longitude", location.getLongitude());
            map.putInt("accuracyMeters", (int)location.getAccuracy());
            promise.resolve(map);
        }).addOnFailureListener(e -> promise.reject("LOCATION_ERROR", e.getMessage()));
    }
}
