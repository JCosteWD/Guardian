package com.guardian.security;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * GUARDIAN – Chiffrement AES-256-GCM via Android Keystore
 * =========================================================
 * Toutes les données sensibles (token JWT, règles, quotas, historique)
 * sont chiffrées via AES-256-GCM avec une clé stockée dans l'Android Keystore.
 *
 * La clé ne quitte JAMAIS le Keystore matériel (TEE/StrongBox).
 * Même si l'appareil est rooté, la clé reste inaccessible.
 *
 * DONNÉES CHIFFRÉES:
 * - Token JWT d'authentification
 * - Configuration des règles parentales (cache local)
 * - Historique d'activité en attente de sync
 * - Préférences et état de l'app
 *
 * ALGORITHME: AES/GCM/NoPadding (256 bits) — authentifié, anti-rejeu
 */
public class GuardianEncryption {
    private static final String TAG = "GuardianCrypto";
    private static final String KEY_ALIAS = "guardian_master_key";
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;  // 96 bits
    private static final int GCM_TAG_LENGTH = 128; // 128 bits

    private static GuardianEncryption instance;

    private GuardianEncryption() {}

    public static synchronized GuardianEncryption getInstance() {
        if (instance == null) instance = new GuardianEncryption();
        return instance;
    }

    /**
     * Initialise ou charge la clé maîtresse depuis l'Android Keystore.
     * Si la clé n'existe pas encore, elle est générée et stockée de façon permanente.
     */
    public void initialize() {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
            keyStore.load(null);

            if (!keyStore.containsAlias(KEY_ALIAS)) {
                generateMasterKey();
                Log.i(TAG, "Master key generated and stored in Android Keystore");
            } else {
                Log.i(TAG, "Master key loaded from Android Keystore");
            }
        } catch (Exception e) {
            Log.e(TAG, "Keystore initialization failed: " + e.getMessage());
            throw new RuntimeException("Cannot initialize Guardian encryption", e);
        }
    }

    /**
     * Génère la clé AES-256 dans le Keystore matériel (TEE/StrongBox si disponible).
     */
    private void generateMasterKey() throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER
        );

        KeyGenParameterSpec.Builder specBuilder = new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
        .setKeySize(256)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        // Nécessite authentification biométrique pour les opérations sensibles (optionnel)
        // .setUserAuthenticationRequired(true)
        // .setUserAuthenticationValidityDurationSeconds(30)
        .setInvalidatedByBiometricEnrollment(false);

        // StrongBox si disponible (chip de sécurité dédié)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            try {
                specBuilder.setIsStrongBoxBacked(true);
            } catch (Exception e) {
                Log.w(TAG, "StrongBox not available, using TEE");
            }
        }

        keyGenerator.init(specBuilder.build());
        keyGenerator.generateKey();
    }

    /**
     * Chiffre une chaîne de caractères.
     * @return Base64(IV + Ciphertext + AuthTag)
     */
    public String encrypt(String plaintext) {
        if (plaintext == null) return null;
        try {
            SecretKey key = getKey();
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, key);

            byte[] iv = cipher.getIV(); // IV aléatoire généré automatiquement
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            // Format: IV(12) || Ciphertext+Tag
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);

            return Base64.encodeToString(combined, Base64.NO_WRAP);
        } catch (Exception e) {
            Log.e(TAG, "Encryption failed: " + e.getMessage());
            throw new RuntimeException("Encryption failed", e);
        }
    }

    /**
     * Déchiffre une chaîne chiffrée par encrypt().
     */
    public String decrypt(String encryptedBase64) {
        if (encryptedBase64 == null) return null;
        try {
            byte[] combined = Base64.decode(encryptedBase64, Base64.NO_WRAP);

            // Sépare IV et ciphertext
            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] ciphertext = new byte[combined.length - GCM_IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
            System.arraycopy(combined, GCM_IV_LENGTH, ciphertext, 0, ciphertext.length);

            SecretKey key = getKey();
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            GCMParameterSpec paramSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, key, paramSpec);

            byte[] plaintext = cipher.doFinal(ciphertext);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.e(TAG, "Decryption failed: " + e.getMessage());
            return null; // Données corrompues ou altérées
        }
    }

    /**
     * Chiffre des données binaires (ex: image d'avatar, cache JSON).
     */
    public byte[] encryptBytes(byte[] plainBytes) {
        try {
            SecretKey key = getKey();
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            byte[] ciphertext = cipher.doFinal(plainBytes);
            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);
            return combined;
        } catch (Exception e) {
            Log.e(TAG, "Binary encryption failed: " + e.getMessage());
            throw new RuntimeException("Binary encryption failed", e);
        }
    }

    public byte[] decryptBytes(byte[] encryptedBytes) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] ciphertext = new byte[encryptedBytes.length - GCM_IV_LENGTH];
            System.arraycopy(encryptedBytes, 0, iv, 0, GCM_IV_LENGTH);
            System.arraycopy(encryptedBytes, GCM_IV_LENGTH, ciphertext, 0, ciphertext.length);
            SecretKey key = getKey();
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            return cipher.doFinal(ciphertext);
        } catch (Exception e) {
            Log.e(TAG, "Binary decryption failed: " + e.getMessage());
            return null;
        }
    }

    /**
     * Vérifie l'intégrité d'une valeur (HMAC simplifié via GCM).
     */
    public boolean verify(String plaintext, String encryptedBase64) {
        try {
            String decrypted = decrypt(encryptedBase64);
            return plaintext != null && plaintext.equals(decrypted);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Supprime la clé maîtresse (en cas de désinstallation ou reset).
     * IRRÉVERSIBLE – toutes les données chiffrées deviennent inaccessibles.
     */
    public void deleteKey() {
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
            keyStore.load(null);
            keyStore.deleteEntry(KEY_ALIAS);
            Log.w(TAG, "Master key deleted from Android Keystore");
        } catch (Exception e) {
            Log.e(TAG, "Key deletion failed: " + e.getMessage());
        }
    }

    private SecretKey getKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
    }
}
