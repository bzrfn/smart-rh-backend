import fs from 'node:fs';

describe(
  'Cambio #1.1 - terminal profesional y sesión directa admin',
  () => {
    const routes =
      fs.readFileSync(
        'src/modules/auth/terminalAccess.routes.ts',
        'utf8'
      );

    const controller =
      fs.readFileSync(
        'src/modules/auth/terminalAccess.controller.ts',
        'utf8'
      );

    const email =
      fs.readFileSync(
        'src/modules/auth/terminalAccess.email.ts',
        'utf8'
      );

    test(
      'existe endpoint admin-session',
      () => {
        expect(
          routes
        ).toContain(
          '/admin-session'
        );
      }
    );

    test(
      'admin-session exige JWT administrativo y aprobador dedicado',
      () => {
        expect(
          routes
        ).toMatch(
          /admin-session[\s\S]*authJwt[\s\S]*requireTerminalApprover/
        );
      }
    );

    test(
      'admin-session emite JWT terminal dedicado',
      () => {
        expect(
          controller
        ).toContain(
          'createAdminTerminalSessionController'
        );

        expect(
          controller
        ).toContain(
          'signTerminalAccessToken'
        );
      }
    );

    test(
      'admin-session valida terminalId',
      () => {
        expect(
          controller
        ).toContain(
          'Identificador de terminal inválido'
        );
      }
    );

    test(
      'email incluye CTA de revisión',
      () => {
        expect(
          email
        ).toContain(
          'Revisar y autorizar terminal'
        );
      }
    );

    test(
      'email enlaza challengeId a la página administrativa',
      () => {
        expect(
          email
        ).toContain(
          'terminal-autorizacion?challengeId='
        );
      }
    );
  }
);
