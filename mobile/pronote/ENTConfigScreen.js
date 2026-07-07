import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useApp, api } from '../App';

const PLATFORMS = {
  pronote: {
    name: 'Pronote',
    logo: '🏫',
    color: '#5B6BF5',
    description: 'La plateforme scolaire la plus utilisée en France.',
    needsUrl: true,
    urlPlaceholder: 'https://xxx.index-education.net/pronote/',
    urlHelp: 'L\'URL se trouve sur le site de votre établissement ou sur la page de connexion Pronote.',
  },
  ecoledirecte: {
    name: 'EcoleDirecte',
    logo: '📚',
    color: '#00A651',
    description: 'Utilisée par de nombreux établissements privés et publics.',
    needsUrl: false,
    urlHelp: '',
  },
};

export default function ENTConfigScreen({ route, navigation }) {
  const { child } = route.params;
  const [configs, setConfigs]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [showForm, setShowForm]     = useState(null); // 'pronote' | 'ecoledirecte' | null
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ username: '', password: '', schoolUrl: '' });

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/children/${child.id}/ent/status`);
      setConfigs(data.configs || []);
    } catch { setConfigs([]); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.username || !form.password) {
      return Alert.alert('Champs requis', 'Veuillez entrer vos identifiants.');
    }
    if (PLATFORMS[showForm].needsUrl && !form.schoolUrl) {
      return Alert.alert('URL requise', 'Veuillez entrer l\'URL de votre instance Pronote.');
    }

    setSaving(true);
    try {
      const { data } = await api.post(`/children/${child.id}/ent`, {
        platform:  showForm,
        username:  form.username.trim(),
        password:  form.password,
        schoolUrl: form.schoolUrl.trim(),
      });
      Alert.alert('✅ Connecté !', `${PLATFORMS[showForm].name} synchronisé avec succès. ${data.message}`);
      setShowForm(null);
      setForm({ username: '', password: '', schoolUrl: '' });
      loadConfigs();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur de connexion';
      Alert.alert('❌ Échec de connexion', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (platform) => {
    setSyncing(true);
    try {
      const { data } = await api.post(`/children/${child.id}/ent/sync`);
      Alert.alert('✅ Synchronisé', `${data.synced} nouvelle(s) note(s) importée(s).`);
    } catch { Alert.alert('Erreur', 'Synchronisation impossible.'); }
    finally { setSyncing(false); }
  };

  const handleDelete = (platform) => {
    Alert.alert(
      `Déconnecter ${PLATFORMS[platform].name} ?`,
      'Les notes déjà importées seront conservées. La synchronisation automatique sera arrêtée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: async () => {
          await api.delete(`/children/${child.id}/ent/${platform}`).catch(() => {});
          loadConfigs();
        }},
      ]
    );
  };

  const cfg = showForm ? PLATFORMS[showForm] : null;

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🏫 Notes scolaires automatiques</Text>
        <Text style={styles.subtitle}>
          Connectez le compte ENT de {child.first_name} pour importer les notes automatiquement.
          Guardian ajustera le temps d'écran sans intervention manuelle.
        </Text>

        {/* Bénéfices */}
        <View style={styles.benefitCard}>
          {[
            { icon: '⚡', text: 'Notes importées automatiquement toutes les heures' },
            { icon: '🔒', text: 'Identifiants chiffrés AES-256 (jamais partagés)' },
            { icon: '📊', text: 'Ajustement du temps d\'écran sans saisie manuelle' },
            { icon: '🏆', text: 'Badges de gamification attribués automatiquement' },
          ].map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>{b.icon}</Text>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* Plateformes connectées */}
        {configs.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>✅ Connecté</Text>
            {configs.map(config => {
              const p = PLATFORMS[config.platform];
              return (
                <View key={config.platform} style={[styles.connectedCard, { borderColor: p.color + '44' }]}>
                  <Text style={styles.connectedLogo}>{p.logo}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.connectedName, { color: p.color }]}>{p.name}</Text>
                    <Text style={styles.connectedUser}>{config.username}</Text>
                    <Text style={styles.connectedSync}>
                      Dernière sync : {config.last_sync
                        ? new Date(config.last_sync).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })
                        : 'Jamais'}
                    </Text>
                  </View>
                  <View style={styles.connectedActions}>
                    <TouchableOpacity
                      style={[styles.syncBtn, syncing && { opacity: 0.5 }]}
                      onPress={() => handleSync(config.platform)}
                      disabled={syncing}
                    >
                      {syncing
                        ? <ActivityIndicator color={p.color} size="small" />
                        : <Text style={[styles.syncBtnText, { color: p.color }]}>🔄</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(config.platform)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Plateformes disponibles */}
        <Text style={styles.sectionTitle}>Connecter une plateforme</Text>
        {Object.entries(PLATFORMS).map(([key, p]) => {
          const isConnected = configs.some(c => c.platform === key);
          return (
            <TouchableOpacity
              key={key}
              style={[styles.platformCard, { borderColor: p.color + '33' }, isConnected && { opacity: 0.5 }]}
              onPress={() => !isConnected && setShowForm(key)}
              disabled={isConnected}
            >
              <Text style={styles.platformLogo}>{p.logo}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.platformName, { color: p.color }]}>{p.name}</Text>
                <Text style={styles.platformDesc}>{p.description}</Text>
              </View>
              <Text style={styles.platformArrow}>{isConnected ? '✅' : '→'}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Formulaire de connexion */}
        {showForm && cfg && (
          <View style={[styles.form, { borderColor: cfg.color + '44' }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formLogo}>{cfg.logo}</Text>
              <Text style={[styles.formTitle, { color: cfg.color }]}>Connexion {cfg.name}</Text>
            </View>

            <Text style={styles.fieldLabel}>Identifiant</Text>
            <TextInput
              style={styles.input}
              value={form.username}
              onChangeText={v => setForm(f => ({ ...f, username: v }))}
              placeholder="votre.identifiant"
              placeholderTextColor="#444"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={v => setForm(f => ({ ...f, password: v }))}
              placeholder="••••••••"
              placeholderTextColor="#444"
              secureTextEntry
            />

            {cfg.needsUrl && (
              <>
                <Text style={styles.fieldLabel}>URL de l'instance Pronote</Text>
                <TextInput
                  style={styles.input}
                  value={form.schoolUrl}
                  onChangeText={v => setForm(f => ({ ...f, schoolUrl: v }))}
                  placeholder={cfg.urlPlaceholder}
                  placeholderTextColor="#444"
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Text style={styles.urlHelp}>{cfg.urlHelp}</Text>
              </>
            )}

            <View style={styles.privacyNote}>
              <Text style={styles.privacyIcon}>🔒</Text>
              <Text style={styles.privacyText}>
                Vos identifiants sont chiffrés avec AES-256 et ne quittent jamais vos serveurs Guardian.
                Ils ne sont jamais partagés avec des tiers.
              </Text>
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(null); setForm({ username:'', password:'', schoolUrl:'' }); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave} disabled={saving}
              >
                <LinearGradient colors={[cfg.color, cfg.color + 'BB']} style={styles.saveBtnGradient}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Se connecter</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#7F77DD', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 20 },

  benefitCard: { backgroundColor: '#13131f', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#252540', gap: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: { fontSize: 18, width: 26 },
  benefitText: { color: '#aaa', fontSize: 13, flex: 1, lineHeight: 18 },

  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 8 },

  connectedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#13131f', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  connectedLogo: { fontSize: 28 },
  connectedName: { fontWeight: '800', fontSize: 15 },
  connectedUser: { color: '#888', fontSize: 12, marginTop: 2 },
  connectedSync: { color: '#555', fontSize: 11, marginTop: 2 },
  connectedActions: { flexDirection: 'row', gap: 8 },
  syncBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' },
  syncBtnText: { fontSize: 18 },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E24B4A11', justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { fontSize: 16 },

  platformCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#13131f', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  platformLogo: { fontSize: 30 },
  platformName: { fontWeight: '800', fontSize: 16 },
  platformDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  platformArrow: { fontSize: 18, color: '#888' },

  form: { backgroundColor: '#13131f', borderRadius: 20, padding: 20, marginTop: 16, borderWidth: 1 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  formLogo: { fontSize: 28 },
  formTitle: { fontSize: 18, fontWeight: '800' },

  fieldLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 13, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#252540', marginBottom: 14 },
  urlHelp: { color: '#555', fontSize: 11, marginTop: -8, marginBottom: 14, lineHeight: 17 },

  privacyNote: { flexDirection: 'row', gap: 10, backgroundColor: '#1D9E7511', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1D9E7533', marginBottom: 20 },
  privacyIcon: { fontSize: 16 },
  privacyText: { color: '#888', fontSize: 12, lineHeight: 18, flex: 1 },

  formBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#252540', borderRadius: 14, padding: 15, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontWeight: '700' },
  saveBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  saveBtnGradient: { padding: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
