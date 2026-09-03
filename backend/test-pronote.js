// ── PRONOTE CONNECTION TEST SCRIPT ─────────────────────────────────────────────────────
// Script pour tester la connexion Pronote avec de vrais identifiants

const pronote = require('pronote-api-maintained');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fonction pour poser une question
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Fonction principale de test
async function testPronoteConnection() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('        TEST DE CONNEXION PRONOTE AVEC VRAIS IDENTIFIANTS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    // Demander les informations de connexion
    const schoolUrl = await askQuestion('URL de l\'établissement Pronote : ');
    const username = await askQuestion('Identifiant élève : ');
    const password = await askQuestion('Mot de passe : ');
    const casType = await askQuestion('Type CAS (none, cas, cas-educonnect, etc.) [none] : ') || 'none';

    console.log('\n🔐 Tentative de connexion...');

    // Tenter la connexion
    const session = await pronote.login(schoolUrl, username, password, casType);

    console.log('✅ Connexion réussie !\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('INFORMATIONS ÉLÈVE :');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`Nom complet : ${session.user.name}`);
    console.log(`Classe : ${session.user.studentClass.name}`);
    console.log(`ID Élève : ${session.user.id}`);
    console.log(`Période actuelle : ${session.params.currentPeriod.name}`);
    console.log(`Établissement : ${session.params.school.name}`);

    // Récupérer et afficher les notes
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('RÉCUPÉRATION DES NOTES...');
    console.log('═══════════════════════════════════════════════════════════════════');
    
    const marks = await session.marks();
    console.log(`✅ ${marks.length} notes récupérées`);
    console.log(`Moyenne élève : ${marks.averages.student}`);
    console.log(`Moyenne classe : ${marks.averages.studentClass}`);

    if (marks.length > 0) {
      console.log('\nDernières notes :');
      marks.slice(0, 5).forEach((mark, index) => {
        console.log(`${index + 1}. ${mark.subject.name}: ${mark.student.value}/${mark.outOf} (coef ${mark.coefficient})`);
      });
    }

    // Récupérer et afficher l'emploi du temps
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('RÉCUPÉRATION DE L\'EMPLOI DU TEMPS...');
    console.log('═══════════════════════════════════════════════════════════════════');
    
    const timetable = await session.timetable();
    console.log(`✅ ${timetable.length} cours aujourd'hui`);

    if (timetable.length > 0) {
      console.log('\nEmploi du temps du jour :');
      timetable.slice(0, 5).forEach((course, index) => {
        const from = new Date(course.from);
        const to = new Date(course.to);
        console.log(`${index + 1}. ${from.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}-${to.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} : ${course.subject.name} (${course.room || 'Salle non spécifiée'})`);
      });
    }

    // Récupérer et afficher les devoirs
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('RÉCUPÉRATION DES DEVOIRS...');
    console.log('═══════════════════════════════════════════════════════════════════');
    
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 7);
    
    const homework = await session.homeworks(from, to);
    console.log(`✅ ${homework.length} devoirs pour les 7 prochains jours`);

    if (homework.length > 0) {
      console.log('\nDevoirs à venir :');
      homework.slice(0, 5).forEach((hw, index) => {
        const dueDate = new Date(hw.date);
        console.log(`${index + 1}. ${hw.subject.name} - ${dueDate.toLocaleDateString('fr-FR')} : ${hw.description.substring(0, 50)}...`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('✅ TEST TERMINÉ AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('\nVous pouvez maintenant utiliser ces identifiants dans l\'application Guardian !');
    console.log('URL :', schoolUrl);
    console.log('Username :', username);
    console.log('CAS :', casType);

  } catch (err) {
    console.log('\n❌ ERREUR DE CONNEXION');
    console.log('═══════════════════════════════════════════════════════════════════');
    
    if (err.code === pronote.errors.WRONG_CREDENTIALS.code) {
      console.log('❌ Identifiants incorrects');
    } else if (err.code === pronote.errors.USER_NOT_FOUND.code) {
      console.log('❌ Utilisateur non trouvé');
    } else {
      console.log('❌ Erreur :', err.message);
    }
    
    console.log('\nVérifiez :');
    console.log('- L\'URL de l\'établissement');
    console.log('- L\'identifiant et le mot de passe');
    console.log('- Le type CAS si nécessaire');
  } finally {
    rl.close();
  }
}

// Lancer le test
testPronoteConnection();
