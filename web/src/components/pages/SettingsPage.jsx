import { useState, useEffect } from 'react';
import { API } from '../api';
import { useApp } from '../context';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Input } from '../common/Input';

export function SettingsPage() {
  const { parent, showToast } = useApp();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [twoFAData, setTwoFAData] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState({});

  useEffect(() => {
    loadNotificationPreferences();
  }, []);

  const loadNotificationPreferences = async () => {
    try {
      const { data } = await API.get('/notifications/preferences');
      setNotificationPrefs(data.preferences || {});
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    }
  };

  const handleToggleNotification = async (key) => {
    const newValue = !notificationPrefs[key];
    try {
      await API.patch('/notifications/preferences', { key, value: newValue });
      setNotificationPrefs({ ...notificationPrefs, [key]: newValue });
      showToast('✅ Préférence mise à jour');
    } catch {
      showToast('❌ Erreur', false);
    }
  };

  const handleSetPin = async () => {
    if (pin.length < 4) return showToast('Le PIN doit avoir au moins 4 chiffres', false);
    if (pin !== pinConfirm) return showToast('Les PINs ne correspondent pas', false);
    try {
      await API.post('/auth/pin', { pin });
      showToast('✅ PIN configuré avec succès');
      setPin(''); setPinConfirm('');
    } catch { showToast('❌ Erreur', false); }
  };

  const handleSetup2FA = async () => {
    try {
      const { data } = await API.post('/auth/2fa/setup');
      setTwoFAData(data);
    } catch { showToast('❌ Erreur 2FA', false); }
  };

  const handleConfirm2FA = async () => {
    try {
      await API.post('/auth/2fa/confirm', { token: twoFACode });
      showToast('✅ 2FA activé !');
      setTwoFAData(null);
    } catch { showToast('❌ Code invalide', false); }
  };

  return (
    <div>
      <div className="topbar"><h1 className="page-title">Paramètres</h1></div>
      <div className="grid grid-2">
        <Card title="👤 Mon compte">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff' }}>
              {parent?.firstName?.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>{parent?.firstName} {parent?.lastName}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>{parent?.email}</div>
              <span className="badge" style={{ background: 'var(--purple)22', color: 'var(--purple)', marginTop: 4 }}>
                Plan {parent?.plan || 'Gratuit'}
              </span>
            </div>
          </div>
        </Card>

        <Card title="🔐 Code PIN parental">
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
            Le PIN protège les modifications de règles et empêche votre enfant de changer les paramètres.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <Input placeholder="Nouveau PIN (4-8 chiffres)" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
            <Input placeholder="Confirmer" value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))} />
          </div>
          <Button onClick={handleSetPin}>Enregistrer le PIN</Button>
        </Card>

        <Card title="🔒 Authentification à deux facteurs">
          {!twoFAData ? (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                Activez la 2FA pour sécuriser encore plus votre compte parent avec une application comme Google Authenticator.
              </p>
              {parent?.twoFAEnabled
                ? <span className="badge" style={{ background: '#51CF6622', color: 'var(--green)' }}>✅ 2FA activée</span>
                : <Button variant="ghost" onClick={handleSetup2FA}>Configurer la 2FA</Button>
              }
            </>
          ) : (
            <>
              <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>Scannez ce QR code avec votre application d'authentification :</p>
              <img src={twoFAData.qrCode} alt="QR Code 2FA" style={{ width: 180, borderRadius: 12, display: 'block', marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <Input placeholder="Code à 6 chiffres" value={twoFACode} onChange={e => setTwoFACode(e.target.value)} maxLength={6} />
                <Button onClick={handleConfirm2FA}>Confirmer</Button>
              </div>
            </>
          )}
        </Card>

        <Card title="🔔 Notifications">
          {[
            { label: 'Quota presque atteint (15 min restantes)', key: 'notif_quota' },
            { label: 'Tentative de contournement détectée', key: 'notif_tamper' },
            { label: 'Quota épuisé', key: 'notif_empty' },
            { label: 'Quiz complété par votre enfant', key: 'notif_quiz' },
            { label: 'Rapport hebdomadaire (Premium)', key: 'notif_report' },
          ].map(n => (
            <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>{n.label}</span>
              <label className="toggle">
                <input 
                  type="checkbox" 
                  checked={notificationPrefs[n.key] !== false}
                  onChange={() => handleToggleNotification(n.key)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
