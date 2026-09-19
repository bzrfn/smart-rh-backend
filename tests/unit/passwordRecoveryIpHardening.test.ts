import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  buildPasswordRecoveryService,
  PASSWORD_RECOVERY_MAX_PER_IP_WINDOW,
  PASSWORD_RECOVERY_RATE_WINDOW_MINUTES,
} from '../../src/modules/auth/passwordRecovery.service.js';


describe(
  'Password recovery IP hardening',
  () => {
    test(
      'IP bloqueada no consulta existencia del usuario',
      async () => {
        const ipHash =
          'd'.repeat(
            64
          );

        const findEligibleUser =
          jest.fn(
            async () =>
              null
          );

        const countRecentIpChallenges =
          jest.fn(
            async () =>
              PASSWORD_RECOVERY_MAX_PER_IP_WINDOW
          );

        const service =
          buildPasswordRecoveryService({
            createIpHash:
              jest.fn(
                () =>
                  ipHash
              ),

            countRecentIpChallenges,

            findEligibleUser,
          } as any);

        const result =
          await service
            .requestPasswordRecovery(
              'usuario@example.com',
              '203.0.113.10'
            );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          countRecentIpChallenges
        ).toHaveBeenCalledWith(
          ipHash,
          PASSWORD_RECOVERY_RATE_WINDOW_MINUTES
        );

        expect(
          findEligibleUser
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'IP bajo limite continua al lookup neutral',
      async () => {
        const ipHash =
          'e'.repeat(
            64
          );

        const findEligibleUser =
          jest.fn(
            async () =>
              null
          );

        const service =
          buildPasswordRecoveryService({
            createIpHash:
              jest.fn(
                () =>
                  ipHash
              ),

            countRecentIpChallenges:
              jest.fn(
                async () =>
                  PASSWORD_RECOVERY_MAX_PER_IP_WINDOW -
                  1
              ),

            findEligibleUser,
          } as any);

        const result =
          await service
            .requestPasswordRecovery(
              'nadie@example.com',
              '203.0.113.11'
            );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          findEligibleUser
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      'trust proxy queda en loopback por defecto',
      () => {
        const envSource =
          readFileSync(
            resolve(
              process.cwd(),
              'src/config/env.ts'
            ),
            'utf8'
          );

        const appSource =
          readFileSync(
            resolve(
              process.cwd(),
              'src/app.ts'
            ),
            'utf8'
          );

        expect(
          envSource
        ).toContain(
          'process.env.TRUST_PROXY'
        );

        expect(
          envSource
        ).toContain(
          "'loopback'"
        );

        expect(
          appSource
        ).toContain(
          "app.set(\n  'trust proxy',\n  env.trustProxy\n);"
        );
      }
    );
  }
);
