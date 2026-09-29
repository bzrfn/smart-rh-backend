import fs from 'node:fs';
import path from 'node:path';


function read(
  relativePath:
    string
): string {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      relativePath
    ),
    'utf8'
  );
}


describe(
  'Cambio #1 — feature flags seguros de Terminal Access',
  () => {
    test(
      '.env.example documenta ambos flags deshabilitados',
      () => {
        const source =
          read(
            '.env.example'
          );

        expect(
          source
        ).toMatch(
          /^TERMINAL_ACCESS_ENABLED=false$/m
        );

        expect(
          source
        ).toMatch(
          /^TERMINAL_ATTENDANCE_ENABLED=false$/m
        );
      }
    );


    test(
      'env.ts expone enabled para autorización terminal',
      () => {
        const source =
          read(
            'src/config/env.ts'
          );

        expect(
          source
        ).toMatch(
          /TERMINAL_ACCESS_ENABLED/
        );

        expect(
          source
        ).toMatch(
          /terminalAccess[\s\S]*enabled/
        );
      }
    );


    test(
      'env.ts expone attendanceEnabled para QR terminal',
      () => {
        const source =
          read(
            'src/config/env.ts'
          );

        expect(
          source
        ).toMatch(
          /TERMINAL_ATTENDANCE_ENABLED/
        );

        expect(
          source
        ).toMatch(
          /terminalAccess[\s\S]*attendanceEnabled/
        );
      }
    );


    test(
      'ambos flags solo se habilitan con valor literal true',
      () => {
        const source =
          read(
            'src/config/env.ts'
          );

        expect(
          source
        ).toMatch(
          /process\.env\.TERMINAL_ACCESS_ENABLED[\s\S]*===\s*['"]true['"]/
        );

        expect(
          source
        ).toMatch(
          /process\.env\.TERMINAL_ATTENDANCE_ENABLED[\s\S]*===\s*['"]true['"]/
        );
      }
    );


    test(
      'Terminal Access service toma el flag desde env',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /env\.terminalAccess\.enabled/
        );

        expect(
          source
        ).not.toMatch(
          /TERMINAL_ACCESS_ENABLED\s*=\s*true/
        );
      }
    );


    test(
      'Terminal QR service toma attendanceEnabled desde env',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.service.ts'
          );

        expect(
          source
        ).toMatch(
          /env\.terminalAccess\.attendanceEnabled/
        );

        expect(
          source
        ).not.toMatch(
          /TERMINAL_ATTENDANCE_ENABLED\s*=\s*true/
        );
      }
    );


    test(
      'controllers conservan fallback 503',
      () => {
        const access =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        const qr =
          read(
            'src/modules/terminal/terminal.controller.ts'
          );

        expect(
          access
        ).toMatch(
          /status\s*\(\s*503\s*\)/
        );

        expect(
          qr
        ).toMatch(
          /status\s*\(\s*503\s*\)/
        );
      }
    );


    test(
      'configuración permanece fail-closed por defecto',
      () => {
        const source =
          read(
            'src/config/env.ts'
          );

        expect(
          source
        ).toMatch(
          /TERMINAL_ACCESS_ENABLED/
        );

        expect(
          source
        ).toMatch(
          /TERMINAL_ATTENDANCE_ENABLED/
        );

        expect(
          source
        ).toMatch(
          /process\.env\.TERMINAL_ACCESS_ENABLED[\s\S]*===\s*['"]true['"]/
        );

        expect(
          source
        ).toMatch(
          /process\.env\.TERMINAL_ATTENDANCE_ENABLED[\s\S]*===\s*['"]true['"]/
        );
      }
    );
  }
);
