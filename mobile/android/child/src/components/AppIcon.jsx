import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';

export function AppIcon({ app, isBlocked, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onPress(app));
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={styles.appIcon} onPress={handlePress} activeOpacity={0.8}>
        <View style={[
          styles.appIconInner,
          isBlocked && styles.appIconBlocked,
          { backgroundColor: app.color || '#2a2a4a' }
        ]}>
          <Text style={styles.appEmoji}>{app.emoji || '📱'}</Text>
          {isBlocked && (
            <View style={styles.blockedOverlay}>
              <Text style={styles.blockedIcon}>🔒</Text>
            </View>
          )}
        </View>
        <Text style={[styles.appName, isBlocked && styles.appNameBlocked]} numberOfLines={1}>
          {app.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  appIcon: { width: '30%', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  appIconInner: {
    width: 70, height: 70, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  appIconBlocked: { opacity: 0.5 },
  appEmoji: { fontSize: 32 },
  blockedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  blockedIcon: { fontSize: 22 },
  appName: { color: '#ccc', fontSize: 11, marginTop: 6, textAlign: 'center' },
  appNameBlocked: { color: '#666' },
});
