# 📋 Plan de Réorganisation - 3 Dossiers Principaux

## 🎯 Objectif
Réorganiser le projet pour n'avoir que **3 dossiers principaux** : `backend/`, `web/`, `mobile/`.

## 📁 Structure Cible

```
guardian-full/
├── backend/                    # API Node.js/Express + tout ce qui est backend
│   ├── src/
│   │   ├── config/              # Database, Redis, migrations
│   │   ├── controllers/         # Auth, Children, Rules, Billing
│   │   ├── middleware/          # JWT, roles, PIN, ownership
│   │   ├── routes/              # Routes API v1
│   │   ├── services/            # AI (Claude), Notifications, Cron
│   │   └── common/              # Code partagé backend (types, utils)
│   ├── config/                  # Infrastructure backend (docker, ci, monitoring)
│   ├── docs/                    # Documentation backend
│   ├── tests/                   # Tests backend (e2e, perf, complete)
│   ├── seed/                    # Données de démo
│   ├── analytics/               # Analytics backend
│   ├── nginx/                   # Reverse proxy
│   ├── deploy-guide/            # Guide déploiement
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── web/                        # Application React Dashboard parent + tout ce qui est web
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/          # Components UI réutilisables
│   │   │   ├── layout/          # Layout components
│   │   │   ├── pages/           # Pages
│   │   │   ├── api.js           # Client API
│   │   │   └── context.jsx      # Context global
│   │   └── common/              # Code partagé web (i18n, theme, types)
│   ├── admin-panel/             # Dashboard admin
│   ├── complete-dashboard/      # Dashboard complet
│   ├── ui-redesign/             # Composants UI redesign
│   ├── realtime-dashboard/      # Dashboard temps réel
│   ├── onboarding-web/          # Onboarding web
│   ├── notifications-ui/        # Centre de notifications
│   ├── web-push/                # Notifications push web
│   ├── pwa/                     # Service Worker
│   ├── package.json
│   └── README.md
│
├── mobile/                     # Applications React Native + tout ce qui est mobile
│   ├── android/
│   │   ├── child/               # App enfant Android
│   │   │   ├── src/
│   │   │   │   ├── components/
│   │   │   │   ├── screens/
│   │   │   │   └── services/
│   │   │   ├── android/         # Natif Java
│   │   │   └── package.json
│   │   └── parent/             # App parent Android
│   │       ├── src/
│   │       │   ├── components/
│   │       │   └── screens/
│   │       └── package.json
│   ├── ios/                    # Apps iOS
│   │   ├── src/
│   │   ├── ios/                 # Natif Swift
│   │   └── package.json
│   ├── native/                  # Modules natifs partagés
│   │   ├── android/             # Java natifs
│   │   └── ios/                 # Swift natifs
│   ├── common/                  # Code partagé mobile (i18n, theme, types)
│   ├── profile/                 # Profil parent
│   ├── pronote/                 # Intégration ENT
│   ├── qr-pairing/              # Couplage QR code
│   ├── offline/                 # Mode hors-ligne
│   ├── deep-links/              # Deep links & notifications
│   ├── support/                 # Support
│   ├── app-store/               # Listings stores
│   ├── fastlane/                # Build automatisé
│   ├── e2e-tests/               # Tests E2E mobile
│   └── README.md
│
├── docker-compose.yml           # Stack complète
├── README.md                   # Documentation principale
└── README-OLD.md               # Backup ancienne documentation
```

## 🔄 Mapping des déplacements

### backend/ (déjà en place)
- **Ajouter** : `config/` (de config/)
- **Ajouter** : `docs/` (de docs/)
- **Ajouter** : `tests/` (de e2e-tests/, perf-tests/, complete-tests/)
- **Ajouter** : `seed/` (de seed/)
- **Ajouter** : `analytics/` (de analytics/)
- **Ajouter** : `nginx/` (de nginx/)
- **Ajouter** : `deploy-guide/` (de deploy-guide/)
- **Ajouter** : `stripe-advanced/` (de stripe-advanced/)
- **Ajouter** : `security-advanced/` (de security-advanced/)

### web/ (déjà en place)
- **Ajouter** : `admin-panel/` (de admin-panel/)
- **Ajouter** : `complete-dashboard/` (de complete-dashboard/)
- **Ajouter** : `ui-redesign/` (de ui-redesign/)
- **Ajouter** : `realtime-dashboard/` (de realtime-dashboard/)
- **Ajouter** : `onboarding-web/` (de onboarding-web/)
- **Ajouter** : `notifications-ui/` (de notifications-ui/)
- **Ajouter** : `web-push/` (de web-push/)
- **Ajouter** : `pwa/` (de pwa/)
- **Ajouter** : `common/i18n/` (de common/i18n/)
- **Ajouter** : `common/theme/` (de common/theme/)
- **Ajouter** : `common/types/` (de common/types/)

### mobile/ (déjà en place)
- **Ajouter** : `native/` (de native/)
- **Ajouter** : `profile/` (de profile/)
- **Ajouter** : `pronote/` (de pronote/)
- **Ajouter** : `qr-pairing/` (de qr-pairing/)
- **Ajouter** : `offline/` (de offline/)
- **Ajouter** : `deep-links/` (de deep-links/)
- **Ajouter** : `support/` (de support/)
- **Ajouter** : `app-store/` (de app-store/)
- **Ajouter** : `fastlane/` (de fastlane/)
- **Ajouter** : `e2e-tests/` (de e2e-tests/)

### À supprimer (déplacés)
- `config/` → `backend/config/`
- `docs/` → `backend/docs/`
- `native/` → `mobile/native/`
- `common/` → réparti entre `backend/`, `web/`, `mobile/`
- `seed/` → `backend/seed/`
- `analytics/` → `backend/analytics/`
- `nginx/` → `backend/nginx/`
- `deploy-guide/` → `backend/deploy-guide/`
- `stripe-advanced/` → `backend/stripe-advanced/`
- `security-advanced/` → `backend/security-advanced/`
- `admin-panel/` → `web/admin-panel/`
- `complete-dashboard/` → `web/complete-dashboard/`
- `ui-redesign/` → `web/ui-redesign/`
- `realtime-dashboard/` → `web/realtime-dashboard/`
- `onboarding-web/` → `web/onboarding-web/`
- `notifications-ui/` → `web/notifications-ui/`
- `web-push/` → `web/web-push/`
- `pwa/` → `web/pwa/`
- `profile/` → `mobile/profile/`
- `pronote/` → `mobile/pronote/`
- `qr-pairing/` → `mobile/qr-pairing/`
- `offline/` → `mobile/offline/`
- `deep-links/` → `mobile/deep-links/`
- `support/` → `mobile/support/`
- `app-store/` → `mobile/app-store/`
- `fastlane/` → `mobile/fastlane/`
- `e2e-tests/` → réparti entre `backend/tests/` et `mobile/e2e-tests/`
- `perf-tests/` → `backend/tests/perf/`
- `complete-tests/` → `backend/tests/complete/`
- `security-checklist/` → `backend/docs/security-checklist/`
