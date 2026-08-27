import { useState } from 'react';
import { API } from '../api';
import { Button } from '../common/Button';

export function ChildQuizPage({ quizData, onComplete }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data } = await API.post(`/ai/quiz/${quizData.id}/submit`, {
        quizId: quizData.id,
        answers,
      });

      setResults(data);
      setShowResults(true);

      if (onComplete) {
        onComplete(data);
      }
    } catch (err) {
      console.error('Quiz submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const question = quizData.questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const progress = ((currentQuestion + 1) / quizData.questions.length) * 100;

  if (showResults && results) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {results.passed ? '🎉' : '💪'}
        </div>
        <h2 style={{ color: results.passed ? 'var(--success)' : 'var(--warning)', marginBottom: 8 }}>
          {results.passed ? 'Bravo !' : 'Continue tes efforts !'}
        </h2>
        <p style={{ fontSize: 24, marginBottom: 16 }}>
          Score: {results.score}% ({results.correct}/{results.total})
        </p>

        {results.passed && (
          <div style={{
            background: 'var(--success)',
            color: 'white',
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏰</div>
            <p style={{ fontSize: 20, margin: 0 }}>
              Tu as gagné {results.bonusMins} minutes bonus !
            </p>
          </div>
        )}

        <div style={{ 
          background: 'var(--bg-secondary)', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 16,
          textAlign: 'left'
        }}>
          <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
            {results.aiMessage}
          </p>
        </div>

        <Button onClick={() => onComplete && onComplete(null)}>
          Retour au chat
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Question {currentQuestion + 1}/{quizData.questions.length}
          </span>
          <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>
            {quizData.subject}
          </span>
        </div>
        <div style={{
          height: 8,
          background: 'var(--bg-tertiary)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--primary)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 20,
      }}>
        <h3 style={{ marginBottom: 20, fontSize: 20 }}>
          {question.question}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {question.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(question.id, idx)}
              style={{
                padding: 16,
                borderRadius: 8,
                border: `2px solid ${
                  answers[question.id] === idx ? 'var(--primary)' : 'var(--border)'
                }`,
                background: answers[question.id] === idx 
                  ? 'var(--primary-light)' 
                  : 'var(--bg-primary)',
                color: 'var(--text)',
                fontSize: 16,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Button
          variant="ghost"
          onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
          disabled={currentQuestion === 0}
        >
          ← Précédent
        </Button>

        {currentQuestion < quizData.questions.length - 1 ? (
          <Button
            onClick={() => setCurrentQuestion(currentQuestion + 1)}
            disabled={answers[question.id] === undefined}
          >
            Suivant →
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={answeredCount < quizData.questions.length || isSubmitting}
            style={{ background: 'var(--success)' }}
          >
            {isSubmitting ? 'Envoi...' : 'Terminer le quiz'}
          </Button>
        )}
      </div>

      <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
        {answeredCount}/{quizData.questions.length} questions répondues
      </div>
    </div>
  );
}
