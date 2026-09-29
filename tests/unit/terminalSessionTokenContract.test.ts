import fs from 'node:fs';
import path from 'node:path';

import * as terminalTokenModule
  from '../../src/modules/auth/terminalAccess.token.js';


type AnyFunction =
  (...args: any[]) => any;


function rootFile(
  relativePath: string
) {
  return path.join(
    process.cwd(),
    relativePath
  );
}


function read(
  relativePath: string
) {
  return fs.readFileSync(
    rootFile(
      relativePath
    ),
    'utf8'
  );
}


function getExport(
  name: string
): unknown {
  return (
    terminalTokenModule as
      Record<string, unknown>
  )[name];
}


describe(
  'Cambio #1 — Sesión JWT exclusiva de terminal',
  () => {
    test(
      'conserva kind, role y scope exclusivos de terminal',
      () => {
        expect(
          terminalTokenModule
            .TERMINAL_ACCESS_TOKEN_KIND
        ).toBe(
          'terminal_attendance_session'
        );

        expect(
          terminalTokenModule
            .TERMINAL_ACCESS_TOKEN_ROLE
        ).toBe(
          'terminal_asistencia'
        );

        expect(
          terminalTokenModule
            .TERMINAL_ACCESS_TOKEN_SCOPE
        ).toBe(
          'attendance:kiosk'
        );
      }
    );


    test(
      'expone firma y verificación propias para la sesión terminal',
      () => {
        expect(
          typeof getExport(
            'signTerminalAccessToken'
          )
        ).toBe(
          'function'
        );

        expect(
          typeof getExport(
            'verifyTerminalAccessToken'
          )
        ).toBe(
          'function'
        );
      }
    );


    test(
      'env define configuración JWT exclusiva para terminal',
      () => {
        const source =
          read(
            'src/config/env.ts'
          );

        expect(
          source
        ).toMatch(
          /terminalAccess\s*:/i
        );

        expect(
          source
        ).toMatch(
          /TERMINAL_ACCESS_JWT_SECRET/
        );

        expect(
          source
        ).toMatch(
          /TERMINAL_ACCESS_JWT_EXPIRES_IN/
        );
      }
    );


    test(
      '.env.example documenta nombres de configuración sin secretos reales',
      () => {
        const source =
          read(
            '.env.example'
          );

        expect(
          source
        ).toMatch(
          /^TERMINAL_ACCESS_JWT_SECRET=/m
        );

        expect(
          source
        ).toMatch(
          /^TERMINAL_ACCESS_JWT_EXPIRES_IN=/m
        );

        expect(
          source
        ).not.toMatch(
          /SMART_RH_TEST_ONLY_TERMINAL/
        );
      }
    );


    test(
      'token terminal no reutiliza sesión normal ni adminAccess',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.token.ts'
          );

        expect(
          source
        ).not.toMatch(
          /\bsignJwt\b/
        );

        expect(
          source
        ).not.toMatch(
          /\bverifyJwt\b/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccessToken/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccess\.token/
        );

        expect(
          source
        ).not.toMatch(
          /ADMIN_ACCESS_JWT_SECRET/
        );
      }
    );


    test(
      'firma y verifica terminalId sin crear identidad de usuario o admin',
      () => {
        const sign =
          getExport(
            'signTerminalAccessToken'
          ) as
            AnyFunction | undefined;

        const verify =
          getExport(
            'verifyTerminalAccessToken'
          ) as
            AnyFunction | undefined;

        expect(
          typeof sign
        ).toBe(
          'function'
        );

        expect(
          typeof verify
        ).toBe(
          'function'
        );

        if (
          typeof sign !== 'function' ||
          typeof verify !== 'function'
        ) {
          return;
        }

        const token =
          sign({
            terminalId:
              'terminal-recepcion-01',
          });

        expect(
          typeof token
        ).toBe(
          'string'
        );

        expect(
          token.length
        ).toBeGreaterThan(
          20
        );

        const claims =
          verify(
            token
          );

        expect(
          claims
        ).toEqual(
          expect.objectContaining({
            kind:
              'terminal_attendance_session',

            role:
              'terminal_asistencia',

            scope:
              'attendance:kiosk',

            terminalId:
              'terminal-recepcion-01',
          })
        );

        expect(
          claims
        ).not.toHaveProperty(
          'userId'
        );

        expect(
          claims
        ).not.toHaveProperty(
          'adminUserId'
        );

        expect(
          claims
        ).not.toHaveProperty(
          'sponsorAdminId'
        );
      }
    );


    test(
      'el authJwt normal permanece sin conocer el rol terminal',
      () => {
        const source =
          read(
            'src/middlewares/authJwt.ts'
          );

        expect(
          source
        ).not.toMatch(
          /terminal_asistencia/
        );

        expect(
          source
        ).not.toMatch(
          /attendance:kiosk/
        );

        expect(
          source
        ).not.toMatch(
          /verifyTerminalAccessToken/
        );
      }
    );


    test(
      'adminAccess permanece independiente del token terminal',
      () => {
        const source =
          [
            read(
              'src/modules/auth/adminAccess.token.ts'
            ),

            read(
              'src/middlewares/requireAdminAccess.ts'
            ),
          ].join(
            '\n'
          );

        expect(
          source
        ).not.toMatch(
          /TERMINAL_ACCESS_JWT_SECRET/
        );

        expect(
          source
        ).not.toMatch(
          /signTerminalAccessToken/
        );

        expect(
          source
        ).not.toMatch(
          /verifyTerminalAccessToken/
        );
      }
    );
  }
);
