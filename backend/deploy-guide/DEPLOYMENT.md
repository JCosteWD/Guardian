# 🚀 Guardian — Guide de déploiement production

Ce guide couvre le déploiement complet de Guardian sur un serveur de production
(VPS Ubuntu 22.04 recommandé, type Hetzner/OVH/DigitalOcean, 4 vCPU / 8 Go RAM minimum).

---

## 📋 Prérequis

- Un serveur Ubuntu 22.04 LTS avec accès root/sudo
- Un nom de domaine pointant vers l'IP du serveur (ex: `guardian-app.com`, `api.guardian-app.com`)
- Comptes créés : Anthropic, Stripe (mode live), Firebase, Google Play Console
- Clé SSH configurée pour le déploiement

---

## 1️⃣ Préparation du serveur

```bash
# Connexion SSH
ssh root@VOTRE_IP_SERVEUR

# Mise à jour système
apt update && apt upgrade -y

# Installation Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Firewall (UFW)
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable

# Création utilisateur de déploiement (non-root)
adduser guardian
usermod -aG docker guardian
su - guardian
```

---

## 2️⃣ Clonage et configuration

```bash
mkdir -p /home/guardian/app && cd /home/guardian/app

# Récupère le code (via git ou upload du ZIP)
git clone https://github.com/votre-org/guardian.git .
# OU: unzip guardian_FINAL_v6.zip && mv guardian/* .

# Crée les dossiers de secrets et backups
mkdir -p secrets backups nginx/ssl nginx/www
```

---

## 3️⃣ Génération des secrets

⚠️ **Ne jamais committer ces fichiers dans Git !** Ajoutez `secrets/` au `.gitignore`.

```bash
# Mots de passe et clés aléatoires (32+ caractères)
openssl rand -base64 32 > secrets/db_password.txt
openssl rand -base64 32 > secrets/redis_password.txt
openssl rand -base64 64 > secrets/jwt_secret.txt
openssl rand -base64 64 > secrets/jwt_refresh_secret.txt
openssl rand -hex 32    > secrets/encryption_key.txt   # 32 bytes pour AES-256

# Clés API (récupérées depuis les dashboards respectifs)
echo "sk-ant-xxxxxxxxxxxx"        > secrets/anthropic_key.txt
echo "sk_live_xxxxxxxxxxxx"       > secrets/stripe_secret.txt
echo "whsec_xxxxxxxxxxxx"         > secrets/stripe_webhook.txt

# Permissions restrictives
chmod 600 secrets/*.txt
```

---

## 4️⃣ Certificats SSL (Let's Encrypt)

```bash
# Installation Certbot (one-shot, avant démarrage de nginx)
apt install -y certbot

# Génère les certificats (mode standalone, port 80 doit être libre)
certbot certonly --standalone \
  -d guardian-app.com -d www.guardian-app.com -d api.guardian-app.com \
  --email admin@guardian-app.com --agree-tos --non-interactive

# Copie vers le dossier nginx
mkdir -p nginx/ssl/guardian-app.com
cp /etc/letsencrypt/live/guardian-app.com/fullchain.pem nginx/ssl/guardian-app.com/
cp /etc/letsencrypt/live/guardian-app.com/privkey.pem   nginx/ssl/guardian-app.com/
```

Le service `certbot` dans `docker-compose.prod.yml` renouvellera automatiquement
les certificats toutes les 12h.

---

## 5️⃣ Configuration nginx

Éditez `nginx/nginx.conf` :
- Remplacez `guardian-app.com` par votre domaine
- Mettez à jour les chemins SSL si différents
- Ajustez les `pin-set` SHA-256 pour le certificate pinning mobile (optionnel)

---

## 6️⃣ Premier démarrage

```bash
# Build des images
docker compose -f docker/docker-compose.prod.yml build

# Démarre uniquement PostgreSQL et Redis pour les migrations
docker compose -f docker/docker-compose.prod.yml up -d postgres redis

# Attend que PostgreSQL soit prêt (healthcheck)
docker compose -f docker/docker-compose.prod.yml ps

# Lance les migrations (v1 + v3 + v6)
docker compose -f docker/docker-compose.prod.yml run --rm migrate

# Démarre tous les services
docker compose -f docker/docker-compose.prod.yml up -d

# Vérifie les logs
docker compose -f docker/docker-compose.prod.yml logs -f api
```

