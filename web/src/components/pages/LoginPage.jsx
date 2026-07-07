import { useState } from 'react';
import { API } from '../api';
import { Input } from '../common/Input';
import { Button } from '../common/Button';

export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await API.post('/auth/login', { email, password });
      localStorage.setItem('guardian_token', data.accessToken);
      onLogin(data.parent);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🛡️</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, background: 'linear-gradient(135deg,#6C63FF,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Guardian</h1>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Contrôle parental intelligent</p>
        </div>
        <div className="card">
          <h2 style={{ marginBottom: 20, fontWeight: 700 }}>Connexion parent</h2>
          {error && <div style={{ background: '#FF6B6B22', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@email.com" required />
            <Input label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ marginBottom: 20 }} />
            <Button type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
              {loading ? 'Connexion...' : '→ Connexion'}
            </Button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
            Pas encore de compte ? <a href="#register" style={{ color: 'var(--purple)' }}>Créer un compte</a>
          </p>
        </div>
      </div>
    </div>
  );
}
