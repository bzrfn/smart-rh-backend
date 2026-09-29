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
  'Cambio #1 — controllers funcionales de Terminal Access',
  () => {
    test(
      'request usa terminalId del body e IP del request',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /requestTerminalAccess/
        );

        expect(
          source
        ).toMatch(
          /req\.body\?*\.terminalId|req\.body\.terminalId/
        );

        expect(
          source
        ).toMatch(
          /req\.ip/
        );
      }
    );


    test(
      'request responde 202 con resultado del service',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /requestTerminalAccessController[\s\S]*status\(\s*202\s*\)[\s\S]*json/
        );
      }
    );


    test(
      'status toma challengeId desde query y responde 200',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /getTerminalAccessStatus/
        );

        expect(
          source
        ).toMatch(
          /req\.query\?*\.challengeId|req\.query\.challengeId/
        );

        expect(
          source
        ).toMatch(
          /terminalAccessStatusController[\s\S]*status\(\s*200\s*\)[\s\S]*json/
        );
      }
    );


    test(
      'decision usa exclusivamente admin autenticado desde req.auth.userId',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /decideTerminalAccess/
        );

        expect(
          source
        ).toMatch(
          /req\.auth\?*\.userId|req\.auth\.userId/
        );

        expect(
          source
        ).toMatch(
          /req\.body\?*\.challengeId|req\.body\.challengeId/
        );

        expect(
          source
        ).toMatch(
          /req\.body\?*\.decision|req\.body\.decision/
        );

        expect(
          source
        ).not.toMatch(
          /req\.body[\s\S]*adminUserId/
        );
      }
    );


    test(
      'decision responde 200 y preserva guards de ruta',
      () => {
        const controller =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        const routes =
          read(
            'src/modules/auth/terminalAccess.routes.ts'
          );

        expect(
          controller
        ).toMatch(
          /terminalAccessDecisionController[\s\S]*status\(\s*200\s*\)[\s\S]*json/
        );

        const match =
          routes.match(
            /terminalAccessRoutes\.post\(\s*['"]\/decision['"]([\s\S]*?)\);/
          );

        expect(
          match
        ).not.toBeNull();

        const block =
          match?.[1] ||
          '';

        const authIndex =
          block.indexOf(
            'authJwt'
          );

        const roleIndex =
          block.indexOf(
            "requireRole('admin')"
          );

        const approverIndex =
          block.indexOf(
            'requireTerminalApprover'
          );

        expect(
          authIndex
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          roleIndex
        ).toBeGreaterThan(
          authIndex
        );

        expect(
          approverIndex
        ).toBeGreaterThan(
          roleIndex
        );
      }
    );


    test(
      'session consume challengeId + sessionProof y firma token exclusivo',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /consumeTerminalAccessForSession/
        );

        expect(
          source
        ).toMatch(
          /signTerminalAccessToken/
        );

        expect(
          source
        ).toMatch(
          /req\.body\?*\.challengeId|req\.body\.challengeId/
        );

        expect(
          source
        ).toMatch(
          /req\.body\?*\.sessionProof|req\.body\.sessionProof/
        );

        expect(
          source
        ).toMatch(
          /terminalId/
        );
      }
    );


    test(
      'session responde 200 con tokenType Bearer sin devolver proof',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /createTerminalSessionController[\s\S]*status\(\s*200\s*\)[\s\S]*tokenType[\s\S]*Bearer/
        );

        const sessionStart =
          source.indexOf(
            'export async function createTerminalSessionController'
          );

        expect(
          sessionStart
        ).toBeGreaterThanOrEqual(
          0
        );

        const sessionBlock =
          source.slice(
            sessionStart
          );

        expect(
          sessionBlock
        ).not.toMatch(
          /json\([\s\S]*sessionProof/
        );

        expect(
          sessionBlock
        ).not.toMatch(
          /json\([\s\S]*proofHmac/
        );
      }
    );


    test(
      'controllers propagan errores con next',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /NextFunction/
        );

        expect(
          source
        ).toMatch(
          /catch\s*\(\s*error\s*\)[\s\S]*next\(\s*error\s*\)/
        );
      }
    );


    test(
      'controller QR terminal llama generateTerminalQr y responde 200',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /generateTerminalQr/
        );

        expect(
          source
        ).toMatch(
          /generateTerminalQrController[\s\S]*await\s+generateTerminalQr/
        );

        expect(
          source
        ).toMatch(
          /generateTerminalQrController[\s\S]*status\(\s*200\s*\)[\s\S]*json/
        );
      }
    );


    test(
      'controller QR terminal propaga errores con next',
      () => {
        const source =
          read(
            'src/modules/terminal/terminal.controller.ts'
          );

        expect(
          source
        ).toMatch(
          /NextFunction/
        );

        expect(
          source
        ).toMatch(
          /catch\s*\(\s*error\s*\)[\s\S]*next\(\s*error\s*\)/
        );
      }
    );


    test(
      '/terminal/qr sigue protegido exclusivamente por requireTerminalSession',
      () => {
        const routes =
          read(
            'src/modules/terminal/terminal.routes.ts'
          );

        const match =
          routes.match(
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
      'controllers todavía permanecen 503 durante este TDD',
      () => {
        const accessController =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        const qrController =
          read(
            'src/modules/terminal/terminal.controller.ts'
          );

        expect(
          accessController
        ).toMatch(
          /status\s*\(\s*503\s*\)/
        );

        expect(
          qrController
        ).toMatch(
          /status\s*\(\s*503\s*\)/
        );
      }
    );


    test(
      'flags continúan false durante este TDD',
      () => {
        const access =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        const qr =
          read(
            'src/modules/terminal/terminal.service.ts'
          );

        expect(
          access
        ).toMatch(
          /TERMINAL_ACCESS_ENABLED\s*=\s*env\.terminalAccess\.enabled/
        );

        expect(
          qr
        ).toMatch(
          /TERMINAL_ATTENDANCE_ENABLED\s*=\s*env\.terminalAccess\.attendanceEnabled/
        );
      }
    );
  }
);
