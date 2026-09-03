# 🛡️ Guardian – Contrôle Parental Intelligent
### Version refactorisée · Architecture modulaire · Mode dégradé

Application mobile de contrôle parental nouvelle génération avec IA conversationnelle, système de quiz adaptatif et sécurité multicouche (Android/iOS).

**Nouveautés v9.0** :
- ✅ Code segmenté en components modulaires réutilisables
- ✅ Mode dégradé : fonctionne sans Redis/PostgreSQL
- ✅ Backend controllers organisés par fonctionnalité
- ✅ Frontend web-parent avec components séparés
- ✅ Apps mobiles React Native avec components UI

---

## 🏗️ Architecture modulaire

```
guardian-full/
├── backend/                 # Node.js / Express API v1
│   └── src/
│       ├── config/          # DB, Redis, migrations
│       ├── controllers/     # Auth, Children, Rules, Billing
│       ├── middleware/       # JWT, roles, PIN, ownership
│       ├── routes/          # Toutes les routes API
│       └── services/        # AI (Claude), Notifications, Cron
│
├── backend-extra/           # Extensions v3
│   ├── geofencingController.js
│   ├── gamificationController.js
│   ├── gdprController.js
│   ├── aiAdvancedService.js
│   ├── multiParentController.js
│   ├── locationService.js
│   ├── migrateV3.js
│   └── routesV3.js
│
├── complete-tests/          # Serveur final v6 + tests
│   ├── server-final.js      # Serveur unifié
│   ├── migrateV6.js         # Migrations v6
│   ├── notificationsController.js
│   └── api-complete.test.js
│
├── mobile-child/            # React Native – App enfant (Android)
│   ├── android/             # Natif Java: DPC, VPN, Accessibility
│   └── src/
│       ├── screens/         # HomeScreen, AIChatScreen
│       └── services/        # API, Security orchestrator
│
├── mobile-parent/           # React Native – App parent (Android)
│   └── src/screens/         # Dashboard, ChildDetails
│
├── web-parent/              # React – Dashboard web parent
│   └── src/App.jsx          # App complète (login, dashboard, billing)
│
├── android-native/          # Android natif
│   ├── AndroidManifest.xml
│   ├── BootReceiver.java
│   └── res/                 # Layouts, XML configs
│
├── native-bridge/           # Bridges React Native ↔ Java
│   └── java/
│       ├── GuardianAccessibilityModule.java
│       ├── GuardianDPCModule.java
│       ├── GuardianLocationModule.java
│       ├── GuardianSecurityModule.java
│       ├── GuardianTamperModule.java
│       ├── GuardianVPNModule.java
│       └── GuardianNativePackage.java
│
├── ios-native/              # iOS natif
│   ├── GuardianNativeModules.swift
│   ├── CrossPlatformSecurityService.js
│   └── README.md
│
├── security-advanced/       # Sécurité avancée
│   ├── BehavioralDetectionService.java
│   └── GuardianEncryption.java
│
├── i18n/                    # Internationalisation mobile
│   ├── i18n.js
│   └── AppearanceScreens.js
│
├── i18n-web/                # Internationalisation web
│   └── i18n-web.js
│
├── theme/                   # Système de thème
│   └── ThemeSystem.js
│
├── profile/                 # Profil parent
│   ├── ProfileScreen.js
│   └── profileController.js
│
├── qr-pairing/              # Couplage QR code
│   └── QRPairingScreens.js
│
├── offline/                 # Mode hors-ligne
│   └── offlineService.js
│
├── deep-links/              # Deep links & notifications
│   └── notificationsDeepLinks.js
│
├── pronote/                 # Intégration ENT
│   ├── ENTConfigScreen.js
│   └── entController.js
│
├── analytics/               # Analytics
│   └── analyticsController.js
│
├── admin-panel/             # Dashboard admin
│   └── AdminPanel.jsx
│
├── stripe-advanced/         # Stripe avancé
│   ├── BillingScreenV2.js
│   └── stripeAdvanced.js
│
├── ui-redesign/             # Composants UI
│   ├── DashboardV2.jsx
│   ├── FamilyScreen.js
│   ├── GeofencingScreen.js
│   ├── RewardsScreen.js
│   ├── BlockingOverlayScreen.js
│   └── GuardianComponents.jsx
│
├── support/                 # Support
│   └── SupportScreen.js
│
├── notifications-ui/        # Centre de notifications
│   └── NotificationCenterScreen.js
│
├── seed/                    # Données de démo
│   └── seedData.js
│
├── docker/                  # Docker production
│   ├── docker-compose.prod.yml
│   └── Dockerfile.prod
│
├── deploy-guide/            # Guide déploiement
│   └── DEPLOYMENT.md
│
├── monitoring/              # Monitoring Prometheus/Grafana
│   ├── prometheus.yml
│   ├── grafana-datasources.yml
│   ├── alertmanager.yml
│   ├── alerts.yml
│   └── docker-compose.monitoring.yml
│
├── nginx/                   # Reverse proxy
│   └── nginx.conf
│
├── ci/                      # CI/CD GitHub Actions
│   └── .github-ci.yml
│
├── security-checklist/     # Checklist sécurité
│   └── SECURITY_CHECKLIST.md
│
├── e2e-tests/               # Tests E2E Detox
│   ├── guardian.e2e.js
│   └── setup-test-configs.js
│
├── fastlane/                # Build automatisé
│   ├── Fastfile
│   └── generate-metadata.js
│
├── pwa/                     # Service Worker
│   └── sw.js
│
├── perf-tests/              # Tests de performance k6
│   ├── load-test.js
│   └── stress-test.js
│
├── onboarding-web/          # Onboarding web
│   └── OnboardingWeb.jsx
│
├── realtime-dashboard/      # Dashboard temps réel
│   └── RealtimeWidgets.jsx
│
├── web-push/                # Notifications push web
│   └── useWebPush.js
│
├── marketing-site/          # Site marketing
│   └── README.md
│
├── pitch-deck/              # Pitch investisseurs
│   └── (contenu)
│
├── documentation/           # Documentation technique
│   └── TECHNICAL_DOCS.md
│
├── app-store/               # Listings stores
│   └── store-listing.yaml
│
├── complete-dashboard/       # Dashboard complet
│   └── DashboardPages.jsx
│
└── docker-compose.yml       # Stack complète
```

