import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Login 2FA auth integration contract',
  () => {
    const service =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/auth/auth.service.ts'
        ),
        'utf8'
      );

    const controller =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/auth/auth.controller.ts'
        ),
        'utf8'
      );

    const events =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/eventosSistema/eventosSistema.types.ts'
        ),
        'utf8'
      );


    test(
      'admin recibe challenge 2FA antes de cualquier JWT',
      () => {
        const start =
          service.indexOf(
            'export async function login'
          );

        const end =
          service.indexOf(
            'export async function verifyLoginCode',
            start
          );

        const block =
          service.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'issueAdminLogin2fa'
        );

        expect(
          block
        ).toContain(
          "'admin'"
        );

        expect(
          block
        ).toContain(
          'return challenge'
        );

        const adminBranch =
          block.indexOf(
            'issueAdminLogin2fa'
          );

        const directJwt =
          block.indexOf(
            'signJwt({'
          );

        expect(
          directJwt
        ).toBeGreaterThan(
          adminBranch
        );
      }
    );


    test(
      'empleado obtiene JWT directo versionado',
      () => {
        const start =
          service.indexOf(
            'export async function login'
          );

        const end =
          service.indexOf(
            'export async function verifyLoginCode',
            start
          );

        const block =
          service.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'signJwt({'
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

        expect(
          block
        ).toContain(
          'false'
        );
      }
    );


    test(
      'legacy email LOGIN_2FA ya no participa en login ni verify',
      () => {
        const start =
          service.indexOf(
            'export async function login'
          );

        const end =
          service.indexOf(
            'export async function register',
            start
          );

        const block =
          service.slice(
            start,
            end
          );

        expect(
          block
        ).not.toContain(
          "tipo: 'LOGIN_2FA'"
        );

        expect(
          block
        ).not.toContain(
          'enviarCodigoLoginEmail'
        );

        expect(
          block
        ).not.toContain(
          'consumirCodigoEmail'
        );
      }
    );


    test(
      'verify usa challengeId en lugar de correo',
      () => {
        const start =
          controller.indexOf(
            'export async function verifyLoginCodeController'
          );

        const end =
          controller.indexOf(
            'export async function registerController',
            start
          );

        const block =
          controller.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'req.body?.challengeId'
        );

        expect(
          block
        ).not.toContain(
          'req.body?.correo'
        );
      }
    );


    test(
      'IP del request llega al servicio de login',
      () => {
        const start =
          controller.indexOf(
            'export async function loginController'
          );

        const end =
          controller.indexOf(
            'export async function verifyLoginCodeController',
            start
          );

        const block =
          controller.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'req.ip'
        );
      }
    );


    test(
      'nuevo tipo de evento 2FA requerido esta declarado',
      () => {
        expect(
          events
        ).toContain(
          "'LOGIN_2FA_REQUERIDO'"
        );
      }
    );


    test(
      'verify recupera usuario despues de challenge y revalida session version',
      () => {
        const start =
          service.indexOf(
            'export async function verifyLoginCode'
          );

        const end =
          service.indexOf(
            'export async function register',
            start
          );

        const block =
          service.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'verifyAdminLogin2fa'
        );

        expect(
          block
        ).toContain(
          'findUserById'
        );

        expect(
          block
        ).toContain(
          'result.sessionVersion'
        );

        expect(
          block
        ).toContain(
          "'admin'"
        );
      }
    );
  }
);
