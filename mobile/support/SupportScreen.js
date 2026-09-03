import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useApp, api } from '../App';

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT IN-APP – FAQ + Formulaire de contact + Tickets
// ══════════════════════════════════════════════════════════════════════════════

const FAQ_DATA = [
  {
    category: '🔐 Sécurité',
    items: [
      {
        q: 'Mon enfant peut-il désinstaller Guardian ?',
        a: 'Non. Une fois les droits administrateur accordés, Guardian empêche sa propre désinstallation via l\'API DevicePolicyManager d\'Android. L\'enfant ne peut pas désactiver cette protection.',
      },
      {
        q: 'Mon enfant peut-il installer un nouveau navigateur pour contourner les filtres ?',
        a: 'Non. Guardian bloque l\'installation de toute nouvelle application via la restriction DISALLOW_INSTALL_APPS. De plus, le VPN local filtre tout le trafic réseau, rendant les filtres actifs même avec n\'importe quel navigateur déjà installé.',
      },
      {
        q: 'Que se passe-t-il si l\'appareil est redémarré ?',
        a: 'Guardian redémarre automatiquement grâce au Boot Receiver. L\'enfant ne peut pas contourner les restrictions en redémarrant l\'appareil.',
      },
      {
        q: 'Le VPN est-il vraiment impossible à désactiver ?',
        a: 'Oui. Guardian configure le VPN en mode "Always-on" via le MDM (DevicePolicyManager.setAlwaysOnVpnPackage). Cette configuration empêche l\'utilisateur de désactiver le VPN depuis les paramètres.',
      },
    ],
  },
  {
    category: '⏰ Temps d\'écran',
    items: [
      {
        q: 'Comment le quota est-il géré en cas de perte de connexion ?',
        a: 'Guardian conserve un cache local des règles et du quota en cours. Le temps utilisé continue d\'être comptabilisé localement, même sans internet. Les données sont synchronisées à la reconnexion.',
      },
      {
        q: 'Les bonus de quiz s\'accumulent-ils ?',
        a: 'Oui, les bonus s\'ajoutent au quota du jour et peuvent s\'accumuler. Ils sont visibles dans le tableau de bord parent avec le détail : quota de base + bonus − pénalités.',
      },
      {
        q: 'Peut-on définir des règles différentes selon le jour ?',
        a: 'Oui. Vous pouvez définir un quota pour les jours de semaine et un quota différent pour le week-end. Le calendrier hebdomadaire permet aussi de définir des plages horaires précises.',
      },
    ],
  },
  {
    category: '🤖 IA Guardian',
    items: [
      {
        q: 'L\'IA peut-elle mentir à mon enfant ou contourner les règles ?',
        a: 'Non. L\'IA est configurée avec un système prompt strict qui lui interdit formellement de mentir ou de proposer des solutions pour contourner les règles parentales. Elle est conçue pour faciliter le dialogue, pas le contournement.',
      },
      {
        q: 'Mes conversations avec l\'IA sont-elles privées ?',
        a: 'Les conversations sont stockées de façon chiffrée et ne sont visibles que par les parents de l\'enfant (via le dashboard). Elles ne sont jamais partagées avec des tiers.',
      },
      {
        q: 'Comment fonctionne la détection de détresse ?',
        a: 'Guardian analyse le contenu des messages à la recherche de patterns indiquant une détresse psychologique (mots-clés, tournures de phrases). En cas de détection, un parent est alerté immédiatement par notification push.',
      },
    ],
  },
  {
    category: '💳 Abonnement',
    items: [
      {
        q: 'Comment annuler mon abonnement ?',
        a: 'Vous pouvez annuler à tout moment depuis Paramètres → Abonnement → Annuler. L\'abonnement reste actif jusqu\'à la fin de la période payée. Aucun remboursement partiel n\'est effectué.',
      },
      {
        q: 'Le plan gratuit est-il vraiment gratuit ?',
        a: 'Oui, le plan gratuit est illimité dans le temps. Il permet de contrôler 1 enfant avec les fonctionnalités basiques. L\'IA Guardian et la gamification nécessitent le plan Premium.',
      },
    ],
  },
];

// ── FAQ ITEM ──────────────────────────────────────────────────────────────────
const FAQItem = ({ item }) => {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.faqItem, open && styles.faqItemOpen]}
      onPress={() => setOpen(o => !o)}
      activeOpacity={0.8}
    >
      <View style={styles.faqQuestion}>
        <Text style={styles.faqQ}>{item.q}</Text>
        <Text style={[styles.faqArrow, open && styles.faqArrowOpen]}>{open ? '▲' : '▼'}</Text>
      </View>
      {open && <Text style={styles.faqA}>{item.a}</Text>}
    </TouchableOpacity>
  );
};

// ── CONTACT FORM ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'bug',      label: '🐛 Bug technique' },
  { key: 'account',  label: '👤 Compte & facturation' },
  { key: 'security', label: '🔐 Sécurité' },
  { key: 'ai',       label: '🤖 IA Guardian' },
  { key: 'feature',  label: '💡 Suggestion de fonctionnalité' },
  { key: 'other',    label: '❓ Autre' },
];

