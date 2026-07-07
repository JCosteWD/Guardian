import { useState, useEffect } from 'react';
import { API } from '../api';
import { useApp } from '../context';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

export function SubscriptionPage() {
  const { parent } = useApp();
  const [sub, setSub] = useState(null);

  useEffect(() => {
    API.get('/billing/subscription').then(r => setSub(r.data)).catch(() => {});
  }, []);

  const plans = [
    {
      id: 'free', name: 'Gratuit', price: '0€', period: '/mois',
      features: ['1 enfant', 'Temps d\'écran basique', 'Blocage d\'applications', 'Filtre web simple'],
      color: 'var(--muted)', featured: false,
    },
    {
      id: 'family', name: 'Family', price: '4,99€', period: '/mois',
      features: ['3 enfants', 'Profils avancés', 'Réglages par notes', 'Rapports détaillés', 'Mode école', 'Heure du coucher', 'Presets rapides'],
      color: 'var(--blue)', featured: false,
    },
    {
      id: 'premium', name: 'Premium + IA', price: '9,99€', period: '/mois',
      features: ['Enfants illimités', '🛡️ IA Guardian complète', '🧠 Quiz adaptatifs', '⏰ Bonus de temps IA', '📊 Rapport IA hebdomadaire', 'Tout Family inclus', 'Support prioritaire'],
      color: 'var(--purple)', featured: true,
    },
  ];

  const handleUpgrade = async (planId) => {
    try {
      const { data } = await API.post('/billing/checkout', { plan: planId });
      window.open(data.checkoutUrl, '_blank');
    } catch (err) {
      alert('Erreur lors du paiement');
    }
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Abonnement</h1>
          <p className="page-sub">Plan actuel : <strong style={{ color: 'var(--purple)' }}>{sub?.plan || parent?.plan || 'Gratuit'}</strong></p>
        </div>
      </div>

      {sub && sub.plan !== 'free' && (
        <Card style={{ marginBottom: 24, borderColor: 'var(--purple)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>✅ Plan {sub.plan} actif</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                Renouvellement : {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR') : '—'}
                {sub.cancelAtPeriodEnd && <span style={{ color: 'var(--red)', marginLeft: 10 }}>· Annulation en cours</span>}
              </div>
            </div>
            {!sub.cancelAtPeriodEnd && (
              <Button variant="danger" onClick={() => {
                if (window.confirm('Annuler l\'abonnement à la fin de la période ?')) {
                  API.post('/billing/cancel').then(() => window.location.reload());
                }
              }}>
                Annuler
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-3">
        {plans.map(plan => (
          <div key={plan.id} className={`plan-card ${plan.featured ? 'featured' : ''}`}
            style={{ background: 'var(--surface)', position: 'relative' }}>
            {plan.featured && <div className="plan-badge">⭐ Recommandé</div>}
            <div style={{ color: plan.color, fontWeight: 800, fontSize: 16 }}>{plan.name}</div>
            <div className="plan-price">{plan.price}</div>
            <div className="plan-period">{plan.period} · Sans engagement</div>
            <ul className="plan-features">
              {plan.features.map((f, i) => (
                <li key={i}>
                  <span style={{ color: plan.color }}>✓</span>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              style={{ width: '100%', justifyContent: 'center', marginTop: 20, opacity: sub?.plan === plan.id ? 0.4 : 1 }}
              disabled={sub?.plan === plan.id || plan.id === 'free'}
              onClick={() => plan.id !== 'free' && handleUpgrade(plan.id)}
            >
              {sub?.plan === plan.id ? '✓ Plan actuel' : plan.id === 'free' ? 'Plan de base' : `Passer à ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>

      <Card title="📊 Comparatif détaillé" style={{ marginTop: 24 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fonctionnalité</th>
              <th>Gratuit</th>
              <th>Family</th>
              <th style={{ color: 'var(--purple)' }}>Premium</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Nombre d\'enfants', '1', '3', '∞'],
              ['Temps d\'écran', '✓', '✓', '✓'],
              ['Blocage d\'apps', '✓', '✓', '✓'],
              ['Filtre web', 'Basique', 'Avancé', 'Avancé'],
              ['Réglages par note', '✗', '✓', '✓'],
              ['Mode école', '✗', '✓', '✓'],
              ['Presets rapides', '✗', '✓', '✓'],
              ['IA Guardian', '✗', '✗', '✓'],
              ['Quiz bonus', '✗', '✗', '✓'],
              ['Rapport IA hebdo', '✗', '✗', '✓'],
            ].map(([feat, f, fam, prem], i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{feat}</td>
                <td style={{ color: f === '✗' ? 'var(--border)' : 'var(--muted)' }}>{f}</td>
                <td style={{ color: fam === '✗' ? 'var(--border)' : 'var(--blue)' }}>{fam}</td>
                <td style={{ color: prem === '✗' ? 'var(--border)' : 'var(--purple)', fontWeight: prem !== '✗' ? 700 : 400 }}>{prem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
