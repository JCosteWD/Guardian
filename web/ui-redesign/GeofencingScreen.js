import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useApp, api } from '../App';

// ── ZONE TYPE CONFIG ──────────────────────────────────────────────────────────
const ZONE_TYPES = {
  safe:       { icon: '🏠', label: 'Zone sûre',     color: '#1D9E75', desc: 'Maison, famille…' },
  school:     { icon: '🏫', label: 'École',          color: '#378ADD', desc: 'Mode école auto' },
  restricted: { icon: '⚠️', label: 'Zone restreinte', color: '#E24B4A', desc: 'Alerte si arrivée' },
};

// ── RADIUS OPTIONS ────────────────────────────────────────────────────────────
const RADIUS_OPTIONS = [
  { value: 100,  label: '100m' },
  { value: 200,  label: '200m' },
  { value: 500,  label: '500m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
];

// ── ZONE CARD ─────────────────────────────────────────────────────────────────
const ZoneCard = ({ zone, onDelete }) => {
  const cfg = ZONE_TYPES[zone.zone_type] || ZONE_TYPES.safe;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[
      styles.zoneCard,
      { borderColor: cfg.color + '44', transform: [{ scale: slideAnim.interpolate({ inputRange:[0,1], outputRange:[0.95,1] }) }], opacity: slideAnim }
    ]}>
      <View style={[styles.zoneIcon, { backgroundColor: cfg.color + '22' }]}>
        <Text style={{ fontSize: 26 }}>{cfg.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.zoneName}>{zone.name}</Text>
        <Text style={styles.zoneType}>{cfg.label} · Rayon {zone.radius_meters}m</Text>
        <Text style={styles.zoneCoords}>
          {parseFloat(zone.latitude).toFixed(4)}, {parseFloat(zone.longitude).toFixed(4)}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onDelete(zone)} style={styles.zoneDeleteBtn}>
        <Text style={styles.zoneDeleteText}>🗑️</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function GeofencingScreen({ route, navigation }) {
  const { child } = route.params;
  const [zones, setZones]         = useState([]);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [activeTab, setActiveTab] = useState('zones'); // zones | history
  const [form, setForm]           = useState({
    name: '',
    latitude: '',
    longitude: '',
    radiusMeters: 200,
    zoneType: 'safe',
  });

  useEffect(() => { loadZones(); loadHistory(); }, []);

  const loadZones = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/children/${child.id}/zones`);
      setZones(data.zones || []);
    } catch { setZones([]); }
    finally { setLoading(false); }
  };

  const loadHistory = async () => {
    try {
      const { data } = await api.get(`/children/${child.id}/location-history?hours=24`);
      setHistory(data.locations || []);
    } catch { setHistory([]); }
  };

  const handleAddZone = async () => {
    if (!form.name || !form.latitude || !form.longitude) {
      return Alert.alert('Champs requis', 'Nom, latitude et longitude sont obligatoires.');
    }
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return Alert.alert('Coordonnées invalides', 'Entrez des coordonnées GPS valides.');
    }

    setSaving(true);
    try {
      await api.post(`/children/${child.id}/zones`, {
        name: form.name.trim(),
        latitude: lat,
        longitude: lon,
        radiusMeters: form.radiusMeters,
        zoneType: form.zoneType,
      });
      Alert.alert('✅', `Zone "${form.name}" créée !`);
      setShowForm(false);
      setForm({ name: '', latitude: '', longitude: '', radiusMeters: 200, zoneType: 'safe' });
      loadZones();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Impossible de créer la zone');
    }
    finally { setSaving(false); }
  };

  const handleDelete = (zone) => {
    Alert.alert('Supprimer cette zone ?', `"${zone.name}" sera supprimée.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await api.delete(`/children/${child.id}/zones/${zone.id}`).catch(() => {});
        loadZones();
      }},
    ]);
  };

  const TABS = [
    { key: 'zones',   label: 'Zones' },
    { key: 'history', label: 'Historique 24h' },
  ];

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Retour</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>📍 Géofencing</Text>
            <Text style={styles.subtitle}>{child.first_name}</Text>
          </View>
        </View>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            💡 Guardian envoie automatiquement une alerte quand {child.first_name} entre ou quitte une zone.
            Les règles d'écran s'adaptent selon la zone (ex: mode école à l'école).
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'zones' && (
          <>
            {/* Zone types explanation */}
            <View style={styles.typeGrid}>
              {Object.entries(ZONE_TYPES).map(([key, cfg]) => (
                <View key={key} style={[styles.typeCard, { borderColor: cfg.color + '33' }]}>
                  <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
                  <Text style={[styles.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.typeDesc}>{cfg.desc}</Text>
                </View>
              ))}
            </View>

            {/* Zones list */}
            {loading ? (
              <ActivityIndicator color="#7F77DD" style={{ marginTop: 32 }} />
            ) : (
              <>
                {zones.map(zone => (
                  <ZoneCard key={zone.id} zone={zone} onDelete={handleDelete} />
                ))}
                {zones.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={{ fontSize: 48 }}>🗺️</Text>
                    <Text style={styles.emptyTitle}>Aucune zone configurée</Text>
                    <Text style={styles.emptySub}>
                      Ajoutez l'école, la maison ou la maison des grands-parents pour recevoir des alertes automatiques.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Add zone form */}
            {showForm ? (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Nouvelle zone</Text>

                <Text style={styles.fieldLabel}>Nom de la zone</Text>
                <TextInput style={styles.input} value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder="Ex: École Pasteur" placeholderTextColor="#444" />

                <View style={styles.coordRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Latitude</Text>
                    <TextInput style={styles.input} value={form.latitude}
                      onChangeText={v => setForm(f => ({ ...f, latitude: v }))}
                      placeholder="48.8566" placeholderTextColor="#444"
                      keyboardType="decimal-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Longitude</Text>
                    <TextInput style={styles.input} value={form.longitude}
                      onChangeText={v => setForm(f => ({ ...f, longitude: v }))}
                      placeholder="2.3522" placeholderTextColor="#444"
                      keyboardType="decimal-pad" />
                  </View>
                </View>

                <Text style={styles.coordHint}>
                  💡 Recherchez l'adresse sur Google Maps → appui long → les coordonnées s'affichent.
                </Text>

                <Text style={styles.fieldLabel}>Rayon de détection</Text>
                <View style={styles.radiusOptions}>
                  {RADIUS_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt.value}
                      style={[styles.radiusBtn, form.radiusMeters === opt.value && styles.radiusBtnActive]}
                      onPress={() => setForm(f => ({ ...f, radiusMeters: opt.value }))}>
                      <Text style={[styles.radiusBtnText, form.radiusMeters === opt.value && { color: '#7F77DD' }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Type de zone</Text>
                <View style={styles.zoneTypeSelector}>
                  {Object.entries(ZONE_TYPES).map(([key, cfg]) => (
                    <TouchableOpacity key={key}
                      style={[styles.zoneTypeBtn, form.zoneType === key && { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}
                      onPress={() => setForm(f => ({ ...f, zoneType: key }))}>
                      <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                      <Text style={[styles.zoneTypeBtnText, form.zoneType === key && { color: cfg.color }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                    onPress={handleAddZone} disabled={saving}
                  >
                    <LinearGradient colors={['#7F77DD', '#378ADD']} style={styles.saveBtnGradient}>
                      {saving
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.saveBtnText}>📍 Créer la zone</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
                <Text style={styles.addBtnText}>➕ Ajouter une zone</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <View style={styles.historyWrap}>
            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40 }}>📡</Text>
                <Text style={styles.emptyTitle}>Aucun déplacement enregistré</Text>
                <Text style={styles.emptySub}>L'historique des 24 dernières heures apparaîtra ici.</Text>
              </View>
            ) : (
              history.map((loc, i) => (
                <View key={i} style={styles.historyRow}>
                  <Text style={styles.historyIcon}>
                    {loc.zone_name ? '📍' : '❓'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyZone}>{loc.zone_name || 'Zone inconnue'}</Text>
                    <Text style={styles.historyCoords}>
                      {parseFloat(loc.latitude).toFixed(4)}, {parseFloat(loc.longitude).toFixed(4)}
                    </Text>
                  </View>
                  <Text style={styles.historyTime}>
                    {new Date(loc.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  back: { color: '#7F77DD', fontWeight: '600', paddingTop: 4 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#888', fontSize: 13 },
  infoBanner: { backgroundColor: '#7F77DD11', borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#7F77DD22' },
  infoText: { color: '#888', fontSize: 13, lineHeight: 20 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: '#13131f', borderWidth: 1, borderColor: '#252540', alignItems: 'center' },
  tabActive: { borderColor: '#7F77DD', backgroundColor: '#7F77DD18' },
  tabText: { color: '#888', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#7F77DD' },
  typeGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeCard: { flex: 1, backgroundColor: '#13131f', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, gap: 4 },
  typeLabel: { fontSize: 11, fontWeight: '800' },
  typeDesc: { color: '#555', fontSize: 9, textAlign: 'center' },
  zoneCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#13131f', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1 },
  zoneIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  zoneName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  zoneType: { color: '#888', fontSize: 12, marginTop: 2 },
  zoneCoords: { color: '#555', fontSize: 10, marginTop: 2, fontFamily: 'monospace' },
  zoneDeleteBtn: { padding: 8 },
  zoneDeleteText: { fontSize: 18 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle: { color: '#888', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#555', fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  form: { backgroundColor: '#13131f', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#252540' },
  formTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  fieldLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 13, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#252540', marginBottom: 12 },
  coordRow: { flexDirection: 'row', gap: 10 },
  coordHint: { color: '#555', fontSize: 11, marginBottom: 16, lineHeight: 17 },
  radiusOptions: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  radiusBtn: { flex: 1, padding: 8, borderRadius: 10, backgroundColor: '#1a1a2e', alignItems: 'center', borderWidth: 1, borderColor: '#252540' },
  radiusBtnActive: { borderColor: '#7F77DD' },
  radiusBtnText: { color: '#888', fontSize: 11, fontWeight: '700' },
  zoneTypeSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  zoneTypeBtn: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#252540', gap: 4 },
  zoneTypeBtnText: { color: '#888', fontSize: 11, fontWeight: '700' },
  formBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#252540', borderRadius: 14, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontWeight: '700' },
  saveBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  saveBtnGradient: { padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  addBtn: { backgroundColor: '#13131f', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#7F77DD44', borderStyle: 'dashed', marginBottom: 16 },
  addBtnText: { color: '#7F77DD', fontWeight: '700' },
  historyWrap: {},
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  historyIcon: { fontSize: 20 },
  historyZone: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  historyCoords: { color: '#555', fontSize: 11, marginTop: 2, fontFamily: 'monospace' },
  historyTime: { color: '#888', fontSize: 12 },
});
