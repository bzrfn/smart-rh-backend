jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
import { execFile } from 'node:child_process';
import { databaseSecretLoader } from '../../src/config/databaseSecret.js';
const arn = 'arn:aws:secretsmanager:us-east-1:682530816594:secret:rds!db-test';
describe('safe Secrets Manager reader', () => {
  afterEach(() => { delete process.env.DB_SECRET_REGION; delete process.env.DB_SECRET_AWS_CLI; });
  it('retrieves AWSCURRENT through the instance role and bounded CLI subprocess', async () => {
    (execFile as unknown as jest.Mock).mockImplementation((_exe, _args, _options, callback) => callback(null,
      JSON.stringify({ SecretString: JSON.stringify({ username: 'admin', password: 'secret' }) }), ''));
    expect(await databaseSecretLoader(arn)()).toEqual({ user: 'admin', password: 'secret' });
    const [,args,options] = (execFile as unknown as jest.Mock).mock.calls[0];
    expect(args).toEqual(expect.arrayContaining(['AWSCURRENT', arn, 'us-east-1']));
    expect(options.timeout).toBe(8000); expect(args.join(' ')).not.toContain('secret"');
  });
  it('never leaks child process stdout/stderr in its rejection', async () => {
    (execFile as unknown as jest.Mock).mockImplementation((_exe, _args, _options, callback) =>
      callback(Object.assign(new Error('SECRET'), { stdout: 'SECRET', stderr: 'SECRET' }), '', ''));
    await expect(databaseSecretLoader(arn)()).rejects.toThrow(/^DB_SECRET_REFRESH_FAILED$/);
  });
  it.each(['{}', '{"SecretString":"{invalid"}', JSON.stringify({ SecretString: '{"username":"admin"}' })])('rejects incomplete or malformed secret responses', async value => {
    (execFile as unknown as jest.Mock).mockImplementation((_exe, _args, _options, callback) => callback(null,value,''));
    await expect(databaseSecretLoader(arn)()).rejects.toThrow('DB_SECRET_REFRESH_FAILED');
  });
  it('rejects malformed identifiers without running a subprocess', () => {
    (execFile as unknown as jest.Mock).mockClear(); expect(() => databaseSecretLoader('not-an-arn')).toThrow('DB_SECRET_CONFIGURATION_INVALID');
    expect(execFile).not.toHaveBeenCalled();
  });
});
