import React, { useState, useEffect, useRef } from 'react';

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Onboarding interactif (Dashboard Web)
// ══════════════════════════════════════════════════════════════════════════════
// Équivalent web de OnboardingScreen.js (mobile).
// S'affiche au premier login du dashboard web.

const STEPS = [
  {
    key: 'welcome',
    icon: '🛡️',
    title: 'Bienvenue sur Guardian',
    subtitle: 'Votre espace de contrôle parental centralisé',
    content: 'welcome',
  },
  {
    key: 'add-child',
    icon: '👶',
    title: 'Ajoutez votre premier enfant',
    subtitle: 'Quelques infos pour personnaliser l\'expérience',
    content: 'form',
  },
  {
    key: 'pair-device',
    icon: '📱',
    title: 'Couplez l\'appareil',
    subtitle: 'Installez Guardian Enfant et scannez le QR code',
    content: 'pairing',
  },
  {
    key: 'rules',
    icon: '⏰',
    title: 'Définissez les premières règles',
    subtitle: 'Vous pourrez tout ajuster plus tard',
    content: 'rules',
  },
  {
    key: 'done',
    icon: '🎉',
    title: 'Tout est prêt !',
    subtitle: 'Guardian protège maintenant votre famille',
    content: 'done',
  },
];

const COLORS = ['#7F77DD', '#378ADD', '#1D9E75', '#BA7517', '#E24B4A', '#D85A30', '#CC5DE8', '#20C997'];

// ── PROGRESS DOTS ──────────────────────────────────────────────────────────────
function ProgressDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 28 : 8, height: 8, borderRadius: 4,
          background: i <= current ? 'linear-gradient(90deg, #7F77DD, #378ADD)' : '#252550',
          transition: 'all .3s ease',
        }} />
      ))}
    </div>
  );
}

