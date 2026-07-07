import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function LockBanner({ lockReason, onChatPress }) {
  return (
    <View style={styles.lockBanner}>
      <Text style={styles.lockBannerText}>🔒 {lockReason}</Text>
      <TouchableOpacity style={styles.lockBannerBtn} onPress={onChatPress}>
        <Text style={styles.lockBannerBtnText}>Parler à Guardian →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  lockBanner: {
    margin: 16, backgroundColor: '#2d1515',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FF4757',
  },
  lockBannerText: { color: '#FF6B6B', fontSize: 14, lineHeight: 20 },
  lockBannerBtn: { marginTop: 10, alignSelf: 'flex-end' },
  lockBannerBtnText: { color: '#6C63FF', fontWeight: '700' },
});
