// ── PRONOTE INTEGRATION SERVICE ─────────────────────────────────────────────────────
// Service d'intégration Pronote avec mode démo réaliste pour tests

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const pronote = require('pronote-api-maintained');
const pawnote = require('pawnote');
const { loginHeadless, closeSession } = require('./pronoteHeadless');

const getPawnotePeriod = (session) => session.instance?.periods?.[0];

class PronoteService {
  constructor() {
    this.demoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';
    this.demoStudents = this.generateDemoStudents();
    this.activeSessions = new Map();
    // Mode hybride : demoMode = true mais permet l'utilisation de vrais identifiants
    this.hybridMode = true; 
  }

  setActiveSession(childId, session) {
    if (childId && session) this.activeSessions.set(String(childId), session);
  }

  getActiveSession(childId) {
    return this.activeSessions.get(String(childId)) || null;
  }

  async removeActiveSession(childId) {
    const session = this.activeSessions.get(String(childId));
    this.activeSessions.delete(String(childId));
    if (session?.__headless) await closeSession(session);
  }

  // ── MODE DÉMO: Étudiants simulés réalistes ───────────────────────────────────────
  generateDemoStudents() {
    return {
      'student-1': {
        firstName: 'Ethan',
        lastName: 'Martin',
        class: '3ème B',
        school: 'Collège Victor Hugo',
        studentId: 'ETH-2024-001',
        period: 'Trimestre 1 2024-2025'
      },
      'student-2': {
        firstName: 'Morgan',
        lastName: 'Dubois',
        class: '6ème A',
        school: 'Collège Victor Hugo',
        studentId: 'MOR-2024-002',
        period: 'Trimestre 1 2024-2025'
      },
      'student-3': {
        firstName: 'Lana',
        lastName: 'Petit',
        class: 'CM2',
        school: 'École Primaire Jules Ferry',
        studentId: 'LAN-2024-003',
        period: 'Trimestre 1 2024-2025'
      }
    };
  }

  // ── MODE DÉMO: Notes réalistes ─────────────────────────────────────────────────────
  generateDemoGrades(studentId, count = 5) {
    const subjects = [
      { name: 'Mathématiques', maxGrade: 20 },
      { name: 'Français', maxGrade: 20 },
      { name: 'Histoire-Géographie', maxGrade: 20 },
      { name: 'Anglais', maxGrade: 20 },
      { name: 'Physique-Chimie', maxGrade: 20 },
      { name: 'SVT', maxGrade: 20 },
      { name: 'EPS', maxGrade: 20 },
      { name: 'Arts Plastiques', maxGrade: 20 }
    ];

    const grades = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const subject = subjects[i % subjects.length];
      const grade = this.generateRealisticGrade(subject.name);
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7); // Une note par semaine

