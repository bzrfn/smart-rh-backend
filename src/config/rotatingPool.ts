import type { Pool, PoolConnection } from 'mysql2/promise';
import { AppError } from '../utils/AppError.js';

export type DatabaseCredentials = { user: string; password: string };
type Handle = { pool: Pool; users: number; retired: boolean; ending: boolean; done: Promise<void>; finish: () => void };
type Options = {
  initial: DatabaseCredentials;
  createPool: (credentials: DatabaseCredentials) => Pool;
  load: () => Promise<DatabaseCredentials>;
  now?: () => number;
  refreshMs?: number;
  warn?: (message: string) => void;
};
const isAuthFailure = (error: unknown) => (error as { code?: string })?.code === 'ER_ACCESS_DENIED_ERROR';
const unavailable = () => new AppError('La base de datos no está disponible temporalmente. Intenta nuevamente.', 503);

/** Refresh only while acquiring a connection. SQL statements and transactions are never replayed. */
export function createRotatingPool(options: Options): Pool {
  const now = options.now || Date.now;
  const ttl = options.refreshMs || 60000;
  const warn = options.warn || (message => console.warn(message));
  const handles = new Set<Handle>();
  let credentials = options.initial;
  let closed = false;
  let nextCheck = now() + ttl;
  let refreshing: Promise<void> | undefined;
  let refreshFailedUntil = 0;
  function handle(pool: Pool): Handle {
    let finish!: () => void;
    const item = { pool, users: 0, retired: false, ending: false,
      done: new Promise<void>(resolve => { finish = resolve; }), finish: () => finish() };
    handles.add(item);
    return item;
  }
  let current = handle(options.createPool(credentials));
  function drain(item: Handle) {
    if (!item.retired || item.users || item.ending) return;
    item.ending = true;
    void Promise.resolve().then(() => item.pool.end()).catch(() => {
      warn('[DB] Retired pool cleanup failed.');
    }).then(() => { handles.delete(item); item.finish(); });
  }
  function retire(item: Handle) { item.retired = true; drain(item); }
  async function renew(force: boolean) {
    let candidate: Handle | undefined;
    try {
      const fresh = await options.load();
      if (closed) throw unavailable();
      if (!force && fresh.user === credentials.user && fresh.password === credentials.password) {
        nextCheck = now() + ttl; return;
      }
      candidate = handle(options.createPool(fresh));
      const check = await candidate.pool.getConnection();
      try { await check.query('SELECT 1'); } finally { check.release(); }
      if (closed) throw unavailable();
      const old = current;
      current = candidate; candidate = undefined;
      credentials = fresh;
      nextCheck = now() + ttl;
      refreshFailedUntil = 0;
      retire(old);
    } catch {
      if (candidate) retire(candidate);
      nextCheck = now() + 30000;
      refreshFailedUntil = now() + 3000;
      warn('[DB] Credential refresh unavailable; current pool retained.');
      throw unavailable();
    }
  }
  function refresh(force: boolean): Promise<void> {
    if (refreshing) return refreshing;
    if (force && now() < refreshFailedUntil) return Promise.reject(unavailable());
    const pending = renew(force);
    refreshing = pending;
    void pending.then(() => { refreshing = undefined; }, () => { refreshing = undefined; });
    return pending;
  }
  async function acquire(item: Handle): Promise<PoolConnection> {
    item.users++;
    let connection: PoolConnection;
    try { connection = await item.pool.getConnection(); }
    catch (error) { item.users--; drain(item); throw error; }
    const release = connection.release.bind(connection);
    const destroy = connection.destroy.bind(connection);
    let returned = false;
    function finish(action: () => void) {
      if (returned) return;
      returned = true;
      try { action(); } finally { item.users--; drain(item); }
    }
    connection.release = () => finish(release);
    connection.destroy = () => finish(destroy);
    return connection;
  }
  async function getConnection(): Promise<PoolConnection> {
    if (closed) throw unavailable();
    if (now() >= nextCheck) void refresh(false).catch(() => undefined);
    const selected = current;
    try { return await acquire(selected); }
    catch (error) {
      if (!isAuthFailure(error)) throw error;
      // Concurrent callers share refresh and then use the validated replacement pool.
      if (current === selected) await refresh(true);
      if (closed) throw unavailable();
      try { return await acquire(current); } catch { throw unavailable(); }
    }
  }
  const invoke = (method: 'query' | 'execute') => async (...args: unknown[]) => {
    const connection = await getConnection();
    try { return await Reflect.apply(connection[method], connection, args); }
    finally { connection.release(); }
  };
  async function end() {
    closed = true;
    if (refreshing) await refreshing.catch(() => undefined);
    const remaining = [...handles];
    remaining.forEach(retire);
    await Promise.all(remaining.map(item => item.done));
  }
  // Preserve mysql2's typed public surface; repositories use query/execute/getConnection/end.
  return new Proxy(current.pool, {
    get(_target, key) {
      if (key === 'getConnection') return getConnection;
      if (key === 'query') return invoke('query');
      if (key === 'execute') return invoke('execute');
      if (key === 'end') return end;
      const value = Reflect.get(current.pool, key);
      return typeof value === 'function' ? value.bind(current.pool) : value;
    },
  });
}
