# Guide d'Intégration et Test Pronote

## 🎯 Objectif

Ce guide explique comment tester l'intégration Pronote avec un mode démo réaliste qui simule le comportement réel de la plateforme.

---

## 📚 Partie 1 : Configuration du Mode Démo Pronote

### Variables d'environnement

Le mode démo est déjà activé dans votre fichier `.env` :

```env
# ─── PRONOTE INTEGRATION ───────────────────────────────────────────────────────────
PRONOTE_DEMO_MODE=true
PRONOTE_API_ENABLED=false
PRONOTE_AUTO_SYNC_INTERVAL=3600
```

### Avantages du mode démo

✅ **Pas besoin d'identifiants réels** : Test complet sans compte Pronote
✅ **Données réalistes** : Notes, devoirs, emploi du temps simulés
✅ **Test de scénarios** : Différents cas de connexion possibles
✅ **Développement rapide** : Pas d'attente pour les vraies API
✅ **Configuration facile** : Un seul fichier à modifier

---

## 🔧 Partie 2 : Services Pronote Créés

### 1. `pronoteService.js` - Service principal

#### Fonctionnalités en mode démo :

**Génération de notes réalistes :**
- Notes adaptées au niveau scolaire
- Matières variées (Maths, Français, Histoire, etc.)
- Coefficients réels
- Commentaires pédagogiques
- Moyennes de classe simulées

**Exemple de note générée :**
```json
{
  "id": "grade-student-1-0",
  "subject": "Mathématiques",
  "grade": 14,
  "maxGrade": 20,
  "coefficient": 3,
  "date": "2024-09-01T10:00:00.000Z",
  "comment": "Bon travail, peut encore progresser",
  "average": 13.5,
  "period": "Trimestre 1 2024-2025",
  "teacher": "M. Dupont"
}
```

**Génération de devoirs :**
- Types variés (exercices, lecture, projet, révision)
- Dates d'échéance réalistes
- Estimations de temps
- Priorités automatiques

**Génération de l'emploi du temps :**
- Jours de semaine complets
- Créneaux horaires réels
- Salles et professeurs
- Matières variées

**Génération d'absences :**
- Types d'absences (maladie, familial, retard)
- Justifications automatiques
- Durées réalistes

### 2. `pronoteController.js` - Contrôleur API

#### Endpoints créés :

| Endpoint | Méthode | Description |
|----------|----------|-------------|
| `/api/pronote/test-connection` | POST | Test connexion Pronote |
| `/api/children/:childId/pronote/config` | POST | Sauvegarde configuration |
| `/api/children/:childId/pronote/sync` | POST | Synchronisation notes |
| `/api/children/:childId/pronote/status` | GET | Statut connexion |
| `/api/children/:childId/pronote/homework` | GET | Devoirs à venir |
| `/api/children/:childId/pronote/schedule` | GET | Emploi du temps |
| `/api/children/:childId/pronote/absences` | GET | Absences |
| `/api/pronote/system-info` | GET | Informations système |

---

## 🚀 Partie 3 : Tester l'Intégration

### Étape 1 : Démarrer le serveur backend

```bash
cd backend
npm start
```

Le serveur devrait démarrer avec le message :
```
🚀 Guardian API — Port 3000
   Env:    development
   Pronote: Mode démo activé
```

### Étape 2 : Tester la connexion (simulation)

```bash
curl -X POST http://localhost:3000/api/pronote/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "schoolUrl": "https://demo.pronote.fr",
    "username": "demo.student",
    "password": "demo123",
    "casType": "none"
  }'
```

**Réponse attendue (succès) :**
```json
{
  "success": true,
  "message": "Connexion réussie (mode démo)",
  "student": {
    "firstName": "Ethan",
    "lastName": "Martin",
    "class": "3ème B",
    "school": "Collège Victor Hugo",
    "studentId": "ETH-2024-001",
    "period": "Trimestre 1 2024-2025"
  },
  "timestamp": "2024-09-03T10:00:00.000Z"
}
```

### Étape 3 : Tester la synchronisation des notes

```bash
curl -X POST http://localhost:3000/api/children/child-1/pronote/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Synchronisation terminée (mode démo): 5 notes importées",
  "grades": [
    {
      "subject": "Mathématiques",
      "grade": 14,
      "maxGrade": 20,
      "percentage": 70,
      "penaltyMins": 0,
      "bonusMins": 15,
      "adjustment": "+15 min bonus"
    },
    // ... autres notes
  ],
  "statistics": {
    "totalGrades": 5,
    "average": 13.5,
    "bestGrade": 0.85,
    "worstGrade": 0.6
  }
}
```

