import {
  AppError,
} from '../../src/utils/AppError.js';

import {
  buildLogin2faService,
} from '../../src/modules/auth/login2fa.service.js';


function createDependencies() {
  return {
    findLatestActiveChallenge:
      jest.fn(),

    replaceChallenge:
      jest.fn(),

    invalidateChallenge:
      jest.fn(),

    consumeChallenge:
      jest.fn(),

    generateChallengeId:
      jest.fn(
        () =>
          'a'.repeat(
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
          'b'.repeat(
            64
          )
      ),

    createIpHash:
      jest.fn(
        () =>
          'c'.repeat(
            64
          )
      ),

    isValidChallengeId:
      jest.fn(
        () =>
          true
      ),

    isValidCode:
      jest.fn(
        () =>
          true
      ),

    sendLoginCodeEmail:
      jest.fn(),

    signSessionToken:
      jest.fn(
        () =>
          'signed-session-token'
      ),
  };
}


const admin = {
  id:
    7,

  correo:
    'admin@example.test',

  nombre:
    'Admin',

  apellido:
    'SMART RH',

  role:
    'admin',

  sessionVersion:
    4,
};


describe(
  'Login 2FA service',
  () => {
    test(
      'rechaza uso para rol distinto de admin',
      async () => {
        const deps =
          createDependencies();

        const service =
          buildLogin2faService(
            deps as any
          );


        await expect(
          service.issueAdminLogin2fa(
            {
              ...admin,
              role:
                'empleado',
            },
            '127.0.0.1'
          )
        ).rejects.toBeInstanceOf(
          AppError
        );


        expect(
          deps.replaceChallenge
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'reutiliza challenge activo durante cooldown sin reenviar',
      async () => {
        const deps =
          createDependencies();


        deps.findLatestActiveChallenge
          .mockResolvedValue({
            challengeId:
              'd'.repeat(
                64
              ),

            secondsElapsed:
              20,
          });


        const service =
          buildLogin2faService(
            deps as any
          );


        const result =
          await service.issueAdminLogin2fa(
            admin,
            '127.0.0.1'
          );


        expect(
          result.requires2FA
        ).toBe(
          true
        );

        expect(
          result.challengeId
        ).toBe(
          'd'.repeat(
            64
          )
        );

        expect(
          result.reused
        ).toBe(
          true
        );

        expect(
          deps.replaceChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.sendLoginCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'crea challenge y envia codigo',
      async () => {
        const deps =
          createDependencies();


        deps.findLatestActiveChallenge
          .mockResolvedValue(
            null
          );

        deps.replaceChallenge
          .mockResolvedValue({
            status:
              'created',
          });

        deps.sendLoginCodeEmail
          .mockResolvedValue(
            undefined
          );


        const service =
          buildLogin2faService(
            deps as any
          );


        const result =
          await service.issueAdminLogin2fa(
            admin,
            '203.0.113.20'
          );


        expect(
          result.requires2FA
        ).toBe(
          true
        );

        expect(
          result.challengeId
        ).toBe(
          'a'.repeat(
            64
          )
        );

        expect(
          result.reused
        ).toBe(
          false
        );


        expect(
          deps.createCodeHmac
        ).toHaveBeenCalledWith(
          'a'.repeat(
            64
          ),
          '123456'
        );


        expect(
          deps.replaceChallenge
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            userId:
              admin.id,

            expectedSessionVersion:
              admin.sessionVersion,

            challengeId:
              'a'.repeat(
                64
              ),

            codeHmac:
              'b'.repeat(
                64
              ),

            requestIpHash:
              'c'.repeat(
                64
              ),
          })
        );


        expect(
          deps.sendLoginCodeEmail
        ).toHaveBeenCalledWith({
          correo:
            admin.correo,

          nombre:
            'Admin SMART RH',

          codigo:
            '123456',
        });
      }
    );


    test(
      'fallo SMTP invalida challenge exacto',
      async () => {
        const deps =
          createDependencies();


        deps.findLatestActiveChallenge
          .mockResolvedValue(
            null
          );

        deps.replaceChallenge
          .mockResolvedValue({
            status:
              'created',
          });

        deps.sendLoginCodeEmail
          .mockRejectedValue(
            new Error(
              'smtp'
            )
          );

        deps.invalidateChallenge
          .mockResolvedValue(
            undefined
          );


        const service =
          buildLogin2faService(
            deps as any
          );


        await expect(
          service.issueAdminLogin2fa(
            admin,
            '127.0.0.1'
          )
        ).rejects.toMatchObject({
          statusCode:
            503,
        });


        expect(
          deps.invalidateChallenge
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          deps.invalidateChallenge
        ).toHaveBeenCalledWith(
          'a'.repeat(
            64
          )
        );
      }
    );


    test(
      'rate bloqueado produce 429',
      async () => {
        const deps =
          createDependencies();


        deps.findLatestActiveChallenge
          .mockResolvedValue(
            null
          );

        deps.replaceChallenge
          .mockResolvedValue({
            status:
              'blocked',
          });


        const service =
          buildLogin2faService(
            deps as any
          );


        await expect(
          service.issueAdminLogin2fa(
            admin,
            '127.0.0.1'
          )
        ).rejects.toMatchObject({
          statusCode:
            429,
        });


        expect(
          deps.sendLoginCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'stale e ineligible no envian correo',
      async () => {
        for (
          const status
          of [
            'stale',
            'ineligible',
          ] as const
        ) {
          const deps =
            createDependencies();


          deps.findLatestActiveChallenge
            .mockResolvedValue(
              null
            );

          deps.replaceChallenge
            .mockResolvedValue({
              status,
            });


          const service =
            buildLogin2faService(
              deps as any
            );


          await expect(
            service.issueAdminLogin2fa(
              admin,
              '127.0.0.1'
            )
          ).rejects.toMatchObject({
            statusCode:
              401,
          });


          expect(
            deps.sendLoginCodeEmail
          ).not.toHaveBeenCalled();
        }
      }
    );


    test(
      'verificacion consume antes de firmar JWT',
      async () => {
        const deps =
          createDependencies();

        const order:
          string[] =
            [];


        deps.consumeChallenge
          .mockImplementation(
            async () => {
              order.push(
                'consume'
              );

              return {
                status:
                  'ok',

                user: {
                  id:
                    admin.id,

                  correo:
                    admin.correo,

                  nombre:
                    admin.nombre,

                  apellido:
                    admin.apellido,

                  role:
                    'admin',

                  sessionVersion:
                    admin.sessionVersion,
                },
              };
            }
          );


        deps.signSessionToken
          .mockImplementation(
            () => {
              order.push(
                'sign'
              );

              return 'signed-session-token';
            }
          );


        const service =
          buildLogin2faService(
            deps as any
          );


        const result =
          await service.verifyAdminLogin2fa(
            'a'.repeat(
              64
            ),
            '123456'
          );


        expect(
          order
        ).toEqual(
          [
            'consume',
            'sign',
          ]
        );


        expect(
          deps.signSessionToken
        ).toHaveBeenCalledWith({
          userId:
            admin.id,

          role:
            'admin',

          sessionVersion:
            admin.sessionVersion,
        });


        expect(
          result.token
        ).toBe(
          'signed-session-token'
        );
      }
    );


    test(
      'challenge invalido no toca repository',
      async () => {
        const deps =
          createDependencies();


        deps.isValidChallengeId
          .mockReturnValue(
            false
          );


        const service =
          buildLogin2faService(
            deps as any
          );


        await expect(
          service.verifyAdminLogin2fa(
            'bad',
            '123456'
          )
        ).rejects.toMatchObject({
          statusCode:
            400,
        });


        expect(
          deps.consumeChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.signSessionToken
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'challenge consumido o codigo incorrecto no firma JWT',
      async () => {
        const deps =
          createDependencies();


        deps.consumeChallenge
          .mockResolvedValue({
            status:
              'invalid',
          });


        const service =
          buildLogin2faService(
            deps as any
          );


        await expect(
          service.verifyAdminLogin2fa(
            'a'.repeat(
              64
            ),
            '123456'
          )
        ).rejects.toMatchObject({
          statusCode:
            400,
        });


        expect(
          deps.signSessionToken
        ).not.toHaveBeenCalled();
      }
    );
  }
);