---

## 7️⃣ Vérification

```bash
# Health check API
curl https://api.guardian-app.com/api/health
# → {"status":"ok","service":"Guardian API"}

# Dashboard web
curl -I https://guardian-app.com
# → HTTP/2 200

# Vérifie les certificats SSL
curl -vI https://guardian-app.com 2>&1 | grep -i "SSL certificate"
```

---

## 8️⃣ Configuration Stripe Webhook

Dans le dashboard Stripe (mode Live) :
1. Developers → Webhooks → Add endpoint
2. URL : `https://api.guardian-app.com/api/billing/webhook`
3. Événements : `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`
4. Copiez le "Signing secret" → `secrets/stripe_webhook.txt`

---

## 9️⃣ Firebase (Push Notifications)

1. Créez un projet Firebase
2. Téléchargez `google-services.json` → placez dans
   `mobile-parent/android/app/` et `mobile-child/android/app/`
3. Générez une clé de service (Project Settings → Service Accounts)
   → utilisée par `notificationService.js`

---

## 🔟 Build & Publication des apps Android

```bash
# Sur une machine avec Android SDK
cd mobile-parent

# Génère le keystore de signature (UNE SEULE FOIS, à conserver précieusement)
keytool -genkey -v -keystore guardian-release.keystore \
  -alias guardian -keyalg RSA -keysize 2048 -validity 10000

# Build AAB pour Google Play
export KEYSTORE_PATH=./guardian-release.keystore
export KEYSTORE_PASSWORD=xxx KEY_ALIAS=guardian KEY_PASSWORD=xxx
cd android && ./gradlew bundleRelease

# Déploiement automatisé via Fastlane
cd .. && fastlane deploy_internal
```

---

## 🔁 Mises à jour (déploiement continu)

```bash
cd /home/guardian/app
git pull

# Rebuild seulement l'API (zero-downtime avec 2 replicas)
docker compose -f docker/docker-compose.prod.yml build api
docker compose -f docker/docker-compose.prod.yml up -d --no-deps api

# Si nouvelles migrations
docker compose -f docker/docker-compose.prod.yml run --rm migrate
```

---

## 💾 Restauration d'un backup

```bash
# Liste les backups disponibles
docker compose -f docker/docker-compose.prod.yml exec backup ls /backups

# Restaure (ATTENTION: écrase la base actuelle)
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  pg_restore -U guardian_user -d guardian -c /backups/guardian_20260101_030000.dump
```

---

## 📊 Monitoring

Voir `monitoring/` pour la configuration Prometheus + Grafana + alertes.

```bash
docker compose -f docker/docker-compose.prod.yml -f monitoring/docker-compose.monitoring.yml up -d
```

Accès Grafana : `https://guardian-app.com:3001` (changez le mot de passe admin par défaut !)

---

## ✅ Checklist finale

- [ ] Tous les secrets générés et stockés en lieu sûr (password manager)
- [ ] `.gitignore` contient `secrets/`, `*.keystore`, `.env`
- [ ] Certificats SSL valides et renouvellement auto fonctionnel
- [ ] Webhook Stripe configuré et testé
- [ ] Backups automatiques fonctionnels (vérifier `/backups` après 24h)
- [ ] Firewall actif (seuls 80/443/22 ouverts)
- [ ] Monitoring + alertes configurés
- [ ] Tests E2E passent sur le build de production
- [ ] Politique de confidentialité accessible publiquement
- [ ] App soumise sur Google Play (review ~3-7 jours)

---

## 🆘 Dépannage

| Problème | Solution |
|---|---|
| `pg_isready` échoue | Vérifier `secrets/db_password.txt` existe et permissions 600 |
| 502 Bad Gateway | `docker compose logs api` — vérifier que l'API a démarré |
| Certificat SSL expiré | `docker compose run certbot renew --force-renewal` |
| Webhook Stripe 401 | Vérifier `stripe_webhook.txt` correspond au signing secret |
| Migrations échouent | Vérifier l'ordre : migrate.js → migrateV3.js → migrateV6.js |

---

**🛡️ Guardian est maintenant en production !**
