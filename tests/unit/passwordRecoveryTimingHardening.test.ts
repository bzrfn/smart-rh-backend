import {
  buildPasswordRecoveryService,
  PASSWORD_RECOVERY_MIN_RESPONSE_MS,
  waitForPasswordRecoveryMinimumDuration,
} from '../../src/modules/auth/passwordRecovery.service.js';


describe(
  'Password recovery timing hardening',
  () => {
    test(
      'espera solo el tiempo restante hasta el piso minimo',
      async () => {
        let sleptMs =
          -1;

        await waitForPasswordRecoveryMinimumDuration(
          100,
          {
            minDurationMs:
              750,

            nowMs:
              () =>
                300,

            sleep:
              async (
                milliseconds
              ) => {
                sleptMs =
                  milliseconds;
              },
          }
        );

        expect(
          sleptMs
        ).toBe(
          550
        );
      }
    );


    test(
      'no agrega espera si la ruta ya supero el piso minimo',
      async () => {
        const sleep =
          jest.fn(
            async () =>
              undefined
          );

        await waitForPasswordRecoveryMinimumDuration(
          100,
          {
            minDurationMs:
              750,

            nowMs:
              () =>
                900,

            sleep,
          }
        );

        expect(
          sleep
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'el piso por defecto permanece en 750ms',
      () => {
        expect(
          PASSWORD_RECOVERY_MIN_RESPONSE_MS
        ).toBe(
          750
        );
      }
    );


    test(
      'correo invalido pasa por normalizacion temporal',
      async () => {
        const waitForNeutralResponse =
          jest.fn(
            async () =>
              undefined
          );

        const service =
          buildPasswordRecoveryService({
            waitForNeutralResponse,
          } as any);

        const result =
          await service
            .requestPasswordRecovery(
              'x',
              '203.0.113.20'
            );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          waitForNeutralResponse
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      'usuario inexistente tambien pasa por normalizacion temporal',
      async () => {
        const waitForNeutralResponse =
          jest.fn(
            async () =>
              undefined
          );

        const service =
          buildPasswordRecoveryService({
            createIpHash:
              jest.fn(
                () =>
                  'd'.repeat(
                    64
                  )
              ),

            countRecentIpChallenges:
              jest.fn(
                async () =>
                  0
              ),

            findEligibleUser:
              jest.fn(
                async () =>
                  null
              ),

            waitForNeutralResponse,
          } as any);

        const result =
          await service
            .requestPasswordRecovery(
              'nadie@example.com',
              '203.0.113.21'
            );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          waitForNeutralResponse
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      'flujo creado y enviado tambien pasa por normalizacion temporal',
      async () => {
        const waitForNeutralResponse =
          jest.fn(
            async () =>
              undefined
          );

        const user = {
          id:
            999,

          nombre:
            'Timing',

          apellido:
            'Test',

          correo:
            'timing@example.com',

          session_version:
            1,
        };

        const service =
          buildPasswordRecoveryService({
            createIpHash:
              jest.fn(
                () =>
                  'd'.repeat(
                    64
                  )
              ),

            countRecentIpChallenges:
              jest.fn(
                async () =>
                  0
              ),

            findEligibleUser:
              jest.fn(
                async () =>
                  user
              ),

            findLatestActiveChallenge:
              jest.fn(
                async () =>
                  null
              ),

            countRecentChallenges:
              jest.fn(
                async () =>
                  0
              ),

            generateChallengeId:
              jest.fn(
                () =>
                  'b'.repeat(
                    64
                  )
              ),

            generateCode:
              jest.fn(
                () =>
                  '123456'
              ),

            createCodeHmac:
              jest.fn(
                () =>
                  'c'.repeat(
                    64
                  )
              ),

            createChallenge:
              jest.fn(
                async () => ({
                  status:
                    'created' as const,
                })
              ),

            sendResetCodeEmail:
              jest.fn(
                async () =>
                  undefined
              ),

            registerEvent:
              jest.fn(
                async () =>
                  undefined
              ),

            registerActivity:
              jest.fn(
                async () =>
                  undefined
              ),

            waitForNeutralResponse,
          } as any);

        const result =
          await service
            .requestPasswordRecovery(
              user.correo,
              '203.0.113.22'
            );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          waitForNeutralResponse
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);
