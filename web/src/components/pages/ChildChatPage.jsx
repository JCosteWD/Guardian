import { useState, useEffect, useRef } from 'react';
import { API } from '../api';
import { Button } from '../common/Button';
import { useApp } from '../context';

export function ChildChatPage() {
  const { children, loadChildren } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [quizModal, setQuizModal] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childToken, setChildToken] = useState(null);
  const [isAuthenticatingChild, setIsAuthenticatingChild] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChildren();
  }, []);

  const selectChildForChat = async (child) => {
    setIsAuthenticatingChild(true);
    try {
      // Get child token using the child's device_id
      const { data } = await API.post('/auth/child', { deviceId: child.device_id });
      setChildToken(data.accessToken);
      setSelectedChild(child);
      setMessages([]);
      setSessionId(null);
      console.log('[ChildChatPage] Child authenticated:', child.first_name);
    } catch (err) {
      console.error('[ChildChatPage] Failed to authenticate child:', err);
      alert(`Erreur: Impossible d'authentifier ${child.first_name}`);
    } finally {
      setIsAuthenticatingChild(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !childToken) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const endpoint = '/ai/chat';
      console.log('[ChildChatPage] Sending message to:', endpoint, userMessage);
      const { data } = await API.post(endpoint, {
        message: userMessage,
        sessionId,
        conversationHistory: messages,
      }, {
        headers: { Authorization: `Bearer ${childToken}` },
      });
      console.log('[ChildChatPage] Response received:', data);

      setMessages(prev => [...prev, { role: 'assistant', content: data.aiResponse || data.response }]);
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
    if (!quizModal || !childToken) return;

    try {
      const { data } = await API.post('/ai/quiz/generate', {
        subject: quizModal.subject,
        numQuestions: 10,
        timeBonusMins: 15,
      }, {
        headers: { Authorization: `Bearer ${childToken}` },
      });

      setQuizModal({ ...quizModal, quizData: data.quiz, started: true });
    } catch (err) {
      console.error('Quiz generation error:', err);
      setQuizModal(null);
    }
  };

  if (!selectedChild) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--primary)', marginBottom: 8 }}>💬 Chat avec Guardian</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Sélectionne un enfant pour commencer
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {children.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
              <p>Aucun enfant enregistré</p>
            </div>
          ) : (
            children.map(child => (
              <button
                key={child.id}
                onClick={() => selectChildForChat(child)}
                disabled={isAuthenticatingChild}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 16,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.borderColor = 'var(--purple)'}
                onMouseLeave={(e) => e.target.style.borderColor = 'var(--border)'}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: child.avatar_color || '#6C63FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 18,
                }}>
                  {child.first_name[0]}
                </div>
                <span>{child.first_name} ({child.age} ans)</span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: 8 }}>💬 Chat avec Guardian</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Conversation avec {selectedChild.first_name}
        </p>
        <button
          onClick={() => setSelectedChild(null)}
          style={{
            marginTop: 8,
            padding: '6px 12px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          ← Changer d'enfant
        </button>
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
            <p>Bonjour {selectedChild.first_name} ! Je suis Guardian. Comment puis-je t'aider aujourd'hui ?</p>
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
              background: msg.role === 'user' ? 'var(--purple)' : 
                         msg.role === 'system' ? '#FF6B6B' : 'var(--bg-tertiary)',
              color: msg.role === 'user' || msg.role === 'system' ? 'white' : 'var(--text)',
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
            fontSize: 14,
            background: 'var(--bg-secondary)',
            color: 'var(--text)',
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
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--surface)',
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
            width: '90%',
            textAlign: 'center',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h3 style={{ marginBottom: 8 }}>Défi éducatif !</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Veux-tu faire un quiz sur <strong>{quizModal.subject}</strong> ?
            </p>
            <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--green)' }}>
              +15 minutes de temps libre en récompense ! ⭐
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                onClick={() => setQuizModal(null)}
                style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text)' }}
              >
                Pas maintenant
              </Button>
              <Button
                onClick={startQuiz}
                style={{ flex: 1 }}
              >
                Commencer le quiz
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
