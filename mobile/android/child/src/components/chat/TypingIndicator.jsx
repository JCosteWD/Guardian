import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export function TypingIndicator() {
  return (
    <View style={styles.typingIndicator}>
      <ActivityIndicator size="small" color="#6C63FF" />
      <Text style={styles.typingText}>Guardian réfléchit...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  typingIndicator: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 4,
  },
  typingText: { color: '#888', fontSize: 12, marginLeft: 8 },
});
