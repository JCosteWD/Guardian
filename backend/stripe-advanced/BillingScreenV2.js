import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Linking, Share,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useApp, api } from '../App';

// ── INVOICE ROW ───────────────────────────────────────────────────────────────
const InvoiceRow = ({ invoice }) => (
  <TouchableOpacity
    style={styles.invoiceRow}
    onPress={() => Linking.openURL(invoice.hostedUrl)}
  >
    <View style={styles.invoiceLeft}>
      <Text style={styles.invoiceNumber}>#{invoice.number}</Text>
      <Text style={styles.invoiceDate}>
        {new Date(invoice.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
      </Text>
    </View>
    <View style={styles.invoiceRight}>
      <Text style={styles.invoiceAmount}>{invoice.amount}€</Text>
      <View style={[
        styles.invoiceStatus,
        { backgroundColor: invoice.status === 'paid' ? '#1D9E7522' : '#E24B4A22' }
      ]}>
        <Text style={[
          styles.invoiceStatusText,
          { color: invoice.status === 'paid' ? '#1D9E75' : '#E24B4A' }
        ]}>
          {invoice.status === 'paid' ? '✓ Payée' : invoice.status}
        </Text>
      </View>
    </View>
    <Text style={styles.invoicePdf}>PDF →</Text>
  </TouchableOpacity>
);

// ── REFERRAL CARD ─────────────────────────────────────────────────────────────
const ReferralCard = ({ code, link, stats }) => {
  const handleShare = async () => {
    await Share.share({
      message: `Essaie Guardian, l'app de contrôle parental avec IA ! 🛡️\nUtilise mon code ${code} pour 1 mois offert : ${link}`,
      url: link,
    });
  };

  return (
    <View style={styles.referralCard}>
      <LinearGradient colors={['#7F77DD22', '#378ADD11']} style={styles.referralGradient}>
        <Text style={styles.referralTitle}>🎁 Programme de parrainage</Text>
        <Text style={styles.referralDesc}>
          Parrainez un ami → vous recevez tous les deux 1 mois offert dès qu'il souscrit à un plan payant.
        </Text>

        <View style={styles.referralCodeWrap}>
          <Text style={styles.referralCodeLabel}>Votre code</Text>
          <View style={styles.referralCode}>
            <Text style={styles.referralCodeText}>{code}</Text>
          </View>
        </View>

        <View style={styles.referralStats}>
          <View style={styles.referralStat}>
            <Text style={styles.referralStatVal}>{stats?.converted_count || 0}</Text>
            <Text style={styles.referralStatLabel}>Filleuls</Text>
          </View>
          <View style={styles.referralStat}>
            <Text style={styles.referralStatVal}>{stats?.rewarded_count || 0}</Text>
            <Text style={styles.referralStatLabel}>Mois offerts</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <LinearGradient colors={['#7F77DD', '#378ADD']} style={styles.shareBtnGradient}>
            <Text style={styles.shareBtnText}>📤 Partager mon code</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function BillingScreenV2({ navigation }) {
  const { parent } = useApp();
  const [sub, setSub]             = useState(null);
  const [invoices, setInvoices]   = useState([]);
  const [referral, setReferral]   = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoInfo, setPromoInfo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [subRes, invRes, refCodeRes, refStatsRes] = await Promise.all([
        api.get('/billing/subscription').catch(() => ({ data: { plan: 'free' } })),
        api.get('/billing/invoices').catch(() => ({ data: { invoices: [] } })),
        api.get('/referral/code').catch(() => ({ data: null })),
        api.get('/referral/stats').catch(() => ({ data: null })),
      ]);
      setSub(subRes.data);
      setInvoices(invRes.data.invoices || []);
      if (refCodeRes.data && refStatsRes.data) {
        setReferral({ ...refCodeRes.data, stats: refStatsRes.data.stats });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const { data } = await api.post('/billing/promo/validate', { code: promoCode });
      setPromoInfo(data);
    } catch (err) {
      Alert.alert('❌', err.response?.data?.error || 'Code invalide');
      setPromoInfo(null);
    } finally { setPromoLoading(false); }
  };

  const handleOpenPortal = async () => {
    try {
      const { data } = await api.post('/billing/portal');
      await Linking.openURL(data.url);
    } catch { Alert.alert('Erreur', 'Impossible d\'ouvrir le portail de facturation.'); }
  };

  const TABS = [
    { key: 'overview', label: 'Abonnement' },
    { key: 'invoices', label: 'Factures' },
    { key: 'referral', label: 'Parrainage' },
  ];

  const PLANS = [
    { id:'free',    name:'Gratuit',       price:'0€',     color:'#888780' },
    { id:'family',  name:'Family',        price:'4,99€',  color:'#378ADD' },
    { id:'premium', name:'Premium + IA',  price:'9,99€',  color:'#7F77DD' },
  ];

  const currentPlan = PLANS.find(p => p.id === (sub?.plan || 'free'));

  return (
    <LinearGradient colors={['#0a0a12', '#1a1a2e']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💎 Abonnement & Facturation</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#7F77DD" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <>
                {/* Plan actuel */}
                <View style={[styles.planCurrent, { borderColor: currentPlan?.color + '44' }]}>
                  <Text style={styles.planCurrentLabel}>Plan actuel</Text>
                  <Text style={[styles.planCurrentName, { color: currentPlan?.color }]}>
                    {currentPlan?.name}
                  </Text>
                  {sub?.currentPeriodEnd && sub?.plan !== 'free' && (
                    <Text style={styles.planRenewal}>
                      Renouvellement : {new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')}
                    </Text>
                  )}
                  {sub?.cancelAtPeriodEnd && (
                    <Text style={styles.planCanceled}>⚠️ Annulation programmée à la fin de la période</Text>
                  )}
                </View>

                {/* Code promo */}
                <View style={styles.promoSection}>
                  <Text style={styles.promoTitle}>🏷️ Code promotionnel</Text>
                  <View style={styles.promoRow}>
                    <TextInput
                      style={styles.promoInput}
                      value={promoCode}
                      onChangeText={setPromoCode}
                      placeholder="Entrez votre code"
                      placeholderTextColor="#444"
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={[styles.promoBtn, promoLoading && { opacity: 0.5 }]}
                      onPress={handleValidatePromo}
                      disabled={promoLoading}
                    >
                      {promoLoading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.promoBtnText}>Valider</Text>
                      }
                    </TouchableOpacity>
                  </View>
                  {promoInfo && (
                    <View style={styles.promoSuccess}>
                      <Text style={styles.promoSuccessText}>✅ {promoInfo.description}</Text>
                    </View>
                  )}
                </View>

                {/* Plans disponibles */}
                <Text style={styles.sectionTitle}>Changer de plan</Text>
                {PLANS.filter(p => p.id !== 'free').map(plan => (
                  <TouchableOpacity
                    key={plan.id}
                    style={[
                      styles.planCard,
                      { borderColor: plan.color + '33' },
                      sub?.plan === plan.id && { borderColor: plan.color, backgroundColor: plan.color + '11' },
                    ]}
                    onPress={() => navigation.navigate('Subscription')}
                    disabled={sub?.plan === plan.id}
                  >
                    <Text style={[styles.planCardName, { color: plan.color }]}>{plan.name}</Text>
                    <View style={{ flexDirection:'row', alignItems:'baseline', gap:4 }}>
                      <Text style={styles.planCardPrice}>{plan.price}</Text>
                      <Text style={styles.planCardPeriod}>/mois</Text>
                    </View>
                    {sub?.plan === plan.id
                      ? <Text style={[styles.planCardBtn, { color: plan.color }]}>✓ Actif</Text>
                      : <Text style={[styles.planCardBtn, { color: plan.color }]}>Choisir →</Text>
                    }
                  </TouchableOpacity>
                ))}

                {/* Portail Stripe */}
                {sub?.plan !== 'free' && (
                  <TouchableOpacity style={styles.portalBtn} onPress={handleOpenPortal}>
                    <Text style={styles.portalBtnText}>⚙️ Gérer l'abonnement (portail Stripe)</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* ── INVOICES ── */}
            {activeTab === 'invoices' && (
              <>
                {invoices.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={{ fontSize: 44 }}>🧾</Text>
                    <Text style={styles.emptyTitle}>Aucune facture</Text>
                    <Text style={styles.emptySub}>Vos factures apparaîtront ici après le premier paiement.</Text>
                  </View>
                ) : (
                  <View style={styles.invoiceList}>
                    {invoices.map((inv, i) => <InvoiceRow key={i} invoice={inv} />)}
                  </View>
                )}
              </>
            )}

            {/* ── REFERRAL ── */}
            {activeTab === 'referral' && referral && (
              <ReferralCard code={referral.code} link={referral.link} stats={referral.stats} />
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingTop: 56 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#7F77DD', fontWeight: '600' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 20 },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: '#13131f', borderWidth: 1, borderColor: '#252540', alignItems: 'center' },
  tabActive: { borderColor: '#7F77DD', backgroundColor: '#7F77DD18' },
  tabText: { color: '#888', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#7F77DD' },

  planCurrent: { backgroundColor: '#13131f', borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 16 },
  planCurrentLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  planCurrentName: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  planRenewal: { color: '#555', fontSize: 12 },
  planCanceled: { color: '#E24B4A', fontSize: 12, marginTop: 4 },

  promoSection: { backgroundColor: '#13131f', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#252540', marginBottom: 16 },
  promoTitle: { color: '#fff', fontWeight: '700', marginBottom: 12 },
  promoRow: { flexDirection: 'row', gap: 10 },
  promoInput: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#252540', letterSpacing: 2 },
  promoBtn: { backgroundColor: '#7F77DD', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  promoBtnText: { color: '#fff', fontWeight: '700' },
  promoSuccess: { marginTop: 10, backgroundColor: '#1D9E7522', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#1D9E7533' },
  promoSuccessText: { color: '#1D9E75', fontWeight: '600', fontSize: 13 },

  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  planCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13131f', borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 10 },
  planCardName: { fontWeight: '800', fontSize: 15, flex: 1 },
  planCardPrice: { color: '#fff', fontSize: 18, fontWeight: '900' },
  planCardPeriod: { color: '#888', fontSize: 11 },
  planCardBtn: { fontWeight: '700', marginLeft: 10 },

  portalBtn: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#252540', marginTop: 8 },
  portalBtnText: { color: '#888', fontWeight: '600' },

  invoiceList: { gap: 1 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#13131f', borderRadius: 12, marginBottom: 6 },
  invoiceLeft: { flex: 1 },
  invoiceNumber: { color: '#fff', fontWeight: '700', fontSize: 13 },
  invoiceDate: { color: '#888', fontSize: 11, marginTop: 2 },
  invoiceRight: { alignItems: 'flex-end', marginRight: 12 },
  invoiceAmount: { color: '#fff', fontWeight: '800', fontSize: 16 },
  invoiceStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  invoiceStatusText: { fontSize: 10, fontWeight: '800' },
  invoicePdf: { color: '#7F77DD', fontSize: 12, fontWeight: '600' },

  referralCard: { borderRadius: 20, overflow: 'hidden' },
  referralGradient: { padding: 22, borderWidth: 1, borderColor: '#7F77DD33', borderRadius: 20 },
  referralTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  referralDesc: { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  referralCodeWrap: { alignItems: 'center', marginBottom: 20 },
  referralCodeLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  referralCode: { backgroundColor: '#13131f', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, borderWidth: 2, borderColor: '#7F77DD55' },
  referralCodeText: { color: '#7F77DD', fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  referralStats: { flexDirection: 'row', gap: 20, justifyContent: 'center', marginBottom: 20 },
  referralStat: { alignItems: 'center' },
  referralStatVal: { color: '#fff', fontSize: 24, fontWeight: '900' },
  referralStatLabel: { color: '#888', fontSize: 12, marginTop: 2 },
  shareBtn: { borderRadius: 14, overflow: 'hidden' },
  shareBtnGradient: { padding: 15, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle: { color: '#888', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#555', fontSize: 13, textAlign: 'center', maxWidth: 280 },
});