      grades.push({
        id: `grade-${studentId}-${i}`,
        subject: subject.name,
        grade: grade.value,
        maxGrade: subject.maxGrade,
        coefficient: this.getCoefficient(subject.name),
        date: date.toISOString(),
        comment: this.generateComment(grade.value, subject.name),
        average: this.calculateClassAverage(subject.name, grade.value),
        period: 'Trimestre 1 2024-2025',
        teacher: this.getRandomTeacher()
      });
    }

    return grades;
  }

  generateRealisticGrade(subject) {
    // Notes réalistes selon la matière
    const subjectDifficulty = {
      'Mathématiques': { min: 8, max: 18, average: 13 },
      'Français': { min: 10, max: 19, average: 14 },
      'Histoire-Géographie': { min: 9, max: 18, average: 14 },
      'Anglais': { min: 7, max: 17, average: 12 },
      'Physique-Chimie': { min: 8, max: 17, average: 13 },
      'SVT': { min: 10, max: 18, average: 14 },
      'EPS': { min: 12, max: 20, average: 16 },
      'Arts Plastiques': { min: 14, max: 20, average: 17 }
    };

    const difficulty = subjectDifficulty[subject] || { min: 10, max: 18, average: 14 };
    const value = Math.floor(Math.random() * (difficulty.max - difficulty.min + 1)) + difficulty.min;
    
    return {
      value,
      percentage: (value / 20) * 100,
      level: this.getGradeLevel(value)
    };
  }

  getGradeLevel(grade) {
    if (grade >= 16) return 'Excellent';
    if (grade >= 14) return 'Très bien';
    if (grade >= 12) return 'Bien';
    if (grade >= 10) return 'Assez bien';
    if (grade >= 8) return 'Passable';
    return 'Insuffisant';
  }

  getCoefficient(subject) {
    const coefficients = {
      'Mathématiques': 3,
      'Français': 3,
      'Histoire-Géographie': 2,
      'Anglais': 2,
      'Physique-Chimie': 2,
      'SVT': 2,
      'EPS': 1,
      'Arts Plastiques': 1
    };
    return coefficients[subject] || 1;
  }

  calculateClassAverage(subject, studentGrade) {
    // Moyenne de classe réaliste autour de la note de l'élève
    const variation = (Math.random() - 0.5) * 4; // ±2 points
    return Math.max(8, Math.min(18, studentGrade + variation));
  }

  generateComment(grade, subject) {
    const comments = {
      excellent: [
        'Excellent travail, continue comme ça !',
        'Très bonne compréhension du sujet',
        'Participation remarquable en classe'
      ],
      good: [
        'Bon travail, peut encore progresser',
        'Compréhension satisfaisante',
        'Effort constant'
      ],
      average: [
        'Des efforts sont nécessaires',
        'Attention à la concentration',
        'Peut mieux faire avec plus de travail'
      ],
      poor: [
        'Des progrès sont attendus',
        'Retard important, rattrapage nécessaire',
        'Travail personnel insuffisant'
      ]
    };

    let category;
    if (grade >= 16) category = 'excellent';
    else if (grade >= 12) category = 'good';
    else if (grade >= 10) category = 'average';
    else category = 'poor';

    const categoryComments = comments[category];
    return categoryComments[Math.floor(Math.random() * categoryComments.length)];
  }

  getRandomTeacher() {
    const teachers = [
      'M. Dupont',
      'Mme. Martin',
      'M. Bernard',
      'Mme. Petit',
      'M. Robert',
      'Mme. Richard'
    ];
    return teachers[Math.floor(Math.random() * teachers.length)];
  }

  // ── MODE DÉMO: Devoirs ───────────────────────────────────────────────────────────
  generateDemoHomework(studentId, daysAhead = 7) {
    const homeworkTypes = [
      { type: 'exercice', subjects: ['Mathématiques', 'Français', 'Anglais'] },
      { type: 'lecture', subjects: ['Histoire', 'Français', 'SVT'] },
      { type: 'projet', subjects: ['Histoire-Géographie', 'Arts Plastiques'] },
      { type: 'révision', subjects: ['Physique-Chimie', 'SVT'] }
    ];

    const homework = [];
    const now = new Date();

    for (let i = 0; i < 5; i++) {
      const hwType = homeworkTypes[i % homeworkTypes.length];
      const subject = hwType.subjects[Math.floor(Math.random() * hwType.subjects.length)];
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * daysAhead) + 1);

      homework.push({
        id: `hw-${studentId}-${i}`,
        subject: subject,
        type: hwType.type,
        description: this.generateHomeworkDescription(hwType.type, subject),
        dueDate: dueDate.toISOString(),
        isDone: Math.random() > 0.7, // 30% de chance d'être déjà fait
        estimatedTime: Math.floor(Math.random() * 60) + 15, // 15-75 minutes
        priority: this.getHomeworkPriority(dueDate)
      });
    }

    return homework;
  }

  generateHomeworkDescription(type, subject) {
    const descriptions = {
      exercise: [
        `Exercices ${subject} pages 45-47`,
        `Série d'exercices ${subject} à terminer`,
        `Préparer les exercices ${subject} pour demain`
      ],
      lecture: [
        `Lire le chapitre ${subject} et répondre aux questions`,
        `Lecture documentaire ${subject} avec prise de notes`,
        `Lire les pages 23-28 du manuel ${subject}`
      ],
      projet: [
        `Projet ${subject} à finaliser pour la semaine prochaine`,
        `Recherches sur le thème ${subject}`,
        `Préparer présentation ${subject}`
      ],
      revision: [
        `Réviser le chapitre ${subject} pour le contrôle`,
        `Faire une fiche de révision ${subject}`,
        `Réviser les formules et définitions ${subject}`
      ]
    };

    const typeDescriptions = descriptions[type];
    return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
  }

  getHomeworkPriority(dueDate) {
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilDue <= 1) return 'urgent';
    if (daysUntilDue <= 3) return 'high';
    if (daysUntilDue <= 7) return 'normal';
    return 'low';
  }

  // ── MODE DÉMO: Emploi du temps ───────────────────────────────────────────────────────
  generateDemoSchedule(studentId) {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const timeSlots = [
      '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00'
    ];
    const subjects = [
      'Mathématiques', 'Français', 'Histoire-Géographie', 'Anglais',
      'Physique-Chimie', 'SVT', 'EPS', 'Arts Plastiques'
    ];

    const schedule = {};
    days.forEach(day => {
      schedule[day] = [];
      timeSlots.forEach((slot, index) => {
        if (Math.random() > 0.2) { // 80% de chance d'avoir cours
          schedule[day].push({
            time: slot,
            subject: subjects[index % subjects.length],
            room: `Salle ${Math.floor(Math.random() * 10) + 1}`,
            teacher: this.getRandomTeacher()
          });
        }
      });
    });

    return schedule;
  }

  // ── MODE DÉMO: Absences ───────────────────────────────────────────────────────────
  generateDemoAbsences(studentId) {
    const absenceTypes = [
      { type: 'maladie', justified: true },
      { type: 'familial', justified: true },
      { type: 'retard', justified: false }
    ];

    const absences = [];
    const now = new Date();

    // Génération de 0-3 absences aléatoires
    const absenceCount = Math.floor(Math.random() * 4);

    for (let i = 0; i < absenceCount; i++) {
      const absenceType = absenceTypes[Math.floor(Math.random() * absenceTypes.length)];
      const date = new Date(now);
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));

      absences.push({
        id: `abs-${studentId}-${i}`,
        date: date.toISOString(),
        type: absenceType.type,
        justified: absenceType.justified,
        reason: this.generateAbsenceReason(absenceType.type),
        duration: Math.random() > 0.5 ? 'journée' : 'demi-journée'
      });
    }

    return absences;
  }

  generateAbsenceReason(type) {
    const reasons = {
      maladie: ['Grippe', 'Fièvre', 'Maladie virale', 'Rendez-vous médical'],
      familial: ['Événement familial', 'Déménagement', 'Décès dans la famille'],
      retard: ['Réveil difficile', 'Problèmes de transport', 'Oubli de matériel']
    };

    const typeReasons = reasons[type];
    return typeReasons[Math.floor(Math.random() * typeReasons.length)];
  }

  // ── CONNEXION PRONOTE (RÉELLE) ───────────────────────────────────────────────────
  async login(schoolUrl, username, password, casType = 'none', forceReal = false) {
    // Mode hybride : permet toujours la connexion réelle si demandé
    if (!forceReal && this.demoMode && !this.hybridMode) {
      logger.warn('[Pronote] Mode démo - Simulation connexion');
      await this.simulateLoginDelay();
      return {
        success: true,
        student: this.demoStudents['student-1'],
        message: 'Connexion simulée réussie (mode démo)'
      };
    }

    try {
      logger.info(`[Pronote] Tentative de connexion réelle pour ${username} à ${schoolUrl}`);

      if (casType === 'none') {
        try {
          const headlessSession = await loginHeadless({
            schoolUrl,
            username,
            password,
            account: /\/parent\.html(?:$|\?)/i.test(schoolUrl) ? 'parent' : 'student',
          });
          if (headlessSession.success) {
            headlessSession.__headless = true;
            this.setActiveSession(headlessSession.id, headlessSession);
            return {
              success: true,
              student: {
                firstName: username,
                lastName: '',
                class: '',
                school: schoolUrl,
                studentId: headlessSession.id,
                period: 'Période actuelle'
              },
              session: headlessSession,
              message: 'Connexion réussie (mode réel Playwright)'
            };
          }
          logger.warn('[Pronote] Connexion Playwright échouée', headlessSession.message);
          return {
            success: false,
            message: headlessSession.message || 'Connexion Pronote impossible.'
          };
        } catch (headlessError) {
          logger.warn('[Pronote] Playwright indisponible', headlessError.message);
        }

        let modernInstance;
        try {
          const instance = await pawnote.instance(schoolUrl);
          modernInstance = instance;
          const accountKind = /\/parent\.html(?:$|\?)/i.test(schoolUrl)
            ? pawnote.AccountKind.PARENT
            : pawnote.AccountKind.STUDENT;
          const session = pawnote.createSessionHandle();
          await pawnote.loginCredentials(session, {
            url: pawnote.cleanURL(schoolUrl),
            kind: accountKind,
            username,
            password,
            deviceUUID: crypto.randomUUID(),
          });
          session.__pawnote = true;

          const resource = session.userResource || session.user?.resources?.[0];
          return {
            success: true,
            student: {
              firstName: session.user.name.split(' ')[0],
              lastName: session.user.name.split(' ').slice(1).join(' '),
              class: resource?.className || '',
              school: instance.name || schoolUrl,
              studentId: session.user.id,
              period: 'Période actuelle'
            },
            session,
            message: 'Connexion réussie (mode réel Pawnote)'
          };
        } catch (modernError) {
          if (modernInstance?.version?.[0] >= 2024) {
            logger.warn('[Pronote] Échec de connexion Pawnote sur une instance moderne', modernError.message);
            if (modernError.name === 'PageUnavailableError') {
              return {
                success: false,
                message: 'L\'instance Pronote est reconnue, mais son point de connexion n\'est pas disponible. Vérifiez que l\'URL correspond à l\'espace élève et que le compte est autorisé à se connecter.'
              };
            }
            return {
              success: false,
              message: modernError.message || 'Connexion impossible avec le connecteur Pronote moderne.'
            };
          }
          logger.warn('[Pronote] Pawnote indisponible, tentative avec ancien connecteur', modernError.message);
        }
      }
      
      // Respect the account endpoint supplied by the user.
      const loginMethod = /\/parent\.html(?:$|\?)/i.test(schoolUrl)
        ? pronote.loginParent
        : pronote.login;
      const session = await loginMethod(schoolUrl, username, password, casType);
      
      logger.info(`[Pronote] Connexion réussie pour ${session.user.name}`);
      
      return {
        success: true,
        student: {
          firstName: session.user.name.split(' ')[0],
          lastName: session.user.name.split(' ').slice(1).join(' '),
          class: session.user.studentClass.name,
          school: schoolUrl,
          studentId: session.user.id,
          period: session.params.currentPeriod.name
        },
        session: session,
        message: 'Connexion réussie (mode réel)'
      };
    } catch (err) {
      logger.error('[Pronote] Login error:', err);
      
      // Gérer les erreurs spécifiques
      if (err.code === pronote.errors.WRONG_CREDENTIALS.code) {
        return {
          success: false,
          message: 'Identifiants incorrects'
        };
      }
      
      // Gérer les erreurs de connexion/URL
      if (err.message && err.message.includes('Unexpected token')) {
        return {
          success: false,
          message: 'Cette instance Pronote est accessible, mais son format moderne n\'est pas compatible avec l\'ancien connecteur. Utilisez le connecteur Pawnote moderne ou une connexion EduConnect interactive.'
        };
      }

      if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(err.code)) {
        return {
          success: false,
          message: 'Serveur Pronote inaccessible. Vérifiez l\'URL de l\'établissement et votre connexion réseau.'
        };
      }

      if (err instanceof TypeError && err.message.includes('Cannot set properties of null')) {
        return {
          success: false,
          message: 'Ce portail utilise une authentification EduConnect interactive. La connexion directe par identifiant n\'est pas prise en charge par ce connecteur.'
        };
      }
      
      // En mode hybride, proposer un fallback
      if (this.hybridMode) {
        logger.warn('[Pronote] Erreur connexion réelle, fallback vers mode démo disponible');
        return {
          success: false,
          message: `Erreur de connexion: ${err.message}. En mode hybride, vous pouvez continuer avec le mode démo.`,
          fallbackAvailable: true
        };
      }
      
      return {
        success: false,
        message: err.message || 'Erreur de connexion Pronote'
      };
    }
  }

  async simulateLoginDelay() {
    // Simule le temps de connexion réel (1-3 secondes)
    const delay = 1000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // ── RÉCUPÉRATION NOTES ───────────────────────────────────────────────────────────
  async getGrades(session, weeksBack = 4) {
    if (this.demoMode && !session?.__pawnote) {
      logger.warn('[Pronote] Mode démo - Génération notes simulées');
      await this.simulateApiDelay();
      return this.generateDemoGrades('student-1', weeksBack);
    }

    try {
      const marks = session.__pawnote
        ? (await pawnote.gradesOverview(session, getPawnotePeriod(session))).grades
        : await session.marks();
      
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - weeksBack * 7);

      return marks.map(m => ({
        id: `pronote-${m.id}`,
        subject: m.subject.name,
        grade: Number(m.student?.value ?? m.value?.points ?? 0),
        maxGrade: Number(m.outOf?.points ?? m.outOf ?? 20),
        coefficient: m.coefficient || 1,
        date: new Date(m.date).toISOString(),
        comment: m.comment || '',
        average: Number(m.average?.points ?? m.average ?? 0),
        period: session.__pawnote ? 'Période actuelle' : session.params.currentPeriod.name,
        teacher: m.teacherName || ''
      }));
    } catch (err) {
      logger.error('[Pronote] getGrades error:', err);
      return [];
    }
  }

  async simulateApiDelay() {
    // Simule le temps de réponse API (500ms-2s)
    const delay = 500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // ── RÉCUPÉRATION DEVOIRS ─────────────────────────────────────────────────────────
  async getHomework(session, daysAhead = 7) {
    if (this.demoMode && !session?.__pawnote) {
      logger.warn('[Pronote] Mode démo - Génération devoirs simulés');
      await this.simulateApiDelay();
      return this.generateDemoHomework('student-1', daysAhead);
    }

    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + daysAhead);

      const homework = session.__pawnote
        ? await pawnote.assignmentsFromIntervals(session, from, to)
        : await session.homeworks(from, to);
      
      return homework.map(h => ({
        id: `pronote-hw-${h.id}`,
        subject: h.subject.name,
        type: 'devoir',
        description: h.description,
        dueDate: new Date(h.date || h.deadline).toISOString(),
        isDone: h.done,
        estimatedTime: h.length || 60,
        priority: this.getHomeworkPriority(new Date(h.date || h.deadline))
      }));
    } catch (err) {
      logger.error('[Pronote] getHomework error:', err);
      return [];
    }
  }

  // ── RÉCUPÉRATION EMPLOI DU TEMPS ───────────────────────────────────────────────────
  async getSchedule(session) {
    if (this.demoMode) {
      logger.warn('[Pronote] Mode démo - Génération emploi du temps simulé');
      await this.simulateApiDelay();
      return this.generateDemoSchedule('student-1');
    }

    try {
      const timetable = await session.timetable();
      
      const schedule = {};
      timetable.forEach(course => {
        const day = new Date(course.from).toLocaleDateString('fr-FR', { weekday: 'long' });
        const time = `${new Date(course.from).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}-${new Date(course.to).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        
        if (!schedule[day]) schedule[day] = [];
        schedule[day].push({
          time,
          subject: course.subject.name,
          room: course.room || '',
          teacher: course.teacherName || ''
        });
      });
      
      return schedule;
    } catch (err) {
      logger.error('[Pronote] getSchedule error:', err);
      return {};
    }
  }

  // ── RÉCUPÉRATION ABSENCES ───────────────────────────────────────────────────────
  async getAbsences(session) {
    if (this.demoMode) {
      logger.warn('[Pronote] Mode démo - Génération absences simulées');
      await this.simulateApiDelay();
      return this.generateDemoAbsences('student-1');
    }

    try {
      const absences = await session.absences();
      
      return absences.map(a => ({
        id: `pronote-abs-${a.id}`,
        date: new Date(a.from).toISOString(),
        type: a.reason || 'absence',
        justified: a.justified || false,
        reason: a.reason || '',
        duration: a.duration || 'journée'
      }));
    } catch (err) {
      logger.error('[Pronote] getAbsences error:', err);
      return [];
    }
  }

  // ── VALIDATION CONNEXION ───────────────────────────────────────────────────────────
  async testConnection(schoolUrl, username, password, casType = 'none') {
    // Mode hybride : teste toujours la vraie connexion si des identifiants sont fournis
    if (this.demoMode && !this.hybridMode) {
      logger.warn('[Pronote] Mode démo - Test connexion simulé');
      await this.simulateLoginDelay();
      
      // Simuler différents scénarios de connexion
      const scenarios = ['success', 'invalid_credentials', 'server_error', 'timeout'];
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      
      switch (scenario) {
        case 'success':
          return {
            success: true,
            message: 'Connexion réussie (mode démo)',
            student: this.demoStudents['student-1']
          };
        case 'invalid_credentials':
          return {
            success: false,
            message: 'Identifiants incorrects (simulation démo)'
          };
        case 'server_error':
          return {
            success: false,
            message: 'Serveur Pronote temporairement indisponible (simulation démo)'
          };
        case 'timeout':
          return {
            success: false,
            message: 'Délai d\'attente dépassé (simulation démo)'
          };
        default:
          return {
            success: true,
            message: 'Connexion réussie (mode démo)',
            student: this.demoStudents['student-1']
          };
      }
    }

    // Mode hybride ou production : teste la vraie connexion
    try {
      return await this.login(schoolUrl, username, password, casType, true); // forceReal = true
    } catch (err) {
      return {
        success: false,
        message: err.message
      };
    }
  }

  // ── SYNCHRONISATION COMPLÈTE ─────────────────────────────────────────────────────
  async syncStudentData(session) {
    logger.info(`[Pronote] Synchronisation données pour étudiant`);

    const syncData = {
      grades: await this.getGrades(session),
      homework: await this.getHomework(session),
      schedule: await this.getSchedule(session),
      absences: await this.getAbsences(session),
      lastSync: new Date().toISOString()
    };

    logger.info(`[Pronote] Sync terminée: ${syncData.grades.length} notes, ${syncData.homework.length} devoirs`);
    return syncData;
  }

  // ── STATISTIQUES SYNCHRONISATION ───────────────────────────────────────────────────
  getSyncStatistics() {
    return {
      mode: this.demoMode ? 'DEMO' : 'PRODUCTION',
      lastSync: new Date().toISOString(),
      demoStudents: Object.keys(this.demoStudents).length,
      availableFeatures: [
        'notes',
        'devoirs', 
        'emploi_du_temps',
        'absences',
        'bulletins'
      ]
    };
  }
}

module.exports = new PronoteService();