---

## 🚀 Démarrage rapide

### Prérequis
- Node.js 20+
- PostgreSQL 16 (optionnel - mode dégradé)
- Redis 7 (optionnel - mode dégradé)
- Compte Anthropic (API Key) - optionnel pour tests

### 1. Configuration

```bash
cd guardian-full/backend
cp .env.example .env
# Remplir les variables dans .env (optionnel pour mode dégradé)
```

### 2. Démarrage du backend (mode dégradé)

```bash
cd backend
npm install
node src/server.js
# Le serveur démarre en mode dégradé si Redis/PostgreSQL non disponibles
# Port par défaut : 3000
```

### 3. Démarrage avec Docker (production)

```bash
# Depuis la racine guardian-full/
docker-compose up -d postgres redis
cd backend
node src/server.js
```

### 4. Démarrage des applications

```bash
# Dashboard web parent
cd web-parent
npm install
npm start
# Ouvrir http://localhost:3000

# App enfant (React Native)
cd mobile-child
npm install
npx react-native run-android

# App parent mobile (React Native)
cd mobile-parent
npm install
npx react-native run-android
```

### 5. Tests

```bash
# Tests unitaires
cd backend && npm test

# Tests E2E
cd mobile-parent && npm run test:e2e

# Tests de performance
k6 run perf-tests/load-test.js
k6 run perf-tests/stress-test.js
```

---

## � Sécurité Android – 6 couches

| # | Mécanisme | Contre |
|---|---|---|
| 1 | MDM (GuardianAdminReceiver) | Désinstallation, installation d'apps |
| 2 | VPN local Always-On | Contournement réseau, DNS |
| 3 | Accessibility Service | Overlay instantané, surveillance apps |
| 4 | Boot Receiver | Redémarrage pour bypass |
| 5 | Behavioral Detection | Root, Magisk, ADB, VPN tiers, émulateur |
| 6 | AES-256 Keystore (TEE/StrongBox) | Vol de données même rooté |