### Étape 4 : Tester les devoirs

```bash
curl http://localhost:3000/api/children/child-1/pronote/homework?daysAhead=7 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Étape 5 : Tester l'emploi du temps

```bash
curl http://localhost:3000/api/children/child-1/pronote/schedule \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 Partie 4 : Intégration dans l'Interface Utilisateur

### Exemple de composant React pour tester Pronote

```javascript
import { useState } from 'react';
import { API } from './api';

export function PronoteTester() {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [grades, setGrades] = useState([]);
  const [homework, setHomework] = useState([]);

  const testConnection = async () => {
    try {
      const response = await API.post('/pronote/test-connection', {
        schoolUrl: 'https://demo.pronote.fr',
        username: 'demo.student',
        password: 'demo123',
        casType: 'none'
      });
      setConnectionStatus(response.data);
    } catch (error) {
      setConnectionStatus({ success: false, message: error.message });
    }
  };

  const syncGrades = async () => {
    try {
      const response = await API.post('/children/child-1/pronote/sync');
      setGrades(response.data.grades);
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const getHomework = async () => {
    try {
      const response = await API.get('/children/child-1/pronote/homework?daysAhead=7');
      setHomework(response.data.homework);
    } catch (error) {
      console.error('Homework error:', error);
    }
  };

  return (
    <div>
      <h2>Test Pronote Integration</h2>
      
      <button onClick={testConnection}>
        Test Connexion
      </button>
      
      {connectionStatus && (
        <div>
          <p>Statut: {connectionStatus.success ? '✅ Connecté' : '❌ Échoué'}</p>
          <p>Message: {connectionStatus.message}</p>
          {connectionStatus.student && (
            <p>Élève: {connectionStatus.student.firstName} {connectionStatus.student.lastName}</p>
          )}
        </div>
      )}

      <button onClick={syncGrades}>
        Synchroniser Notes
      </button>

      {grades.length > 0 && (
        <div>
          <h3>Notes synchronisées:</h3>
          <ul>
            {grades.map((grade, index) => (
              <li key={index}>
                {grade.subject}: {grade.grade}/{grade.maxGrade} 
                ({grade.adjustment})
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={getHomework}>
        Obtenir Devoirs
      </button>

      {homework.length > 0 && (
        <div>
          <h3>Devoirs à venir:</h3>
          <ul>
            {homework.map((hw, index) => (
              <li key={index}>
                {hw.subject}: {hw.description} 
                (Échéance: {new Date(hw.dueDate).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## 📊 Partie 5 : Scénarios de Test Mode Démo

### Scénario 1 : Connexion réussie
```bash
curl -X POST http://localhost:3000/api/pronote/test-connection \
  -H "Content-Type: application/json" \
  -d '{"schoolUrl": "https://demo.pronote.fr", "username": "valid.user", "password": "validpass"}'
```

### Scénario 2 : Identifiants incorrects
```bash
curl -X POST http://localhost:3000/api/pronote/test-connection \
  -H "Content-Type: application/json" \
  -d '{"schoolUrl": "https://demo.pronote.fr", "username": "invalid", "password": "wrong"}'
```

### Scénario 3 : Synchronisation avec ajustements automatiques
- Notes < 30% : -60 minutes (pénalité)
- Notes < 50% : -30 minutes (pénalité)  
- Notes ≥ 80% : +15 minutes (bonus)
- Notes ≥ 90% : +30 minutes (bonus)

---

## 🔧 Partie 6 : Configuration pour Production

### Pour tester avec de vrais identifiants Pronote :

1. **La librairie est déjà installée :**
```bash
# Déjà installé : pronote-api-maintained
npm install pronote-api-maintained
```

2. **Modifier les variables d'environnement dans `.env` :**
```env
# Passer du mode démo au mode réel
PRONOTE_DEMO_MODE=false
PRONOTE_API_ENABLED=true
```

3. **Redémarrer le serveur :**
```bash
cd backend
npm start
```

4. **Configurer les identifiants réels :**
```bash
curl -X POST http://localhost:3000/api/children/child-1/pronote/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "schoolUrl": "https://votre-ecole.pronote.fr",
    "username": "votre_username",
    "password": "votre_password",
    "autoSync": true
  }'
