import {
  signJwt,
} from '../../src/config/jwt.js';

import {
  ADMIN_ACCESS_TOKEN_KIND,
  ADMIN_ACCESS_TOKEN_SCOPE,
  signAdminAccessToken,
  verifyAdminAccessToken,
} from '../../src/modules/auth/adminAccess.token.js';

import {
  requireAdminAccess,
} from '../../src/middlewares/requireAdminAccess.js';


describe(
  'Admin portal access token',
  () => {
    test(
      'crea y valida un token administrativo temporal',
      () => {
        const token =
          signAdminAccessToken({
            sponsorAdminId: 7,
            sponsorEmail:
              'ADMIN@SMART-RH.COM.MX',
          });

        const decoded =
          verifyAdminAccessToken(
            token
          );

        expect(
          decoded
        ).toEqual({
          kind:
            ADMIN_ACCESS_TOKEN_KIND,

          scope:
            ADMIN_ACCESS_TOKEN_SCOPE,

          sponsorAdminId:
            7,

          sponsorEmail:
            'admin@smart-rh.com.mx',
        });
      }
    );


    test(
      'un JWT normal de usuario no funciona como acceso administrativo',
      () => {
        const normalJwt =
          signJwt({
            userId: 7,
            role: 'admin',
          });

        expect(
          () =>
            verifyAdminAccessToken(
              normalJwt
            )
        ).toThrow(
          'Acceso administrativo inválido o expirado'
        );
      }
    );


    test(
      'rechaza un token manipulado',
      () => {
        const token =
          signAdminAccessToken({
            sponsorAdminId: 7,
            sponsorEmail:
              'admin@smart-rh.com.mx',
          });

        const last =
          token.slice(-1);

        const replacement =
          last === 'a'
            ? 'b'
            : 'a';

        const tampered =
          `${token.slice(
            0,
            -1
          )}${replacement}`;

        expect(
          () =>
            verifyAdminAccessToken(
              tampered
            )
        ).toThrow(
          'Acceso administrativo inválido o expirado'
        );
      }
    );


    test(
      'middleware acepta bearer administrativo y agrega contexto',
      () => {
        const token =
          signAdminAccessToken({
            sponsorAdminId: 11,
            sponsorEmail:
              'seguridad@smart-rh.com.mx',
          });

        const req: any = {
          headers: {
            authorization:
              `Bearer ${token}`,
          },
        };

        const next =
          jest.fn();

        requireAdminAccess(
          req,
          {} as any,
          next
        );

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          next
        ).toHaveBeenCalledWith();

        expect(
          req.adminAccess
        ).toEqual({
          kind:
            ADMIN_ACCESS_TOKEN_KIND,

          scope:
            ADMIN_ACCESS_TOKEN_SCOPE,

          sponsorAdminId:
            11,

          sponsorEmail:
            'seguridad@smart-rh.com.mx',
        });
      }
    );


    test(
      'middleware rechaza solicitud sin bearer',
      () => {
        const req: any = {
          headers: {},
        };

        const next =
          jest.fn();

        requireAdminAccess(
          req,
          {} as any,
          next
        );

        const error =
          next.mock.calls[0][0];

        expect(
          error
        ).toMatchObject({
          statusCode: 401,
          message:
            'Acceso administrativo requerido',
        });
      }
    );


    test(
      'middleware rechaza bearer inválido',
      () => {
        const req: any = {
          headers: {
            authorization:
              'Bearer token-invalido',
          },
        };

        const next =
          jest.fn();

        requireAdminAccess(
          req,
          {} as any,
          next
        );

        const error =
          next.mock.calls[0][0];

        expect(
          error
        ).toMatchObject({
          statusCode: 401,
          message:
            'Acceso administrativo inválido o expirado',
        });
      }
    );


    test(
      'no permite crear token con administrador inválido',
      () => {
        expect(
          () =>
            signAdminAccessToken({
              sponsorAdminId: 0,
              sponsorEmail:
                'admin@smart-rh.com.mx',
            })
        ).toThrow(
          'No se pudo crear la autorización administrativa'
        );
      }
    );
  }
);