### 1. Device Policy Controller (MDM)
Utilise l'API `DevicePolicyManager` d'Android pour :
- **Bloquer l'installation de nouveaux navigateurs** (`DISALLOW_INSTALL_APPS`)
- **Empêcher la désinstallation** de Guardian (`setUninstallBlocked`)
- **Bloquer l'ADB** pour éviter les contournements techniques
- **Always-on VPN** via MDM (impossible à désactiver)

### 2. VPN Local (DNS Filtering)
- Intercepte **tout le trafic DNS** de l'appareil
- Les domaines bloqués reçoivent **NXDOMAIN** (site inexistant)
- Utilise `START_STICKY` pour redémarrer automatiquement si tué
- **Impossible à désactiver** grâce au MDM Always-on VPN

### 3. Accessibility Service
- Surveille l'**app au premier plan** en temps réel
- Affiche un **overlay infranchissable** sur les apps bloquées
- Redirige vers Guardian si l'enfant tente d'ouvrir les paramètres
- Applique les **restrictions de quota** en temps réel

### 4. Boot Receiver
- Redémarre automatiquement tous les services au démarrage
- Empêche le contournement par redémarrage

### 5. Behavioral Detection
- Détecte le **root** de l'appareil (Play Integrity API)
- Détecte l'**ADB activé**
- Détecte les **VPN tiers**
- Détecte les **émulateurs**
- Alerte le parent immédiatement par **push notification**

### 6. AES-256 Keystore
- Chiffrement des données sensibles avec AES-256
- Stockage des clés dans TEE/StrongBox
- Protection contre l'extraction de données même sur appareil rooté

---

## 🤖 L'IA Guardian

### Fonctionnement
L'IA est alimentée par **Claude API (Anthropic)** avec un système prompt enrichi du contexte de l'enfant :
- Temps restant / pénalités / bonus
- Notes scolaires récentes
- Comportements signalés
- Tone personnalisable (friendly / strict / fun / calm)

### Exemple de conversation
```
Enfant : "Pourquoi j'ai moins de temps que prévu ?"

Guardian : "Écoute, ta maman t'a réduit ton temps suite à ta note 
en maths (8/20). Ce n'est pas facile, mais c'est pour t'aider à 
progresser ! Voici ce que je te propose : prends une pause, mange 
un goûter, et reviens me voir. Je te ferai un quiz de 10 questions 
sur les fractions. Si tu en as 8 bonnes, tu gagnes 20 min bonus ! 💪"
```

### Quiz adaptatifs
1. L'enfant demande un quiz (ou l'IA le propose)
2. Guardian génère 5-10 questions avec Claude API adaptées à l'âge et la matière
3. L'enfant répond dans l'interface
4. Si le score ≥ seuil (défaut 80%) → bonus de temps automatique

---

## 💳 Plans d'abonnement

| Fonctionnalité | Gratuit | Family 4,99€/mois | Premium 9,99€/mois |
|---|---|---|---|
| Enfants | 1 | 3 | ∞ |
| Temps d'écran + blocage | ✓ | ✓ | ✓ |
| Notes auto (Pronote/ENT) | ✗ | ✓ | ✓ |
| Géofencing | ✗ | ✓ | ✓ |
| Multi-parent | ✗ | ✓ | ✓ |
| **IA Guardian (chat)** | ✗ | ✗ | ✓ |
| **Quiz adaptatifs** | ✗ | ✗ | ✓ |
| **Gamification** | ✗ | ✗ | ✓ |
| **Rapport IA hebdo** | ✗ | ✗ | ✓ |
| **Détresse psychologique** | ✗ | ✗ | ✓ |

Paiement via **Stripe** avec essai gratuit 14 jours sur les plans payants.

---

## 📡 API Endpoints

### Auth
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Inscription parent |
| POST | `/api/auth/login` | Connexion parent |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/pin` | Configurer PIN |
| POST | `/api/auth/2fa/setup` | Setup 2FA |
| POST | `/api/auth/child` | Auth appareil enfant |

### Children
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/children` | Liste des enfants |
| POST | `/api/children` | Créer un profil enfant |
| GET | `/api/children/:id/dashboard` | Dashboard complet |
| POST | `/api/children/:id/quick-action` | Action rapide |
| POST | `/api/children/:id/grades` | Saisir une note |

