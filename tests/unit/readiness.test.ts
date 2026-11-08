jest.mock('../../src/config/db.js', () => ({ pool: { query: jest.fn() } }));
import mongoose from 'mongoose';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { readiness } from '../../src/config/readiness.js';
function response() { return { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }; }
describe('dependency readiness', () => {
  const oldUri = env.mongo.uri;
  beforeEach(() => { env.mongo.uri = 'mongodb://test'; Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
    Object.defineProperty(mongoose.connection, 'db', { configurable: true, value: { admin: () => ({ ping: async () => ({ ok: 1 }) }) } });
    (pool.query as jest.Mock).mockResolvedValue([[{ ok: 1 }]]);
  });
  afterEach(() => { env.mongo.uri = oldUri; jest.useRealTimers(); });
  it('reports ready only after real dependency probes succeed', async () => {
    const res = response(); await readiness({} as any,res as any);
    expect(res.status).toHaveBeenCalledWith(200); expect(pool.query).toHaveBeenCalledWith({ sql: 'SELECT 1', timeout: 3000 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, checks: { mysql: 'ok', mongo: 'ok' } }));
  });
  it('a running HTTP service with SQL access denied is not ready', async () => {
    (pool.query as jest.Mock).mockRejectedValue(Object.assign(new Error('SECRET'),{code:'ER_ACCESS_DENIED_ERROR'}));
    const res = response(); await readiness({} as any,res as any);
    expect(res.status).toHaveBeenCalledWith(503); expect(JSON.stringify(res.json.mock.calls)).not.toContain('SECRET');
  });
  it('an unavailable configured Mongo connection produces 503', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 0 });
    const res = response(); await readiness({} as any,res as any); expect(res.status).toHaveBeenCalledWith(503);
  });
  it('local installations without Mongo remain supported', async () => {
    env.mongo.uri = ''; const res = response(); await readiness({} as any,res as any);
    expect(res.status).toHaveBeenCalledWith(200); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mongo: 'disabled' }));
  });
  it('concurrent checks share a single SQL probe', async () => {
    let resolve!: (value: any) => void;
    (pool.query as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
    const count = (pool.query as jest.Mock).mock.calls.length;
    const requests = Array.from({ length: 20 }, () => readiness({} as any,response() as any));
    await Promise.resolve(); resolve([[{ ok: 1 }]]); await Promise.all(requests);
    expect((pool.query as jest.Mock).mock.calls.length-count).toBe(1);
  });
  it('hung probes return 503 after five seconds without adding more probes', async () => {
    jest.useFakeTimers(); let resolve!: (value: any) => void;
    (pool.query as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
    const res = response(); const request = readiness({} as any,res as any);
    await Promise.resolve(); await jest.advanceTimersByTimeAsync(5001); await request;
    expect(res.status).toHaveBeenCalledWith(503); resolve([[{ ok: 1 }]]); await Promise.resolve(); await Promise.resolve();
  });
});
