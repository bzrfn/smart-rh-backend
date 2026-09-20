// @ts-nocheck

import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';


function read(
  relativePath: string
): string {

  return readFileSync(
    join(
      process.cwd(),
      relativePath
    ),
    'utf8'
  );
}


describe(
  'Admin central approval boundary',
  () => {

    test(
      'correo autorizador se obtiene de configuración backend',
      () => {

        const config =
          read(
            'src/config/env.ts'
          );

        const example =
          read(
            '.env.example'
          );

        expect(
          config
        ).toContain(
          'ADMIN_ACCESS_APPROVER_EMAIL'
        );

        expect(
          config
        ).toContain(
          'approverEmail:'
        );

        expect(
          example
        ).toContain(
          'ADMIN_ACCESS_APPROVER_EMAIL='
        );

        /*
         * Nunca hardcodear el correo real
         * dentro de código versionado.
         */
        expect(
          config
        ).not.toContain(
          'brandonbernal413@gmail.com'
        );

        expect(
          example
        ).not.toContain(
          'brandonbernal413@gmail.com'
        );
      }
    );


    test(
      'browser ya no selecciona correo del autorizador',
      () => {

        const controller =
          read(
            'src/modules/auth/adminAccess.controller.ts'
          );

        expect(
          controller
        ).not.toContain(
          'req.body?.correo'
        );

        expect(
          controller
        ).toContain(
          'requestAdminAccess('
        );

        expect(
          controller
        ).toContain(
          'req.ip'
        );
      }
    );


    test(
      'service usa exclusivamente approver configurado',
      () => {

        const service =
          read(
            'src/modules/auth/adminAccess.service.ts'
          );

        expect(
          service
        ).toContain(
          'env.adminAccess.approverEmail'
        );

        expect(
          service
        ).toContain(
          'findEligibleAdminByEmail'
        );

        expect(
          service
        ).toContain(
          'Administrador general no disponible'
        );
      }
    );


    test(
      'admin que autoriza puede ser distinto del admin que inicia sesion',
      () => {

        const controller =
          read(
            'src/modules/auth/auth.controller.ts'
          );

        const service =
          read(
            'src/modules/auth/auth.service.ts'
          );

        expect(
          controller
        ).not.toContain(
          'sponsorEmail !==\n      correo'
        );

        expect(
          service
        ).not.toContain(
          'const userEmail'
        );

        expect(
          service
        ).not.toContain(
          'sponsorId !==\n        Number(\n          u.id'
        );

        expect(
          service
        ).toContain(
          'sponsorEmail !==\n        approverEmail'
        );
      }
    );


    test(
      'preautorizacion contraseña y 2FA siguen separados',
      () => {

        const service =
          read(
            'src/modules/auth/auth.service.ts'
          );

        const authorization =
          service.indexOf(
            'sponsorEmail !=='
          );

        const password =
          service.indexOf(
            'verifyPassword('
          );

        const twoFactor =
          service.indexOf(
            'issueAdminLogin2fa('
          );

        expect(
          authorization
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          password
        ).toBeGreaterThan(
          authorization
        );

        expect(
          twoFactor
        ).toBeGreaterThan(
          password
        );
      }
    );


    test(
      'admin-login sigue requiriendo adminAccessToken',
      () => {

        const routes =
          read(
            'src/modules/auth/auth.routes.ts'
          );

        expect(
          routes
        ).toMatch(
          /authRoutes\.post\(\s*['"]\/admin-login['"]\s*,\s*requireAdminAccess\s*,\s*adminLoginController\s*\)/
        );
      }
    );

  }
);
