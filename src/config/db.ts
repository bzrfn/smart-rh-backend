// src/config/db.ts
import mysql from 'mysql2/promise';
import { env } from './env.js';
import { createRotatingPool, type DatabaseCredentials } from './rotatingPool.js';
import { databaseSecretLoader } from './databaseSecret.js';

const initial = { user: env.db.user, password: env.db.password };
const createPool = (credentials: DatabaseCredentials) => mysql.createPool({
  host: env.db.host,
  port: Number(env.db.port),
  user: credentials.user,
  password: credentials.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});
const secretArn = process.env.DB_SECRET_ARN?.trim();
export const pool = secretArn
  ? createRotatingPool({ initial, createPool, load: databaseSecretLoader(secretArn) })
  : createPool(initial);
