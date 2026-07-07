import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export function ChatInput({ value, onChangeText, onSend, isLoading }) {
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Parle à Guardian..."
        placeholderTextColor="#888"
        multiline
        maxLength={500}
        onSubmitEditing={onSend}
        editable={!isLoading}
      />
      <TouchableOpacity
        style={[styles.sendButton, (!value.trim() || isLoading) && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={!value.trim() || isLoading}
      >
        <LinearGradient
          colors={value.trim() ? ['#6C63FF', '#3B82F6'] : ['#555', '#444']}
          style={styles.sendGradient}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#16161e', borderTopWidth: 1, borderTopColor: '#2a2a3e',
  },
  input: {
    flex: 1, backgroundColor: '#1e2040',
    borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12,
    color: '#fff', fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: '#2a2a3e',
  },
  sendButton: { marginLeft: 10, borderRadius: 24, overflow: 'hidden' },
  sendButtonDisabled: { opacity: 0.5 },
  sendGradient: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  sendIcon: { color: '#fff', fontSize: 18 },
});
