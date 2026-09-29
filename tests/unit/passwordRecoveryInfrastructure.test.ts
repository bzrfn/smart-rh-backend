import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Password recovery secure infrastructure',
  () => {
    beforeAll(
      () => {
        process.env
          .PASSWORD_RECOVERY_HMAC_SECRET =
          'SMART_RH_TEST_ONLY_PASSWORD_RECOVERY_HMAC_SECRET_2026_000000000004';
      }
    );


    afterAll(
      () => {
        delete process.env
          .PASSWORD_RECOVERY_HMAC_SECRET;
      }
    );


    test(
      'genera challenge id aleatorio de 64 hex',
      async () => {
        const {
          generatePasswordRecoveryChallengeId,
        } =
          await import(
            '../../src/modules/auth/passwordRecovery.crypto.js'
          );

        const first =
          generatePasswordRecoveryChallengeId();

        const second =
          generatePasswordRecoveryChallengeId();

        expect(
          first
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          second
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          first
        ).not.toBe(
          second
        );
      }
    );


    test(
      'genera codigo criptografico de seis digitos',
      async () => {
        const {
          generatePasswordRecoveryCode,
        } =
          await import(
            '../../src/modules/auth/passwordRecovery.crypto.js'
          );

        for (
          let index = 0;
          index < 50;
          index += 1
        ) {
          expect(
            generatePasswordRecoveryCode()
          ).toMatch(
            /^\d{6}$/
          );
        }
      }
    );


    test(
      'HMAC depende de challenge y codigo',
      async () => {
        const {
          createPasswordRecoveryCodeHmac,
        } =
          await import(
            '../../src/modules/auth/passwordRecovery.crypto.js'
          );

        const challengeA =
          'a'.repeat(
            64
          );

        const challengeB =
          'b'.repeat(
            64
          );

        const first =
          createPasswordRecoveryCodeHmac(
            challengeA,
            '123456'
          );

        const same =
          createPasswordRecoveryCodeHmac(
            challengeA,
            '123456'
          );

        const otherCode =
          createPasswordRecoveryCodeHmac(
            challengeA,
            '654321'
          );

        const otherChallenge =
          createPasswordRecoveryCodeHmac(
            challengeB,
            '123456'
          );

        expect(
          first
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          first
        ).toBe(
          same
        );

        expect(
          first
        ).not.toBe(
          otherCode
        );

        expect(
          first
        ).not.toBe(
          otherChallenge
        );
      }
    );


    test(
      'comparacion HMAC acepta correcto y rechaza incorrecto',
      async () => {
        const {
          comparePasswordRecoveryHmac,
        } =
          await import(
            '../../src/modules/auth/passwordRecovery.crypto.js'
          );

        const first =
          'a'.repeat(
            64
          );

        const second =
          'b'.repeat(
            64
          );

        expect(
          comparePasswordRecoveryHmac(
            first,
            first
          )
        ).toBe(
          true
        );

        expect(
          comparePasswordRecoveryHmac(
            first,
            second
          )
        ).toBe(
          false
        );

        expect(
          comparePasswordRecoveryHmac(
            first,
            '123456'
          )
        ).toBe(
          false
        );
      }
    );


    test(
      'IP se transforma a HMAC y no se guarda en claro',
      async () => {
        const {
          createPasswordRecoveryIpHash,
        } =
          await import(
            '../../src/modules/auth/passwordRecovery.crypto.js'
          );

        const hash =
          createPasswordRecoveryIpHash(
            '127.0.0.1'
          );

        expect(
          hash
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          hash
        ).not.toContain(
          '127.0.0.1'
        );

        expect(
          createPasswordRecoveryIpHash(
            ''
          )
        ).toBeNull();
      }
    );


    test(
      'migracion usa HMAC intentos expiracion y single-use',
      () => {
        const migration =
          readFileSync(
            resolve(
              process.cwd(),
              'db/migrations/2026_09_18_password_reset_challenges.sql'
            ),
            'utf8'
          );

        expect(
          migration
        ).toContain(
          'password_reset_challenges'
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
          'expires_at DATETIME'
        );

        expect(
          migration
        ).toContain(
          'used_at DATETIME'
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
      'configuracion usa secreto dedicado',
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
          'PASSWORD_RECOVERY_HMAC_SECRET'
        );

        expect(
          example
        ).toContain(
          'PASSWORD_RECOVERY_HMAC_SECRET='
        );
      }
    );


    test(
      'infraestructura nueva no usa Math.random ni Map en memoria',
      () => {
        const cryptoSource =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/auth/passwordRecovery.crypto.ts'
            ),
            'utf8'
          );

        const repositorySource =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/auth/passwordRecovery.repository.ts'
            ),
            'utf8'
          );

        const source =
          `${cryptoSource}\n${repositorySource}`;

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
          cryptoSource
        ).toContain(
          'randomInt('
        );

        expect(
          cryptoSource
        ).toContain(
          'timingSafeEqual'
        );
      }
    );
  }
);
