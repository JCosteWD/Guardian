import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { GuardianAvatar } from './GuardianAvatar';

export function MessageBubble({ message, childName, aiName }) {
  const isAI = message.role === 'assistant';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 300, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isAI ? styles.messageRowAI : styles.messageRowChild,
        { opacity: fadeAnim },
      ]}
    >
      {isAI && <GuardianAvatar isTyping={false} />}
      <View style={[
        styles.bubble,
        isAI ? styles.bubbleAI : styles.bubbleChild,
      ]}>
        {isAI && (
          <Text style={styles.bubbleSender}>{aiName || 'Guardian'}</Text>
        )}
        <Text style={[styles.bubbleText, isAI && styles.bubbleTextAI]}>
          {message.content}
        </Text>
        {message.bonusMins > 0 && (
          <View style={styles.bonusBadge}>
            <Text style={styles.bonusText}>+{message.bonusMins} min gagnées ! 🎉</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  messageRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  messageRowAI: { justifyContent: 'flex-start' },
  messageRowChild: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%', borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  bubbleAI: {
    backgroundColor: '#1e2040', marginLeft: 8,
    borderTopLeftRadius: 4,
  },
  bubbleChild: {
    backgroundColor: '#6C63FF',
    borderTopRightRadius: 4,
  },
  bubbleSender: { color: '#6C63FF', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  bubbleTextAI: { color: '#e8e8f0' },
  bonusBadge: {
    marginTop: 8, backgroundColor: '#51CF66',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  bonusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
