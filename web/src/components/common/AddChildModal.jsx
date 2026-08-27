import { useState } from 'react';
import { API } from '../api';
import { Input } from './Input';
import { Button } from './Button';
import { useApp } from '../context';

export function AddChildModal({ isOpen, onClose, onSuccess }) {
  const { showToast, loadChildren } = useApp();
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('10');
  const [avatarColor, setAvatarColor] = useState('#6C63FF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdResult, setCreatedResult] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await API.post('/children', {
        firstName,
        age: parseInt(age, 10),
      });
      showToast(`🎉 Profil de ${firstName} créé avec succès !`);
      setCreatedResult(data);
      if (loadChildren) loadChildren();
      if (onSuccess) onSuccess(data.child);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création de l\'enfant');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFirstName('');
    setAge('10');
    setCreatedResult(null);
    setError('');
    onClose();
  };

  const colors = ['#6C63FF', '#3B82F6', '#51CF66', '#FF922B', '#FF6B6B', '#CC5DE8'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(10, 10, 18, 0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--purple)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>➕ Ajouter un enfant</h2>
          <button onClick={handleClose} className="btn btn-ghost" style={{ padding: '4px 10px' }}>✕</button>
        </div>

        {!createdResult ? (
          <form onSubmit={handleSubmit}>
            {error && <div style={{ background: '#FF6B6B22', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>{error}</div>}

            <Input
              label="Prénom de l'enfant"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Ex: Lucas"
              required
            />

            <Input
              label="Âge"
              type="number"
              min="3"
              max="18"
              value={age}
              onChange={e => setAge(e.target.value)}
              required
            />

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Couleur de profil
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', background: c,
                      border: avatarColor === c ? '3px solid #fff' : 'none', cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <Button type="button" variant="ghost" onClick={handleClose}>Annuler</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Création...' : 'Créer le profil'}
              </Button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: 44 }}>📲</span>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>Couplage de l'appareil</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
              Entrez ce code de couplage dans l'application <strong>Guardian Enfant</strong> sur le téléphone ou la tablette de {createdResult.child.first_name} :
            </p>

            <div style={{
              background: 'var(--surface2)', border: '2px dashed var(--purple)',
              borderRadius: 14, padding: '16px', margin: '20px 0',
              fontSize: 32, fontWeight: 900, letterSpacing: 6, color: 'var(--purple)'
            }}>
              {createdResult.pairingCode || 'PAIR12'}
            </div>

            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 20 }}>
              Ce code expire dans 24 heures. Vous pourrez également générer un QR Code plus tard.
            </p>

            <Button onClick={handleClose} style={{ width: '100%', justifyContent: 'center' }}>
              ✓ Terminer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
