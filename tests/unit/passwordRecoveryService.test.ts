import {
  buildPasswordRecoveryService,
  PASSWORD_RECOVERY_MAX_ATTEMPTS,
} from '../../src/modules/auth/passwordRecovery.service.js';


const user = {
  id:
    10,

  nombre:
    'Usuario',

  apellido:
    'Prueba',

  correo:
    'usuario@example.com',

  activo:
    1,

  email_verificado:
    1,
};


function makeDeps(
  overrides:
    Record<string, unknown> = {}
) {
  return {
    findEligibleUser:
      jest.fn(
        async () =>
          user
      ),

    findLatestActiveChallenge:
      jest.fn(
        async () => ({
          challengeId:
            'a'.repeat(
              64
            ),

          secondsElapsed:
            120,
        })
      ),

    countRecentChallenges:
      jest.fn(
        async () =>
          0
      ),

    invalidateActiveChallenges:
      jest.fn(
        async () =>
          undefined
      ),

    createChallenge:
      jest.fn(
        async () =>
          undefined
      ),

    consumeChallenge:
      jest.fn(
        async () => ({
          status:
            'ok' as const,

          user: {
            id:
              user.id,

            nombre:
              user.nombre,

            apellido:
              user.apellido,

            correo:
              user.correo,
          },
        })
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

    createIpHash:
      jest.fn(
        () =>
          'd'.repeat(
            64
          )
      ),

    isValidCode:
      jest.fn(
        (
          value:
            unknown
        ) =>
          /^\d{6}$/.test(
            String(
              value ||
              ''
            )
          )
      ),

    hashPassword:
      jest.fn(
        async () =>
          'HASHED_PASSWORD'
      ),

    sendResetCodeEmail:
      jest.fn(
        async () =>
          undefined
      ),

    sendPasswordUpdatedEmail:
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

    ...overrides,
  };
}


describe(
  'Password recovery service',
  () => {
    test(
      'correo inexistente conserva respuesta neutral',
      async () => {
        const deps =
          makeDeps({
            findEligibleUser:
              jest.fn(
                async () =>
                  null
              ),
          });

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        const result =
          await service
            .requestPasswordRecovery(
              'nadie@example.com',
              '127.0.0.1'
            );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          result
        ).not.toHaveProperty(
          'challengeId'
        );

        expect(
          result
        ).not.toHaveProperty(
          'codigo'
        );

        expect(
          deps.createChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.sendResetCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'crea challenge HMAC y envia codigo solo por email',
      async () => {
        const deps =
          makeDeps({
            findLatestActiveChallenge:
              jest.fn(
                async () =>
                  null
              ),
          });

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        const result =
          await service
            .requestPasswordRecovery(
              user.correo,
              '127.0.0.1'
            );

        expect(
          deps.createChallenge
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            challengeId:
              'b'.repeat(
                64
              ),

            userId:
              user.id,

            codeHmac:
              'c'.repeat(
                64
              ),

            maxAttempts:
              PASSWORD_RECOVERY_MAX_ATTEMPTS,
          })
        );

        expect(
          deps.sendResetCodeEmail
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            correo:
              user.correo,

            codigo:
              '123456',
          })
        );

        expect(
          result
        ).not.toHaveProperty(
          'challengeId'
        );

        expect(
          result
        ).not.toHaveProperty(
          'codigo'
        );
      }
    );


    test(
      'cooldown bloquea una solicitud repetida',
      async () => {
        const deps =
          makeDeps({
            findLatestActiveChallenge:
              jest.fn(
                async () => ({
                  challengeId:
                    'a'.repeat(
                      64
                    ),

                  secondsElapsed:
                    10,
                })
              ),
          });

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        await service
          .requestPasswordRecovery(
            user.correo,
            '127.0.0.1'
          );

        expect(
          deps.createChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.sendResetCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'rate limit por usuario bloquea nuevos challenges',
      async () => {
        const deps =
          makeDeps({
            findLatestActiveChallenge:
              jest.fn(
                async () =>
                  null
              ),

            countRecentChallenges:
              jest.fn(
                async () =>
                  3
              ),
          });

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        await service
          .requestPasswordRecovery(
            user.correo,
            '127.0.0.1'
          );

        expect(
          deps.createChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.sendResetCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'fallo de email invalida el challenge',
      async () => {
        const deps =
          makeDeps({
            findLatestActiveChallenge:
              jest.fn(
                async () =>
                  null
              ),

            sendResetCodeEmail:
              jest.fn(
                async () => {
                  throw new Error(
                    'SMTP TEST'
                  );
                }
              ),
          });

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        const result =
          await service
            .requestPasswordRecovery(
              user.correo,
              '127.0.0.1'
            );

        expect(
          deps.invalidateActiveChallenges
        ).toHaveBeenCalledTimes(
          2
        );

        expect(
          result.accepted
        ).toBe(
          true
        );
      }
    );


    test(
      'codigo mal formado no llega al consumo',
      async () => {
        const deps =
          makeDeps();

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        await expect(
          service.completePasswordRecovery(
            user.correo,
            '12',
            'NuevaPassword123!'
          )
        ).rejects.toMatchObject({
          statusCode:
            400,
        });

        expect(
          deps.consumeChallenge
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'codigo incorrecto devuelve error generico',
      async () => {
        const deps =
          makeDeps({
            consumeChallenge:
              jest.fn(
                async () => ({
                  status:
                    'invalid' as const,
                })
              ),
          });

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        await expect(
          service.completePasswordRecovery(
            user.correo,
            '123456',
            'NuevaPassword123!'
          )
        ).rejects.toMatchObject({
          statusCode:
            400,
        });

        expect(
          deps.createCodeHmac
        ).toHaveBeenCalledWith(
          'a'.repeat(
            64
          ),
          '123456'
        );

        expect(
          deps.consumeChallenge
        ).toHaveBeenCalled();
      }
    );


    test(
      'codigo correcto usa consumo transaccional',
      async () => {
        const deps =
          makeDeps();

        const service =
          buildPasswordRecoveryService(
            deps as any
          );

        const result =
          await service
            .completePasswordRecovery(
              user.correo,
              '123456',
              'NuevaPassword123!'
            );

        expect(
          deps.hashPassword
        ).toHaveBeenCalledWith(
          'NuevaPassword123!'
        );

        expect(
          deps.consumeChallenge
        ).toHaveBeenCalledWith(
          'a'.repeat(
            64
          ),
          'c'.repeat(
            64
          ),
          'HASHED_PASSWORD'
        );

        expect(
          deps.sendPasswordUpdatedEmail
        ).toHaveBeenCalled();

        expect(
          deps.registerActivity
        ).toHaveBeenCalled();

        expect(
          result.message
        ).toBe(
          'Contraseña actualizada correctamente'
        );
      }
    );
  }
);
