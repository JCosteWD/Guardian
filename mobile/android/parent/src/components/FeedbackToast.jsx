import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

export function FeedbackToast({ message, success, opacity }) {
  return (
    <Animated.View style={[
      styles.feedbackToast,
      {
        opacity,
        backgroundColor: success ? '#1a3a1a' : '#3a1a1a',
        borderColor: success ? '#51CF66' : '#FF6B6B',
      }
    ]}>
      <Text style={styles.feedbackText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  feedbackToast: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 100,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  feedbackText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
