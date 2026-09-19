import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';


function getVerifyAccountSource():
string {
  const source =
    readFileSync(
      join(
        process.cwd(),
        'src/modules/auth/auth.service.ts'
      ),
      'utf8'
    );

  const start =
    source.indexOf(
      'export async function verifyAccount'
    );

  const end =
    source.indexOf(
      'export async function forgotPassword',
      start
    );

  if (
    start < 0 ||
    end < 0 ||
    end <= start
  ) {
    throw new Error(
      'No se pudo localizar verifyAccount'
    );
  }

  return source.slice(
    start,
    end
  );
}


describe(
  'Verify account session hardening',
  () => {
    test(
      'verifyAccount no firma JWT',
      () => {
        const source =
          getVerifyAccountSource();

        expect(
          source
        ).not.toContain(
          'signJwt('
        );
      }
    );


    test(
      'verifyAccount no devuelve token',
      () => {
        const source =
          getVerifyAccountSource();

        expect(
          source
        ).not.toMatch(
          /\btoken\s*,/
        );

        expect(
          source
        ).not.toMatch(
          /\btoken\s*:/
        );
      }
    );


    test(
      'cuenta ya verificada requiere login',
      () => {
        const source =
          getVerifyAccountSource();

        expect(
          source
        ).toContain(
          'La cuenta ya estaba verificada. Inicia sesión para continuar.'
        );

        expect(
          source
        ).toContain(
          'requiresLogin: true'
        );
      }
    );


    test(
      'cuenta recien confirmada requiere login',
      () => {
        const source =
          getVerifyAccountSource();

        expect(
          source
        ).toContain(
          'Cuenta confirmada correctamente. Inicia sesión para continuar.'
        );
      }
    );
  }
);
