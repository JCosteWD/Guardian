// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – server.js FINAL (v6 – complet et définitif)
// ══════════════════════════════════════════════════════════════════════════════
// Remplacez backend/src/server.js par ce fichier.
// Toutes les routes, middlewares et services sont montés ici.

require('dotenv').config();

const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const logger       = require('./utils/logger');
const { connect: connectRedis, getClient } = require('./config/redis');
const { query }    = require('./config/database');

// ── ROUTES ────────────────────────────────────────────────────────────────────
const routesV1     = require('./routes');
const routesV3     = require('../backend-extra/routesV3');
const routesP4     = require('../complete-dashboard/routesP4');
const routesP5     = require('../routesP5');
const routesFinal  = require('../complete-tests/notificationsController'); // notifications + support + activity

const app    = express();
const server = http.createServer(app);

// ══════════════════════════════════════════════════════════════════════════════
// SOCKET.IO
// ══════════════════════════════════════════════════════════════════════════════
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);

  socket.on('identify', ({ type, id }) => {
    if (type && id) {
      socket.join(`${type}:${id}`);
      logger.debug(`Socket ${socket.id} joined ${type}:${id}`);
    }
  });

  socket.on('disconnect', (reason) => {
    logger.debug(`Socket disconnected: ${socket.id} (${reason})`);
  });

  socket.on('error', (err) => {
    logger.error(`Socket error: ${err.message}`);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAUX
// ══════════════════════════════════════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'", 'wss:', 'https://api.guardian-app.com'],
      frameSrc:    ['https://js.stripe.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'https://guardian-app.com',
    /guardian-app\.com$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
}));

app.use(compression({ threshold: 1024 }));

// ⚠️ Stripe webhook doit recevoir le body RAW avant JSON parsing
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Global rate limit (par IP)
app.use(rateLimit({
  windowMs:         900000,  // 15 min
  max:              200,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
  skip: (req) => req.path === '/api/health',
}));

// Request logger (dev uniquement)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES API
// ══════════════════════════════════════════════════════════════════════════════
app.use('/api', routesV1);     // Auth, Children, Rules, Billing, AI v1
app.use('/api', routesV3);     // Geofencing, Multi-parent, Gamification, RGPD, AI avancé
app.use('/api', routesP4);     // Profil, Push tokens, Pairing QR
app.use('/api', routesP5);     // ENT, Analytics, Stripe avancé
app.use('/api', routesFinal);  // Notifications, Support, Activity stream

// ── PAIRING CODE (génère et stocke dans Redis 24h) ───────────────────────────
app.post('/api/children/:childId/generate-pairing', async (req, res) => {
  try {
    const redis    = getClient();
    const childId  = req.params.childId;
    const code     = Math.random().toString(36).substring(2, 8).toUpperCase();
    await redis.setEx(`pairing:${code}`, 86400, childId);
    res.json({ pairingCode: code, qrValue: `guardian://pair/${code}`, expiresIn: '24h' });
  } catch (err) {
    logger.error('generate-pairing error:', err);
    res.status(500).json({ error: 'Erreur génération code' });
  }
});

// ── STATIC ADMIN PANEL ───────────────────────────────────────────────────────
// (servez admin-panel/dist/ en production)
if (process.env.NODE_ENV === 'production') {
  app.use('/admin', express.static(path.join(__dirname, '../../admin-panel/dist')));
  app.get('/admin/*', (_req, res) =>
    res.sendFile(path.join(__dirname, '../../admin-panel/dist/index.html'))
  );
}

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route non trouvée' }));

// ── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur'
      : err.message,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DÉMARRAGE
// ══════════════════════════════════════════════════════════════════════════════
const start = async () => {
  try {
    // 1. Redis
    await connectRedis();
    logger.info('✅ Redis connecté');

    // 2. PostgreSQL
    await query('SELECT 1');
    logger.info('✅ PostgreSQL connecté');

    // 3. Cron jobs v1
    require('./services/cronService');
    logger.info('✅ Cron jobs v1 démarrés');

    // 4. ENT Cron (Pronote/EcoleDirecte) – sync notes toutes les heures
    try {
      const { startENTCron } = require('../pronote/entController');
      startENTCron();
      logger.info('✅ ENT Cron démarré (Pronote/EcoleDirecte)');
    } catch (entErr) {
      logger.warn('⚠️ ENT Cron non disponible:', entErr.message);
    }

    // 5. Démarrage du serveur
    const PORT = parseInt(process.env.PORT) || 3000;
    server.listen(PORT, () => {
      logger.info(`\n🚀 Guardian API v6 — Port ${PORT}`);
      logger.info(`   Env:    ${process.env.NODE_ENV || 'development'}`);
      logger.info(`   Routes: v1 + v3 + p4 + p5 + final`);
      logger.info(`   Socket: WebSocket actif`);
      logger.info(`   ENT:    Pronote & EcoleDirecte\n`);
    });

  } catch (err) {
    logger.error('Échec du démarrage:', err);
    process.exit(1);
  }
};

// ── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} reçu — arrêt propre...`);
  server.close(() => {
    logger.info('Serveur HTTP fermé');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000); // force après 10s
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));
process.on('uncaughtException',  (err)    => { logger.error('Uncaught exception:', err); process.exit(1); });

start();

module.exports = { app, io };
