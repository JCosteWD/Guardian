import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export function GuardianAvatar({ isTyping }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isTyping]);

  return (
    <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulse }] }]}>
      <LinearGradient colors={['#6C63FF', '#3B82F6']} style={styles.avatar}>
        <Text style={styles.avatarEmoji}>🛡️</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  avatarContainer: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  avatar: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 22 },
});
