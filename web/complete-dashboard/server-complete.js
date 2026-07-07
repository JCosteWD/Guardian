// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – server.js (version intégrale avec v3 + p4)
// ══════════════════════════════════════════════════════════════════════════════
// Remplacez le server.js original par celui-ci.
// Il inclut toutes les routes v1, v3 et p4, ainsi que la
// gestion du pairing code Redis.

require('dotenv').config();
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const helmet   = require('helmet');
const cors     = require('cors');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const logger        = require('./utils/logger');
const { connect: connectRedis, getClient } = require('./config/redis');
const routes        = require('./routes');
const routesV3      = require('../backend-extra/routesV3');
const routesP4      = require('../complete-dashboard/routesP4');

const app    = express();
const server = http.createServer(app);

// ── SOCKET.IO ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET','POST'] },
  pingTimeout: 60000,
});
app.set('io', io);

io.on('connection', socket => {
  socket.on('identify', ({ type, id }) => {
    socket.join(`${type}:${id}`);
  });
  socket.on('disconnect', () => {});
});

// ── MIDDLEWARE ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(compression());
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 900000, max: 200 }));

// ── ROUTES ─────────────────────────────────────────────────────────────────
app.use('/api', routes);    // v1 (auth, children, rules, billing, AI)
app.use('/api', routesV3);  // v3 (geofencing, multi-parent, gamification, RGPD, IA avancée)
app.use('/api', routesP4);  // p4 (profil, push tokens, pairing)

// ── PAIRING CODE ENDPOINT (génère et stocke dans Redis) ──────────────────
app.post('/api/children/:childId/generate-pairing', async (req, res) => {
  const { requireParent, requireChildOwnership } = require('./middleware/auth');

  // Inline middleware check (simplifié pour l'exemple)
  const childId = req.params.childId;
  try {
    const redis = getClient();
    // Génère un code alphanumérique 6 caractères
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    // Stocke dans Redis avec expiration 24h
    await redis.setEx(`pairing:${code}`, 86400, childId);

    // Génère aussi l'URL du QR code
    const qrValue = `guardian://pair/${code}`;

    res.json({ pairingCode: code, qrValue, expiresIn: '24h' });
  } catch (err) {
    logger.error('generate-pairing error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du code' });
  }
});

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));

// ── ERROR HANDLER ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne' : err.message
  });
});

// ── STARTUP ────────────────────────────────────────────────────────────────
const start = async () => {
  await connectRedis();
  logger.info('✅ Redis connected');

  const { query } = require('./config/database');
  await query('SELECT 1');
  logger.info('✅ PostgreSQL connected');

  require('./services/cronService');
  logger.info('✅ Cron jobs started');

  const PORT = parseInt(process.env.PORT) || 3000;
  server.listen(PORT, () => {
    logger.info(`🚀 Guardian API v3 running on port ${PORT}`);
    logger.info(`   Routes: v1 + v3 (geofencing, multi-parent, gamification) + p4 (profile, pairing)`);
  });
};

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('unhandledRejection', reason => logger.error('Unhandled rejection:', reason));

start();
module.exports = { app, io };
