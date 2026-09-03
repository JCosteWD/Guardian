import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Switch,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../i18n/i18n';
import { ThemeSelector, useTheme } from '../theme/ThemeSystem';

// ══════════════════════════════════════════════════════════════════════════════
// LANGUAGE SELECTOR SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export function LanguageScreen({ navigation }) {
  const { i18n, t } = useTranslation();
  const { theme } = useTheme();
  const [selected, setSelected] = useState(i18n.language || 'fr');
  const [saving, setSaving] = useState(false);

  const handleSelect = async (langCode) => {
    setSaving(true);
    setSelected(langCode);
    try {
      await changeLanguage(langCode);

      // RTL pour l'arabe
      const { I18nManager } = require('react-native');
      const isRTL = langCode === 'ar';
      if (I18nManager.isRTL !== isRTL) {
        I18nManager.forceRTL(isRTL);
        Alert.alert(
          'Redémarrage requis',
          'Veuillez redémarrer l\'application pour appliquer le changement de direction (RTL/LTR).',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.warn('Language change failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🌍 Langue</Text>
        <Text style={styles.subtitle}>Choisissez la langue de l'interface Guardian.</Text>

        {SUPPORTED_LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.langCard,
              selected === lang.code && { borderColor: '#7F77DD', backgroundColor: '#7F77DD11' },
            ]}
            onPress={() => handleSelect(lang.code)}
          >
            <Text style={styles.langFlag}>{lang.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.langLabel}>{lang.label}</Text>
              {lang.rtl && <Text style={styles.langRtl}>Direction droite → gauche (RTL)</Text>}
            </View>
            {selected === lang.code && (
              <View style={styles.selectedCheck}>
                <Text style={{ color: '#7F77DD', fontWeight: '800' }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 La langue de l'IA Guardian (ton de l'assistant) est configurée séparément dans le profil de chaque enfant.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APPEARANCE SCREEN – Thème + accessibilité
// ══════════════════════════════════════════════════════════════════════════════
export function AppearanceScreen({ navigation }) {
  const { theme, mode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState('normal'); // small | normal | large
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const THEMES = [
    { key: 'dark',  icon: '🌙', label: 'Mode sombre',     desc: 'Fond sombre, idéal le soir' },
    { key: 'light', icon: '☀️', label: 'Mode clair',      desc: 'Fond blanc, lisible en plein jour' },
    { key: 'auto',  icon: '📱', label: 'Automatique',     desc: 'Suit le thème système Android' },
  ];

  const FONT_SIZES = [
    { key: 'small',  label: 'Petit',  size: 13 },
    { key: 'normal', label: 'Normal', size: 15 },
    { key: 'large',  label: 'Grand',  size: 18 },
  ];

  return (
    <LinearGradient
      colors={mode === 'light' ? ['#F5F5FF', '#E8E8F8'] : ['#0a0a12', '#1a1a2e']}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={[styles.title, mode === 'light' && { color: '#1A1A2E' }]}>🎨 Apparence</Text>

        {/* Thème */}
        <Text style={[styles.sectionTitle, mode === 'light' && { color: '#555577' }]}>Thème</Text>
        {THEMES.map(th => (
          <TouchableOpacity
            key={th.key}
            style={[
              styles.themeCard,
              mode === 'light' && { backgroundColor: '#fff', borderColor: '#DDDDF0' },
              mode === th.key && { borderColor: '#7F77DD', backgroundColor: '#7F77DD11' },
            ]}
            onPress={() => toggleTheme(th.key)}
          >
            <Text style={styles.themeIcon}>{th.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeLabel, mode === 'light' && { color: '#1A1A2E' }]}>{th.label}</Text>
              <Text style={[styles.themeDesc, mode === 'light' && { color: '#555577' }]}>{th.desc}</Text>
            </View>
            {mode === th.key && <Text style={styles.themeCheck}>✓</Text>}
          </TouchableOpacity>
        ))}

        {/* Aperçu */}
        <View style={[styles.preview, mode === 'light' && { backgroundColor: '#fff', borderColor: '#DDDDF0' }]}>
          <Text style={[styles.previewLabel, mode === 'light' && { color: '#555577' }]}>Aperçu</Text>
          <View style={styles.previewContent}>
            <View style={[styles.previewCard, mode === 'light' && { backgroundColor: '#F0F0FA', borderColor: '#DDDDF0' }]}>
              <Text style={{ fontSize: 20 }}>🛡️</Text>
              <View>
                <Text style={[styles.previewCardTitle, mode === 'light' && { color: '#1A1A2E' }]}>Guardian</Text>
                <Text style={[styles.previewCardSub, mode === 'light' && { color: '#555577' }]}>Contrôle parental</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Taille de police */}
        <Text style={[styles.sectionTitle, mode === 'light' && { color: '#555577' }]}>Taille du texte</Text>
        <View style={styles.fontSizeRow}>
          {FONT_SIZES.map(fs => (
            <TouchableOpacity
              key={fs.key}
              style={[
                styles.fontSizeBtn,
                mode === 'light' && { backgroundColor: '#F0F0FA', borderColor: '#DDDDF0' },
                fontSize === fs.key && { borderColor: '#7F77DD', backgroundColor: '#7F77DD11' },
              ]}
              onPress={() => setFontSize(fs.key)}
            >
              <Text style={[{ fontSize: fs.size, fontWeight: '700' }, mode === 'light' ? { color: '#1A1A2E' } : { color: '#fff' }]}>
                Aa
              </Text>
              <Text style={[styles.fontSizeLabel, mode === 'light' && { color: '#555577' }]}>{fs.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Accessibilité */}
        <Text style={[styles.sectionTitle, mode === 'light' && { color: '#555577' }]}>Accessibilité</Text>
        <View style={[styles.accessCard, mode === 'light' && { backgroundColor: '#fff', borderColor: '#DDDDF0' }]}>
          {[
            { label: 'Réduire les animations', value: reduceMotion, onChange: setReduceMotion, desc: 'Désactive les transitions et effets visuels' },
            { label: 'Contraste élevé', value: highContrast, onChange: setHighContrast, desc: 'Augmente le contraste pour une meilleure lisibilité' },
          ].map((item, i) => (
            <View key={i} style={[styles.accessRow, i > 0 && { borderTopWidth: 1, borderTopColor: mode === 'light' ? '#DDDDF0' : '#1a1a2e', marginTop: 12, paddingTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accessLabel, mode === 'light' && { color: '#1A1A2E' }]}>{item.label}</Text>
                <Text style={[styles.accessDesc, mode === 'light' && { color: '#555577' }]}>{item.desc}</Text>
              </View>
              <Switch
                value={item.value}
                onValueChange={item.onChange}
                trackColor={{ true: '#7F77DD', false: mode === 'light' ? '#DDDDF0' : '#252540' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

export default { LanguageScreen, AppearanceScreen };

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#7F77DD', fontWeight: '600' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 6 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 24, lineHeight: 20 },
  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 20 },

  langCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#13131f', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252540', marginBottom: 8 },
  langFlag: { fontSize: 30 },
  langLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  langRtl: { color: '#888', fontSize: 11, marginTop: 2 },
  selectedCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7F77DD22', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#7F77DD' },

  infoBox: { backgroundColor: '#7F77DD11', borderRadius: 12, padding: 14, marginTop: 20, borderWidth: 1, borderColor: '#7F77DD22' },
  infoText: { color: '#888', fontSize: 13, lineHeight: 20 },

  themeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#13131f', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252540', marginBottom: 8 },
  themeIcon: { fontSize: 26 },
  themeLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  themeDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  themeCheck: { color: '#7F77DD', fontWeight: '800', fontSize: 18 },

  preview: { backgroundColor: '#13131f', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252540', marginTop: 8 },
  previewLabel: { color: '#888', fontSize: 12, marginBottom: 12 },
  previewContent: {},
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#252540' },
  previewCardTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  previewCardSub: { color: '#888', fontSize: 12 },

  fontSizeRow: { flexDirection: 'row', gap: 10 },
  fontSizeBtn: { flex: 1, alignItems: 'center', backgroundColor: '#13131f', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252540', gap: 6 },
  fontSizeLabel: { color: '#888', fontSize: 11, fontWeight: '600' },

  accessCard: { backgroundColor: '#13131f', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#252540' },
  accessRow: { flexDirection: 'row', alignItems: 'center' },
  accessLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
  accessDesc: { color: '#888', fontSize: 12, marginTop: 2, lineHeight: 17 },
});
