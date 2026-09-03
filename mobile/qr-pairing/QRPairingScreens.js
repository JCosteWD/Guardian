import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Alert, ActivityIndicator, Vibration,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useScanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';
import api, { childAuth } from '../services/api';

// ── SCAN FRAME ANIMATION ──────────────────────────────────────────────────────
const ScanFrame = ({ size = 260, color = '#7F77DD' }) => {
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const corners = [
    { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  ];

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {/* Coins animés */}
      {corners.map((c, i) => (
        <View key={i} style={[styles.corner, c, { borderColor: color, width: 28, height: 28 }]} />
      ))}
      {/* Ligne de scan animée */}
      <Animated.View style={[
        styles.scanLine,
        {
          backgroundColor: color,
          transform: [{
            translateY: scanAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, size - 4],
            })
          }],
        }
      ]} />
    </View>
  );
};

// ── QR PAIRING SCREEN (App Enfant) ────────────────────────────────────────────
export function QRScanPairingScreen({ onPaired }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanning, setScanning]           = useState(true);
  const [processing, setProcessing]       = useState(false);
  const [error, setError]                 = useState('');
  const devices                           = useCameraDevices();
  const device                            = devices.back;
  const lastScan                          = useRef('');

  const [frameProcessor, barcodes] = useScanBarcodes([BarcodeFormat.QR_CODE], {
    checkInverted: true,
  });

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'authorized');
    })();
  }, []);

  useEffect(() => {
    if (!scanning || !barcodes.length) return;
    const qrValue = barcodes[0]?.displayValue;
    if (!qrValue || qrValue === lastScan.current) return;

    handleQRCode(qrValue);
  }, [barcodes]);

  const handleQRCode = async (value) => {
    lastScan.current = value;
    setScanning(false);
    setProcessing(true);

    try {
      // Vérifie que le QR code est un token Guardian valide
      if (!value.startsWith('guardian://pair/')) {
        setError('QR code invalide. Utilisez le code depuis l\'app parent Guardian.');
        setScanning(true);
        setProcessing(false);
        return;
      }

      const pairingToken = value.replace('guardian://pair/', '');
      Vibration.vibrate([0, 100, 50, 100]);

      // Appelle l'API de couplage
      const { data } = await api.post('/auth/pair-device', { pairingToken });

      // Authentifie l'appareil
      await childAuth(data.deviceId);
      onPaired(data.child);

    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur de couplage';
      setError(msg);
      Alert.alert('❌ Échec du couplage', msg, [
        { text: 'Réessayer', onPress: () => { setScanning(true); setError(''); lastScan.current = ''; } }
      ]);
    } finally {
      setProcessing(false);
    }
  };

  if (!hasPermission) {
    return (
      <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
        <Text style={styles.permTitle}>Caméra requise</Text>
        <Text style={styles.permSub}>Guardian a besoin d'accéder à la caméra pour scanner le QR code de couplage.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={async () => {
          const s = await Camera.requestCameraPermission();
          setHasPermission(s === 'authorized');
        }}>
          <Text style={styles.permBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (!device) return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={styles.center}>
      <ActivityIndicator color="#7F77DD" size="large" />
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      {/* Caméra plein écran */}
      {device && (
        <Camera
          style={StyleSheet.absoluteFillObject}
          device={device}
          isActive={scanning}
          frameProcessor={frameProcessor}
          frameProcessorFps={5}
        />
      )}

      {/* Overlay sombre autour du cadre */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea} />
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* UI par-dessus */}
      <View style={styles.ui}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🛡️ Coupler l'appareil</Text>
          <Text style={styles.headerSub}>Scannez le QR code affiché dans l'app parent</Text>
        </View>

        {/* Cadre de scan */}
        <View style={styles.frameWrap}>
          <ScanFrame size={260} color={processing ? '#1D9E75' : '#7F77DD'} />
          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator color="#1D9E75" size="large" />
              <Text style={styles.processingText}>Couplage en cours...</Text>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>❌ {error}</Text>
            </View>
          ) : processing ? (
            <Text style={styles.instrText}>✅ QR code détecté !</Text>
          ) : (
            <Text style={styles.instrText}>Placez le QR code dans le cadre</Text>
          )}

          <View style={styles.steps}>
            {[
              'Ouvrez l\'app Guardian Parent',
              'Allez dans Enfants → Coupler l\'appareil',
              'Scannez le QR code affiché',
            ].map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>

          {/* Code manuel alternatif */}
          <TouchableOpacity style={styles.manualBtn} onPress={() => {
            Alert.prompt(
              'Code manuel',
              'Entrez le code à 6 caractères affiché dans l\'app parent :',
              (code) => {
                if (code?.length === 6) handleQRCode(`guardian://pair/${code.toUpperCase()}`);
              },
              'plain-text',
              '',
              'default'
            );
          }}>
            <Text style={styles.manualBtnText}>⌨️ Entrer le code manuellement</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── QR CODE DISPLAY (App Parent – génère le QR) ───────────────────────────────
import QRCode from 'react-native-qrcode-svg';

export function QRCodeDisplayScreen({ route, navigation }) {
  const { child, pairingCode } = route.params;
  const qrValue = `guardian://pair/${pairingCode}`;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [timeLeft, setTimeLeft] = useState(24 * 60 * 60); // 24h en secondes

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m ${String(s).padStart(2, '0')}s`;
  };

  const expired = timeLeft === 0;

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <Animated.ScrollView
        contentContainerStyle={styles.qrScroll}
        style={{ opacity: fadeAnim }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.qrTitle}>📱 Coupler l'appareil de {child.first_name}</Text>
        <Text style={styles.qrSub}>Scannez ce QR code depuis l'app Guardian Enfant</Text>

        {/* QR Code */}
        <View style={[styles.qrCard, expired && styles.qrCardExpired]}>
          {expired ? (
            <View style={styles.qrExpiredOverlay}>
              <Text style={{ fontSize: 40 }}>⏰</Text>
              <Text style={styles.qrExpiredText}>Code expiré</Text>
            </View>
          ) : (
            <QRCode
              value={qrValue}
              size={220}
              backgroundColor="#13131f"
              color="#FFFFFF"
              logo={require('../assets/logo_shield.png')}
              logoSize={40}
              logoBackgroundColor="#13131f"
              logoBorderRadius={8}
            />
          )}
        </View>

        {/* Code textuel */}
        <View style={styles.codeWrap}>
          <Text style={styles.codeLabel}>Code alternatif (saisie manuelle)</Text>
          <View style={styles.codeDigits}>
            {pairingCode.split('').map((c, i) => (
              <View key={i} style={styles.codeDigit}>
                <Text style={styles.codeDigitText}>{c}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Timer */}
        <View style={[styles.timerBadge, expired && { borderColor: '#E24B4A44', backgroundColor: '#E24B4A11' }]}>
          <Text style={[styles.timerText, expired && { color: '#E24B4A' }]}>
            {expired ? '⏰ Code expiré' : `⏳ Expire dans : ${formatTime(timeLeft)}`}
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.qrInstructions}>
          {[
            { icon: '📥', text: `Installez Guardian Enfant sur l'appareil de ${child.first_name}` },
            { icon: '📷', text: 'Ouvrez l\'app → Appuyez sur "Scanner le QR code"' },
            { icon: '✅', text: 'Acceptez toutes les permissions demandées' },
            { icon: '🎉', text: `${child.first_name} est prêt(e) à utiliser Guardian !` },
          ].map((s, i) => (
            <View key={i} style={styles.qrStep}>
              <Text style={styles.qrStepIcon}>{s.icon}</Text>
              <Text style={styles.qrStepText}>{s.text}</Text>
            </View>
          ))}
        </View>

        {expired && (
          <TouchableOpacity
            style={styles.regenerateBtn}
            onPress={() => navigation.replace('Pairing', { child })}
          >
            <LinearGradient colors={['#7F77DD', '#378ADD']} style={styles.regenerateBtnGradient}>
              <Text style={styles.regenerateBtnText}>🔄 Générer un nouveau code</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </Animated.ScrollView>
    </LinearGradient>
  );
}

