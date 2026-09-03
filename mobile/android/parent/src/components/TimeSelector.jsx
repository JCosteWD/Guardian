import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function TimeSelector({ label, value, onChange, min = 0, max = 480, step = 15 }) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  return (
    <View style={styles.timeSelectorRow}>
      <Text style={styles.timeSelectorLabel}>{label}</Text>
      <View style={styles.timeSelectorControls}>
        <TouchableOpacity
          style={styles.timeBtn}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Text style={styles.timeBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.timeValue}>
          {hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins} min`}
        </Text>
        <TouchableOpacity
          style={styles.timeBtn}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.timeBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeSelectorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  timeSelectorLabel: { color: '#ccc', fontSize: 15 },
  timeSelectorControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  timeBtn: { width: 36, height: 36, backgroundColor: '#2a2a4a', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  timeBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  timeValue: { color: '#fff', fontSize: 16, fontWeight: '700', minWidth: 70, textAlign: 'center' },
});
