import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, FlatList, KeyboardAvoidingView, Platform, StyleSheet,
  ActivityIndicator, Alert, Text,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { sendAIMessage, generateQuiz } from '../services/api';
import { GuardianAvatar } from '../components/chat/GuardianAvatar';
import { MessageBubble } from '../components/chat/MessageBubble';
import { QuickSuggestions } from '../components/chat/QuickSuggestions';
import { QuizCard } from '../components/chat/QuizCard';
import { ChatInput } from '../components/chat/ChatInput';
import { TypingIndicator } from '../components/chat/TypingIndicator';

export default function AIChatScreen({ route }) {
  const { child } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    const greeting = {
      role: 'assistant',
      content: `Salut ${child?.firstName || 'toi'} ! 👋 Je suis ${child?.aiPersonaName || 'Guardian'}, ton assistant personnel. Comment puis-je t'aider aujourd'hui ?`,
      id: 'greeting',
    };
    setMessages([greeting]);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = useCallback(async (text = input) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: 'user', content: text.trim(), id: Date.now().toString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setShowSuggestions(false);
    setIsLoading(true);
    scrollToBottom();

    try {
      const response = await sendAIMessage(text.trim(), sessionId);

      if (!sessionId && response.sessionId) setSessionId(response.sessionId);

      const aiMsg = {
        role: 'assistant',
        content: response.response,
        id: (Date.now() + 1).toString(),
        mood: response.mood,
      };
      setMessages(prev => [...prev, aiMsg]);

      if (response.quizRequested) {
        setIsLoading(true);
        try {
          const quizData = await generateQuiz(response.quizRequested, 10, 15);
          setActiveQuiz(quizData.quiz);
        } catch (e) {
          console.warn('Quiz generation failed:', e);
        }
        setIsLoading(false);
      }
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: 'Oups, je suis momentanément indisponible. Réessaie dans un instant ! 😊',
        id: (Date.now() + 1).toString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [input, isLoading, sessionId]);

  const handleQuizComplete = async (quizId, answers) => {
    setActiveQuiz(null);
    setIsLoading(true);

    try {
      const { submitQuiz } = require('../services/api');
      const result = await submitQuiz(quizId, answers);

      const resultMsg = {
        role: 'assistant',
        content: result.aiMessage,
        id: Date.now().toString(),
        bonusMins: result.passed ? result.bonusMins : 0,
      };
      setMessages(prev => [...prev, resultMsg]);
    } catch (err) {
      console.warn('Quiz submit failed:', err);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
        <GuardianAvatar isTyping={isLoading} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{child?.aiPersonaName || 'Guardian'}</Text>
          <Text style={styles.headerStatus}>
            {isLoading ? '✍️ En train d\'écrire...' : '🟢 En ligne'}
          </Text>
        </View>
      </LinearGradient>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            childName={child?.firstName}
            aiName={child?.aiPersonaName}
          />
        )}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        onContentSizeChange={scrollToBottom}
      />

      {showSuggestions && messages.length <= 1 && (
        <QuickSuggestions onSelect={(s) => sendMessage(s)} />
      )}

      {activeQuiz && (
        <View style={styles.quizOverlay}>
          <QuizCard
            quiz={activeQuiz}
            onComplete={handleQuizComplete}
          />
        </View>
      )}

      {isLoading && <TypingIndicator />}

      <ChatInput
        value={input}
        onChangeText={setInput}
        onSend={() => sendMessage()}
        isLoading={isLoading}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#2a2a3e',
  },
  headerInfo: { marginLeft: 12 },
  headerName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerStatus: { color: '#aaa', fontSize: 12, marginTop: 2 },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 8 },
  quizOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 16,
  },
});
