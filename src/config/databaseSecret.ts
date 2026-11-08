import { execFile } from 'node:child_process';
import type { DatabaseCredentials } from './rotatingPool.js';

export function databaseSecretLoader(secretArn: string) {
  const region = process.env.DB_SECRET_REGION || secretArn.split(':')[3];
  if (!/^arn:aws[a-z-]*:secretsmanager:[a-z0-9-]+:\d{12}:secret:.+$/.test(secretArn) ||
      !/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region || '')) {
    throw new Error('DB_SECRET_CONFIGURATION_INVALID');
  }
  const executable = process.env.DB_SECRET_AWS_CLI || 'aws';
  return async (): Promise<DatabaseCredentials> => {
    try {
      const stdout = await new Promise<string>((resolve, reject) => execFile(executable, [
        'secretsmanager', 'get-secret-value', '--secret-id', secretArn,
        '--version-stage', 'AWSCURRENT', '--region', region,
        '--output', 'json', '--cli-connect-timeout', '3', '--cli-read-timeout', '4',
      ], { timeout: 8000, maxBuffer: 65536, encoding: 'utf8',
        env: { ...process.env, AWS_MAX_ATTEMPTS: '1', AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off' } }, (error, output) => error ? reject(new Error('DB_SECRET_REFRESH_FAILED')) : resolve(output)));
      const response = JSON.parse(stdout);
      const value = JSON.parse(response.SecretString);
      if (typeof value.username !== 'string' || !value.username ||
          typeof value.password !== 'string' || !value.password) {
        throw new Error('INVALID_SECRET');
      }
      return { user: value.username, password: value.password };
    } catch {
      // execFile errors contain stdout/stderr; never propagate secret-bearing objects.
      throw new Error('DB_SECRET_REFRESH_FAILED');
    }
  };
}
