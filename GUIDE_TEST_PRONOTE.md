# Guide Rapide : Tester Pronote avec Vrais Identifiants

## 🎯 OUI, vous pouvez maintenant tester avec de vrais identifiants Pronote !

La librairie `pronote-api-maintained` a été installée et le système est configuré pour fonctionner en mode réel.

---

## 🚀 Étape 1 : Tester la connexion directement (script de test)

Utilisez le script de test pour vérifier que vos identifiants fonctionnent :

```bash
cd backend
npm run test-pronote
```

Le script vous demandera :
- **URL de l'établissement** : L'URL de l'instance Pronote de l'école
- **Identifiant élève** : Le nom d'utilisateur Pronote
- **Mot de passe** : Le mot de passe Pronote
- **Type CAS** : Généralement "none", ou "cas", "cas-educonnect" selon l'école

### Exemple de test :

```
URL de l'établissement Pronote : https://college-victor-hugo.pronote.fr
Identifiant élève : ethan.martin
Mot de passe : ********
Type CAS (none, cas, cas-educonnect, etc.) [none] : none
```

### Résultat attendu en cas de succès :

```
✅ Connexion réussie !

INFORMATIONS ÉLÈVE :
Nom complet : Ethan Martin
Classe : 3ème B
ID Élève : 12345
Période actuelle : Trimestre 1 2024-2025
Établissement : Collège Victor Hugo

RÉCUPÉRATION DES NOTES...
✅ 8 notes récupérées
Moyenne élève : 13.5
Moyenne classe : 12.8

RÉCUPÉRATION DE L'EMPLOI DU TEMPS...
✅ 6 cours aujourd'hui

RÉCUPÉRATION DES DEVOIRS...
✅ 4 devoirs pour les 7 prochains jours
```

---

## 🔧 Étape 2 : Passer en mode réel dans l'application

Une fois que le test fonctionne, modifiez le fichier `.env` :

```env
# Passer du mode démo au mode réel
PRONOTE_DEMO_MODE=false
PRONOTE_API_ENABLED=true
```

Puis redémarrez le serveur :

```bash
npm start
```

---

## 📱 Étape 3 : Configurer l'application avec vos identifiants

### Via l'API :

```bash
curl -X POST http://localhost:3000/api/children/child-1/pronote/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "schoolUrl": "https://college-victor-hugo.pronote.fr",
    "username": "ethan.martin",
    "password": "votre_password",
    "autoSync": true
  }'
```

### Via l'interface utilisateur (si disponible) :

1. Connectez-vous en tant que parent
2. Allez dans les paramètres de l'enfant
3. Section "Intégration Pronote"
4. Entrez vos identifiants
5. Cliquez sur "Tester la connexion"
6. Si succès, cliquez sur "Sauvegarder"

---

## 🔍 Où trouver vos identifiants Pronote ?

### URL de l'établissement :
- Généralement fournie par l'école
- Format : `https://nom-ecole.pronote.fr` ou similaire
- Parfois via un ENT : `https://ent.academie.fr`

### Identifiant et mot de passe :
- Fournis par l'école (cahier de correspondance, courrier)
- Souvent les mêmes que ceux utilisés pour l'ENT de l'école
- Contacter l'école en cas de perte

### Type CAS :
- **none** : Si connexion directe à Pronote
- **cas** : Si connexion via un ENT générique
- **cas-educonnect** : Si connexion via EduConnect
- **cas-moncollege-essonne** : Exemple spécifique selon l'académie

---

## 🧪 Scénarios de test recommandés

### 1. Test avec l'URL de démonstration officielle :
```
URL : https://demo.index-education.net/pronote/
Username : demonstration
Password : pronotevs
CAS : none
```

### 2. Test avec vos identifiants réels :
- Utilisez le script de test pour vérifier
- En cas d'erreur, vérifiez l'URL et les identifiants
- Contactez l'école si problème persiste

---

## ⚠️ Important

### Sécurité :
- ✅ Les mots de passe sont chiffrés en base de données
- ✅ Jamais stockés en clair
- ✅ Transmission sécurisée HTTPS

### Mode démo vs réel :
- **Mode démo** : Données simulées, aucun identifiant requis
- **Mode réel** : Connexion authentique à Pronote, données réelles

### Retour au mode démo :
```env
PRONOTE_DEMO_MODE=true
```

---

## 🐛 Dépannage

### Erreur "Identifiants incorrects" :
- Vérifiez l'orthographe du username/password
- Vérifiez que vous utilisez les identifiants élève (pas parent)
- Essayez différents types CAS

### Erreur "URL inaccessible" :
- Vérifiez que l'URL est correcte
- Essayez de vous connecter via un navigateur web
- Vérifiez que l'école n'a pas changé d'URL

### Erreur "Élève non trouvé" :
- Vérifiez que l'élève est bien inscrit dans cet établissement
- Contactez l'école pour vérifier le compte

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Testez d'abord avec le script `npm run test-pronote`
2. Vérifiez les logs du serveur backend
3. Consultez le guide complet `PRONOTE_INTEGRATION_GUIDE.md`
4. Contactez le support technique si nécessaire

---

## ✅ Checklist avant de passer en production

- [ ] Test de connexion réussi avec `npm run test-pronote`
- [ ] Récupération des notes fonctionne
- [ ] Récupération de l'emploi du temps fonctionne
- [ ] Récupération des devoirs fonctionne
- [ ] Modification de `PRONOTE_DEMO_MODE=false` dans `.env`
- [ ] Redémarrage du serveur
- [ ] Configuration dans l'interface utilisateur
- [ ] Test de synchronisation automatique

**Vous êtes prêt à utiliser Pronote avec des identifiants réels ! 🎉**
