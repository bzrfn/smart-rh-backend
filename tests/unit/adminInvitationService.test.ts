import {
  AppError,
} from '../../src/utils/AppError.js';

import {
  buildAdminInviteService,
} from '../../src/modules/auth/adminInvite.service.js';


function adminUser() {
  return {
    id:
      7,

    correo:
      'sponsor@example.test',

    activo:
      1,

    email_verificado:
      1,

    session_version:
      3,

    rol_id:
      1,

    rol_nombre:
      'admin',

    nombre:
      'Admin',

    apellido:
      'Sponsor',

    contrasena:
      'hash',
  };
}


function buildDeps(
  overrides:
    Record<string, any> =
      {}
): any {
  return {
    findSponsor:
      jest.fn(
        async () =>
          adminUser()
      ),

    generateInvitationId:
      jest.fn(
        () =>
          'a'.repeat(
            64
          )
      ),

    generateToken:
      jest.fn(
        () =>
          'b'.repeat(
            64
          )
      ),

    createTokenHmac:
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

    createInvitation:
      jest.fn(
        async () => ({
          status:
            'created',
        })
      ),

    revokeInvitation:
      jest.fn(
        async () =>
          true
      ),

    acceptInvitation:
      jest.fn(
        async () => ({
          status:
            'ok',

          user: {
            id:
              99,

            correo:
              'invite@example.test',

            role:
              'admin',

            sessionVersion:
              1,
          },
        })
      ),

    hashPassword:
      jest.fn(
        async () =>
          'password-hash'
      ),

    sendInvitationEmail:
      jest.fn(
        async () =>
          undefined
      ),

    ...overrides,
  };
}


describe(
  'Admin invitation service',
  () => {
    const payload = {
      correo:
        'invite@example.test',

      nombre:
        'Nuevo',

      apellido:
        'Administrador',

      telefono:
        null,

      direccion:
        null,

      fecha_ingreso:
        null,

      dias_vacaciones_disponibles:
        12,
    };


    test(
      'crea invitacion ligada al sponsor y envia link sin exponer token en respuesta',
      async () => {
        const deps =
          buildDeps();

        const service =
          buildAdminInviteService(
            deps
          );

        const result =
          await service.requestInvitation(
            7,
            payload,
            '127.0.0.1'
          );


        expect(
          deps.createInvitation
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            sponsorAdminId:
              7,

            sponsorSessionVersion:
              3,

            inviteEmail:
              'invite@example.test',
          })
        );


        expect(
          deps.sendInvitationEmail
        ).toHaveBeenCalledTimes(
          1
        );


        const emailInput =
          deps
            .sendInvitationEmail
            .mock
            .calls[0][0];


        expect(
          emailInput.acceptUrl
        ).toContain(
          'invitationId='
        );

        expect(
          emailInput.acceptUrl
        ).toContain(
          'token='
        );


        expect(
          result
        ).not.toHaveProperty(
          'token'
        );

        expect(
          result.invitationId
        ).toBe(
          'a'.repeat(
            64
          )
        );
      }
    );


    test(
      'rechaza sponsor que ya no es admin elegible',
      async () => {
        const deps =
          buildDeps({
            findSponsor:
              jest.fn(
                async () => ({
                  ...adminUser(),
                  activo:
                    0,
                })
              ),
          });

        const service =
          buildAdminInviteService(
            deps
          );


        await expect(
          service.requestInvitation(
            7,
            payload
          )
        ).rejects.toMatchObject({
          statusCode:
            403,
        });
      }
    );


    test(
      'mapea invitacion activa a conflicto',
      async () => {
        const deps =
          buildDeps({
            createInvitation:
              jest.fn(
                async () => ({
                  status:
                    'active',
                })
              ),
          });

        const service =
          buildAdminInviteService(
            deps
          );


        await expect(
          service.requestInvitation(
            7,
            payload
          )
        ).rejects.toMatchObject({
          statusCode:
            409,
        });
      }
    );


    test(
      'revoca exactamente la invitacion si SMTP falla',
      async () => {
        const deps =
          buildDeps({
            sendInvitationEmail:
              jest.fn(
                async () => {
                  throw new Error(
                    'smtp'
                  );
                }
              ),
          });

        const service =
          buildAdminInviteService(
            deps
          );


        await expect(
          service.requestInvitation(
            7,
            payload
          )
        ).rejects.toMatchObject({
          statusCode:
            502,
        });


        expect(
          deps.revokeInvitation
        ).toHaveBeenCalledWith(
          'a'.repeat(
            64
          ),
          7
        );
      }
    );


    test(
      'acepta invitacion con token HMAC y password hasheado',
      async () => {
        const deps =
          buildDeps();

        const service =
          buildAdminInviteService(
            deps
          );


        const result =
          await service.acceptInvitation({
            invitationId:
              'a'.repeat(
                64
              ),

            token:
              'b'.repeat(
                64
              ),

            contrasena:
              'PasswordSeguro123!',
          });


        expect(
          deps.createTokenHmac
        ).toHaveBeenCalledWith(
          'a'.repeat(
            64
          ),
          'b'.repeat(
            64
          )
        );


        expect(
          deps.hashPassword
        ).toHaveBeenCalledWith(
          'PasswordSeguro123!'
        );


        expect(
          deps.acceptInvitation
        ).toHaveBeenCalledWith(
          'a'.repeat(
            64
          ),
          'c'.repeat(
            64
          ),
          'password-hash'
        );


        expect(
          result.user.role
        ).toBe(
          'admin'
        );
      }
    );


    test(
      'no devuelve JWT al aceptar invitacion',
      async () => {
        const deps =
          buildDeps();

        const service =
          buildAdminInviteService(
            deps
          );


        const result =
          await service.acceptInvitation({
            invitationId:
              'a'.repeat(
                64
              ),

            token:
              'b'.repeat(
                64
              ),

            contrasena:
              'PasswordSeguro123!',
          });


        expect(
          result
        ).not.toHaveProperty(
          'token'
        );
      }
    );


    test(
      'rechaza password corto antes de consumir invitacion',
      async () => {
        const deps =
          buildDeps();

        const service =
          buildAdminInviteService(
            deps
          );


        await expect(
          service.acceptInvitation({
            invitationId:
              'a'.repeat(
                64
              ),

            token:
              'b'.repeat(
                64
              ),

            contrasena:
              '123',
          })
        ).rejects.toBeInstanceOf(
          AppError
        );


        expect(
          deps.acceptInvitation
        ).not.toHaveBeenCalled();
      }
    );
  }
);
