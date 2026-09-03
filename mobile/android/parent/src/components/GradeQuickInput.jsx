import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export function GradeQuickInput({ child, onSubmit, onClose }) {
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const subjects = ['Maths', 'Français', 'Histoire', 'Sciences', 'Anglais', 'Sport'];

  return (
    <View style={styles.gradeModal}>
      <Text style={styles.gradeModalTitle}>
        Saisir une note pour {child.first_name}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectList}>
        {subjects.map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.subjectChip, subject === s && styles.subjectChipSelected]}
            onPress={() => setSubject(s)}
          >
            <Text style={[styles.subjectChipText, subject === s && { color: '#fff' }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.gradeLabel}>Note /20</Text>
      <View style={styles.gradeButtons}>
        {[4, 6, 8, 10, 12, 14, 16, 18, 20].map(n => (
          <TouchableOpacity
            key={n}
            style={[
              styles.gradeBtn,
              grade === String(n) && styles.gradeBtnSelected,
              { backgroundColor: n < 10 ? '#FF6B6B22' : n < 14 ? '#FFD93D22' : '#51CF6622' },
            ]}
            onPress={() => setGrade(String(n))}
          >
            <Text style={[
              styles.gradeBtnText,
              { color: n < 10 ? '#FF6B6B' : n < 14 ? '#FFD93D' : '#51CF66' },
              grade === String(n) && { fontWeight: '800' },
            ]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.gradeModalActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, (!subject || !grade) && styles.submitBtnDisabled]}
          onPress={() => subject && grade && onSubmit(child.id, subject, parseFloat(grade))}
          disabled={!subject || !grade}
        >
          <LinearGradient colors={['#6C63FF', '#3B82F6']} style={styles.submitBtnGradient}>
            <Text style={styles.submitBtnText}>Valider</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradeModal: {
    backgroundColor: '#1e2040', borderRadius: 24,
    padding: 24, margin: 16,
  },
  gradeModalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  subjectList: { marginBottom: 20 },
  subjectChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#2a2a4a', marginRight: 8, borderWidth: 1, borderColor: '#3a3a5a',
  },
  subjectChipSelected: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  subjectChipText: { color: '#888', fontWeight: '600' },
  gradeLabel: { color: '#888', fontSize: 13, marginBottom: 12 },
  gradeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  gradeBtn: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  gradeBtnSelected: { borderColor: '#fff', borderWidth: 2 },
  gradeBtnText: { fontSize: 16, fontWeight: '600' },
  gradeModalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, padding: 16, borderRadius: 14,
    backgroundColor: '#2a2a4a', alignItems: 'center',
  },
  cancelBtnText: { color: '#888', fontWeight: '600' },
  submitBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnGradient: { padding: 16, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
