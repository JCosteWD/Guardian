# 🛡️ Guardian – Contrôle Parental Intelligent
### Version v11.0 · Structure 3 Dossiers · Backend + Web + Mobile

Application mobile de contrôle parental nouvelle génération avec IA conversationnelle, système de quiz adaptatif et sécurité multicouche (Android/iOS/Web).

---

## 🏗️ Architecture Simplifiée - 3 Dossiers Principaux

```
guardian-full/
├── 📁 backend/                    # API Node.js/Express + Infrastructure Backend
│   ├── src/
│   │   ├── config/                # Database, Redis, migrations
│   │   ├── controllers/           # Auth, Children, Rules, Billing (segmentés)
│   │   ├── middleware/            # JWT, roles, PIN, ownership
│   │   ├── routes/                # Routes API v1
│   │   ├── services/              # AI (Claude), Notifications, Cron
│   │   └── common/                # Code partagé backend (types, utils)
│   ├── config/                    # Infrastructure backend (docker, ci, monitoring)
│   ├── docs/                      # Documentation backend
│   ├── tests/                     # Tests backend (e2e, perf, complete)
│   ├── seed/                      # Données de démo
│   ├── analytics/                 # Analytics backend
│   ├── nginx/                     # Reverse proxy
│   ├── deploy-guide/              # Guide déploiement
│   ├── stripe-advanced/           # Stripe avancé
│   ├── security-advanced/         # Sécurité avancée
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
│
├── 📁 web/                        # Application React Dashboard parent + UI Web
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/            # Components UI réutilisables
│   │   │   ├── layout/            # Layout components
│   │   │   ├── pages/             # Pages
│   │   │   ├── api.js             # Client API
│   │   │   └── context.jsx        # Context global
│   │   └── common/                # Code partagé web (i18n, theme, types)
│   ├── admin-panel/               # Dashboard admin
│   ├── complete-dashboard/        # Dashboard complet
│   ├── ui-redesign/               # Composants UI redesign
│   ├── realtime-dashboard/        # Dashboard temps réel
│   ├── onboarding-web/            # Onboarding web
│   ├── notifications-ui/          # Centre de notifications
│   ├── web-push/                  # Notifications push web
│   ├── pwa/                       # Service Worker
│   └── package.json
│
├── 📁 mobile/                     # Applications React Native + Mobile
│   ├── android/
│   │   ├── child/                  # App enfant Android
│   │   │   ├── src/
│   │   │   │   ├── components/
│   │   │   │   ├── screens/
│   │   │   │   └── services/
│   │   │   ├── android/           # Natif Java
│   │   │   └── package.json
│   │   └── parent/                # App parent Android
│   │       ├── src/
│   │       │   ├── components/
│   │       │   └── screens/
│   │       └── package.json
│   ├── ios/                       # Apps iOS
│   │   ├── src/
│   │   ├── ios/                    # Natif Swift
│   │   └── package.json
│   ├── native/                    # Modules natifs partagés
│   │   ├── android/               # Java natifs
│   │   └── ios/                   # Swift natifs
│   ├── common/                    # Code partagé mobile (i18n, theme, types)
│   ├── profile/                   # Profil parent
│   ├── pronote/                   # Intégration ENT
│   ├── qr-pairing/                # Couplage QR code
│   ├── offline/                   # Mode hors-ligne
│   ├── deep-links/                # Deep links & notifications
│   ├── support/                   # Support
│   ├── app-store/                 # Listings stores
│   ├── fastlane/                  # Build automatisé
│   └── e2e-tests/                 # Tests E2E mobile
│
├── docker-compose.yml
└── README.md
```

---

## 🎯 Différenciation des supports

### 🖥️ Web (`web/`)
- **Framework** : React
- **Usage** : Dashboard parent pour gestion complète
- **Accès** : Navigateur desktop/mobile
- **Fonctionnalités** : Gestion enfants, règles, facturation, analytics

### 📱 Android (`mobile/android/`)
- **Framework** : React Native
- **Apps** : `child/` (enfant) + `parent/` (parent)
- **Sécurité** : 6 couches (MDM, VPN, Accessibility, Boot, Behavioral, Encryption)
- **Natif** : Java pour DPC, VPN, Accessibility Service

### 🍎 iOS (`mobile/ios/`)
- **Framework** : React Native
- **Apps** : Enfant + Parent
- **Sécurité** : Screen Time API, MDM, VPN
- **Natif** : Swift pour modules natifs

### 🔧 Backend (`backend/`)
- **Framework** : Node.js/Express
- **Base** : PostgreSQL + Redis (mode dégradé disponible)
- **API** : RESTful + WebSocket (Socket.IO)
- **Services** : IA (Claude), Notifications, Cron jobs

---

## 🚀 Démarrage rapide

### 1. Backend (API)
```bash
cd backend
npm install
cp .env.example .env
node src/server.js
# Port : 3000
```

### 2. Web (Dashboard parent)
```bash
cd web
npm install
npm start
# http://localhost:3000
```

### 3. Mobile Android
```bash
# App enfant
cd mobile/android/child
npm install
npx react-native run-android

# App parent
cd mobile/android/parent
npm install
npx react-native run-android
```

### 4. Mobile iOS
```bash
cd mobile/ios
npm install
npx react-native run-ios
```

---

## 📊 Structure détaillée par support

