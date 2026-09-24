import fs from 'node:fs';
import path from 'node:path';


function read(
  relativePath:
    string
): string {
  const absolutePath =
    path.join(
      process.cwd(),
      relativePath
    );

  return fs.readFileSync(
    absolutePath,
    'utf8'
  );
}


describe(
  'Cambio #1 — reutilización segura del QR en Terminal',
  () => {
    test(
      'asistencia conserva generateDynamicQr como fuente reutilizable',
      () => {
        const source =
          read(
            'src/modules/asistencia/asistencia.service.ts'
          );

        expect(
          source
        ).toMatch(
          /export async function generateDynamicQr/
        );
      }
    );


    test(
      'terminal.service importa generateDynamicQr desde asistencia.service',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.service.ts'
          );

        expect(
          source
        ).toMatch(
          /generateDynamicQr/
        );

        expect(
          source
        ).toMatch(
          /asistencia\.service\.js/
        );
      }
    );


    test(
      'terminal.service expone generateTerminalQr',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.service.ts'
          );

        expect(
          source
        ).toMatch(
          /export async function generateTerminalQr/
        );
      }
    );


    test(
      'generateTerminalQr delega en generateDynamicQr',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.service.ts'
          );

        expect(
          source
        ).toMatch(
          /generateTerminalQr[\s\S]*generateDynamicQr/
        );
      }
    );


    test(
      'terminal no duplica implementación QR',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.service.ts'
          );

        expect(
          source
        ).not.toMatch(
          /QRCode\.toDataURL/
        );

        expect(
          source
        ).not.toMatch(
          /randomBytes/
        );

        expect(
          source
        ).not.toMatch(
          /QrLogModel\.create/
        );

        expect(
          source
        ).not.toMatch(
          /insertQrLog/
        );
      }
    );


    test(
      'terminal QR no reutiliza controller administrativo',
      () => {
        const service =
          read(
            'src/modules/terminal/terminal.service.ts'
          );

        const controller =
          read(
            'src/modules/terminal/terminal.controller.ts'
          );

        expect(
          service
        ).not.toMatch(
          /generateQrController/
        );

        expect(
          controller
        ).not.toMatch(
          /generateQrController/
        );

        expect(
          service
        ).not.toMatch(
          /asistencia\.controller/
        );

        expect(
          controller
        ).not.toMatch(
          /asistencia\.controller/
        );
      }
    );


    test(
      '/terminal/qr conserva requireTerminalSession y no authJwt',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.routes.ts'
          );

        const match =
          source.match(
            /terminalRoutes\.(get|post)\(\s*['"]\/qr['"]([\s\S]*?)\);/
          );

        expect(
          match
        ).not.toBeNull();

        const block =
          match?.[2] ||
          '';

        expect(
          block
        ).toMatch(
          /requireTerminalSession/
        );

        expect(
          block
        ).not.toMatch(
          /authJwt/
        );

        expect(
          block
        ).not.toMatch(
          /requireRole/
        );

        expect(
          block
        ).not.toMatch(
          /requireModule/
        );
      }
    );


    test(
      '/asistencia/qr permanece admin-only',
      () => {
        const source =
          read(
            'src/modules/asistencia/asistencia.routes.ts'
          );

        const match =
          source.match(
            /asistenciaRoutes\.post\(\s*['"]\/qr['"]([\s\S]*?)\);/
          );

        expect(
          match
        ).not.toBeNull();

        const block =
          match?.[1] ||
          '';

        expect(
          block
        ).toMatch(
          /authJwt/
        );

        expect(
          block
        ).toMatch(
          /requireRole\(['"]admin['"]\)/
        );

        expect(
          block
        ).toMatch(
          /generateQrController/
        );
      }
    );


    test(
      'asistencia scan no acepta identidad terminal',
      () => {
        const source =
          read(
            'src/modules/asistencia/asistencia.routes.ts'
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
          /requireTerminalSession/
        );
      }
    );


    test(
      'controller terminal continúa cerrado durante este TDD',
      () => {
        const controller =
          read(
            'src/modules/terminal/terminal.controller.ts'
          );

        expect(
          controller
        ).toMatch(
          /status\s*\(\s*503\s*\)/
        );
      }
    );


    test(
      'Terminal Access continúa deshabilitado durante este TDD',
      () => {
        const service =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          service
        ).toMatch(
          /TERMINAL_ACCESS_ENABLED\s*=\s*env\.terminalAccess\.enabled/
        );
      }
    );
  }
);
