import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Admin portal access routes',
  () => {
    test(
      'monta /admin-access dentro de auth',
      () => {
        const source =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/auth/auth.routes.ts'
            ),
            'utf8'
          );

        expect(
          source
        ).toMatch(
          /authRoutes\.use\(\s*['"]\/admin-access['"],\s*adminAccessRoutes\s*\)/s
        );
      }
    );


    test(
      'expone request y verify sin authJwt previo',
      () => {
        const source =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/auth/adminAccess.routes.ts'
            ),
            'utf8'
          );

        expect(
          source
        ).toMatch(
          /adminAccessRoutes\.post\(\s*['"]\/request['"],\s*requestAdminAccessController\s*\)/s
        );

        expect(
          source
        ).toMatch(
          /adminAccessRoutes\.post\(\s*['"]\/verify['"],\s*verifyAdminAccessController\s*\)/s
        );

        expect(
          source
        ).not.toContain(
          'authJwt'
        );
      }
    );
  }
);
