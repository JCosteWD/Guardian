# 📖 Guardian — Documentation Technique Complète

---

## 🗂️ Table des matières

1. [Architecture système](#architecture)
2. [API Reference](#api-reference)
3. [Authentification](#authentification)
4. [Modules natifs Android](#android-native)
5. [IA Guardian](#ia-guardian)
6. [WebSocket Events](#websocket)
7. [Intégrations tierces](#integrations)
8. [Variables d'environnement](#env)
9. [Glossaire](#glossaire)

---

## 🏗️ Architecture système {#architecture}

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GUARDIAN – Vue d'ensemble                          │
├──────────────────┬──────────────────┬─────────────────┬────────────────────┤
│   App Parent     │   App Enfant     │ Dashboard Web   │   Admin Panel      │
│   React Native   │   React Native   │ React + Vite    │   React            │
│   (Android/iOS)  │   (Android)      │   (PWA)         │                    │
└────────┬─────────┴────────┬─────────┴────────┬────────┴────────────────────┘
         │                  │                   │
         └──────────────────┼───────────────────┘
                            │ HTTPS / WebSocket
                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        NGINX (Reverse Proxy)                                │
│              Rate limiting · TLS 1.3 · CSP · HSTS                         │
└─────────────────────────────┬──────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │         Node.js API           │
              │     Express + Socket.io       │
              │    Port 3000 (interne)        │
              └───┬───────────────────────────┘
                  │
     ┌────────────┼────────────────────────────┐
     │            │                            │
     ▼            ▼                            ▼
┌─────────┐ ┌──────────┐              ┌─────────────────────┐
│Postgres │ │  Redis   │              │  Services externes  │
│ 26 tables│ │Quotas   │              │  Anthropic Claude   │
│         │ │Sessions │              │  Stripe             │
│         │ │Blocklists│              │  Firebase FCM       │
│         │ │Rate limits│             │  Sendgrid           │
└─────────┘ └──────────┘              └─────────────────────┘
```

### Décisions architecturales

**Pourquoi Node.js ?**
Performances I/O non-bloquantes pour les WebSocket temps réel (quotas live), faible latence pour les appels IA, équipe mono-langage JS front/back.

**Pourquoi PostgreSQL ?**
Relations complexes (parent → enfants → règles → quotas), transactions ACID pour les opérations de quota, JSON natif pour les payloads d'activité.

**Pourquoi Redis ?**
Cache des quotas en mémoire (lecture toutes les minutes par appareil enfant), sessions JWT, rate limiting distribuable. TTL automatique pour les quotas journaliers.

**Pourquoi React Native ?**
Code partagé Android/iOS (70-80%), accès aux modules natifs Java/Swift, large écosystème npm.

---

## 📡 API Reference {#api-reference}

### Base URL
```
Production:  https://api.guardian-app.com/api
Staging:     https://api.staging.guardian-app.com/api
Dev local:   http://localhost:3000/api
```

### Authentification
```
Authorization: Bearer <access_token>
```

---

### 🔐 Auth

#### POST /auth/register
```json
// Request
{
  "email":     "parent@exemple.com",
  "password":  "Password123",
  "firstName": "Marie",
  "lastName":  "Dupont",
  "phone":     "+33612345678"
}
// Response 201
{
  "message": "Compte créé. Vérifiez votre email.",
  "parentId": "uuid"
}
```

#### POST /auth/login
```json
// Request
{ "email": "...", "password": "...", "totpCode": "123456" }
// Response 200
{
  "accessToken":  "eyJhb...",
  "refreshToken": "eyJhb...",
  "expiresIn":    900,
  "parent": { "id": "uuid", "email": "...", "firstName": "...", "plan": "premium" }
}
// Erreurs possibles
// 401 INVALID_CREDENTIALS · 401 ACCOUNT_LOCKED · 403 TOTP_REQUIRED · 429 RATE_LIMITED
```

#### POST /auth/refresh
```json
{ "refreshToken": "eyJhb..." }
// Response 200 → { "accessToken": "...", "expiresIn": 900 }
```

#### POST /auth/child
```json
{ "deviceId": "device_xxx", "pairingToken": "ABCD12" }
// Response 200 → { "accessToken": "...", "child": { ... } }
```

---

### 👶 Children

#### GET /children
```json
// Response 200
{
  "children": [{
    "id":             "uuid",
    "firstName":      "Lucas",
    "age":            11,
    "avatarColor":    "#7F77DD",
    "deviceName":     "Samsung Galaxy",
    "usedMinsToday":  45,
    "baseLimit":      120,
    "bonusMins":      15,
    "penaltyMins":    0,
    "isLocked":       false,
    "lastSeen":       "2026-06-17T14:23:00Z",
    "subscriptionPlan": "premium"
  }]
}
```

#### POST /children
```json
// Request
{ "firstName": "Lucas", "age": 11, "avatarColor": "#7F77DD", "aiTone": "friendly", "aiPersonaName": "Guardian" }
// Response 201
{ "child": { ... }, "pairingCode": "XK7P2A" }
```

#### GET /children/:id/dashboard
```json
// Response 200
{
  "quota":             { "used": 45, "total": 135, "remaining": 90, "isLocked": false },
  "weekStats":         [{ "day": "2026-06-11", "screenMins": 98 }, ...],
  "recentGrades":      [{ "subject": "Maths", "grade": 16, "maxGrade": 20 }],
  "recentActivities":  [{ "eventType": "app_blocked", "appPackage": "com.tiktok", "createdAt": "..." }],
  "gamification":      { "level": 4, "points": 320, "streak": 5, "levelProgress": 65 }
}
```

#### POST /children/:id/grades
```json
// Request
{ "subject": "Maths", "grade": 16, "maxGrade": 20, "gradeDate": "2026-06-17" }
// Response 200
{
  "bonusMins":   15,
  "penaltyMins": 0,
  "message":     "Bravo ! +15 minutes bonus appliquées.",
  "gradePercent": 80
}
```

#### POST /children/:id/quick-action
```json
// Request
{ "customDelta": -30, "customLock": false, "lockReason": "", "childName": "Lucas" }
// Response 200
{ "success": true, "isLocked": false, "remainingMins": 60 }
```

---

### ⚙️ Rules

#### PATCH /children/:id/rules/screen-time
```json
{
  "dailyLimitMins":    120,
  "weekendLimitMins":  180,
  "bedtimeStart":      "21:00",
  "bedtimeEnd":        "07:00",
  "schoolModeEnabled": true
}
```

#### POST /children/:id/rules/apps
```json
{ "packageName": "com.tiktok", "appName": "TikTok", "isBlocked": true }
```

#### POST /children/:id/rules/urls
```json
{ "url": "exemple-dangereux.com", "isBlocked": true }
```

#### GET /device/rules (token enfant)
```json
// Response 200
{
  "remainingMins":    90,
  "baseLimitMins":    120,
  "bonusMins":        15,
  "penaltyMins":      0,
  "isLocked":         false,
  "lockReason":       null,
  "blockedApps":      ["com.tiktok", "com.instagram.android"],
  "blockedDomains":   ["exemple-dangereux.com"],
  "blockedCategories":["adult", "violence"],
  "bedtimeStart":     "21:00",
  "bedtimeEnd":       "07:00",
  "schoolModeActive": false
}
```

---

### 🤖 AI

#### POST /ai/chat (token enfant)
```json
// Request
{ "message": "Pourquoi ai-je moins de temps aujourd'hui ?", "sessionId": "uuid|null" }
// Response 200
{
  "response":       "Bonjour Lucas ! 😊 Aujourd'hui tu as eu 6/20 en histoire...",
  "sessionId":      "uuid",
  "mood":           "neutral",
  "isDistress":     false,
  "quizRequested":  null,
  "remainingMins":  90
}
```

#### POST /ai/quiz/adaptive (token enfant)
```json
// Request
{ "numQuestions": 10 }
// Response 200
{
  "quiz": {
    "id":           "uuid",
    "subject":      "Histoire",
    "difficulty":   "facile",
    "timeBonusMins": 15,
    "questions": [{
      "id": 1,
      "question": "Quelle est la date de la Révolution française ?",
      "options": ["A. 1787", "B. 1789", "C. 1791", "D. 1793"],
      "difficulty": "easy"
    }]
  }
}
```

#### POST /ai/quiz/:quizId/submit (token enfant)
```json
{ "answers": [1, 2, 0, 3, ...] }
// Response 200
{
  "passed":       true,
  "score":        0.8,
  "bonusMins":    15,
  "rewards":      [{ "type": "badge", "name": "Premier quiz" }],
  "message":      "🎉 Bravo Lucas ! Tu as gagné 15 minutes !"
}
```

---

### 📍 Géofencing

#### POST /children/:id/zones
```json
{
  "name":          "École Jean Moulin",
  "latitude":      48.8606,
  "longitude":     2.3376,
  "radiusMeters":  200,
  "zoneType":      "school"
}
```

#### POST /device/location (token enfant)
```json
{ "latitude": 48.8606, "longitude": 2.3376, "accuracyMeters": 15 }
// Response 200
{
  "currentZone":   { "id": "uuid", "name": "École Jean Moulin", "type": "school", "distanceMeters": 42 },
  "isInKnownZone": true
}
```

---

### 💳 Billing

#### POST /billing/checkout
```json
{ "plan": "premium", "promoCode": "LAUNCH50" }
// Response 200 → { "checkoutUrl": "https://checkout.stripe.com/..." }
```

#### POST /billing/portal
```json
// Response 200 → { "url": "https://billing.stripe.com/..." }
```

#### GET /billing/invoices
```json
// Response 200
{
  "invoices": [{
    "id":         "in_xxx",
    "number":     "GUARDIAN-0001",
    "amount":     "4.99",
    "status":     "paid",
    "date":       "2026-06-01T00:00:00Z",
    "pdfUrl":     "https://...",
    "hostedUrl":  "https://..."
  }]
}
```

---

## 🔔 WebSocket Events {#websocket}

### Connexion
```js
const socket = io('https://api.guardian-app.com', { auth: { token: accessToken } });
socket.emit('identify', { type: 'parent', id: parentId });
// ou
socket.emit('identify', { type: 'child', id: childId });
```

### Événements parent reçus
| Événement | Payload | Description |
|---|---|---|
| `quota_warning` | `{ childId, childName, remainingMins }` | Quota presque épuisé |
| `quota_updated` | `{ childId, usedMins, remainingMins }` | Mise à jour temps réel |
| `tamper_attempt` | `{ childId, type, score }` | Tentative de contournement |
| `distress_alert` | `{ childId, snippet }` | Détresse détectée par l'IA |
| `zone_changed` | `{ childId, zoneName, zoneType }` | Changement de zone GPS |
| `child_message` | `{ childId, childName, message }` | Message de l'enfant via IA |
| `grade_added` | `{ childId, subject, grade, bonusMins }` | Nouvelle note ENT |

### Événements enfant reçus
| Événement | Payload | Description |
|---|---|---|
| `quota_updated` | `{ remainingMins, isLocked }` | Quota mis à jour par parent |
| `rules_updated` | `{ blockedApps, blockedDomains }` | Règles modifiées |
| `parent_message` | `{ content, timestamp }` | Message du parent |
| `zone_changed` | `{ zoneName, zoneType, autoRules }` | Arrivée/départ zone |
| `quiz_available` | `{ quizId, subject, bonusMins }` | Quiz disponible |

---

## 🔐 Authentification {#authentification}

### Flux JWT

```
1. Parent se connecte → reçoit accessToken (15 min) + refreshToken (30 jours)
2. Chaque requête → Authorization: Bearer <accessToken>
3. Expiration → POST /auth/refresh avec refreshToken → nouveau accessToken
4. Logout → refreshToken révoqué en DB (ne peut plus être utilisé)
5. Changement mot de passe → TOUS les refreshTokens révoqués
```

### Types de tokens
| Type | Durée | Claims |
|---|---|---|
| Parent | 15 min | `{ id, type: 'parent', plan, iat, exp }` |
| Enfant | 7 jours | `{ id, type: 'child', deviceId, iat, exp }` |
| Refresh | 30 jours | `{ id, type: 'refresh', userId, iat, exp }` |

### PIN parental
Le PIN (4-8 chiffres) est requis pour :
- Modifier les règles critiques (désactivation complète, factory reset)
- Accès aux paramètres avancés depuis l'app enfant
- Validation dans `requirePin` middleware

---

## 📱 Modules natifs Android {#android-native}

### Initialisation (MainApplication.java)
```java
@Override
protected List<ReactPackage> getPackages() {
  return Arrays.asList(
    new MainReactPackage(),
    new GuardianNativePackage()   // ← Obligatoire
  );
}
```

### API JavaScript
```js
import { NativeModules } from 'react-native';
const { GuardianDPC, GuardianVPN, GuardianAccessibility,
        GuardianTamper, GuardianSecurity } = NativeModules;

// Droits admin
await GuardianDPC.requestAdminPrivileges();
await GuardianDPC.disableAppInstallation();
await GuardianDPC.blockSettingsAccess(true);

// VPN
await GuardianVPN.start({ blockedCategories: ['adult', 'violence'] });
await GuardianVPN.updateBlocklist({ blockedDomains: ['danger.com'] });
await GuardianVPN.isRunning(); // → boolean

// Accessibility
await GuardianAccessibility.isEnabled(); // → boolean
await GuardianAccessibility.updateBlockedApps(['com.tiktok']);
await GuardianAccessibility.setQuotaStatus({ remainingMins: 0, isLocked: true });

// Tamper detection
await GuardianTamper.startMonitoring({});
await GuardianTamper.checkIntegrity(); // → { isRooted, adbEnabled, threatScore }

// Events
const { NativeEventEmitter } = require('react-native');
const emitter = new NativeEventEmitter(GuardianSecurity);
emitter.addListener('onAppBlocked', ({ packageName }) => { ... });
emitter.addListener('onTamperDetected', ({ type, totalScore }) => { ... });
```

---

## 🤖 IA Guardian {#ia-guardian}

### Configuration du system prompt
```js
// backend/src/services/aiService.js
const buildSystemPrompt = (child, context) => `
Tu es ${child.aiPersonaName}, l'assistant bienveillant de ${child.firstName} (${child.age} ans).

CONTEXTE:
- Temps restant: ${context.remainingMins} min
- Notes récentes: ${context.grades}
- Humeur détectée: ${context.mood}

RÈGLES ABSOLUES:
1. Ne jamais proposer de contournement des restrictions parentales
2. Ne jamais mentir sur les règles ou les quotas
3. Si détresse → tag [DISTRESS_DETECTED] dans la réponse
4. Si quiz demandé → tag [QUIZ_REQUEST:<matière>]
5. Si message pour parent → tag [PARENT_MESSAGE:<texte>]
`;
```

### Modèle utilisé
```
Modèle: claude-opus-4-5 (via ANTHROPIC_API_KEY)
Max tokens: 1024 (chat) / 3000 (quiz generation)
Temperature: default (1.0)
```

### Détection de détresse
```js
// Patterns regex — 8 expressions régulières
MOOD_PATTERNS.distress.some(p => p.test(message))
// → true → notifie parent immédiatement via Firebase + Socket
```

---

## 🔗 Intégrations tierces {#integrations}

### Pronote
```
Lib: pronote-api (npm)
Auth: URL instance + identifiants ENT
Sync: Toutes les heures via node-cron
Stockage mot de passe: AES-256-GCM (ENCRYPTION_KEY)
```

### EcoleDirecte
```
API: https://api.ecoledirecte.com/v3
Auth: POST /login.awp → token X-Token
Sync: Toutes les heures
Stockage mot de passe: AES-256-GCM
```

### Stripe
```
Plans: STRIPE_PRICE_FAMILY + STRIPE_PRICE_PREMIUM
Webhook: /api/billing/webhook (raw body)
Events: checkout.session.completed, subscription.updated/deleted, invoice.payment_failed
Portal: Stripe Customer Portal (auto-hosted)
```

### Firebase
```
Usage: Push notifications (FCM)
Token registration: POST /api/push-tokens (parent) ou /api/device/push-token (enfant)
Canaux Android: guardian_alerts (high), guardian_security (alarm), guardian_info (default)
```

---

## 🌐 Variables d'environnement {#env}

```bash
# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=guardian
DB_USER=guardian_user
DB_PASSWORD=           # Via secrets/ en prod

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT (min 64 chars)
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m

# Chiffrement AES-256 (exactement 32 bytes en hex)
ENCRYPTION_KEY=

# APIs externes
ANTHROPIC_API_KEY=
AI_MODEL=claude-opus-4-5

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_FAMILY=price_xxx
STRIPE_PRICE_PREMIUM=price_xxx

# Frontend
FRONTEND_URL=https://guardian-app.com

# Optionnel
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

---

## 📚 Glossaire {#glossaire}

| Terme | Définition |
|---|---|
| **MDM** | Mobile Device Management — protocole d'administration d'appareils mobiles |
| **DPC** | Device Policy Controller — composant Android qui applique les politiques MDM |
| **TEE** | Trusted Execution Environment — zone sécurisée matérielle du processeur |
| **StrongBox** | Chip de sécurité dédié (meilleure option que TEE) disponible sur certains Android |
| **ADB** | Android Debug Bridge — outil de débogage qui peut être utilisé pour contourner les restrictions |
| **Magisk** | Solution de root Android qui peut contourner la détection basique de root |
| **Always-On VPN** | Mode VPN où la connexion ne peut pas être désactivée par l'utilisateur |
| **TOTP** | Time-based One-Time Password — code 2FA qui change toutes les 30 secondes |
| **ENT** | Espace Numérique de Travail — plateforme scolaire (Pronote, EcoleDirecte) |
| **Haversine** | Formule de calcul de distance entre deux points GPS sur une sphère |
| **quota** | Temps d'écran alloué pour la journée (base + bonus - pénalités) |
| **preset** | Action rapide prédéfinie (ex: -30 min, Mode devoirs) |
| **streak** | Nombre de jours consécutifs d'utilisation de l'app |
| **CAC** | Coût d'Acquisition Client |
| **LTV** | Lifetime Value — revenus totaux générés par un client |
| **MRR** | Monthly Recurring Revenue — revenu récurrent mensuel |
| **ARR** | Annual Recurring Revenue — MRR × 12 |

---

*Documentation mise à jour : Juin 2026 · Version 6.0*
