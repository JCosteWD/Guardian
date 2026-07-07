import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export function QuizCard({ quiz, onAnswer, onComplete }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);

  const question = quiz.questions[currentQ];

  const handleSelect = (idx) => {
    setSelected(idx);
    const newAnswers = { ...answers, [question.id]: idx };
    setAnswers(newAnswers);

    setTimeout(() => {
      if (currentQ < quiz.questions.length - 1) {
        setCurrentQ(c => c + 1);
        setSelected(null);
      } else {
        onComplete(quiz.id, newAnswers);
      }
    }, 500);
  };

  return (
    <View style={styles.quizCard}>
      <LinearGradient colors={['#6C63FF', '#3B82F6']} style={styles.quizHeader}>
        <Text style={styles.quizTitle}>📚 Quiz – {quiz.subject}</Text>
        <Text style={styles.quizProgress}>
          {currentQ + 1} / {quiz.questions.length}
        </Text>
        <Text style={styles.quizBonus}>+{quiz.timeBonusMins} min si tu réussis !</Text>
      </LinearGradient>

      <View style={styles.quizBody}>
        <Text style={styles.quizQuestion}>{question.question}</Text>
        {question.options.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.quizOption,
              selected === idx && styles.quizOptionSelected,
            ]}
            onPress={() => handleSelect(idx)}
            disabled={selected !== null}
          >
            <Text style={[
              styles.quizOptionText,
              selected === idx && styles.quizOptionTextSelected,
            ]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quizCard: { backgroundColor: '#1e2040', borderRadius: 20, overflow: 'hidden' },
  quizHeader: { padding: 20, alignItems: 'center' },
  quizTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  quizProgress: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  quizBonus: {
    marginTop: 8, color: '#FFD93D', fontWeight: '700', fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  quizBody: { padding: 20 },
  quizQuestion: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 20, lineHeight: 26 },
  quizOption: {
    backgroundColor: '#2a2a4a', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#3a3a5a',
  },
  quizOptionSelected: { backgroundColor: '#6C63FF', borderColor: '#8a80ff' },
  quizOptionText: { color: '#ccc', fontSize: 15 },
  quizOptionTextSelected: { color: '#fff', fontWeight: '600' },
});
