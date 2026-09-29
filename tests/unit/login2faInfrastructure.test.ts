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
  createLogin2faCodeHmac,
  createLogin2faIpHash,
  generateLogin2faChallengeId,
  generateLogin2faCode,
  isValidLogin2faChallengeId,
  isValidLogin2faCode,
  safeEqualLogin2faHmac,
} from '../../src/modules/auth/login2fa.crypto.js';


describe(
  'Login 2FA infrastructure hardening',
  () => {
    const originalSecret =
      env.login2fa.hmacSecret;


    beforeEach(
      () => {
        env.login2fa.hmacSecret =
          'l'.repeat(
            64
          );
      }
    );


    afterAll(
      () => {
        env.login2fa.hmacSecret =
          originalSecret;
      }
    );


    test(
      'challenge usa 64 caracteres hexadecimales',
      () => {
        const first =
          generateLogin2faChallengeId();

        const second =
          generateLogin2faChallengeId();


        expect(
          first
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          first
        ).not.toBe(
          second
        );

        expect(
          isValidLogin2faChallengeId(
            first
          )
        ).toBe(
          true
        );
      }
    );


    test(
      'codigo usa seis digitos',
      () => {
        for (
          let i = 0;
          i < 100;
          i += 1
        ) {
          const code =
            generateLogin2faCode();

          expect(
            code
          ).toMatch(
            /^\d{6}$/
          );

          expect(
            isValidLogin2faCode(
              code
            )
          ).toBe(
            true
          );
        }
      }
    );


    test(
      'HMAC queda ligado al challenge y al codigo',
      () => {
        const challenge =
          'a'.repeat(
            64
          );

        const expected =
          createLogin2faCodeHmac(
            challenge,
            '123456'
          );

        const same =
          createLogin2faCodeHmac(
            challenge,
            '123456'
          );

        const wrong =
          createLogin2faCodeHmac(
            challenge,
            '654321'
          );


        expect(
          expected
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          safeEqualLogin2faHmac(
            expected,
            same
          )
        ).toBe(
          true
        );

        expect(
          safeEqualLogin2faHmac(
            expected,
            wrong
          )
        ).toBe(
          false
        );
      }
    );


    test(
      'IP se convierte a HMAC',
      () => {
        const ip =
          '203.0.113.44';

        const result =
          createLogin2faIpHash(
            ip
          );


        expect(
          result
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          result
        ).not.toContain(
          ip
        );

        expect(
          createLogin2faIpHash(
            ''
          )
        ).toBeNull();
      }
    );


    test(
      'migracion contiene controles requeridos',
      () => {
        const migration =
          readFileSync(
            resolve(
              process.cwd(),
              'db/migrations/2026_09_19_login_2fa_challenges.sql'
            ),
            'utf8'
          );


        expect(
          migration
        ).toContain(
          'login_2fa_challenges'
        );

        expect(
          migration
        ).toContain(
          'session_version INT UNSIGNED'
        );

        expect(
          migration
        ).toContain(
          'code_hmac CHAR(64)'
        );

        expect(
          migration
        ).toContain(
          'attempts TINYINT UNSIGNED'
        );

        expect(
          migration
        ).toContain(
          'max_attempts TINYINT UNSIGNED'
        );

        expect(
          migration
        ).toContain(
          'used_at DATETIME'
        );

        expect(
          migration
        ).toContain(
          'request_ip_hash CHAR(64)'
        );

        expect(
          migration
        ).toContain(
          'ON DELETE RESTRICT'
        );

        expect(
          migration
            .toLowerCase()
        ).not.toMatch(
          /\bcodigo\b/
        );
      }
    );


    test(
      'crypto no usa Math.random ni almacenamiento volatil',
      () => {
        const source =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/auth/login2fa.crypto.ts'
            ),
            'utf8'
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

        expect(
          source
        ).toContain(
          'randomBytes('
        );

        expect(
          source
        ).toContain(
          'randomInt('
        );

        expect(
          source
        ).toContain(
          'timingSafeEqual'
        );
      }
    );


    test(
      'configuracion declara secreto dedicado',
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
          'LOGIN_2FA_HMAC_SECRET'
        );

        expect(
          example
        ).toContain(
          'LOGIN_2FA_HMAC_SECRET='
        );
      }
    );
  }
);
