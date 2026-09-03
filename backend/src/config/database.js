const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;
let mockMode = false;

const initPool = () => {
  try {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle DB client', err);
    });

    pool.on('connect', () => {
      logger.debug('New DB connection established');
    });
  } catch (err) {
    logger.warn('Database initialization failed - mock mode enabled');
    mockMode = true;
  }
};

initPool();

const query = async (text, params) => {
  if (mockMode || !pool) {
    const err = new Error('PostgreSQL indisponible');
    err.code = 'DB_UNAVAILABLE';
    throw err;
  }

  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    logger.error('Database query error', { text, error: err.message });
    throw err;
  }
};

const getClient = () => {
  if (mockMode || !pool) return null;
  return pool.connect();
};

const transaction = async (callback) => {
  if (mockMode || !pool) {
    const err = new Error('PostgreSQL indisponible');
    err.code = 'DB_UNAVAILABLE';
    throw err;
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, transaction, pool, mockMode };
