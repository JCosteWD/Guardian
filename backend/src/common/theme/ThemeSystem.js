// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Système de thème complet (sombre / clair)
// ══════════════════════════════════════════════════════════════════════════════
// Utilise React Context pour propager le thème dans toute l'app.
// Le choix est persisté dans AsyncStorage.
// Supporte le mode automatique (suit le thème système Android).

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Appearance, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── PALETTE DE COULEURS ────────────────────────────────────────────────────────
const palette = {
  // Neutres
  white:   '#FFFFFF',
  black:   '#000000',
  // Accent
  purple:  '#7F77DD',
  purple2: '#534AB7',
  blue:    '#378ADD',
  green:   '#1D9E75',
  yellow:  '#BA7517',
  red:     '#E24B4A',
  orange:  '#D85A30',
  teal:    '#20C997',
  coral:   '#D85A30',
};

// ── THÈME SOMBRE ───────────────────────────────────────────────────────────────
const darkTheme = {
  mode: 'dark',
  colors: {
    // Backgrounds
    bg:        '#080810',
    surface1:  '#0f0f1a',
    surface2:  '#13131f',
    surface3:  '#1a1a2e',
    surface4:  '#1e2040',
    // Borders
    border1:   '#1e2040',
    border2:   '#252550',
    border3:   '#303060',
    // Text
    text:      '#F0F0FA',
    textMuted: '#888780',
    textFaint: '#444460',
    // Accent
    primary:   palette.purple,
    primary2:  palette.purple2,
    secondary: palette.blue,
    success:   palette.green,
    warning:   palette.yellow,
    danger:    palette.red,
    info:      palette.blue,
    // Gradients
    gradientBg:      ['#080810', '#1a1a2e'],
    gradientPrimary: ['#7F77DD', '#378ADD'],
    gradientSuccess: ['#1D9E75', '#20C997'],
    gradientDanger:  ['#E24B4A', '#D85A30'],
    // Specific
    cardBg:      '#13131f',
    inputBg:     '#1a1a2e',
    placeholder: '#444460',
    overlay:     'rgba(0,0,0,0.75)',
    shadow:      '#000000',
  },
  // Radius
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  // Spacing
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  // Typography
  typography: {
    xs: 11, sm: 12, base: 14, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40,
    weight: { regular: '400', medium: '500', semibold: '600', bold: '700', black: '900' },
  },
};

// ── THÈME CLAIR ────────────────────────────────────────────────────────────────
const lightTheme = {
  mode: 'light',
  colors: {
    // Backgrounds
    bg:        '#F5F5FF',
    surface1:  '#FFFFFF',
    surface2:  '#F0F0FA',
    surface3:  '#E8E8F5',
    surface4:  '#DDDDF0',
    // Borders
    border1:   '#DDDDF0',
    border2:   '#C8C8E8',
    border3:   '#AAAACC',
    // Text
    text:      '#1A1A2E',
    textMuted: '#555577',
    textFaint: '#8888AA',
    // Accent (identiques)
    primary:   palette.purple,
    primary2:  palette.purple2,
    secondary: palette.blue,
    success:   palette.green,
    warning:   '#9A5500',
    danger:    palette.red,
    info:      palette.blue,
    // Gradients
    gradientBg:      ['#F5F5FF', '#E8E8F8'],
    gradientPrimary: ['#7F77DD', '#378ADD'],
    gradientSuccess: ['#1D9E75', '#20C997'],
    gradientDanger:  ['#E24B4A', '#D85A30'],
    // Specific
    cardBg:      '#FFFFFF',
    inputBg:     '#F0F0FA',
    placeholder: '#AAAACC',
    overlay:     'rgba(0,0,0,0.5)',
    shadow:      '#9999BB',
  },
  radius:     darkTheme.radius,
  spacing:    darkTheme.spacing,
  typography: darkTheme.typography,
};

// ── CONTEXT ───────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);
const THEME_KEY = 'guardian_theme_mode';

// ── PROVIDER ──────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark'); // 'dark' | 'light' | 'auto'

  useEffect(() => {
    // Charge le thème sauvegardé
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved) setMode(saved);
    });

    // Écoute les changements système si mode auto
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem(THEME_KEY).then(saved => {
        if (saved === 'auto') setMode('auto');
      });
    });

    return () => sub.remove();
  }, []);

  const toggleTheme = async (newMode) => {
    setMode(newMode);
    await AsyncStorage.setItem(THEME_KEY, newMode);
  };

  const resolvedMode = mode === 'auto'
    ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark')
    : mode;

  const theme = useMemo(
    () => ({ ...(resolvedMode === 'light' ? lightTheme : darkTheme), mode: resolvedMode, preferredMode: mode }),
    [resolvedMode, mode]
  );

  return (
    <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── HOOKS ─────────────────────────────────────────────────────────────────────
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

// Helper pour créer des styles dynamiques basés sur le thème
export const useThemedStyles = (styleFactory) => {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(styleFactory(theme)), [theme]);
};

// ── THEME SELECTOR COMPONENT ─────────────────────────────────────────────────
import { View, Text, TouchableOpacity, StyleSheet as RNStyles } from 'react-native';

export function ThemeSelector() {
  const { theme, mode, toggleTheme } = useTheme();

  const options = [
    { key: 'dark',  icon: '🌙', label: 'Sombre' },
    { key: 'light', icon: '☀️', label: 'Clair'  },
    { key: 'auto',  icon: '⚙️', label: 'Auto'   },
  ];

  return (
    <View style={sel.container}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[sel.option, mode === opt.key && { backgroundColor: theme.colors.primary + '22', borderColor: theme.colors.primary }]}
          onPress={() => toggleTheme(opt.key)}
        >
          <Text style={sel.icon}>{opt.icon}</Text>
          <Text style={[sel.label, { color: mode === opt.key ? theme.colors.primary : theme.colors.textMuted }]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sel = RNStyles.create({
  container: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: '#252550', backgroundColor: 'transparent',
  },
  icon:  { fontSize: 20, marginBottom: 3 },
  label: { fontSize: 11, fontWeight: '700' },
});

// ── CSS VARIABLES WEB (pour DashboardV2) ─────────────────────────────────────
export const getCSSVars = (isDark) => `
  :root {
    --bg:      ${isDark ? '#080810'  : '#F5F5FF'};
    --s1:      ${isDark ? '#0f0f1a'  : '#FFFFFF'};
    --s2:      ${isDark ? '#13131f'  : '#F0F0FA'};
    --s3:      ${isDark ? '#1a1a2e'  : '#E8E8F5'};
    --b1:      ${isDark ? '#1e2040'  : '#DDDDF0'};
    --b2:      ${isDark ? '#252550'  : '#C8C8E8'};
    --text:    ${isDark ? '#F0F0FA'  : '#1A1A2E'};
    --muted:   ${isDark ? '#888780'  : '#555577'};
    --faint:   ${isDark ? '#444460'  : '#8888AA'};
    --purple:  #7F77DD;
    --blue:    #378ADD;
    --green:   #1D9E75;
    --yellow:  #BA7517;
    --red:     #E24B4A;
  }
`;

// ── WEB THEME TOGGLE ──────────────────────────────────────────────────────────
export const WebThemeToggle = ({ isDark, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      background: 'none', border: '1px solid var(--b2)', borderRadius: 10,
      padding: '6px 12px', cursor: 'pointer', color: 'var(--text)',
      fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
    }}
  >
    {isDark ? '☀️' : '🌙'} {isDark ? 'Mode clair' : 'Mode sombre'}
  </button>
);

export { darkTheme, lightTheme, palette };
export default ThemeProvider;