function ContactForm({ onSubmitted }) {
  const { parent } = useApp();
  const [form, setForm]   = useState({ category: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.category || !form.subject.trim() || !form.message.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    setSending(true);
    try {
      await api.post('/support/ticket', {
        category: form.category,
        subject:  form.subject.trim(),
        message:  form.message.trim(),
        email:    parent?.email,
        plan:     parent?.plan,
      });
      onSubmitted();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le ticket. Réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.contactForm}>
      <Text style={styles.contactTitle}>📩 Contacter le support</Text>
      <Text style={styles.contactSub}>
        Nous répondons sous 24h (48h le week-end) · Plan Premium → 4h
      </Text>

      <Text style={styles.fieldLabel}>Catégorie</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryBtn, form.category === cat.key && styles.categoryBtnActive]}
            onPress={() => setForm(f => ({ ...f, category: cat.key }))}
          >
            <Text style={[styles.categoryText, form.category === cat.key && { color: '#7F77DD' }]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Sujet</Text>
      <TextInput
        style={styles.input}
        value={form.subject}
        onChangeText={v => setForm(f => ({ ...f, subject: v }))}
        placeholder="Décrivez brièvement le problème"
        placeholderTextColor="#444"
        maxLength={100}
      />

      <Text style={styles.fieldLabel}>Message détaillé</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={form.message}
        onChangeText={v => setForm(f => ({ ...f, message: v }))}
        placeholder="Décrivez le problème en détail. Plus vous êtes précis, plus vite nous pourrons vous aider."
        placeholderTextColor="#444"
        multiline
        numberOfLines={6}
        maxLength={2000}
      />
      <Text style={styles.charCount}>{form.message.length}/2000</Text>

      <TouchableOpacity
        style={[styles.sendBtn, sending && { opacity: 0.5 }]}
        onPress={handleSend}
        disabled={sending}
      >
        <LinearGradient colors={['#7F77DD', '#378ADD']} style={styles.sendBtnGradient}>
          {sending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.sendBtnText}>✉️ Envoyer le ticket</Text>
          }
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function SupportScreen({ navigation }) {
  const { parent } = useApp();
  const [tab, setTab]       = useState('faq');  // faq | contact | tickets
  const [tickets, setTickets] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (tab === 'tickets') loadTickets();
  }, [tab]);

  const loadTickets = async () => {
    try {
      const { data } = await api.get('/support/tickets');
      setTickets(data.tickets || []);
    } catch { setTickets([]); }
  };

  const filteredFAQ = FAQ_DATA.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      !search || item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  const TABS = [
    { key: 'faq',     label: 'FAQ' },
    { key: 'contact', label: 'Contact' },
    { key: 'tickets', label: 'Mes tickets' },
  ];

  const STATUS_CONFIG = {
    open:        { label: 'Ouvert',     color: '#378ADD' },
    in_progress: { label: 'En cours',   color: '#BA7517' },
    resolved:    { label: '✓ Résolu',   color: '#1D9E75' },
    closed:      { label: 'Fermé',      color: '#888780' },
  };

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.title}>🎧 Aide & Support</Text>

        {/* Liens rapides */}
        <View style={styles.quickLinks}>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => Linking.openURL('https://docs.guardian-app.com')}
          >
            <Text style={styles.quickLinkIcon}>📖</Text>
            <Text style={styles.quickLinkText}>Documentation</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => Linking.openURL('https://status.guardian-app.com')}
          >
            <Text style={styles.quickLinkIcon}>🟢</Text>
            <Text style={styles.quickLinkText}>Statut des services</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => Linking.openURL('https://guardian-app.com/changelog')}
          >
            <Text style={styles.quickLinkIcon}>🆕</Text>
            <Text style={styles.quickLinkText}>Nouveautés</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => { setTab(t.key); setSubmitted(false); }}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── FAQ ── */}
        {tab === 'faq' && (
          <>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="🔍 Rechercher dans la FAQ..."
              placeholderTextColor="#444"
            />
            {filteredFAQ.map((cat, ci) => (
              <View key={ci} style={styles.faqCategory}>
                <Text style={styles.faqCategoryTitle}>{cat.category}</Text>
                {cat.items.map((item, ii) => <FAQItem key={ii} item={item} />)}
              </View>
            ))}
            {filteredFAQ.length === 0 && search && (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>
                  Aucun résultat pour "{search}". Contactez le support.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── CONTACT ── */}
        {tab === 'contact' && (
          submitted ? (
            <View style={styles.successCard}>
              <Text style={{ fontSize: 56 }}>✅</Text>
              <Text style={styles.successTitle}>Ticket envoyé !</Text>
              <Text style={styles.successSub}>
                Nous vous répondrons sous {parent?.plan === 'premium' ? '4 heures' : '24 heures'} à l\'adresse {parent?.email}.
              </Text>
              <TouchableOpacity style={styles.backToFaqBtn} onPress={() => { setTab('faq'); setSubmitted(false); }}>
                <Text style={styles.backToFaqText}>Consulter la FAQ →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ContactForm onSubmitted={() => setSubmitted(true)} />
          )
        )}

        {/* ── TICKETS ── */}
        {tab === 'tickets' && (
          <>
            {tickets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 44 }}>📭</Text>
                <Text style={styles.emptyTitle}>Aucun ticket</Text>
                <Text style={styles.emptySub}>Vos demandes de support apparaîtront ici.</Text>
              </View>
            ) : (
              tickets.map((ticket, i) => {
                const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                return (
                  <View key={i} style={styles.ticketCard}>
                    <View style={styles.ticketHeader}>
                      <Text style={styles.ticketId}>#{ticket.id?.substring(0, 8)}</Text>
                      <View style={[styles.ticketStatus, { backgroundColor: status.color + '22', borderColor: status.color + '66' }]}>
                        <Text style={[styles.ticketStatusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                    <Text style={styles.ticketDate}>
                      {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </Text>
                    {ticket.reply && (
                      <View style={styles.ticketReply}>
                        <Text style={styles.ticketReplyLabel}>💬 Réponse :</Text>
                        <Text style={styles.ticketReplyText}>{ticket.reply}</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

// ── SUPPORT BACKEND CONTROLLER (léger) ───────────────────────────────────────
// À ajouter dans un fichier supportController.js
/*
exports.createTicket = async (req, res) => {
  const { category, subject, message, email, plan } = req.body;
  const ticketId = require('uuid').v4();
  // Stocke en DB
  await query(
    `INSERT INTO support_tickets (id, parent_id, category, subject, message, status)
     VALUES ($1, $2, $3, $4, $5, 'open')`,
    [ticketId, req.user.id, category, subject, message]
  );
  // Envoie par email (Sendgrid)
  // await sendEmail({ to: 'support@guardian-app.com', subject: `[${category}] ${subject}`, ... });
  res.json({ ticketId, message: 'Ticket créé' });
};
*/

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#7F77DD', fontWeight: '600' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 16 },

  quickLinks: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickLink: { flex: 1, backgroundColor: '#13131f', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#252540', gap: 4 },
  quickLinkIcon: { fontSize: 20 },
  quickLinkText: { color: '#888', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: '#13131f', borderWidth: 1, borderColor: '#252540', alignItems: 'center' },
  tabActive: { borderColor: '#7F77DD', backgroundColor: '#7F77DD18' },
  tabText: { color: '#888', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#7F77DD' },

  searchInput: { backgroundColor: '#13131f', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#252540', marginBottom: 16 },

  faqCategory: { marginBottom: 20 },
  faqCategoryTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 10 },
  faqItem: { backgroundColor: '#13131f', borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: '#252540' },
  faqItemOpen: { borderColor: '#7F77DD44' },
  faqQuestion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  faqQ: { color: '#fff', fontWeight: '600', fontSize: 14, flex: 1, lineHeight: 20 },
  faqArrow: { color: '#555', fontSize: 11, marginTop: 2 },
  faqArrowOpen: { color: '#7F77DD' },
  faqA: { color: '#888', fontSize: 13, lineHeight: 21, marginTop: 12, borderTopWidth: 1, borderTopColor: '#252540', paddingTop: 12 },

  noResults: { alignItems: 'center', paddingVertical: 32 },
  noResultsText: { color: '#888', fontSize: 14, textAlign: 'center' },

  contactForm: { backgroundColor: '#13131f', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#252540' },
  contactTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  contactSub: { color: '#888', fontSize: 12, marginBottom: 20, lineHeight: 18 },

  fieldLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 13, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#252540', marginBottom: 16 },
  inputMultiline: { height: 140, textAlignVertical: 'top' },
  charCount: { color: '#555', fontSize: 11, textAlign: 'right', marginTop: -10, marginBottom: 16 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#252540' },
  categoryBtnActive: { borderColor: '#7F77DD', backgroundColor: '#7F77DD22' },
  categoryText: { color: '#888', fontSize: 12, fontWeight: '600' },

  sendBtn: { borderRadius: 14, overflow: 'hidden' },
  sendBtnGradient: { padding: 16, alignItems: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  successCard: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  successTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  successSub: { color: '#888', textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  backToFaqBtn: { marginTop: 8 },
  backToFaqText: { color: '#7F77DD', fontWeight: '700' },

  ticketCard: { backgroundColor: '#13131f', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#252540' },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ticketId: { color: '#555', fontSize: 11, fontFamily: 'monospace' },
  ticketStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  ticketStatusText: { fontSize: 11, fontWeight: '700' },
  ticketSubject: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  ticketDate: { color: '#555', fontSize: 11 },
  ticketReply: { marginTop: 12, backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#7F77DD' },
  ticketReplyLabel: { color: '#7F77DD', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  ticketReplyText: { color: '#aaa', fontSize: 13, lineHeight: 20 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle: { color: '#888', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#555', fontSize: 13, textAlign: 'center' },
});
