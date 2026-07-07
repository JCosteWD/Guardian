import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function StatBox({ label, value, color }) {
  return (
    <View style={[styles.statBox, { borderColor: color + '44' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statBox: {
    flex: 1, minWidth: '45%', backgroundColor: '#16161e',
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4 },
});
