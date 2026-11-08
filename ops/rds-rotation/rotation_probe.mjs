import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = process.argv[2];
const load = path => import(pathToFileURL(`${root}/${path}`).href);
let pool;
let stage = 'secret_role';
let passed = false;
try {
  const { databaseSecretLoader } = await load('dist/config/databaseSecret.js');
  const fresh = await databaseSecretLoader(process.env.DB_SECRET_ARN)();
  assert.equal(fresh.user, process.env.DB_USER);
  assert(fresh.password.length > 0);
  console.log('RDS_SECRETS_ROLE_ACCESS=OK');
  // Only this isolated child process receives a deliberately stale password.
  // The real RDS password, secret version and running service remain unchanged.
  process.env.DB_PASSWORD = `SMART_RH_STALE_PROBE_${randomUUID()}`;
  stage = 'stale_password';
  const pid = process.pid;
  ({ pool } = await load('dist/config/db.js'));
  const [rows] = await pool.query('SELECT 1 AS ok');
  assert.equal(rows[0].ok, 1); assert.equal(process.pid, pid);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [transactionRows] = await connection.query('SELECT 1 AS ok');
    assert.equal(transactionRows[0].ok, 1); await connection.rollback();
  } finally { connection.release(); }
  console.log('MYSQL_STALE_PASSWORD_RECOVERED=OK');
  console.log('MYSQL_TRANSACTION_READ=OK');
  stage = 'mongo';
  assert(process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || 'RRHH', serverSelectionTimeoutMS: 6000 });
  await mongoose.connection.db.admin().ping(); console.log('MONGO_READ=OK');
  stage = 'readiness';
  const { readiness } = await load('dist/config/readiness.js');
  let status, body;
  await readiness({}, { setHeader() {}, status(value) { status = value; return this; }, json(value) { body = value; } });
  assert.equal(status, 200); assert.equal(body.ok, true);
  assert.deepEqual(body.checks, { mysql: 'ok', mongo: 'ok' });
  console.log('API_READINESS_PROBE=OK'); passed = true;
} catch (error) {
  console.log(`ROTATION_PROBE=ERROR; stage=${stage}; type=${String(error?.name || 'Error').replace(/[^a-zA-Z]/g,'')}`);
} finally {
  try { if (pool) await pool.end(); } catch { passed = false; }
  try { await mongoose.disconnect(); } catch { passed = false; }
}
process.exitCode = passed ? 0 : 1;
