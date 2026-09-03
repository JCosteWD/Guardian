# Guide des Indicateurs de Mode Pronote

## 🎯 Aperçu

Le système fournit maintenant des indicateurs clairs pour savoir si vous êtes sur le compte démo ou connecté au vrai compte Pronote.

---

## 📊 Indicateurs disponibles dans les réponses API

### Chaque réponse API Pronote contient maintenant :

```json
{
  "success": true,
  "mode": "DEMO" | "REAL" | "HYBRID_WITH_CONFIG" | "PRODUCTION",
  "modeMessage": "Message explicite avec emoji",
  "isRealAccount": true | false,
  "isDemoAccount": true | false,
  "dataSource": "PRONOTE_RÉEL" | "DONNÉES_SIMULÉES"
}
```

---

## 🎨 Codes couleur et messages

### 🟢 Mode réel (PRONOTE_RÉEL)
- **Couleur** : Vert (`#10b981`)
- **Emoji** : 🎉
- **Message** : "🎉 Connexion réussie au vrai compte Pronote !"
- **dataSource** : "PRONOTE_RÉEL"
- **isRealAccount** : true
- **isDemoAccount** : false

### 🟡 Mode hybride avec configuration
- **Couleur** : Orange (`#f59e0b`)
- **Emoji** : 🔄
- **Message** : "🔄 Mode hybride - Configuration Pronote présente"
- **dataSource** : "DONNÉES_SIMULÉES" (jusqu'à connexion réussie)
- **isRealAccount** : false
- **isDemoAccount** : true
- **hasRealConfig** : true

### ⚪ Mode démo pur
- **Couleur** : Gris (`#6b7280`)
- **Emoji** : 🧪
- **Message** : "🧪 Mode démo pur - Aucune configuration Pronote"
- **dataSource** : "DONNÉES_SIMULÉES"
- **isRealAccount** : false
- **isDemoAccount** : true
- **hasRealConfig** : false

---

## 🔍 Exemples de réponses API

### 1. Test de connexion réussi (mode réel)

```bash
curl -X POST http://localhost:3000/api/pronote/test-connection \
  -H "Content-Type: application/json" \
  -d '{"schoolUrl":"https://demo.index-education.net/pronote/","username":"demonstration","password":"pronotevs"}'
```

**Réponse :**
```json
{
  "success": true,
  "message": "Connexion réussie (mode réel)",
  "student": {
    "firstName": "Démonstration",
    "lastName": "PRONOTE",
    "class": "CLASSE DÉMO",
    "school": "https://demo.index-education.net/pronote/"
  },
  "mode": "REAL",
  "modeMessage": "🎉 Connexion réussie au vrai compte Pronote !",
  "isRealAccount": true,
  "isDemoAccount": false,
  "dataSource": "PRONOTE_RÉEL"
}
```

### 2. Test de connexion en mode démo

```bash
curl -X POST http://localhost:3000/api/pronote/test-connection \
  -H "Content-Type: application/json" \
  -d '{"schoolUrl":"demo","username":"demo","password":"demo"}'
```

**Réponse :**
```json
{
  "success": true,
  "message": "Connexion simulée réussie (mode démo)",
  "student": {
    "firstName": "Ethan",
    "lastName": "Martin",
    "class": "3ème B"
  },
  "mode": "DEMO",
  "modeMessage": "🧪 Mode démo actif - Données simulées",
  "isRealAccount": false,
  "isDemoAccount": true,
  "dataSource": "DONNÉES_SIMULÉES"
}
```

### 3. Statut Pronote

```bash
curl http://localhost:3000/api/children/child-1/pronote/status
```

**Réponse en mode démo pur :**
```json
{
  "connected": true,
  "platform": "pronote",
  "mode": "DEMO",
  "modeMessage": "🧪 Mode démo pur - Aucune configuration Pronote",
  "isRealAccount": false,
  "isDemoAccount": true,
  "dataSource": "DONNÉES_SIMULÉES",
  "hasRealConfig": false,
  "lastSync": "2024-09-03T15:30:00.000Z",
  "autoSync": true
}
```

**Réponse en mode hybride avec config :**
```json
{
  "connected": true,
  "platform": "pronote",
  "mode": "HYBRID_WITH_CONFIG",
  "modeMessage": "🔄 Mode hybride - Configuration Pronote présente (connectez-vous pour utiliser les vraies données)",
  "isRealAccount": false,
  "isDemoAccount": true,
  "dataSource": "DONNÉES_SIMULÉES",
  "hasRealConfig": true,
  "lastSync": "2024-09-03T15:30:00.000Z",
  "autoSync": true
}
```

### 4. Synchronisation

```bash
curl -X POST http://localhost:3000/api/children/child-1/pronote/sync
```

**Réponse en mode réel :**
```json
{
  "success": true,
  "message": "8 notes synchronisées depuis Pronote",
  "mode": "REAL",
  "modeMessage": "🎉 Synchronisation depuis le vrai compte Pronote !",
  "isRealAccount": true,
  "isDemoAccount": false,
  "dataSource": "PRONOTE_RÉEL",
  "grades": [...]
}
```

**Réponse en mode démo :**
```json
{
  "success": true,
  "message": "Synchronisation terminée (mode démo): 5 notes importées",
  "mode": "DEMO",
  "modeMessage": "🧪 Synchronisation en mode démo - Données simulées",
  "isRealAccount": false,
  "isDemoAccount": true,
  "dataSource": "DONNÉES_SIMULÉES",
  "grades": [...]
}
```

---

## 🎨 Composant React pour afficher l'indicateur

Un composant React a été créé : `PronoteModeIndicator.jsx`

### Utilisation :

```jsx
import PronoteModeIndicator from './components/pronote/PronoteModeIndicator';

function ChildrenPage() {
  return (
    <div>
      <PronoteModeIndicator childId="child-1" />
      {/* Autre contenu */}
    </div>
  );
}
```

### Affichage selon le mode :

- **🟢 Vert** : Compte Pronote réel connecté
- **🟡 Orange** : Mode hybride avec configuration
- **⚪ Gris** : Mode démo pur

---

## 🔧 Vérification rapide

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
  "mode": "HYBRID",
  "modeMessage": "🔄 Mode hybride - Démo avec possibilité d'utiliser de vrais identifiants Pronote",
  "isRealAccount": false,
  "isDemoAccount": true,
  "dataSource": "DONNÉES_SIMULÉES"
}
```

---

## 📋 Résumé des indicateurs

| Endpoint | Indicateurs inclus |
|----------|-------------------|
| `/api/pronote/test-connection` | ✅ mode, modeMessage, isRealAccount, isDemoAccount, dataSource |
| `/api/children/:id/pronote/status` | ✅ mode, modeMessage, isRealAccount, isDemoAccount, dataSource, hasRealConfig |
| `/api/children/:id/pronote/sync` | ✅ mode, modeMessage, isRealAccount, isDemoAccount, dataSource |
| `/api/children/:id/pronote/homework` | ✅ mode, modeMessage, isRealAccount, isDemoAccount, dataSource |
| `/api/children/:id/pronote/schedule` | ✅ mode, modeMessage, isRealAccount, isDemoAccount, dataSource |
| `/api/children/:id/pronote/absences` | ✅ mode, modeMessage, isRealAccount, isDemoAccount, dataSource |
| `/api/pronote/system-info` | ✅ mode, modeMessage, isRealAccount, isDemoAccount, dataSource |

---

## 🎯 Comment interpréter les indicateurs

### `isRealAccount: true`
- ✅ Vous êtes connecté au vrai compte Pronote
- ✅ Les données sont réelles
- ✅ La synchronisation fonctionnera avec les vraies données

### `isRealAccount: false` + `hasRealConfig: true`
- ⚠️ Une configuration existe mais la connexion n'est pas active
- 🔄 Le système peut basculer vers le mode réel si la connexion réussit
- 🧪 Actuellement en mode démo

### `isRealAccount: false` + `hasRealConfig: false`
- 🧪 Mode démo pur
- 🧪 Aucune configuration Pronote
- 🧪 Toutes les données sont simulées

---

## 💡 Conseils d'utilisation

1. **Toujours vérifier** `isRealAccount` avant de prendre des décisions basées sur les données
2. **Afficher** `modeMessage` à l'utilisateur pour une information claire
3. **Utiliser** `dataSource` pour indiquer l'origine des données
4. **Surveiller** `hasRealConfig` pour savoir si une configuration existe

Ces indicateurs vous permettent de savoir exactement dans quel mode vous vous trouvez et d'agir en conséquence ! 🎉
