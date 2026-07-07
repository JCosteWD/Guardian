import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

const CATEGORIES = [
  { key: 'adult', label: 'Contenu adulte', emoji: '🔞', defaultBlocked: true },
  { key: 'violence', label: 'Violence', emoji: '⚔️', defaultBlocked: true },
  { key: 'gambling', label: 'Jeux d\'argent', emoji: '🎰', defaultBlocked: true },
  { key: 'drugs', label: 'Drogues / Alcool', emoji: '🍺', defaultBlocked: true },
  { key: 'social_media', label: 'Réseaux sociaux', emoji: '📱', defaultBlocked: false },
  { key: 'gaming', label: 'Jeux vidéo', emoji: '🎮', defaultBlocked: false },
  { key: 'streaming', label: 'Vidéos / Streaming', emoji: '📺', defaultBlocked: false },
  { key: 'chat', label: 'Chat / Messagerie', emoji: '💬', defaultBlocked: false },
  { key: 'shopping', label: 'Shopping', emoji: '🛒', defaultBlocked: true },
];

export function CategoryToggle({ categories, onToggle }) {
  return (
    <>
      {CATEGORIES.map(cat => (
        <View key={cat.key} style={styles.switchRow}>
          <View style={styles.catInfo}>
            <Text style={styles.catEmoji}>{cat.emoji}</Text>
            <Text style={styles.catLabel}>{cat.label}</Text>
          </View>
          <Switch
            value={categories[cat.key] !== undefined ? categories[cat.key] : cat.defaultBlocked}
            onValueChange={v => onToggle(cat.key, v)}
            trackColor={{ true: '#FF6B6B', false: '#2a2a4a' }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  catInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  catEmoji: { fontSize: 20, marginRight: 12 },
  catLabel: { color: '#ccc', fontSize: 14 },
});
