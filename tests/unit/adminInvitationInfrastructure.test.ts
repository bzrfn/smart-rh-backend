import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  env,
} from '../../src/config/env.js';

import {
  createAdminInviteIpHash,
  createAdminInviteTokenHmac,
  generateAdminInviteId,
  generateAdminInviteToken,
  isValidAdminInviteId,
  isValidAdminInviteToken,
  safeEqualAdminInviteHmac,
} from '../../src/modules/auth/adminInvite.crypto.js';


const originalSecrets = {
  invite:
    env.adminInvite.hmacSecret,

  jwt:
    env.jwt.secret,

  adminJwt:
    env.adminAccess.jwtSecret,

  adminHmac:
    env.adminAccess.hmacSecret,

  recovery:
    env.passwordRecovery.hmacSecret,

  login2fa:
    env.login2fa.hmacSecret,
};


describe(
  'Admin invitation infrastructure',
  () => {
    beforeEach(
      () => {
        env.adminInvite.hmacSecret =
          'i'.repeat(
            64
          );

        env.jwt.secret =
          'j'.repeat(
            64
          );

        env.adminAccess.jwtSecret =
          'a'.repeat(
            64
          );

        env.adminAccess.hmacSecret =
          'b'.repeat(
            64
          );

        env.passwordRecovery.hmacSecret =
          'p'.repeat(
            64
          );

        env.login2fa.hmacSecret =
          'l'.repeat(
            64
          );
      }
    );


    afterAll(
      () => {
        env.adminInvite.hmacSecret =
          originalSecrets.invite;

        env.jwt.secret =
          originalSecrets.jwt;

        env.adminAccess.jwtSecret =
          originalSecrets.adminJwt;

        env.adminAccess.hmacSecret =
          originalSecrets.adminHmac;

        env.passwordRecovery.hmacSecret =
          originalSecrets.recovery;

        env.login2fa.hmacSecret =
          originalSecrets.login2fa;
      }
    );


    test(
      'genera IDs y tokens criptograficos de 256 bits',
      () => {
        const invitationId =
          generateAdminInviteId();

        const token =
          generateAdminInviteToken();


        expect(
          invitationId
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          token
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          invitationId
        ).not.toBe(
          token
        );

        expect(
          isValidAdminInviteId(
            invitationId
          )
        ).toBe(
          true
        );

        expect(
          isValidAdminInviteToken(
            token
          )
        ).toBe(
          true
        );
      }
    );


    test(
      'almacena comparacion mediante HMAC',
      () => {
        const invitationId =
          generateAdminInviteId();

        const token =
          generateAdminInviteToken();

        const hmac =
          createAdminInviteTokenHmac(
            invitationId,
            token
          );


        expect(
          hmac
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          hmac
        ).not.toContain(
          token
        );

        expect(
          safeEqualAdminInviteHmac(
            hmac,
            hmac
          )
        ).toBe(
          true
        );

        expect(
          safeEqualAdminInviteHmac(
            hmac,
            '0'.repeat(
              64
            )
          )
        ).toBe(
          false
        );
      }
    );


    test(
      'hash de IP no almacena IP en claro',
      () => {
        const ip =
          '203.0.113.50';

        const hash =
          createAdminInviteIpHash(
            ip
          );


        expect(
          hash
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          hash
        ).not.toContain(
          ip
        );

        expect(
          createAdminInviteIpHash(
            ''
          )
        ).toBeNull();
      }
    );


    test(
      'secret de invitaciones no puede reutilizar otros secrets',
      () => {
        env.adminInvite.hmacSecret =
          env.login2fa.hmacSecret;


        expect(
          () =>
            createAdminInviteIpHash(
              '127.0.0.1'
            )
        ).toThrow(
          /criptográfica/i
        );
      }
    );


    test(
      'crypto no utiliza Math.random ni memoria volatil',
      () => {
        const source =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/auth/adminInvite.crypto.ts'
            ),
            'utf8'
          );


        expect(
          source
        ).toContain(
          'randomBytes'
        );

        expect(
          source
        ).toContain(
          'timingSafeEqual'
        );

        expect(
          source
        ).not.toContain(
          'Math.random'
        );

        expect(
          source
        ).not.toContain(
          'new Map'
        );
      }
    );


    test(
      'migracion persiste solo HMAC y estado single use',
      () => {
        const migration =
          readFileSync(
            resolve(
              process.cwd(),
              'db/migrations/2026_09_19_admin_invitations.sql'
            ),
            'utf8'
          );


        expect(
          migration
        ).toContain(
          'CREATE TABLE IF NOT EXISTS admin_invitations'
        );

        expect(
          migration
        ).toContain(
          'token_hmac CHAR(64)'
        );

        expect(
          migration
        ).toContain(
          'sponsor_admin_id'
        );

        expect(
          migration
        ).toContain(
          'sponsor_session_version'
        );

        expect(
          migration
        ).toContain(
          'invite_email'
        );

        expect(
          migration
        ).toContain(
          'expires_at'
        );

        expect(
          migration
        ).toContain(
          'accepted_at'
        );

        expect(
          migration
        ).toContain(
          'revoked_at'
        );

        expect(
          migration
        ).toContain(
          'accepted_user_id'
        );

        expect(
          migration
        ).toContain(
          'ON DELETE RESTRICT'
        );

        expect(
          migration
        ).not.toMatch(
          /\btoken\s+(?:CHAR|VARCHAR|TEXT|BINARY|VARBINARY)/i
        );

        expect(
          migration
        ).not.toMatch(
          /\bDROP\s+TABLE\b/i
        );

        expect(
          migration
        ).not.toMatch(
          /\bTRUNCATE\b/i
        );

        expect(
          migration
        ).not.toMatch(
          /\bDELETE\s+FROM\b/i
        );
      }
    );


    test(
      'configuracion declara secret dedicado',
      () => {
        const envSource =
          readFileSync(
            resolve(
              process.cwd(),
              'src/config/env.ts'
            ),
            'utf8'
          );

        const example =
          readFileSync(
            resolve(
              process.cwd(),
              '.env.example'
            ),
            'utf8'
          );


        expect(
          envSource
        ).toContain(
          'ADMIN_INVITE_HMAC_SECRET'
        );

        expect(
          envSource
        ).toContain(
          'adminInvite'
        );

        expect(
          example
        ).toContain(
          'ADMIN_INVITE_HMAC_SECRET='
        );
      }
    );
  }
);
