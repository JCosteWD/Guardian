import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export function GuardianCTA({ onPress }) {
  return (
    <TouchableOpacity style={styles.guardianCTA} onPress={onPress}>
      <LinearGradient colors={['#6C63FF', '#3B82F6']} style={styles.guardianCTAGradient}>
        <Text style={styles.guardianCTAEmoji}>🛡️</Text>
        <View style={styles.guardianCTAText}>
          <Text style={styles.guardianCTATitle}>Parler à Guardian</Text>
          <Text style={styles.guardianCTASubtitle}>Pose tes questions, fais un quiz</Text>
        </View>
        <Text style={styles.guardianCTAArrow}>→</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  guardianCTA: { margin: 16, borderRadius: 20, overflow: 'hidden' },
  guardianCTAGradient: {
    flexDirection: 'row', alignItems: 'center', padding: 20,
  },
  guardianCTAEmoji: { fontSize: 32 },
  guardianCTAText: { flex: 1, marginLeft: 14 },
  guardianCTATitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  guardianCTASubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  guardianCTAArrow: { color: '#fff', fontSize: 22 },
});
