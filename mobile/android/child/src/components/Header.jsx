import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function Header({ child, currentTime }) {
  const timeStr = currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>
          Bonjour {child?.firstName} 👋
        </Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>
      <Text style={styles.clock}>{timeStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20,
  },
  greeting: { color: '#fff', fontSize: 24, fontWeight: '700' },
  dateText: { color: '#888', fontSize: 14, marginTop: 4, textTransform: 'capitalize' },
  clock: { color: '#6C63FF', fontSize: 28, fontWeight: '700' },
});
