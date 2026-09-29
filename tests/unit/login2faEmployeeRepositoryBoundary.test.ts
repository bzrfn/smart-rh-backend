import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';


describe(
  'Login 2FA employee repository boundary',
  () => {
    const source =
      readFileSync(
        join(
          process.cwd(),
          'src/modules/auth/login2fa.repository.ts'
        ),
        'utf8'
      );


    test(
      'repository 2FA admite roles autenticables conocidos',
      () => {
        const start =
          source.indexOf(
            'function isEligibleLogin2faUserRow'
          );

        const end =
          source.indexOf(
            'export async function findLatestActiveLogin2faChallenge',
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

        const helper =
          source.slice(
            start,
            end
          );

        expect(
          helper
        ).toContain(
          "'admin'"
        );

        expect(
          helper
        ).toContain(
          "'empleado'"
        );

        expect(
          helper
        ).toContain(
          "'tecnico'"
        );

        expect(
          helper
        ).not.toContain(
          ".toLowerCase() === 'admin'"
        );

        expect(
          helper
        ).toContain(
          'Number(row.activo) === 1'
        );

        expect(
          helper
        ).toContain(
          'Number(row.email_verificado) === 1'
        );
      }
    );


    test(
      'emision y consumo reutilizan elegibilidad generica',
      () => {
        const matches =
          source.match(
            /!isEligibleLogin2faUserRow\(/g
          ) || [];

        expect(
          matches
        ).toHaveLength(
          2
        );
      }
    );


    test(
      'repository ya no contiene helper exclusivo de admin',
      () => {
        expect(
          source
        ).not.toContain(
          'isEligibleAdminRow'
        );
      }
    );
  }
);
