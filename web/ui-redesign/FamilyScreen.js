import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Switch,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useApp, api } from '../App';

const ROLES = {
  parent:   { label: 'Parent',       icon: '👨‍👩‍👧', color: '#7F77DD', desc: 'Accès complet aux règles et activité' },
  guardian: { label: 'Gardien',      icon: '🛡️',   color: '#1D9E75', desc: 'Réglages rapides + voir l\'activité' },
  observer: { label: 'Observateur',  icon: '👁️',   color: '#888780', desc: 'Lecture seule + notifications' },
};

const PERMISSION_LABELS = {
  canEditRules:      '✏️ Modifier les règles',
  canViewActivity:   '📊 Voir l\'activité',
  canAddGrades:      '📝 Saisir les notes',
  canQuickAction:    '⚡ Actions rapides',
  canManageChildren: '👶 Gérer les enfants',
  canViewLocation:   '📍 Voir la position',
};

export default function FamilyScreen({ navigation }) {
  const { parent, showToast } = useApp();
  const [members, setMembers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting]   = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'parent' });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { loadMembers(); }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/family/members');
      setMembers(data.members || []);
    } catch { setMembers([]); }
    finally { setLoading(false); }
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.name) {
      return Alert.alert('Champs requis', 'Veuillez entrer l\'email et le prénom.');
    }
    setInviting(true);
    try {
      const { data } = await api.post('/family/invite', inviteForm);
      showToast(`✅ Invitation envoyée à ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: '', name: '', role: 'parent' });
      loadMembers();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur lors de l\'invitation';
      if (err.response?.status === 403) {
        Alert.alert('Plan requis', msg, [
          { text: 'Voir les plans', onPress: () => navigation.navigate('Subscription') },
          { text: 'Annuler', style: 'cancel' },
        ]);
      } else {
        showToast('❌ ' + msg, false);
      }
    }
    finally { setInviting(false); }
  };

  const handleChangeRole = async (memberId, newRole) => {
    try {
      await api.patch(`/family/members/${memberId}`, { role: newRole });
      showToast('✅ Rôle mis à jour');
      loadMembers();
    } catch { showToast('❌ Erreur', false); }
  };

  const handleRemove = (member) => {
    Alert.alert(
      'Retirer ce membre ?',
      `${member.member_name || member.member_email} n'aura plus accès à votre espace Guardian.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: async () => {
          await api.delete(`/family/members/${member.id}`);
          showToast('Membre retiré');
          loadMembers();
        }},
      ]
    );
  };

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>👨‍👩‍👧 Famille</Text>
        <Text style={styles.subtitle}>Gérez les adultes qui ont accès à Guardian</Text>

        {/* Admin card */}
        <View style={styles.adminCard}>
          <View style={[styles.memberAvatar, { backgroundColor: '#7F77DD' }]}>
            <Text style={styles.memberAvatarText}>{parent?.firstName?.charAt(0) || 'P'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{parent?.firstName} {parent?.lastName}</Text>
            <Text style={styles.memberEmail}>{parent?.email}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: '#7F77DD22', borderColor: '#7F77DD' }]}>
            <Text style={[styles.roleBadgeText, { color: '#7F77DD' }]}>👑 Admin</Text>
          </View>
        </View>

        {/* Members list */}
        {loading ? (
          <ActivityIndicator color="#7F77DD" style={{ marginTop: 40 }} />
        ) : (
          <>
            {members.map(member => {
              const role = ROLES[member.role] || ROLES.observer;
              const isExpanded = expandedId === member.id;
              const perms = member.permissions || {};

              return (
                <View key={member.id} style={[styles.memberCard, { borderColor: role.color + '33' }]}>
                  <TouchableOpacity
                    style={styles.memberCardHeader}
                    onPress={() => setExpandedId(isExpanded ? null : member.id)}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: role.color + '33' }]}>
                      <Text style={{ fontSize: 22 }}>{role.icon}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.memberName}>{member.member_name || 'Invité'}</Text>
                      <Text style={styles.memberEmail}>{member.member_email}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[styles.roleBadge, { backgroundColor: role.color + '22', borderColor: role.color }]}>
                        <Text style={[styles.roleBadgeText, { color: role.color }]}>{role.label}</Text>
                      </View>
                      <Text style={styles.memberStatus}>
                        {member.is_active ? '● Actif' : '○ En attente'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.memberExpanded}>
                      {/* Changer le rôle */}
                      <Text style={styles.expandedLabel}>Changer le rôle :</Text>
                      <View style={styles.roleSelector}>
                        {Object.entries(ROLES).map(([key, r]) => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.roleOption, member.role === key && { backgroundColor: r.color + '22', borderColor: r.color }]}
                            onPress={() => handleChangeRole(member.id, key)}
                          >
                            <Text style={{ fontSize: 18 }}>{r.icon}</Text>
                            <Text style={[styles.roleOptionLabel, member.role === key && { color: r.color }]}>{r.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* Permissions */}
                      <Text style={styles.expandedLabel}>Permissions :</Text>
                      {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                        <View key={key} style={styles.permRow}>
                          <Text style={styles.permLabel}>{label}</Text>
                          <Text style={[styles.permStatus, { color: perms[key] ? '#1D9E75' : '#444' }]}>
                            {perms[key] ? '✓ Autorisé' : '✗ Refusé'}
                          </Text>
                        </View>
                      ))}

                      {/* Actions */}
                      <View style={styles.memberActions}>
                        <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(member)}>
                          <Text style={styles.removeBtnText}>🗑️ Retirer</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {members.length === 0 && !showInvite && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
                <Text style={styles.emptyTitle}>Aucun membre invité</Text>
                <Text style={styles.emptySub}>
                  Invitez l'autre parent, les grands-parents ou tout adulte de confiance pour partager la gestion de Guardian.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Invite form */}
        {showInvite ? (
          <View style={styles.inviteForm}>
            <Text style={styles.inviteTitle}>Inviter un membre</Text>

            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={inviteForm.name}
              onChangeText={v => setInviteForm(f => ({ ...f, name: v }))}
              placeholder="Ex: Sophie"
              placeholderTextColor="#444"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={inviteForm.email}
              onChangeText={v => setInviteForm(f => ({ ...f, email: v }))}
              placeholder="email@exemple.com"
              placeholderTextColor="#444"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Rôle</Text>
            <View style={styles.roleSelector}>
              {Object.entries(ROLES).map(([key, r]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.roleOption,
                    inviteForm.role === key && { backgroundColor: r.color + '22', borderColor: r.color }
                  ]}
                  onPress={() => setInviteForm(f => ({ ...f, role: key }))}
                >
                  <Text style={{ fontSize: 20 }}>{r.icon}</Text>
                  <Text style={[styles.roleOptionLabel, inviteForm.role === key && { color: r.color }]}>{r.label}</Text>
                  <Text style={styles.roleOptionDesc}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInvite(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, inviting && { opacity: 0.5 }]}
                onPress={handleInvite} disabled={inviting}
              >
                <LinearGradient colors={['#7F77DD', '#378ADD']} style={styles.sendBtnGradient}>
                  {inviting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.sendBtnText}>✉️ Envoyer l'invitation</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
            <Text style={styles.inviteBtnText}>➕ Inviter un membre de la famille</Text>
          </TouchableOpacity>
        )}

        {/* Info plan */}
        <View style={styles.planInfo}>
          <Text style={styles.planInfoText}>
            💡 Le multi-parent est disponible à partir du plan <Text style={{ color: '#7F77DD' }}>Family</Text>.
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Subscription')}>
            <Text style={styles.planInfoLink}>Voir les plans →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 20 },

  adminCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#13131f', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#7F77DD33',
  },

  memberCard: {
    backgroundColor: '#13131f', borderRadius: 16,
    marginBottom: 10, borderWidth: 1, overflow: 'hidden',
  },
  memberCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16,
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  memberAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  memberName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  memberEmail: { color: '#888', fontSize: 12, marginTop: 2 },
  memberStatus: { color: '#555', fontSize: 11 },

  roleBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '800' },

  memberExpanded: { padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  expandedLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },

  roleSelector: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  roleOption: {
    flex: 1, alignItems: 'center', padding: 10, borderRadius: 12,
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#252540', gap: 4,
  },
  roleOptionLabel: { color: '#888', fontSize: 11, fontWeight: '700' },
  roleOptionDesc: { color: '#555', fontSize: 9, textAlign: 'center', lineHeight: 12 },

  permRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  permLabel: { color: '#ccc', fontSize: 13 },
  permStatus: { fontSize: 12, fontWeight: '700' },

  memberActions: { marginTop: 12 },
  removeBtn: { alignSelf: 'flex-end', padding: 8 },
  removeBtnText: { color: '#E24B4A', fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: '#888', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  inviteForm: {
    backgroundColor: '#13131f', borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#252540',
  },
  inviteTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  fieldLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 13,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#252540', marginBottom: 14,
  },

  formBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, backgroundColor: '#252540', borderRadius: 14, padding: 15, alignItems: 'center' },
  cancelBtnText: { color: '#888', fontWeight: '700' },
  sendBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  sendBtnGradient: { padding: 15, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '800' },

  inviteBtn: {
    backgroundColor: '#13131f', borderRadius: 16, padding: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#7F77DD44',
    borderStyle: 'dashed', marginBottom: 16,
  },
  inviteBtnText: { color: '#7F77DD', fontWeight: '700' },

  planInfo: {
    backgroundColor: '#7F77DD11', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#7F77DD22', gap: 8, alignItems: 'center',
  },
  planInfoText: { color: '#888', fontSize: 13, textAlign: 'center' },
  planInfoLink: { color: '#7F77DD', fontWeight: '700', fontSize: 13 },
});
