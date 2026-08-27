import { useState, useEffect, useRef } from 'react';
import { API } from '../api';
import { Button } from '../common/Button';

export function ChildChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [quizModal, setQuizModal] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Use standard /ai/chat endpoint (allows parent access in dev mode)
      const endpoint = '/ai/chat';
      console.log('[ChildChatPage] Sending message to:', endpoint, userMessage);
      const { data } = await API.post(endpoint, {
        message: userMessage,
        sessionId,
        conversationHistory: messages, // Send conversation history for context
      });
      console.log('[ChildChatPage] Response received:', data);

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      setSessionId(data.sessionId);

      if (data.quizRequested) {
        setQuizModal({ subject: data.quizRequested });
      }

      if (data.mood === 'sad') {
        setMessages(prev => [...prev, {
          role: 'system',
          content: '💙 Si tu es triste, n\'hésite pas à en parler avec tes parents. Ils sont là pour t\'aider !'
        }]);
      }
    } catch (err) {
      console.error('[ChildChatPage] Chat error:', err);
      console.error('[ChildChatPage] Error response:', err.response?.data);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Erreur: ${err.response?.data?.error || err.message || 'Désolé, je ne peux pas répondre pour le moment. Réessaie plus tard !'}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startQuiz = async () => {
    if (!quizModal) return;

    try {
      const { data } = await API.post('/ai/quiz/generate', {
        subject: quizModal.subject,
        numQuestions: 10,
        timeBonusMins: 15,
      });

      setQuizModal({ ...quizModal, quizData: data.quiz, started: true });
    } catch (err) {
      console.error('Quiz generation error:', err);
      setQuizModal(null);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: 8 }}>💬 Chat avec Guardian</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Je suis là pour t'aider et t'expliquer les règles !
        </p>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        height: 400,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            marginTop: 'auto',
            marginBottom: 'auto',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🤖</div>
            <p>Bonjour ! Je suis Guardian. Comment puis-je t'aider aujourd'hui ?</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}
          >
            <div style={{
              background: msg.role === 'user' ? 'var(--primary)' : 
                         msg.role === 'system' ? 'var(--warning)' : 'var(--bg-tertiary)',
              color: msg.role === 'user' ? 'white' : 
                     msg.role === 'system' ? 'white' : 'var(--text)',
              padding: 12,
              borderRadius: 12,
              borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
              borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div style={{
              background: 'var(--bg-tertiary)',
              padding: 12,
              borderRadius: 12,
              borderBottomLeftRadius: 4,
            }}>
              <span style={{ animation: 'pulse 1.5s infinite' }}>●●●</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Écris ton message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: 16,
          }}
        />
        <Button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          style={{ padding: '12px 24px' }}
        >
          Envoyer
        </Button>
      </div>

      {/* Quiz Modal */}
      {quizModal && !quizModal.started && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
            width: '90%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h3 style={{ marginBottom: 8 }}>Défi éducatif !</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Veux-tu faire un quiz sur <strong>{quizModal.subject}</strong> ?
            </p>
            <p style={{ marginBottom: 16 }}>
              Si tu obtiens 8/10 ou plus, tu gagneras <strong>15 minutes bonus</strong> ! 🎉
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button onClick={startQuiz} style={{ background: 'var(--success)' }}>
                C'est parti !
              </Button>
              <Button onClick={() => setQuizModal(null)} variant="ghost">
                Plus tard
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
