# Guide Mode Hybride Pronote

## 🎯 Concept du Mode Hybride

Le mode hybride permet de conserver le mode démo tout en utilisant de vrais identifiants Pronote en parallèle :

- **Mode démo par défaut** : Fonctionnalités démo actives pour les tests
- **Identifiants réels optionnels** : Possibilité de configurer des identifiants Pronote réels
- **Bascul automatique** : Utilise les identifiants réels si configurés, sinon utilise le mode démo

---

## 🔄 Fonctionnement du Mode Hybride

### Scénario 1 : Aucune configuration Pronote
```
Configuration → Aucune identifiant
Résultat → Mode démo automatique
Données → Simulées
```

### Scénario 2 : Configuration Pronote avec identifiants valides
```
Configuration → Identifiants réels configurés
Résultat → Mode réel Pronote
Données → Réelles depuis Pronote
```

### Scénario 3 : Configuration Pronote mais erreur de connexion
```
Configuration → Identifiants configurés mais échec connexion
Résultat → Fallback vers mode démo
Données → Simulées (avec avertissement)
```

---

## 🚀 Utilisation du Mode Hybride

### Étape 1 : Tester vos identifiants

Utilisez le script de test pour vérifier que vos identifiants fonctionnent :

```bash
cd backend
npm run test-pronote
```

### Étape 2 : Configurer les identifiants dans l'application

Une fois le test réussi, configurez les identifiants via l'API :

```bash
curl -X POST http://localhost:3000/api/children/child-1/pronote/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "schoolUrl": "https://college-victor-hugo.pronote.fr",
    "username": "ethan.martin",
    "password": "votre_password",
    "casType": "none",
    "autoSync": true
  }'
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Configuration Pronote sauvegardée (mode hybride - identifiants réels enregistrés)",
  "config": {
    "childId": "child-1",
    "schoolUrl": "https://college-victor-hugo.pronote.fr",
    "username": "eth***",
    "casType": "none",
    "autoSync": true,
    "lastSync": "2024-09-03T15:30:00.000Z",
    "mode": "HYBRID"
  }
}
```

### Étape 3 : Synchroniser les données

```bash
curl -X POST http://localhost:3000/api/children/child-1/pronote/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Si identifiants configurés et valides :**
```json
{
  "success": true,
  "message": "Synchronisation terminée (mode réel): 8 notes importées",
  "mode": "REAL",
  "grades": [...]
}
```

**Si pas d'identifiants ou erreur :**
```json
{
  "success": true,
  "message": "Synchronisation terminée (mode démo): 5 notes simulées",
  "mode": "DEMO",
  "grades": [...]
}
```

---

## 📊 Vérifier le mode actif

### Via l'API système :

```bash
curl http://localhost:3000/api/pronote/system-info
```

**Réponse :**
```json
{
  "success": true,
  "system": {
    "mode": "HYBRID",
    "demoMode": true,
    "hybridMode": true
  },
  "mode": "HYBRID"
}
```

### Via les logs du serveur :

**Mode démo actif :**
```
[Pronote Controller] Mode démo - Simulation connexion
[Pronote Service] Mode démo - Génération notes simulées
```

**Mode réel actif :**
```
[Pronote Controller] Configuration réelle trouvée - Mode hybride
[Pronote Service] Tentative de connexion réelle pour ethan.martin
[Pronote Service] Connexion réussie pour Ethan Martin
```

---

## 🔄 Basculer entre modes

### Pour repasser en mode démo pur :

Supprimez simplement la configuration Pronote :

```bash
curl -X DELETE http://localhost:3000/api/children/child-1/pronote/config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Pour activer le mode réel :

Reconfigurez les identifiants (voir Étape 2 ci-dessus).

---

## 🧪 Cas d'usage du mode hybride

### 1. Développement et tests
- Conserver le mode démo pour les tests généraux
- Tester les vrais identifiants pour vérifier l'intégration
- Basculer facilement entre les deux modes

### 2. Déploiement progressif
- Commencer avec le mode démo
- Tester avec quelques utilisateurs réels
- Étendre progressivement l'utilisation

### 3. Maintenance et dépannage
- Mode démo pour le développement
- Mode réel pour la production
- Fallback automatique en cas de problème

---

## ⚙️ Configuration avancée

### Variables d'environnement actuelles :

```env
# Mode hybride activé
DEMO_MODE=true
PRONOTE_DEMO_MODE=true
PRONOTE_API_ENABLED=true
PRONOTE_AUTO_SYNC_INTERVAL=3600
```

### Changer de mode :

**Mode démo pur :**
```env
PRONOTE_DEMO_MODE=true
# Dans pronoteService.js : this.hybridMode = false
```

**Mode hybride (actuel) :**
```env
PRONOTE_DEMO_MODE=true
# Dans pronoteService.js : this.hybridMode = true
```

**Mode production pur :**
```env
PRONOTE_DEMO_MODE=false
DEMO_MODE=false
```

---

## 🔍 Dépannage

### Problème : Les identifiants sont configurés mais le mode démo est toujours utilisé

**Solution :**
1. Vérifiez que la base de données fonctionne
2. Vérifiez les logs pour voir si la connexion Pronote échoue
3. Testez les identifiants avec `npm run test-pronote`

### Problème : Erreur de base de données lors de la sauvegarde

**Solution :**
- Le mode hybride accepte cette situation et passe en simulation
- Les données seront simulées mais le système continue de fonctionner

### Problème : Je veux forcer l'utilisation des identifiants réels

**Solution :**
- Appelez directement l'API de test de connexion
- Si succès, les identifiants seront utilisés pour les synchronisations futures

---

## 📝 Résumé des avantages

### ✅ Avantages du mode hybride

1. **Flexibilité** : Testez les deux modes sans redémarrage
2. **Sécurité** : Identifiants chiffrés même en mode démo
3. **Continuité** : Le système fonctionne même si Pronote est inaccessible
4. **Développement** : Test rapide sans base de données
5. **Production** : Transition douce vers le mode réel

### 🔧 Comparaison des modes

| Fonctionnalité | Mode Démo | Mode Hybride | Mode Production |
|----------------|-----------|--------------|-----------------|
| Données simulées | ✅ Oui | ✅ Si pas d'identifiants | ❌ Non |
| Identifiants réels | ❌ Non | ✅ Si configurés | ✅ Oui |
| Base de données requise | ❌ Non | ⚠️ Optionnelle | ✅ Oui |
| Fallback automatique | ❌ Non | ✅ Oui | ❌ Non |
| Test rapide | ✅ Oui | ✅ Oui | ❌ Non |

---

## 🎉 Conclusion

Le mode hybride offre la meilleure flexibilité :
- **Conservez** tous les avantages du mode démo
- **Utilisez** des identifiants réels quand vous le souhaitez
- **Basculez** automatiquement selon la configuration
- **Développez** et **testez** plus efficacement

C'est la configuration idéale pour le développement et les tests !
