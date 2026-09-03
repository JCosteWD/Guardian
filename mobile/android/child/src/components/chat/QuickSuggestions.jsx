import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function QuickSuggestions({ onSelect }) {
  const suggestions = [
    "Pourquoi ai-je moins de temps ?",
    "Je veux faire un quiz",
    "Comment gagner du bonus ?",
    "J'ai besoin d'aide pour réviser",
  ];

  return (
    <View style={styles.suggestionsContainer}>
      {suggestions.map((s, i) => (
        <TouchableOpacity
          key={i}
          style={styles.suggestionChip}
          onPress={() => onSelect(s)}
        >
          <Text style={styles.suggestionText}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionsContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, paddingBottom: 8, gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#1e2040', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#6C63FF',
  },
  suggestionText: { color: '#aab', fontSize: 13 },
});