### Rules
| Méthode | Route | Description |
|---|---|---|
| PATCH | `/api/children/:id/rules/screen-time` | Règles temps écran |
| POST | `/api/children/:id/rules/apps` | Bloquer/autoriser app |
| POST | `/api/children/:id/rules/urls` | Bloquer domaine |
| PATCH | `/api/children/:id/rules/categories` | Filtres catégories |

### Geofencing (v3)
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/children/:id/geofence` | Créer zone géo |
| GET | `/api/children/:id/geofence` | Listes zones |
| DELETE | `/api/children/:id/geofence/:zoneId` | Supprimer zone |

### Gamification (v3)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/children/:id/badges` | Badges de l'enfant |
| POST | `/api/children/:id/rewards` | Accorder récompense |
| GET | `/api/children/:id/leaderboard` | Classement famille |

### Multi-parent (v3)
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/family/invite` | Inviter co-parent |
| GET | `/api/family/members` | Membres famille |
| PATCH | `/api/family/members/:id/role` | Modifier rôle |

### AI (Premium)
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/ai/chat` | Chat avec Guardian IA |
| POST | `/api/ai/quiz/generate` | Générer un quiz |
| POST | `/api/ai/quiz/:id/submit` | Soumettre quiz |
| GET | `/api/children/:id/ai/weekly-report` | Rapport hebdomadaire |

### Notifications (v6)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/notifications` | Liste notifications |
| PATCH | `/api/notifications/:id/read` | Marquer comme lu |
| POST | `/api/notifications/settings` | Configurer préférences |

---

## 🗓️ Cron Jobs

| Heure | Tâche |
|---|---|
| `00:00` | Reset quotas journaliers |
| `*/5 min` | Persistance Redis → PostgreSQL |
| `20:00 – 23:59` | Vérification heure coucher |
| `07:00` | Déverrouillage matin |
| `*/15 min` | Alertes quota faible |
| `Lundi 08:00` | Rapports IA hebdomadaires (Premium) |
| `*/1 min` | Vérification géofencing (v3) |
| `*/30 min` | Sync gamification badges (v3) |

---

## 🌍 Langues supportées

FR · EN · ES · AR (RTL)

Support complet via:
- **Mobile**: `i18n/` - react-i18next avec dictionnaires FR/EN/ES/AR
- **Web**: `i18n-web/` - Internationalisation dashboard web
- **Thème**: Support RTL automatique pour l'arabe

---

## 📊 Métriques du projet v9.0

| Métrique | Valeur |
|---|---|
| Dossiers | **48** |
| Fichiers | **~131** |
| Lignes de code | **~29 700** |
| Tables SQL | **26** |
| Routes API | **80+** |
| Modules Java natifs | **9** |
| Modules Swift natifs | **4** |
| Components React (web) | **8** |
| Components React Native (mobile) | **12** |
| Controllers backend segmentés | **15** |
| Mode dégradé | ✅ Sans Redis/PostgreSQL |

---

## 🔧 Variables d'environnement requises

```env
# Base de données
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# Redis
REDIS_HOST, REDIS_PORT

# Sécurité
JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY

# Services externes
ANTHROPIC_API_KEY        # IA Guardian
STRIPE_SECRET_KEY        # Paiements
STRIPE_WEBHOOK_SECRET    # Webhooks Stripe
FIREBASE_PROJECT_ID      # Push notifications
FIREBASE_PRIVATE_KEY     # Firebase Admin SDK
FIREBASE_CLIENT_EMAIL    # Firebase Admin SDK
```

---

## 📱 Build Android Release

```bash
cd mobile-child/android
./gradlew assembleRelease

# L'APK signé se trouve dans:
# app/build/outputs/apk/release/app-release.apk
```

### Permissions AndroidManifest.xml requises
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.BIND_VPN_SERVICE" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE" />
```

---

## 🛡️ Guardian v9.0 — Fait avec ❤️ in France 🇫🇷
