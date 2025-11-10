const express = require('express');
const client = require('prom-client');

const {
  PORT = 8080,
  NODE_ENV = 'production',
  DB_HOST,
  DB_PORT = 5432,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
} = process.env;

let pg = null;
try {
  pg = require('pg');
} catch {
}

const dbEnabled =
  !!pg &&
  !!DB_HOST &&
  !!DB_USER &&
  !!DB_PASSWORD &&
  !!DB_NAME &&
  Number.isFinite(Number(DB_PORT));

let pool = null;
if (dbEnabled) {
  pool = new pg.Pool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    console.error('[db] pool error:', err.message);
  });
} else {
  console.warn(
    '[db] Desabilitado (pg não instalado ou variáveis ausentes). ' +
      'Rotas de negócio responderão 503 até você instalar/configurar.'
  );
}

const register = new client.Registry();
client.collectDefaultMetrics({
  register,
  prefix: 'svc_',
});

const reqCounter = new client.Counter({
  name: 'svc_requests_total',
  help: 'Total de requisições HTTP rotuladas por rota, método e status.',
  labelNames: ['route', 'method', 'status'],
  registers: [register],
});

const reqDuration = new client.Histogram({
  name: 'svc_request_duration_seconds',
  help: 'Histograma da duração das requisições HTTP por rota e método.',
  labelNames: ['route', 'method'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

const app = express();

app.use((req, res, next) => {
  if (req.path === '/metrics') return next();

  const routeLabel = req.path;
  const methodLabel = req.method;

  const endTimer = reqDuration.startTimer({ route: routeLabel, method: methodLabel });

  res.on('finish', () => {
    endTimer();
    reqCounter.inc({ route: routeLabel, method: methodLabel, status: String(res.statusCode) });
  });

  next();
});

app.get('/health', async (_req, res) => {
  if (dbEnabled) {
    try {
      await pool.query('SELECT 1');
      return res.status(200).json({ status: 'ok', db: 'up' });
    } catch (e) {
      return res.status(200).json({ status: 'ok', db: 'down' });
    }
  }
  return res.status(200).json({ status: 'ok', db: 'disabled' });
});

app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err) {
    res.status(500).send(`# metrics error\n${String(err?.message || err)}`);
  }
});

app.get('/checkins/recentes', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 200);

  if (!dbEnabled) {
    return res.status(503).json({
      error: 'database_unavailable',
      message:
        'Banco desabilitado. Instale o pacote "pg" e configure DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.',
    });
  }

  try {
    const sql = `
      SELECT
        pessoa,
        curso,
        semestre,
        sala,
        criado_em
      FROM checkins
      ORDER BY criado_em DESC
      LIMIT $1
    `;
    const { rows } = await pool.query(sql, [limit]);
    res.json({ count: rows.length, items: rows });
  } catch (err) {
    console.error('[db] query error:', err.message);
    res.status(500).json({ error: 'query_failed', message: err.message });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

const server = app.listen(Number(PORT), () => {
  console.log(`[app] ${NODE_ENV} listening on port ${PORT}`);
  console.log(`[app] dbEnabled=${dbEnabled}`);
});

function shutdown(signal) {
  console.log(`[app] ${signal} received, shutting down...`);
  server.close(async () => {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        console.error('[db] pool end error:', e.message);
      }
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