```

### Données nécessaires pour la connexion Pronote :

1. **URL de l'établissement** : L'URL de l'instance Pronote de l'école
2. **Identifiant élève** : Le nom d'utilisateur Pronote
3. **Mot de passe** : Le mot de passe Pronote
4. **CAS (optionnel)** : Type de connexion si l'école utilise un ENT spécifique

### Cas de connexion supportés :

- **none** : Connexion directe Pronote
- **cas** : Connexion via CAS générique
- **cas-educonnect** : Connexion via EduConnect
- **cas-*autres** : Selon l'académie de l'école

---

## 🎯 Partie 7 : Vérification de la Conformité

### Comparaison Mode Démo vs Réalité

| Aspect | Mode Démo | Réalité Pronote |
|--------|-----------|-----------------|
| Structure des notes | ✅ Identique | ✅ Identique |
| Matières disponibles | ✅ Réalistes | ✅ Identique |
| Coefficients | ✅ Conformes | ✅ Identique |
| Commentaires | ✅ Pédagogiques | ✅ Identique |
| Devoirs | ✅ Types variés | ✅ Identique |
| Emploi du temps | ✅ Structure conforme | ✅ Identique |
| Absences | ✅ Types justifiés | ✅ Identique |

### Tests de conformité :

1. **Test structure des données :**
```javascript
const grade = pronoteService.generateDemoGrades('student-1', 1)[0];
console.log('Structure note:', Object.keys(grade));
// Devrait contenir: subject, grade, maxGrade, coefficient, date, comment, etc.
```

2. **Test calcul des ajustements :**
```javascript
const syncData = await pronoteService.syncStudentData('student-1');
syncData.grades.forEach(grade => {
  const percentage = (grade.grade / grade.maxGrade) * 100;
  console.log(`${grade.subject}: ${percentage}% - ${grade.adjustment}`);
});
```

---

## 📈 Partie 8 : Monitoring et Logs

### Logs générés par le service :

```
[Pronote] Mode démo - Simulation connexion
[Pronote] Mode démo - Génération notes simulées
[Pronote] Mode démo - Génération devoirs simulés
[Pronote Controller] Test connexion demandé
[Pronote Controller] Synchronisation notes demandée
```

### Activation des logs détaillés :

Pour voir plus de détails, vous pouvez modifier le niveau de log dans `.env` :

```env
LOG_LEVEL=debug
```

---

## 🚀 Partie 9 : Test Complet avec Postman

### Collection Postman suggérée :

**1. Test connexion :**
- Méthode : POST
- URL : `http://localhost:3000/api/pronote/test-connection`
- Body :
```json
{
  "schoolUrl": "https://demo.pronote.fr",
  "username": "demo.student",
  "password": "demo123",
  "casType": "none"
}
```

**2. Configuration :**
- Méthode : POST
- URL : `http://localhost:3000/api/children/child-1/pronote/config`
- Headers : `Authorization: Bearer YOUR_TOKEN`
- Body :
```json
{
  "schoolUrl": "https://demo.pronote.fr",
  "username": "demo.student",
  "password": "demo123",
  "autoSync": true
}
```

**3. Synchronisation :**
- Méthode : POST
- URL : `http://localhost:3000/api/children/child-1/pronote/sync`
- Headers : `Authorization: Bearer YOUR_TOKEN`

---

## 💡 Partie 10 : Prochaines Étapes

### Pour une intégration complète :

1. **Tester tous les endpoints** avec Postman ou curl
2. **Vérifier les ajustements de temps d'écran** selon les notes
3. **Tester l'interface utilisateur** avec les données démo
4. **Valider la conformité** avec la vraie API Pronote
5. **Passer en mode production** avec les vrais identifiants

### Pour personnaliser le mode démo :

1. **Modifier les étudiants de démo** dans `generateDemoStudents()`
2. **Ajuster les algorithmes de génération de notes** selon vos besoins
3. **Personnaliser les commentaires pédagogiques** dans `generateComment()`
4. **Adapter les coefficients** dans `getCoefficient()`

---

## 📞 Support

Pour toute question sur l'intégration Pronote :
- Consulter les logs pour voir les détails des opérations
- Tester les fonctions individuellement dans le service
- Modifier les paramètres de génération selon vos besoins

Le mode démo est conçu pour être aussi réaliste que possible pour permettre des tests complets sans avoir besoin d'un compte Pronote réel !