// ── STEP CONTENT: WELCOME ─────────────────────────────────────────────────────
function WelcomeContent() {
  const features = [
    { icon: '🔒', text: 'Sécurité Android infranchissable' },
    { icon: '🤖', text: 'IA bienveillante qui dialogue avec votre enfant' },
    { icon: '📝', text: 'Notes scolaires → ajustement automatique' },
    { icon: '🏆', text: 'Gamification pour motiver sans frustrer' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420, margin: '0 auto' }}>
      {features.map((f, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: '#13131f', border: '1px solid #252550', borderRadius: 14, padding: '14px 18px',
          animation: `slideIn .4s ease ${i * 0.1}s both`,
        }}>
          <span style={{ fontSize: 22 }}>{f.icon}</span>
          <span style={{ fontSize: 14, color: '#F0F0FA', fontWeight: 600 }}>{f.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── STEP CONTENT: ADD CHILD FORM ──────────────────────────────────────────────
function AddChildContent({ form, setForm }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left' }}>
      <label style={{ fontSize: 12, color: '#888780', fontWeight: 600, display: 'block', marginBottom: 8 }}>
        Prénom de l'enfant
      </label>
      <input
        value={form.firstName}
        onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
        placeholder="Ex: Lucas"
        autoFocus
        style={{
          width: '100%', padding: '14px 16px', background: '#1a1a2e',
          border: '1px solid #252550', borderRadius: 12, color: '#fff',
          fontSize: 16, outline: 'none', marginBottom: 20,
        }}
      />

      <label style={{ fontSize: 12, color: '#888780', fontWeight: 600, display: 'block', marginBottom: 8 }}>
        Âge : {form.age} ans
      </label>
      <input
        type="range" min="3" max="18" value={form.age}
        onChange={e => setForm(f => ({ ...f, age: parseInt(e.target.value) }))}
        style={{ width: '100%', marginBottom: 20, accentColor: '#7F77DD' }}
      />

      <label style={{ fontSize: 12, color: '#888780', fontWeight: 600, display: 'block', marginBottom: 8 }}>
        Couleur de l'avatar
      </label>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 8 }}>
        {COLORS.map(c => (
          <div
            key={c}
            onClick={() => setForm(f => ({ ...f, avatarColor: c }))}
            style={{
              width: 32, height: 32, borderRadius: '50%', backgroundColor: c, cursor: 'pointer',
              border: form.avatarColor === c ? '3px solid #fff' : '2px solid transparent',
              transform: form.avatarColor === c ? 'scale(1.15)' : 'scale(1)',
              transition: 'all .15s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── STEP CONTENT: PAIRING ─────────────────────────────────────────────────────
function PairingContent({ pairingCode, childName }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{
        background: '#13131f', border: '2px solid #7F77DD44', borderRadius: 20,
        padding: 32, marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, color: '#888780', marginBottom: 12 }}>Code de couplage</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {(pairingCode || 'XXXXXX').split('').map((c, i) => (
            <div key={i} style={{
              width: 42, height: 50, background: '#1a1a2e', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, color: '#7F77DD', border: '1.5px solid #7F77DD55',
            }}>
              {c}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
        {[
          `Installez "Guardian Enfant" sur l'appareil de ${childName || 'votre enfant'}`,
          'Ouvrez l\'app → Appuyez sur "Entrer le code manuellement"',
          'Saisissez le code ci-dessus',
          'Acceptez toutes les permissions demandées',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 12, background: '#7F77DD22',
              border: '1px solid #7F77DD', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#7F77DD', flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 13, color: '#aaa' }}>{step}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#555', marginTop: 16 }}>
        💡 Vous pouvez aussi terminer ce couplage plus tard depuis le dashboard.
      </p>
    </div>
  );
}

// ── STEP CONTENT: RULES ───────────────────────────────────────────────────────
function RulesContent({ rules, setRules }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left' }}>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 12, color: '#888780', fontWeight: 600, display: 'block', marginBottom: 10 }}>
          Temps d'écran quotidien : {rules.dailyLimit} min
        </label>
        <input
          type="range" min="30" max="300" step="15" value={rules.dailyLimit}
          onChange={e => setRules(r => ({ ...r, dailyLimit: parseInt(e.target.value) }))}
          style={{ width: '100%', accentColor: '#7F77DD' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginTop: 4 }}>
          <span>30 min</span><span>5h</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#13131f', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: '1px solid #252550' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>🌙 Heure du coucher</div>
          <div style={{ fontSize: 12, color: '#888780' }}>Bloque l'appareil automatiquement</div>
        </div>
        <input
          type="time" value={rules.bedtime}
          onChange={e => setRules(r => ({ ...r, bedtime: e.target.value }))}
          style={{ background: '#1a1a2e', border: '1px solid #252550', borderRadius: 8, padding: '6px 10px', color: '#fff' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#13131f', borderRadius: 12, padding: '14px 16px', border: '1px solid #252550' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>📚 Mode école</div>
          <div style={{ fontSize: 12, color: '#888780' }}>Bloque tout de 8h à 17h en semaine</div>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
          <input
            type="checkbox" checked={rules.schoolMode}
            onChange={e => setRules(r => ({ ...r, schoolMode: e.target.checked }))}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', inset: 0, background: rules.schoolMode ? '#7F77DD' : '#252550',
            borderRadius: 12, transition: '.2s', cursor: 'pointer',
          }} onClick={() => setRules(r => ({ ...r, schoolMode: !r.schoolMode }))}>
            <span style={{
              position: 'absolute', height: 18, width: 18, left: rules.schoolMode ? 23 : 3, bottom: 3,
              background: '#fff', borderRadius: '50%', transition: '.2s',
            }} />
          </span>
        </label>
      </div>
    </div>
  );
}

// ── STEP CONTENT: DONE ────────────────────────────────────────────────────────
function DoneContent({ childName }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ fontSize: 64, marginBottom: 20, animation: 'bounce 1s ease infinite' }}>🎉</div>
      <p style={{ color: '#aaa', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
        Le profil de <strong style={{ color: '#7F77DD' }}>{childName || 'votre enfant'}</strong> est configuré.
        Vous pouvez maintenant explorer le tableau de bord et ajuster les règles à tout moment.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
        {[
          '💎 Découvrez les plans Family et Premium',
          '🤖 Activez l\'IA Guardian pour dialoguer avec votre enfant',
          '👨‍👩‍👧 Invitez l\'autre parent depuis Famille',
        ].map((tip, i) => (
          <div key={i} style={{ background: '#13131f', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ccc', border: '1px solid #252550' }}>
            {tip}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ONBOARDING COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function OnboardingWeb({ onComplete, api }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ firstName: '', age: 10, avatarColor: '#7F77DD' });
  const [rules, setRules] = useState({ dailyLimit: 120, bedtime: '21:00', schoolMode: true });
  const [pairingCode, setPairingCode] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;
  const isFirst = step === 0;

  const canProceed = () => {
    if (current.key === 'add-child') return form.firstName.trim().length > 0;
    return true;
  };

  const handleNext = async () => {
    setError('');

    // Création de l'enfant à la fin de l'étape "add-child"
    if (current.key === 'add-child') {
      setCreating(true);
      try {
        const { data } = await api.post('/children', {
          firstName: form.firstName.trim(),
          age: form.age,
          avatarColor: form.avatarColor,
        });
        setPairingCode(data.pairingCode);
        setStep(s => s + 1);
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors de la création du profil');
      } finally {
        setCreating(false);
      }
      return;
    }

    // Sauvegarde des règles à la fin de l'étape "rules"
    if (current.key === 'rules') {
      try {
        // Les règles seront appliquées au premier enfant créé
        await api.patch(`/children/latest/rules/screen-time`, {
          dailyLimitMins: rules.dailyLimit,
          bedtimeStart: rules.bedtime,
          schoolModeEnabled: rules.schoolMode,
        }).catch(() => {}); // Non bloquant
      } catch {}
      setStep(s => s + 1);
      return;
    }

    if (isLast) {
      onComplete?.();
      return;
    }

    setStep(s => s + 1);
  };

  const handleBack = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  const handleSkip = () => {
    onComplete?.();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(127,119,221,.12), #080810 60%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateY(10px);} to {opacity:1; transform:translateY(0);} }
        @keyframes bounce { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-10px);} }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 540, background: '#0f0f1a',
        border: '1px solid #252550', borderRadius: 28, padding: '48px 40px',
        textAlign: 'center', position: 'relative',
      }}>
        {/* Skip button */}
        {!isLast && (
          <button onClick={handleSkip} style={{
            position: 'absolute', top: 20, right: 24, background: 'none', border: 'none',
            color: '#555', fontSize: 13, cursor: 'pointer', fontWeight: 600,
          }}>
            Passer →
          </button>
        )}

        <ProgressDots current={step} total={STEPS.length} />

        <div style={{ fontSize: 48, marginBottom: 16 }}>{current.icon}</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 6 }}>{current.title}</h2>
        <p style={{ fontSize: 14, color: '#888780', marginBottom: 32 }}>{current.subtitle}</p>

        {/* Step content */}
        <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {current.content === 'welcome' && <WelcomeContent />}
          {current.content === 'form'    && <AddChildContent form={form} setForm={setForm} />}
          {current.content === 'pairing' && <PairingContent pairingCode={pairingCode} childName={form.firstName} />}
          {current.content === 'rules'   && <RulesContent rules={rules} setRules={setRules} />}
          {current.content === 'done'    && <DoneContent childName={form.firstName} />}
        </div>

        {error && (
          <div style={{ color: '#E24B4A', fontSize: 13, marginTop: 16, background: '#E24B4A11', borderRadius: 8, padding: 10 }}>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 36 }}>
          {!isFirst && (
            <button onClick={handleBack} style={{
              flex: 1, padding: '14px', borderRadius: 14, background: '#1a1a2e',
              border: '1px solid #252550', color: '#888780', fontWeight: 700, cursor: 'pointer', fontSize: 14,
            }}>
              ← Retour
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || creating}
            style={{
              flex: 2, padding: '14px', borderRadius: 14, border: 'none',
              background: canProceed() ? 'linear-gradient(135deg, #7F77DD, #378ADD)' : '#252550',
              color: '#fff', fontWeight: 800, fontSize: 14,
              cursor: canProceed() && !creating ? 'pointer' : 'not-allowed',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Création...' : isLast ? '🚀 Accéder au dashboard' : 'Continuer →'}
          </button>
        </div>
      </div>
    </div>
  );
}
