import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions, Easing, StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

// ── SHIELD ANIMATION ──────────────────────────────────────────────────────────
const AnimatedShield = ({ color, size = 80 }) => {
  const scaleAnim  = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ringAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrée
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Pulsation continue
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const ringScale   = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.1, 0] });

  return (
    <Animated.View style={[styles.shieldWrap, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Pulse rings */}
      {[0, 400, 800].map((delay, i) => (
        <Animated.View key={i} style={[
          styles.pulseRing,
          {
            width: size * 2.2, height: size * 2.2,
            borderRadius: size * 1.1,
            borderColor: color,
            transform: [{ scale: ringAnim.interpolate({ inputRange: [0,1], outputRange:[1, 1.8 + i*0.3] }) }],
            opacity: ringAnim.interpolate({ inputRange:[0,.5,1], outputRange:[0.3-i*0.08, 0.1, 0] }),
          }
        ]} />
      ))}
      {/* Icon */}
      <View style={[styles.shieldIcon, { width: size, height: size, borderRadius: size/2, backgroundColor: color + '22', borderColor: color }]}>
        <Text style={{ fontSize: size * 0.5 }}>🛡️</Text>
      </View>
    </Animated.View>
  );
};

// ── FLOATING PARTICLES ────────────────────────────────────────────────────────
const Particle = ({ color, delay }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const x = useRef(Math.random() * width).current;
  const size = useRef(2 + Math.random() * 4).current;
  const duration = useRef(3000 + Math.random() * 4000).current;

  useEffect(() => {
    const start = () => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1, duration,
        delay: delay || 0,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => start());
    };
    start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      left: x,
      width: size, height: size,
      borderRadius: size/2,
      backgroundColor: color,
      opacity: anim.interpolate({ inputRange:[0,.5,1], outputRange:[0,0.6,0] }),
      transform: [{
        translateY: anim.interpolate({ inputRange:[0,1], outputRange:[height, -40] })
      }],
    }} />
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// BLOCKING OVERLAY SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export default function BlockingOverlayScreen({
  type = 'quota',        // 'quota' | 'locked' | 'blocked_app' | 'bedtime' | 'school'
  childName = '',
  appName = '',
  reason = '',
  remainingMins = 0,
  bonusMins = 0,
  onOpenGuardian,
}) {
  const [countdown, setCountdown] = useState(null);
  const slideAnim    = useRef(new Animated.Value(50)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const btnScaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    // Bouton pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(btnScaleAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }),
        Animated.timing(btnScaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const CONFIG = {
    quota: {
      icon: '⏰',
      color: '#E24B4A',
      gradient: ['#1a0808', '#2d1010', '#1a0808'],
      title: 'Temps écoulé !',
      message: `${childName}, tu as utilisé tout ton temps d'écran pour aujourd'hui !`,
      ctaLabel: '🛡️ Parler à Guardian',
      ctaSub: 'Guardian peut te proposer un quiz pour gagner du temps bonus',
    },
    locked: {
      icon: '🔒',
      color: '#7F77DD',
      gradient: ['#0a0818', '#12102a', '#0a0818'],
      title: 'Accès restreint',
      message: reason || 'Tes parents ont restreint l\'accès à cet appareil.',
      ctaLabel: '🛡️ Pourquoi ? Demander à Guardian',
      ctaSub: 'Guardian peut t\'expliquer et t\'aider',
    },
    blocked_app: {
      icon: '🚫',
      color: '#E24B4A',
      gradient: ['#1a0808', '#2d0f0f', '#1a0808'],
      title: `${appName} bloquée`,
      message: 'Tes parents ont décidé de bloquer cette application.',
      ctaLabel: '🛡️ Comprendre avec Guardian',
      ctaSub: 'Guardian peut expliquer la raison et t\'aider',
    },
    bedtime: {
      icon: '🌙',
      color: '#378ADD',
      gradient: ['#080818', '#0f1030', '#080818'],
      title: 'Bonne nuit !',
      message: `${childName}, c'est l'heure de dormir. L'appareil sera disponible demain matin.`,
      ctaLabel: null,
      ctaSub: 'Dors bien ! 😴',
    },
    school: {
      icon: '📚',
      color: '#1D9E75',
      gradient: ['#080f0f', '#0e2020', '#080f0f'],
      title: 'Mode école activé',
      message: 'Concentre-toi sur tes cours ! L\'appareil sera disponible après l\'école.',
      ctaLabel: '📝 Accéder aux apps scolaires',
      ctaSub: 'Certaines applications éducatives restent accessibles',
    },
  };

  const cfg = CONFIG[type] || CONFIG.quota;
  const particles = Array.from({ length: 12 }, (_, i) => ({ id: i, delay: i * 300 }));

  return (
    <LinearGradient colors={cfg.gradient} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Particles flottantes */}
      {particles.map(p => (
        <Particle key={p.id} color={cfg.color} delay={p.delay} />
      ))}

      <Animated.View style={[
        styles.content,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>

        {/* Shield animé */}
        <AnimatedShield color={cfg.color} size={90} />

        {/* Titre */}
        <Text style={[styles.title, { color: cfg.color }]}>{cfg.icon} {cfg.title}</Text>

        {/* Message */}
        <Text style={styles.message}>{cfg.message}</Text>

        {/* Quota info */}
        {type === 'quota' && bonusMins === 0 && (
          <View style={[styles.infoPill, { borderColor: cfg.color + '44', backgroundColor: cfg.color + '11' }]}>
            <Text style={[styles.infoPillText, { color: cfg.color }]}>
              🔓 Tu pourras accéder à l'appareil demain matin
            </Text>
          </View>
        )}

        {/* Bonus disponible */}
        {type === 'quota' && (
          <View style={[styles.quizBanner]}>
            <LinearGradient colors={['#7F77DD22', '#378ADD22']} style={styles.quizBannerGradient}>
              <Text style={styles.quizBannerIcon}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.quizBannerTitle}>Tu veux plus de temps ?</Text>
                <Text style={styles.quizBannerSub}>Guardian peut te proposer un quiz ! Réussis-le pour gagner jusqu'à 30 min bonus.</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* CTA principal */}
        {cfg.ctaLabel && (
          <Animated.View style={{ transform: [{ scale: btnScaleAnim }], width: '100%' }}>
            <TouchableOpacity onPress={onOpenGuardian} style={styles.ctaBtn}>
              <LinearGradient
                colors={[cfg.color, cfg.color + 'BB']}
                style={styles.ctaBtnGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaBtnText}>{cfg.ctaLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Sous-texte */}
        <Text style={styles.ctaSub}>{cfg.ctaSub}</Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>🛡️ Guardian · Protégé par tes parents</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: {
    alignItems: 'center', paddingHorizontal: 32, width: '100%',
  },

  shieldWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 28, height: 140 },
  pulseRing: { position: 'absolute', borderWidth: 1 },
  shieldIcon: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  title: { fontSize: 26, fontWeight: '900', marginBottom: 14, textAlign: 'center' },
  message: {
    fontSize: 15, color: '#aaa', textAlign: 'center',
    lineHeight: 24, marginBottom: 20, paddingHorizontal: 8,
  },

  infoPill: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, marginBottom: 20,
  },
  infoPillText: { fontSize: 12, fontWeight: '600' },

  quizBanner: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  quizBannerGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  quizBannerIcon: { fontSize: 28 },
  quizBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 3 },
  quizBannerSub: { color: '#aaa', fontSize: 12, lineHeight: 17 },

  ctaBtn: { width: '100%', borderRadius: 18, overflow: 'hidden', marginBottom: 12 },
  ctaBtnGradient: { padding: 18, alignItems: 'center' },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  ctaSub: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 32 },

  footer: { position: 'absolute', bottom: -60 },
  footerText: { color: '#333', fontSize: 11 },
});
