# 🔒 Guardian — Checklist de sécurité avant lancement

Document de référence à valider avant toute mise en production.
Cocher chaque case après vérification effective (pas juste lecture).

---

## 🔑 Secrets & Authentification

- [ ] `JWT_SECRET` et `JWT_REFRESH_SECRET` ont au moins 64 caractères aléatoires (`openssl rand -base64 64`)
- [ ] `ENCRYPTION_KEY` (AES-256) fait exactement 32 bytes (`openssl rand -hex 32`)
- [ ] Aucun secret n'est commité dans Git
- [ ] `.env` et `secrets/*.txt` sont dans `.gitignore`
- [ ] Les mots de passe parents sont hashés avec bcrypt (coût ≥ 10)
- [ ] Le PIN parental est hashé séparément du mot de passe
- [ ] Les refresh tokens sont stockés hashés en DB
- [ ] Le changement de mot de passe révoque tous les refresh tokens existants
- [ ] 2FA TOTP disponible et testé pour les comptes parents
- [ ] Rate limiting actif sur `/auth/login` (max 5 tentatives / 15 min par IP)
- [ ] Verrouillage de compte après N échecs de connexion

## 🗄️ Base de données

- [ ] PostgreSQL accessible UNIQUEMENT depuis le réseau Docker interne
- [ ] Mot de passe PostgreSQL différent du mot de passe Redis
- [ ] Toutes les requêtes utilisent des requêtes paramétrées ($1, $2...)
- [ ] `ON DELETE CASCADE` correctement configuré pour le RGPD
- [ ] Backups automatiques quotidiens fonctionnels et testés (restauration réelle effectuée)
- [ ] Les identifiants ENT (Pronote/EcoleDirecte) sont chiffrés AES-256-GCM

## 🌐 Réseau & HTTPS

- [ ] HTTPS forcé partout (redirection 301)
- [ ] HSTS activé avec includeSubDomains et preload
- [ ] TLS 1.2 minimum
- [ ] Certificate pinning avec les VRAIS hashs SHA-256 (pas les placeholders)
- [ ] CSP configuré sans unsafe-eval
- [ ] CORS limité aux domaines Guardian (pas de wildcard en prod)
- [ ] Firewall serveur : seuls 22, 80, 443 ouverts
- [ ] SSH : authentification par mot de passe désactivée

## 🛡️ Sécurité Android (côté enfant)

- [ ] GuardianAdminReceiver testé : désinstallation impossible une fois activé
- [ ] DISALLOW_INSTALL_APPS et DISALLOW_INSTALL_UNKNOWN_SOURCES actifs
- [ ] VPN en mode Always-on via MDM
- [ ] Service d'accessibilité protégé par PIN parent
- [ ] BehavioralDetectionService testé sur appareil rooté (Magisk)
- [ ] Redémarrage appareil → Guardian redémarre automatiquement
- [ ] GuardianEncryption utilise le Keystore matériel (StrongBox si dispo)
- [ ] Token JWT côté enfant chiffré, pas en clair

## 🤖 IA & Contenu

- [ ] System prompt interdit explicitement le contournement des règles
- [ ] Détection de détresse testée avec messages réels
- [ ] Conversations IA isolées par enfant (multi-tenant)
- [ ] Rate limiting sur /api/ai/* (coûts API)
- [ ] L'IA ne génère jamais de contenu inapproprié

## 💳 Paiements (Stripe)

- [ ] Mode Live activé (pas de clés sk_test_)
- [ ] Signature webhook vérifiée
- [ ] express.raw() AVANT le parsing JSON global
- [ ] Idempotence des événements webhook (event.id)
- [ ] Changements de plan reflétés immédiatement
- [ ] Parcours complet testé : inscription → essai → facturation réelle

## 👨‍👩‍👧 Multi-tenant & Permissions

- [ ] requireChildOwnership testé pour tous les endpoints enfants
- [ ] Rôle observer ne peut pas modifier les règles
- [ ] Token enfant rejeté sur routes parent
- [ ] Suppression parent → CASCADE complet vérifié

## 📜 Conformité légale

- [ ] Politique de confidentialité publiée (/privacy)
- [ ] Conditions d'utilisation publiées (/terms)
- [ ] Export RGPD testé — toutes les données présentes
- [ ] Suppression RGPD testée — CASCADE complet
- [ ] Consentement explicite pour géolocalisation enfants
- [ ] Conformité COPPA évaluée si utilisateurs US
- [ ] Durée de conservation des données définie et appliquée

## 🧪 Tests avant lancement

- [ ] Tests Jest passent avec couverture > 70%
- [ ] Tests E2E Detox passent sur appareil physique
- [ ] Test de charge : 100 req/s sans dégradation
- [ ] Mode offline : règles appliquées sans connexion
- [ ] Multi-langue : FR, EN, ES, AR (RTL vérifié visuellement)
- [ ] Parcours complet : compte → enfant → couplage → règle → blocage

## 📱 Store & Distribution

- [ ] Politique de confidentialité dans Google Play Console
- [ ] Formulaire Data Safety rempli correctement
- [ ] Déclaration "Designed for Families" évaluée
- [ ] Build signé avec keystore de production
- [ ] Keystore sauvegardé dans 2 emplacements sécurisés
- [ ] Screenshots et descriptions à jour dans toutes les langues

## 🚨 Plan de réponse incident

- [ ] Procédure documentée en cas de fuite de données
- [ ] Contact sécurité publié (security@guardian-app.com)
- [ ] Alertes Prometheus testées (fausse alerte → Slack/email reçu)
- [ ] AdminPanel protégé par 2FA obligatoire
- [ ] Logs d'audit conservés et consultables

---

## ✅ Validation finale

À faire valider par :
- [ ] Le développeur principal
- [ ] Une revue de sécurité indépendante
- [ ] Test utilisateur réel (parent + ado consentants)

**Date de validation :** _______________
**Validé par :** _______________
