import type { Pool, PoolConnection } from 'mysql2/promise';
import { createRotatingPool, type DatabaseCredentials } from '../../src/config/rotatingPool.js';

const authError = () => Object.assign(new Error('private SQL error'), { code: 'ER_ACCESS_DENIED_ERROR' });
function harness() {
  let clock = 0;
  let accepted = 'v1';
  let secret = 'v1';
  const handles: any[] = [];
  const reads: string[] = [];
  const load = jest.fn(async () => ({ user: 'admin', password: secret }));
  const warn = jest.fn();
  const createPool = jest.fn((credentials: DatabaseCredentials) => {
    const item: any = { credentials, end: jest.fn(async () => {}), leases: [] };
    item.getConnection = jest.fn(async () => {
      if (credentials.password !== accepted) throw authError();
      const connection = {
        query: jest.fn(async (...args: any[]) => { reads.push(String(args[0])); return [[{ ok: 1 }], []]; }),
        execute: jest.fn(async (...args: any[]) => { reads.push(String(args[0])); return [{ affectedRows: 1 }, []]; }),
        release: jest.fn(), destroy: jest.fn(),
      };
      item.leases.push({ ...connection });
      return connection as unknown as PoolConnection;
    });
    handles.push(item); return item as Pool;
  });
  const pool = createRotatingPool({ initial: { user: 'admin', password: 'v1' }, createPool, load,
    now: () => clock, refreshMs: 100, warn });
  return { pool, load, warn, handles, reads, createPool,
    rotate: () => { accepted = 'v2'; secret = 'v2'; },
    wrongSecret: () => { secret = 'wrong'; }, tick: () => { clock += 101; }, advance: (ms: number) => { clock += ms; } };
}
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
describe('RDS managed secret rotation without service restart', () => {
  it('healthy cached credentials need no secret call per query', async () => {
    const h = harness(); await h.pool.query('SELECT initial'); await h.pool.execute('SELECT other');
    expect(h.load).not.toHaveBeenCalled(); expect(h.createPool).toHaveBeenCalledTimes(1); await h.pool.end();
  });
  it('a stale password refreshes AWSCURRENT before sending the original SQL exactly once', async () => {
    const h = harness(); h.rotate(); const result = await h.pool.query('INSERT original', [1]);
    expect(result).toEqual([[{ ok: 1 }], []]);
    expect(h.load).toHaveBeenCalledTimes(1); expect(h.reads.filter(x => x === 'INSERT original')).toHaveLength(1);
    expect(h.handles[0].end).toHaveBeenCalledTimes(1); await h.pool.end();
  });
  it('execute follows the same acquisition-only recovery', async () => {
    const h = harness(); h.rotate(); await h.pool.execute('UPDATE once', [1]);
    expect(h.reads.filter(x => x === 'UPDATE once')).toHaveLength(1); await h.pool.end();
  });
  it('concurrent failures share one fetch and one replacement pool', async () => {
    const h = harness(); h.rotate();
    await Promise.all(Array.from({ length: 30 }, () => h.pool.query('SELECT concurrent')));
    expect(h.load).toHaveBeenCalledTimes(1); expect(h.createPool).toHaveBeenCalledTimes(2);
    expect(h.reads.filter(x => x === 'SELECT concurrent')).toHaveLength(30); await h.pool.end();
  });
  it('does not replay SQL errors after a connection was acquired', async () => {
    const h = harness();
    const original = h.handles[0].getConnection.getMockImplementation();
    h.handles[0].getConnection.mockImplementation(async () => {
      const connection = await original(); connection.query.mockRejectedValue(authError()); return connection;
    });
    await expect(h.pool.query('INSERT uncertain')).rejects.toMatchObject({ code: 'ER_ACCESS_DENIED_ERROR' });
    expect(h.load).not.toHaveBeenCalled(); expect(h.handles[0].getConnection).toHaveBeenCalledTimes(1);
    expect(h.handles[0].leases[0].release).toHaveBeenCalledTimes(1); await h.pool.end();
  });
  it('network failures do not trigger secret refresh or SQL replay', async () => {
    const h = harness(); h.handles[0].getConnection.mockRejectedValue(Object.assign(new Error(), { code: 'ETIMEDOUT' }));
    await expect(h.pool.query('INSERT uncertain')).rejects.toMatchObject({ code: 'ETIMEDOUT' });
    expect(h.load).not.toHaveBeenCalled(); await h.pool.end();
  });
  it('an active transaction keeps its old connection until release', async () => {
    const h = harness(); const connection = await h.pool.getConnection(); h.rotate();
    await h.pool.query('SELECT after rotation');
    expect(h.handles[0].end).not.toHaveBeenCalled();
    await connection.query('COMMIT'); connection.release(); await flush();
    expect(h.handles[0].end).toHaveBeenCalledTimes(1); await h.pool.end();
  });
  it('double release or destroy does not decrement a lease twice', async () => {
    const h = harness(); const connection = await h.pool.getConnection(); h.rotate();
    await h.pool.query('SELECT after rotation'); connection.release(); connection.release(); connection.destroy(); await flush();
    expect(h.handles[0].leases[0].release).toHaveBeenCalledTimes(1);
    expect(h.handles[0].leases[0].destroy).not.toHaveBeenCalled();
    expect(h.handles[0].end).toHaveBeenCalledTimes(1); await h.pool.end();
  });
  it('a bad replacement secret is rejected without exposing credentials or replacing the working pool', async () => {
    const h = harness(); h.wrongSecret(); h.tick();
    await h.pool.query('SELECT still healthy'); await flush();
    expect(h.handles[0].end).not.toHaveBeenCalled(); expect(h.handles[1].end).toHaveBeenCalledTimes(1);
    expect(h.warn.mock.calls.flat().join(' ')).not.toMatch(/wrong|v1/); await h.pool.end();
  });
  it('secret service outage permits healthy cached connections', async () => {
    const h = harness(); h.load.mockRejectedValue(new Error('password=SECRET')); h.tick();
    await h.pool.query('SELECT cached'); await flush();
    expect(h.warn.mock.calls.flat().join(' ')).not.toContain('SECRET'); await h.pool.end();
  });
  it('stale credentials plus secret outage return a safe 503', async () => {
    const h = harness(); h.rotate(); h.load.mockRejectedValue(new Error('password=SECRET'));
    await expect(h.pool.query('SELECT blocked')).rejects.toMatchObject({ statusCode: 503 });
    expect(h.reads).toHaveLength(0); expect(h.warn.mock.calls.flat().join(' ')).not.toContain('SECRET'); await h.pool.end();
  });
  it('refresh on expiry notices rotation while no SQL is replayed', async () => {
    const h = harness(); h.rotate(); h.tick(); await h.pool.query('SELECT fresh');
    expect(h.load).toHaveBeenCalledTimes(1); expect(h.reads.filter(x => x === 'SELECT fresh')).toHaveLength(1); await h.pool.end();
  });
  it('unchanged credentials do not replace the pool on normal expiry', async () => {
    const h = harness(); h.tick(); await h.pool.query('SELECT same'); await flush();
    expect(h.load).toHaveBeenCalledTimes(1); expect(h.createPool).toHaveBeenCalledTimes(1); await h.pool.end();
  });
  it('shutdown waits for active leases and rejects new acquisitions', async () => {
    const h = harness(); const connection = await h.pool.getConnection(); const ended = h.pool.end();
    expect(h.handles[0].end).not.toHaveBeenCalled();
    await expect(h.pool.getConnection()).rejects.toMatchObject({ statusCode: 503 });
    connection.release(); await ended; expect(h.handles[0].end).toHaveBeenCalledTimes(1);
  });
  it('a failing secrets endpoint is not called repeatedly for sequential authentication failures', async () => {
    const h = harness(); h.rotate(); h.load.mockRejectedValue(new Error('secret endpoint unavailable'));
    await expect(h.pool.query('SELECT first')).rejects.toMatchObject({ statusCode: 503 });
    await expect(h.pool.query('SELECT second')).rejects.toMatchObject({ statusCode: 503 });
    expect(h.load).toHaveBeenCalledTimes(1);
    h.advance(3001); h.load.mockResolvedValue({ user: 'admin', password: 'v2' });
    await h.pool.query('SELECT recovered'); expect(h.load).toHaveBeenCalledTimes(2); await h.pool.end();
  });

});