export default QRScanPairingScreen;

// ── STYLES ─────────────────────────────────────────────────────────────────────
const SCAN_SIZE = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  // Overlay caméra
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayMiddle: { flexDirection: 'row', height: SCAN_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  scanArea: { width: SCAN_SIZE, height: SCAN_SIZE },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },

  // Cadre de scan
  corner: { position: 'absolute', borderRadius: 2 },
  scanLine: { position: 'absolute', left: 4, right: 4, height: 2, opacity: 0.8 },

  // UI
  ui: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  header: { padding: 24, paddingTop: 60, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 6, textAlign: 'center' },

  frameWrap: { alignItems: 'center', justifyContent: 'center' },
  processingOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, gap: 12,
  },
  processingText: { color: '#1D9E75', fontWeight: '700', fontSize: 15 },

  instructions: { padding: 24, paddingBottom: 40, alignItems: 'center' },
  instrText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 20, fontWeight: '600' },
  errorBox: { backgroundColor: '#E24B4A22', borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: '#E24B4A' },
  errorText: { color: '#E24B4A', fontSize: 13 },

  steps: { gap: 10, width: '100%', marginBottom: 20 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#7F77DD33', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#7F77DD' },
  stepNumText: { color: '#7F77DD', fontSize: 12, fontWeight: '800' },
  stepText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, flex: 1 },

  manualBtn: { padding: 10 },
  manualBtnText: { color: '#7F77DD', fontWeight: '600', fontSize: 13 },

  // Permissions
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  permSub: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  permBtn: { backgroundColor: '#7F77DD', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // QR Display (parent)
  qrScroll: { flexGrow: 1, padding: 24, paddingTop: 56, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: '#7F77DD', fontWeight: '600' },
  qrTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  qrSub: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 28 },

  qrCard: {
    backgroundColor: '#13131f', borderRadius: 24, padding: 24,
    borderWidth: 2, borderColor: '#7F77DD44', marginBottom: 24,
    position: 'relative',
  },
  qrCardExpired: { borderColor: '#E24B4A44', opacity: 0.6 },
  qrExpiredOverlay: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center', gap: 12 },
  qrExpiredText: { color: '#E24B4A', fontWeight: '800', fontSize: 16 },

  codeWrap: { alignItems: 'center', marginBottom: 20 },
  codeLabel: { color: '#888', fontSize: 12, marginBottom: 10, fontWeight: '600' },
  codeDigits: { flexDirection: 'row', gap: 8 },
  codeDigit: { width: 40, height: 48, backgroundColor: '#1a1a2e', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#7F77DD55' },
  codeDigitText: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },

  timerBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#7F77DD44', backgroundColor: '#7F77DD11', marginBottom: 28 },
  timerText: { color: '#7F77DD', fontSize: 13, fontWeight: '700' },

  qrInstructions: { width: '100%', gap: 14, marginBottom: 24 },
  qrStep: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  qrStepIcon: { fontSize: 20 },
  qrStepText: { color: '#aaa', fontSize: 13, lineHeight: 20, flex: 1 },

  regenerateBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  regenerateBtnGradient: { padding: 18, alignItems: 'center' },
  regenerateBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
