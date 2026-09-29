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

  if (
    !fs.existsSync(
      absolutePath
    )
  ) {
    return '';
  }

  return fs.readFileSync(
    absolutePath,
    'utf8'
  );
}


describe(
  'Cambio #1 — Aprobador y notificación de Terminal Access',
  () => {
    test(
      'env define approverEmail exclusivo de terminal',
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
          /approverEmail\s*:/i
        );

        expect(
          source
        ).toMatch(
          /TERMINAL_ACCESS_APPROVER_EMAIL/
        );
      }
    );


    test(
      '.env.example documenta el aprobador terminal sin correo real',
      () => {
        const source =
          read(
            '.env.example'
          );

        expect(
          source
        ).toMatch(
          /^TERMINAL_ACCESS_APPROVER_EMAIL=$/m
        );
      }
    );


    test(
      'existe módulo de email exclusivo para Terminal Access',
      () => {
        expect(
          fs.existsSync(
            path.join(
              process.cwd(),
              'src/modules/auth/terminalAccess.email.ts'
            )
          )
        ).toBe(
          true
        );
      }
    );


    test(
      'email terminal usa SMTP existente pero no reutiliza adminAccess.email',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.email.ts'
          );

        expect(
          source
        ).toMatch(
          /nodemailer/
        );

        expect(
          source
        ).toMatch(
          /env\.smtp/
        );

        expect(
          source
        ).toMatch(
          /sendTerminalAccessApprovalEmail/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccess\.email/
        );

        expect(
          source
        ).not.toMatch(
          /sendAdminAccessCodeEmail/
        );
      }
    );


    test(
      'servicio usa aprobador configurado por backend y no recibido del cliente',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /env\.terminalAccess\.approverEmail/
        );

        expect(
          source
        ).toMatch(
          /sendTerminalAccessApprovalEmail/
        );

        expect(
          source
        ).not.toMatch(
          /approverEmailInput/
        );

        expect(
          source
        ).not.toMatch(
          /req\.body.*approverEmail/
        );
      }
    );


    test(
      'notificación contiene challenge y terminalId pero nunca sessionProof',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.email.ts'
          );

        expect(
          source
        ).toMatch(
          /challengeId/
        );

        expect(
          source
        ).toMatch(
          /terminalId/
        );

        expect(
          source
        ).not.toMatch(
          /sessionProof/
        );

        expect(
          source
        ).not.toMatch(
          /proofHmac/
        );

        expect(
          source
        ).not.toMatch(
          /session_proof_hmac/
        );
      }
    );


    test(
      'request terminal mantiene el proof únicamente en respuesta a la terminal',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /return\s*\{[\s\S]*?challengeId[\s\S]*?sessionProof[\s\S]*?status/s
        );

        expect(
          source
        ).toMatch(
          /sendTerminalAccessApprovalEmail/
        );
      }
    );


    test(
      'Terminal Access sigue separado de adminAccess',
      () => {
        const service =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        const email =
          read(
            'src/modules/auth/terminalAccess.email.ts'
          );

        expect(
          service
        ).not.toMatch(
          /adminAccess\.service/
        );

        expect(
          service
        ).not.toMatch(
          /adminAccess\.email/
        );

        expect(
          email
        ).not.toMatch(
          /adminAccess/
        );
      }
    );


    test(
      'flujo público sigue cerrado durante el TDD',
      () => {
        const service =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        const accessController =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        const qrController =
          read(
            'src/modules/terminal/terminal.controller.ts'
          );

        expect(
          service
        ).toMatch(
          /TERMINAL_ACCESS_ENABLED\s*=\s*env\.terminalAccess\.enabled/
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
  }
);
