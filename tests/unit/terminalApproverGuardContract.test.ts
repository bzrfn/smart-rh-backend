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
  'Cambio #1 — Guard exclusivo del aprobador Terminal Access',
  () => {
    test(
      'existe middleware dedicado requireTerminalApprover',
      () => {
        expect(
          fs.existsSync(
            path.join(
              process.cwd(),
              'src/middlewares/requireTerminalApprover.ts'
            )
          )
        ).toBe(
          true
        );
      }
    );


    test(
      'existe repository dedicado para resolver identidad del aprobador',
      () => {
        expect(
          fs.existsSync(
            path.join(
              process.cwd(),
              'src/modules/auth/terminalAccessApprover.repository.ts'
            )
          )
        ).toBe(
          true
        );
      }
    );


    test(
      'middleware usa exclusivamente req.auth.userId como identidad de entrada',
      () => {
        const source =
          read(
            'src/middlewares/requireTerminalApprover.ts'
          );

        expect(
          source
        ).toMatch(
          /req\.auth\?*\.userId|req\.auth\.userId/
        );

        expect(
          source
        ).not.toMatch(
          /req\.body[\s\S]*?(approverEmail|correo|email)/i
        );

        expect(
          source
        ).not.toMatch(
          /req\.query[\s\S]*?(approverEmail|correo|email)/i
        );

        expect(
          source
        ).not.toMatch(
          /req\.params[\s\S]*?(approverEmail|correo|email)/i
        );
      }
    );


    test(
      'middleware compara contra env.terminalAccess.approverEmail',
      () => {
        const source =
          read(
            'src/middlewares/requireTerminalApprover.ts'
          );

        expect(
          source
        ).toMatch(
          /env\.terminalAccess\.approverEmail/
        );
      }
    );


    test(
      'repository busca por userId y valida admin activo y email verificado',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccessApprover.repository.ts'
          );

        expect(
          source
        ).toMatch(
          /findEligibleTerminalApproverById/
        );

        expect(
          source
        ).toMatch(
          /usuarios/
        );

        expect(
          source
        ).toMatch(
          /roles/
        );

        expect(
          source
        ).toMatch(
          /u\.id\s*=\s*\?/
        );

        expect(
          source
        ).toMatch(
          /u\.activo\s*=\s*1/
        );

        expect(
          source
        ).toMatch(
          /email_verificado/
        );

        expect(
          source
        ).toMatch(
          /['"]admin['"]/
        );

        expect(
          source
        ).toMatch(
          /correo/
        );
      }
    );


    test(
      'guard niega si no existe approver configurado',
      () => {
        const source =
          read(
            'src/middlewares/requireTerminalApprover.ts'
          );

        expect(
          source
        ).toMatch(
          /approverEmail/
        );

        expect(
          source
        ).toMatch(
          /503/
        );
      }
    );


    test(
      'guard niega si userId autenticado no corresponde al correo configurado',
      () => {
        const source =
          read(
            'src/middlewares/requireTerminalApprover.ts'
          );

        expect(
          source
        ).toMatch(
          /findEligibleTerminalApproverById/
        );

        expect(
          source
        ).toMatch(
          /toLowerCase/
        );

        expect(
          source
        ).toMatch(
          /403/
        );
      }
    );


    test(
      'decision exige authJwt + admin + requireTerminalApprover en ese orden',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.routes.ts'
          );

        const decisionMatch =
          source.match(
            /terminalAccessRoutes\.post\(\s*['"]\/decision['"]([\s\S]*?)\);/
          );

        expect(
          decisionMatch
        ).not.toBeNull();

        const block =
          decisionMatch?.[1] ||
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
      'guard terminal no reutiliza adminAccess',
      () => {
        const middleware =
          read(
            'src/middlewares/requireTerminalApprover.ts'
          );

        const repository =
          read(
            'src/modules/auth/terminalAccessApprover.repository.ts'
          );

        expect(
          middleware
        ).not.toMatch(
          /adminAccess/
        );

        expect(
          repository
        ).not.toMatch(
          /adminAccess/
        );

        expect(
          middleware
        ).not.toMatch(
          /requireAdminAccess/
        );
      }
    );


    test(
      'guard no modifica authJwt ni introduce terminal en JWT normal',
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
      'Terminal Access sigue deshabilitado durante este TDD',
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