### Backend (`backend/`)
```
backend/
├── src/
│   ├── config/
│   │   ├── database.js           # PostgreSQL connection
│   │   ├── redis.js              # Redis connection (mode dégradé)
│   │   └── migrate.js            # Database migrations
│   ├── controllers/
│   │   ├── auth/                 # Authentification
│   │   │   ├── register.js
│   │   │   ├── login.js
│   │   │   ├── token.js
│   │   │   ├── pin.js
│   │   │   ├── twoFactor.js
│   │   │   └── childAuth.js
│   │   ├── children/             # Gestion enfants
│   │   │   ├── list.js
│   │   │   ├── create.js
│   │   │   ├── update.js
│   │   │   ├── dashboard.js
│   │   │   ├── activity.js
│   │   │   └── quickAction.js
│   │   ├── rules/                # Règles temps écran, apps, URLs
│   │   │   ├── screenTime.js
│   │   │   ├── apps.js
│   │   │   ├── urls.js
│   │   │   ├── grades.js
│   │   │   ├── presets.js
│   │   │   └── deviceCheck.js
│   │   └── billing/              # Abonnements Stripe
│   │       ├── subscription.js
│   │       ├── checkout.js
│   │       └── webhook.js
│   ├── middleware/
│   │   └── auth.js               # JWT, roles, PIN verification
│   ├── routes/
│   │   └── index.js              # Routes API v1
│   ├── services/
│   │   ├── aiService.js          # Claude API
│   │   ├── cronService.js        # Cron jobs
│   │   └── notificationService.js
│   └── server.js                 # Point d'entrée
└── package.json
```

### Web (`web/`)
```
web/
├── src/
│   ├── App.jsx                   # Application React
│   └── components/
│       ├── common/               # Components UI réutilisables
│       │   ├── Button.jsx
│       │   ├── Card.jsx
│       │   └── Input.jsx
│       ├── layout/               # Layout components
│       │   ├── Sidebar.jsx
│       │   └── Toast.jsx
│       ├── pages/                # Pages
│       │   ├── LoginPage.jsx
│       │   ├── OverviewPage.jsx
│       │   ├── SettingsPage.jsx
│       │   └── SubscriptionPage.jsx
│       ├── api.js                # Client API axios
│       └── context.jsx           # Context global
└── package.json
```

### Mobile Android (`mobile/android/`)
```
mobile/android/
├── child/                        # App enfant
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.js
│   │   │   └── AIChatScreen.js
│   │   ├── components/
│   │   │   ├── QuotaRing.jsx
│   │   │   ├── AppIcon.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── LockBanner.jsx
│   │   │   ├── GuardianCTA.jsx
│   │   │   └── chat/
│   │   │       ├── GuardianAvatar.jsx
│   │   │       ├── MessageBubble.jsx
│   │   │       ├── QuickSuggestions.jsx
│   │   │       ├── QuizCard.jsx
│   │   │       ├── ChatInput.jsx
│   │   │       └── TypingIndicator.jsx
│   │   └── services/
│   │       ├── api.js
│   │       └── securityService.js
│   ├── android/                 # Natif Java
│   │   ├── GuardianAccessibilityService.java
│   │   ├── GuardianAdminReceiver.java
│   │   └── GuardianVPNService.java
│   └── package.json
│
└── parent/                       # App parent
    ├── src/
    │   ├── screens/
    │   │   ├── ParentDashboardScreen.js
    │   │   └── ChildDetailsScreen.js
    │   └── components/
    │       ├── ChildCard.jsx
    │       ├── GradeQuickInput.jsx
    │       ├── SectionCard.jsx
    │       ├── TimeSelector.jsx
    │       ├── StatBox.jsx
    │       ├── CategoryToggle.jsx
    │       └── FeedbackToast.jsx
    └── package.json
```

### Mobile iOS (`mobile/ios/`)
```
mobile/ios/
├── src/                          # Code React Native partagé
│   ├── screens/                  # Screens iOS
│   ├── components/               # Components iOS
│   └── services/                 # Services iOS
├── ios/                          # Natif Swift
│   └── GuardianNativeModules.swift
└── package.json
```

### Native (`native/`)
```
native/
├── android/                     # Modules Java natifs
│   ├── android/
│   │   ├── AndroidManifest.xml
│   │   ├── BootReceiver.java
│   │   └── res/                 # Resources XML
│   └── bridge/                  # Native bridges
│       ├── GuardianAccessibilityModule.java
│       ├── GuardianDPCModule.java
│       ├── GuardianVPNModule.java
│       ├── GuardianSecurityModule.java
│       ├── GuardianTamperModule.java
│       └── GuardianNativePackage.java
└── ios/                         # Modules Swift natifs
    └── GuardianNativeModules.swift
```

### Common (`common/`)
```
common/
├── i18n/                        # Internationalisation
│   ├── i18n.js
│   └── AppearanceScreens.js
├── theme/                       # Système de thème
│   └── ThemeSystem.js
└── types/                       # Types TypeScript
    └── (types partagés)
```

---

## 🔧 Mode dégradé

Le backend fonctionne en mode dégradé si Redis/PostgreSQL non disponibles :
- ✅ Serveur démarre quand même
- ✅ Health endpoint accessible
- ⚠️ Fonctionnalités limitées (pas de persistance, pas de cron jobs)

---

## 📝 Migration depuis l'ancienne structure

L'ancienne structure a été restructurée pour une séparation claire par support :

**Ancien** → **Nouveau**
- `backend/` → `backend/` (inchangé)
- `web-parent/` → `web/`
- `mobile-child/` → `mobile/android/child/`
- `mobile-parent/` → `mobile/android/parent/`
- `ios-native/` → `mobile/ios/`
- `android-native/` → `native/android/`
- `native-bridge/` → `native/android/bridge/`
- `i18n/` → `common/i18n/`
- `theme/` → `common/theme/`
- `docker/` → `config/docker/`
- `monitoring/` → `config/monitoring/`
- `ci/` → `config/ci/`
- `documentation/` → `docs/`

---

## 🛡️ Guardian v10.0 — Fait avec ❤️ in France 🇫🇷
