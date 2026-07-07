import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function SectionCard({ title, icon, children }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionHeader}>{icon} {title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    margin: 16, marginBottom: 8, backgroundColor: '#1e2040',
    borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#2a2a4a',
  },
  sectionHeader: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
});
