import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';


function source(
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
  'Admin portal login boundary',
  () => {
    test(
      'admin-login exige requireAdminAccess',
      () => {
        const routes =
          source(
            'src/modules/auth/auth.routes.ts'
          );

        expect(
          routes
        ).toMatch(
          /authRoutes\.post\(\s*['"]\/admin-login['"]\s*,\s*requireAdminAccess\s*,\s*adminLoginController\s*\)/
        );
      }
    );


    test(
      'controller transporta identidad del autorizador central',
      () => {

        const controller =
          source(
            'src/modules/auth/auth.controller.ts'
          );

        expect(
          controller
        ).toContain(
          'req.adminAccess.sponsorEmail'
        );

        expect(
          controller
        ).toContain(
          'req.adminAccess.sponsorAdminId'
        );

        /*
         * El controller ya NO obliga a que
         * sponsorEmail sea igual al correo
         * de quien inicia sesión.
         */
        expect(
          controller
        ).not.toContain(
          'sponsorEmail !=='
        );
      }
    );


    test(
      'login admin exige autorización central antes del password',
      () => {
        const full =
          source(
            'src/modules/auth/auth.service.ts'
          );

        const start =
          full.indexOf(
            'export async function login('
          );

        const end =
          full.indexOf(
            'export async function verifyLoginCode',
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

        const login =
          full.slice(
            start,
            end
          );

        const guard =
          login.indexOf(
            'const isAdminAccount'
          );

        const password =
          login.indexOf(
            'verifyPassword('
          );

        const secondFactor =
          login.indexOf(
            'issueAdminLogin2fa('
          );

        expect(
          guard
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          password
        ).toBeGreaterThan(
          guard
        );

        expect(
          secondFactor
        ).toBeGreaterThan(
          password
        );

        expect(
          login
        ).toContain(
          'adminAccess?.sponsorAdminId'
        );

        expect(
          login
        ).toContain(
          'adminAccess?.sponsorEmail'
        );
      }
    );
  }
);
