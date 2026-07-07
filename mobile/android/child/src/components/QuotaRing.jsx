import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

export function QuotaRing({ usedMins, totalMins, isLocked }) {
  const percentage = totalMins > 0 ? Math.min(1, usedMins / totalMins) : 0;
  const remainingMins = Math.max(0, totalMins - usedMins);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: percentage, duration: 1000, useNativeDriver: false,
    }).start();
  }, [percentage]);

  const color = isLocked ? '#FF4757'
    : remainingMins <= 15 ? '#FF6B6B'
    : remainingMins <= 30 ? '#FFD93D'
    : '#51CF66';

  const hours = Math.floor(remainingMins / 60);
  const mins = remainingMins % 60;

  return (
    <View style={styles.quotaContainer}>
      <View style={[styles.quotaRing, { borderColor: isLocked ? '#FF4757' : '#2a2a4a' }]}>
        <View style={[styles.quotaInner, { borderColor: color }]}>
          {isLocked ? (
            <>
              <Text style={styles.quotaLocked}>🔒</Text>
              <Text style={styles.quotaLockedText}>Bloqué</Text>
            </>
          ) : (
            <>
              <Text style={[styles.quotaTime, { color }]}>
                {hours > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${mins}m`}
              </Text>
              <Text style={styles.quotaLabel}>restantes</Text>
            </>
          )}
        </View>
      </View>
      <Text style={styles.quotaUsed}>{usedMins} min utilisées</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quotaContainer: { alignItems: 'center', paddingVertical: 20 },
  quotaRing: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 6, justifyContent: 'center', alignItems: 'center',
  },
  quotaInner: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 4, justifyContent: 'center', alignItems: 'center',
  },
  quotaTime: { fontSize: 32, fontWeight: '800' },
  quotaLabel: { color: '#888', fontSize: 13, marginTop: 4 },
  quotaLocked: { fontSize: 32 },
  quotaLockedText: { color: '#FF4757', fontWeight: '700', marginTop: 4 },
  quotaUsed: { color: '#666', fontSize: 13, marginTop: 12 },
});
