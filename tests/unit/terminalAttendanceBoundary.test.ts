import fs from 'node:fs';
import path from 'node:path';

const ROOT =
  process.cwd();

function read(
  relativePath: string
): string {
  return fs.readFileSync(
    path.join(
      ROOT,
      relativePath
    ),
    'utf8'
  );
}

function exists(
  relativePath: string
): boolean {
  return fs.existsSync(
    path.join(
      ROOT,
      relativePath
    )
  );
}


describe(
  'Cambio #1 — Terminal de Asistencia aislada',
  () => {

    test(
      'el QR administrativo existente continúa siendo admin-only',
      () => {

        const source =
          read(
            'src/modules/asistencia/asistencia.routes.ts'
          );

        expect(
          source
        ).toMatch(
          /asistenciaRoutes\.post\(\s*['"]\/qr['"]\s*,\s*authJwt\s*,\s*requireRole\(\s*['"]admin['"]\s*\)\s*,\s*generateQrController\s*\)/s
        );

        expect(
          source
        ).not.toMatch(
          /requireRole\([^)]*terminal_asistencia[^)]*\)[\s\S]{0,200}generateQrController/i
        );

      }
    );


    test(
      'el escaneo móvil conserva únicamente admin y empleado',
      () => {

        const source =
          read(
            'src/modules/asistencia/asistencia.routes.ts'
          );

        expect(
          source
        ).toMatch(
          /asistenciaRoutes\.post\(\s*['"]\/scan['"]\s*,\s*authJwt\s*,\s*requireRole\(\s*['"]admin['"]\s*,\s*['"]empleado['"]\s*\)\s*,\s*requireModule\(\s*['"]asistencia['"]\s*\)\s*,\s*scanController\s*\)/s
        );

        expect(
          source
        ).not.toMatch(
          /['"]terminal_asistencia['"][\s\S]{0,200}scanController/i
        );

      }
    );


    test(
      'existe un módulo backend separado para la terminal',
      () => {

        expect(
          exists(
            'src/modules/terminal/terminal.routes.ts'
          )
        ).toBe(
          true
        );

        expect(
          exists(
            'src/modules/terminal/terminal.controller.ts'
          )
        ).toBe(
          true
        );

        expect(
          exists(
            'src/modules/terminal/terminal.service.ts'
          )
        ).toBe(
          true
        );

      }
    );


    test(
      'la API de terminal se monta fuera de /asistencia y /portal',
      () => {

        const app =
          read(
            'src/app.ts'
          );

        expect(
          app
        ).toMatch(
          /app\.use\(\s*['"]\/terminal['"]\s*,\s*terminalRoutes\s*\)/s
        );

      }
    );


    test(
      'el endpoint QR de terminal usa autenticación exclusiva de terminal',
      () => {

        if (
          !exists(
            'src/modules/terminal/terminal.routes.ts'
          )
        ) {
          throw new Error(
            'Falta src/modules/terminal/terminal.routes.ts'
          );
        }

        const source =
          read(
            'src/modules/terminal/terminal.routes.ts'
          );

        expect(
          source
        ).toMatch(
          /terminalRoutes\.(get|post)\(\s*['"]\/qr['"]\s*,\s*requireTerminalSession\s*,\s*generateTerminalQrController\s*\)/s
        );

        expect(
          source
        ).not.toMatch(
          /\bauthJwt\b/
        );

        expect(
          source
        ).not.toMatch(
          /requireRole\(\s*['"]admin['"]/
        );

        expect(
          source
        ).not.toMatch(
          /requireModule\(\s*['"]asistencia['"]/
        );

      }
    );


    test(
      'existe middleware de sesión aislada con scope attendance:kiosk',
      () => {

        expect(
          exists(
            'src/middlewares/requireTerminalSession.ts'
          )
        ).toBe(
          true
        );

        if (
          !exists(
            'src/middlewares/requireTerminalSession.ts'
          )
        ) {
          throw new Error(
            'Falta requireTerminalSession.ts'
          );
        }

        const source =
          read(
            'src/middlewares/requireTerminalSession.ts'
          );

        expect(
          source
        ).toMatch(
          /attendance:kiosk/
        );

        expect(
          source
        ).toMatch(
          /terminal_asistencia/i
        );

      }
    );


    test(
      'el flujo de autorización de terminal es independiente del adminAccessToken',
      () => {

        expect(
          exists(
            'src/modules/auth/terminalAccess.routes.ts'
          )
        ).toBe(
          true
        );

        if (
          !exists(
            'src/modules/auth/terminalAccess.routes.ts'
          )
        ) {
          throw new Error(
            'Falta terminalAccess.routes.ts'
          );
        }

        const source =
          read(
            'src/modules/auth/terminalAccess.routes.ts'
          );

        expect(
          source
        ).toMatch(
          /['"]\/request['"]/
        );

        expect(
          source
        ).toMatch(
          /['"]\/status['"]/
        );

        expect(
          source
        ).toMatch(
          /['"]\/decision['"]/
        );

        expect(
          source
        ).toMatch(
          /['"]\/session['"]/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccessToken/
        );

        expect(
          source
        ).not.toMatch(
          /requireAdminAccess/
        );

      }
    );


    test(
      'auth monta el flujo terminal bajo /terminal-access',
      () => {

        const source =
          read(
            'src/modules/auth/auth.routes.ts'
          );

        expect(
          source
        ).toMatch(
          /authRoutes\.use\(\s*['"]\/terminal-access['"]\s*,\s*terminalAccessRoutes\s*\)/s
        );

      }
    );

  }
);
