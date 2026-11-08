import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { pool } from './db.js';
import { env } from './env.js';

type Status = { ok: boolean; mysql: 'ok' | 'unavailable'; mongo: 'ok' | 'unavailable' | 'disabled' };
let pending: Promise<Status> | undefined;
async function probe(): Promise<Status> {
  const [mysql, mongo] = await Promise.all([
    pool.query({ sql: 'SELECT 1', timeout: 3000 }).then(() => 'ok' as const, () => 'unavailable' as const),
    !env.mongo.uri ? Promise.resolve('disabled' as const) : mongoose.connection.readyState !== 1 || !mongoose.connection.db
      ? Promise.resolve('unavailable' as const)
      : mongoose.connection.db.admin().ping({ maxTimeMS: 3000 }).then(() => 'ok' as const, () => 'unavailable' as const),
  ]);
  return { ok: mysql === 'ok' && mongo !== 'unavailable', mysql, mongo };
}
export async function readiness(_req: Request, res: Response) {
  // A slow dependency can leave only one probe in flight, rather than filling the pool queue.
  if (!pending) {
    const operation = Promise.resolve().then(probe).catch((): Status => ({ ok: false, mysql: 'unavailable', mongo: 'unavailable' }));
    pending = operation;
    void operation.finally(() => { if (pending === operation) pending = undefined; });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      pending,
      new Promise<Status>(resolve => { timer = setTimeout(() => resolve({ ok: false, mysql: 'unavailable', mongo: 'unavailable' }), 5000); }),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(result.ok ? 200 : 503).json({ ...result, service: 'SMART RH Backend', checks: { mysql: result.mysql, mongo: result.mongo } });
  } finally { if (timer) clearTimeout(timer); }
}
