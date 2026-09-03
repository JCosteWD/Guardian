import { useState } from 'react';
import { API } from '../api';
import { Input } from '../common/Input';
import { Button } from '../common/Button';

export function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (isRegister) {
        await API.post('/auth/register', { email, password, firstName, lastName });
      }
      const { data } = await API.post('/auth/login', { email, password });
      localStorage.setItem('guardian_token', data.accessToken);
      onLogin(data.parent);
    } catch (err) {
      setError(err.response?.data?.error || (isRegister ? 'Erreur lors de l\'inscription' : 'Erreur de connexion'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true); setError('');
    const demoEmail = 'demo@guardian.com';
    const demoPass = 'Password123';
    try {
      let data;
      try {
        const res = await API.post('/auth/login', { email: demoEmail, password: demoPass });
        data = res.data;
      } catch (loginErr) {
        // Mode démo fallback : enregistre le compte démo si inexistant
        await API.post('/auth/register', { email: demoEmail, password: demoPass, firstName: 'Parent', lastName: 'Démo' });
        const res = await API.post('/auth/login', { email: demoEmail, password: demoPass });
        data = res.data;
      }
      localStorage.setItem('guardian_token', data.accessToken);
      onLogin(data.parent);
    } catch (err) {
      setError('Impossible de se connecter au compte démo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🛡️</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, background: 'linear-gradient(135deg,#6C63FF,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Guardian</h1>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Contrôle parental intelligent & accompagnement scolaire</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <button
              className="btn"
              style={{ flex: 1, justifyContent: 'center', background: !isRegister ? 'var(--surface2)' : 'none', color: !isRegister ? 'var(--purple)' : 'var(--muted)' }}
              onClick={() => { setIsRegister(false); setError(''); }}
            >
              Connexion
            </button>
            <button
              className="btn"
              style={{ flex: 1, justifyContent: 'center', background: isRegister ? 'var(--surface2)' : 'none', color: isRegister ? 'var(--purple)' : 'var(--muted)' }}
              onClick={() => { setIsRegister(true); setError(''); }}
            >
              Créer un compte
            </button>
          </div>

          {error && <div style={{ background: '#FF6B6B22', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Marie" required />
                <Input label="Nom" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" required />
              </div>
            )}
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@email.com" required />
            <Input label="Mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="•••••••• (Min 8 car, 1 Maj, 1 Chiffre)" required style={{ marginBottom: 20 }} />
            <Button type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
              {loading ? 'Patientez...' : isRegister ? '→ Inscription' : '→ Connexion'}
            </Button>
          </form>

          <div style={{ margin: '20px 0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>OU TESTEZ L'APPLICATION</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <Button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            style={{
              width: '100%',
              justify: 'center',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(59,130,246,0.15))',
              border: '1px solid var(--purple)',
              color: 'var(--text)'
            }}
          >
            🚀 Connexion Démo Immédiate (Compte Test Gratuit)
          </Button>
        </div>
      </div>
    </div>
  );
}
