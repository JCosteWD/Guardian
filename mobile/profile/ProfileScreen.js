import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Animated, ActivityIndicator, Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useApp, api } from '../App';

// ── AVATAR INITIALS ───────────────────────────────────────────────────────────
const AvatarDisplay = ({ firstName, lastName, color = '#7F77DD', size = 80, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.avatarWrap}>
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size/2, backgroundColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {`${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()}
      </Text>
    </View>
    <View style={styles.avatarEditBadge}>
      <Text style={{ fontSize: 14 }}>✏️</Text>
    </View>
  </TouchableOpacity>
);

// ── PASSWORD STRENGTH ─────────────────────────────────────────────────────────
const PasswordStrength = ({ password }) => {
  const checks = [
    { ok: password.length >= 8,    label: '8 car.' },
    { ok: /[A-Z]/.test(password),  label: 'Majuscule' },
    { ok: /[0-9]/.test(password),  label: 'Chiffre' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'Symbole' },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['#E24B4A', '#BA7517', '#BA7517', '#1D9E75', '#1D9E75'];

  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBar}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[styles.strengthSegment, { backgroundColor: i < score ? colors[score] : '#252540' }]} />
        ))}
      </View>
      <View style={styles.strengthChecks}>
        {checks.map((c, i) => (
          <View key={i} style={styles.strengthCheck}>
            <View style={[styles.strengthDot, { backgroundColor: c.ok ? '#1D9E75' : '#333' }]} />
            <Text style={[styles.strengthLabel, c.ok && { color: '#1D9E75' }]}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── SECTION ───────────────────────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

const Field = ({ label, value, onChange, placeholder, secure, keyboardType, autoCapitalize, editable = true }) => {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldRow, focused && styles.fieldRowFocused, !editable && styles.fieldRowDisabled]}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#444"
          secureTextEntry={secure && !show}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
            <Text>{show ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { parent, setParent } = useApp();
  const [profile, setProfile] = useState({
    firstName: parent?.firstName || '',
    lastName:  parent?.lastName  || '',
    email:     parent?.email     || '',
    phone:     parent?.phone     || '',
  });
  const [passwords, setPasswords] = useState({
    current: '', newPwd: '', confirm: '',
  });
  const [saving, setSaving]         = useState(false);
  const [savingPwd, setSavingPwd]   = useState(false);
  const [successAnim]               = useState(new Animated.Value(0));

  const showSuccess = () => {
    Animated.sequence([
      Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handleSaveProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      return Alert.alert('Champs requis', 'Prénom et nom sont obligatoires.');
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/profile', {
        firstName: profile.firstName.trim(),
        lastName:  profile.lastName.trim(),
        phone:     profile.phone.trim(),
      });
      setParent(prev => ({ ...prev, ...data.parent }));
      showSuccess();
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.current) return Alert.alert('Requis', 'Entrez votre mot de passe actuel.');
    if (passwords.newPwd.length < 8) return Alert.alert('Trop court', 'Minimum 8 caractères.');
    if (!/[A-Z]/.test(passwords.newPwd)) return Alert.alert('Format', 'Ajoutez au moins une majuscule.');
    if (passwords.newPwd !== passwords.confirm) return Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');

    setSavingPwd(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.newPwd,
      });
      setPasswords({ current: '', newPwd: '', confirm: '' });
      Alert.alert('✅', 'Mot de passe modifié avec succès.');
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.error || 'Mot de passe actuel incorrect.');
    } finally {
      setSavingPwd(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Supprimer le compte',
      'Toutes vos données et celles de vos enfants seront effacées définitivement (RGPD Article 17). Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Je comprends, supprimer', style: 'destructive', onPress: () => {
          Alert.prompt(
            'Confirmation',
            'Tapez "SUPPRIMER_MES_DONNEES" pour confirmer :',
            async (confirmation) => {
              if (confirmation === 'SUPPRIMER_MES_DONNEES') {
                await api.delete('/gdpr/delete', { data: { confirmation } });
                // Logout
              } else {
                Alert.alert('Annulé', 'La suppression a été annulée.');
              }
            }
          );
        }},
      ]
    );
  };

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Mon profil</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <AvatarDisplay
            firstName={profile.firstName}
            lastName={profile.lastName}
            size={88}
            onPress={() => Alert.alert('Avatar', 'Fonctionnalité photo de profil à venir.')}
          />
          <Text style={styles.avatarName}>{profile.firstName} {profile.lastName}</Text>
          <Text style={styles.avatarEmail}>{profile.email}</Text>
          <View style={[styles.planBadge, { backgroundColor: '#7F77DD22' }]}>
            <Text style={styles.planBadgeText}>Plan {parent?.plan || 'Gratuit'}</Text>
          </View>
        </View>

        {/* Succès toast */}
        <Animated.View style={[styles.successToast, { opacity: successAnim, transform: [{ scale: successAnim }] }]}>
          <Text style={styles.successText}>✅ Profil sauvegardé !</Text>
        </Animated.View>

        {/* Informations personnelles */}
        <Section title="👤 Informations personnelles">
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Prénom" value={profile.firstName}
                onChange={v => setProfile(p => ({ ...p, firstName: v }))}
                placeholder="Marie" autoCapitalize="words" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Nom" value={profile.lastName}
                onChange={v => setProfile(p => ({ ...p, lastName: v }))}
                placeholder="Dupont" autoCapitalize="words" />
            </View>
          </View>
          <Field label="Email" value={profile.email} editable={false}
            placeholder="email@exemple.com" keyboardType="email-address" />
          <Text style={styles.emailNote}>
            ℹ️ Pour changer l'email, contactez le support.
          </Text>
          <Field label="Téléphone (optionnel)" value={profile.phone}
            onChange={v => setProfile(p => ({ ...p, phone: v }))}
            placeholder="+33 6 12 34 56 78" keyboardType="phone-pad" />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSaveProfile} disabled={saving}
          >
            <LinearGradient colors={['#7F77DD', '#378ADD']} style={styles.saveBtnGradient}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>💾 Sauvegarder</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </Section>

        {/* Changer le mot de passe */}
        <Section title="🔑 Changer le mot de passe">
          <Field label="Mot de passe actuel" value={passwords.current}
            onChange={v => setPasswords(p => ({ ...p, current: v }))}
            placeholder="••••••••" secure />
          <Field label="Nouveau mot de passe" value={passwords.newPwd}
            onChange={v => setPasswords(p => ({ ...p, newPwd: v }))}
            placeholder="Minimum 8 car., 1 majuscule, 1 chiffre" secure />
          {passwords.newPwd.length > 0 && <PasswordStrength password={passwords.newPwd} />}
          <Field label="Confirmer le nouveau mot de passe" value={passwords.confirm}
            onChange={v => setPasswords(p => ({ ...p, confirm: v }))}
            placeholder="••••••••" secure />

          <TouchableOpacity
            style={[styles.saveBtn, savingPwd && { opacity: 0.5 }]}
            onPress={handleChangePassword} disabled={savingPwd}
          >
            <LinearGradient colors={['#7F77DD', '#378ADD']} style={styles.saveBtnGradient}>
              {savingPwd
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>🔑 Changer le mot de passe</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </Section>

        {/* Zone danger */}
        <Section title="⚠️ Zone critique">
          <Text style={styles.dangerNote}>
            La suppression de compte efface définitivement toutes vos données et celles de vos enfants, conformément au RGPD (Article 17).
          </Text>
          <View style={styles.dangerActions}>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={async () => {
                try {
                  const { data } = await api.get('/gdpr/export?format=summary', { responseType: 'text' });
                  Alert.alert('Export', 'Export généré. Téléchargez-le depuis le dashboard web.');
                } catch { Alert.alert('Erreur', 'Export indisponible.'); }
              }}
            >
              <Text style={styles.exportBtnText}>📦 Exporter mes données (RGPD)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.deleteBtnText}>🗑️ Supprimer mon compte</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <View style={{ height: 80 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn: {},
  backText: { color: '#7F77DD', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', flex: 1 },

  avatarSection: { alignItems: 'center', marginBottom: 28, gap: 6 },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '900' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#13131f', borderRadius: 14, padding: 4,
    borderWidth: 2, borderColor: '#1a1a2e',
  },
  avatarName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  avatarEmail: { color: '#888', fontSize: 13 },
  planBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 },
  planBadgeText: { color: '#7F77DD', fontWeight: '700', fontSize: 12 },

  successToast: {
    backgroundColor: '#1D9E7522', borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#1D9E75',
    alignItems: 'center',
  },
  successText: { color: '#1D9E75', fontWeight: '700' },

  section: { marginBottom: 20 },
  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  sectionCard: { backgroundColor: '#13131f', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#252540' },

  row2: { flexDirection: 'row', gap: 10 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, borderWidth: 1, borderColor: '#252540' },
  fieldRowFocused: { borderColor: '#7F77DD' },
  fieldRowDisabled: { opacity: 0.5 },
  fieldInput: { flex: 1, color: '#fff', fontSize: 14, padding: 13 },
  eyeBtn: { padding: 12 },

  emailNote: { color: '#555', fontSize: 11, marginTop: -8, marginBottom: 12 },

  saveBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  saveBtnGradient: { padding: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  strengthWrap: { marginBottom: 12 },
  strengthBar: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthChecks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  strengthCheck: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  strengthDot: { width: 8, height: 8, borderRadius: 4 },
  strengthLabel: { color: '#555', fontSize: 11 },

  dangerNote: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  dangerActions: { gap: 10 },
  exportBtn: { backgroundColor: '#7F77DD22', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#7F77DD44' },
  exportBtnText: { color: '#7F77DD', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#E24B4A22', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E24B4A44' },
  deleteBtnText: { color: '#E24B4A', fontWeight: '700' },
});
