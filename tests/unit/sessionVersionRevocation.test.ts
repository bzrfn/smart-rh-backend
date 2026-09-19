import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

import {
  signJwt,
  verifyJwt,
} from '../../src/config/jwt.js';

import {
  resolveAuthContext,
} from '../../src/middlewares/authJwt.js';


function read(
  relativePath: string
):
string {
  return readFileSync(
    join(
      process.cwd(),
      relativePath
    ),
    'utf8'
  );
}


describe(
  'Session version revocation',
  () => {
    test(
      'JWT nuevo conserva sessionVersion',
      () => {
        const token =
          signJwt({
            userId:
              10,

            role:
              'empleado',

            sessionVersion:
              3,
          });

        const claims =
          verifyJwt(
            token
          );

        expect(
          claims.sessionVersion
        ).toBe(
          3
        );
      }
    );


    test(
      'JWT legado sin version funciona mientras usuario siga en version 1',
      () => {
        expect(
          resolveAuthContext(
            {
              userId:
                10,

              role:
                'empleado',
            },
            {
              id:
                10,

              activo:
                1,

              session_version:
                1,

              role:
                'empleado',
            }
          )
        ).toEqual({
          userId:
            10,

          role:
            'empleado',
        });
      }
    );


    test(
      'JWT legado queda revocado cuando version cambia',
      () => {
        expect(
          () =>
            resolveAuthContext(
              {
                userId:
                  10,

                role:
                  'empleado',
              },
              {
                id:
                  10,

                activo:
                  1,

                session_version:
                  2,

                role:
                  'empleado',
              }
            )
        ).toThrow(
          'Sesión expirada. Inicia sesión nuevamente'
        );
      }
    );


    test(
      'JWT versionado funciona cuando coincide con DB',
      () => {
        expect(
          resolveAuthContext(
            {
              userId:
                10,

              role:
                'empleado',

              sessionVersion:
                4,
            },
            {
              id:
                10,

              activo:
                1,

              session_version:
                4,

              role:
                'empleado',
            }
          )
        ).toEqual({
          userId:
            10,

          role:
            'empleado',
        });
      }
    );


    test(
      'JWT queda revocado cuando las versiones no coinciden',
      () => {
        expect(
          () =>
            resolveAuthContext(
              {
                userId:
                  10,

                role:
                  'empleado',

                sessionVersion:
                  3,
              },
              {
                id:
                  10,

                activo:
                  1,

                session_version:
                  4,

                role:
                  'empleado',
              }
            )
        ).toThrow(
          'Sesión expirada. Inicia sesión nuevamente'
        );
      }
    );


    test(
      'login firma el JWT con sessionVersion actual',
      () => {
        const source =
          read(
            'src/modules/auth/auth.service.ts'
          );

        const start =
          source.indexOf(
            'export async function verifyLoginCode'
          );

        const end =
          source.indexOf(
            'export async function register',
            start
          );

        expect(
          start
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          end
        ).toBeGreaterThan(
          start
        );

        const block =
          source.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'sessionVersion:'
        );

        expect(
          block
        ).toContain(
          'u.session_version'
        );
      }
    );


    test(
      'password reset incrementa version e invalida 2FA pendiente',
      () => {
        const source =
          read(
            'src/modules/auth/passwordRecovery.repository.ts'
          );

        expect(
          source
        ).toContain(
          'session_version + 1'
        );

        expect(
          source
        ).toContain(
          "tipo = 'LOGIN_2FA'"
        );

        expect(
          source
        ).toContain(
          'usado = 1'
        );

        expect(
          source
        ).toContain(
          'beginTransaction()'
        );

        expect(
          source
        ).toContain(
          'commit()'
        );
      }
    );


    test(
      'estado de acceso consulta session_version desde usuarios',
      () => {
        const source =
          read(
            'src/modules/users/users.repository.ts'
          );

        expect(
          source
        ).toContain(
          'u.session_version'
        );
      }
    );


    test(
      'usuario de login consulta session_version',
      () => {
        const source =
          read(
            'src/modules/auth/auth.repository.ts'
          );

        expect(
          source
        ).toContain(
          'u.session_version'
        );
      }
    );
  }
);
