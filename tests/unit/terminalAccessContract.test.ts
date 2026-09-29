import fs from 'node:fs';
import path from 'node:path';

const root =
  process.cwd();

function absolute(
  relativePath: string
) {
  return path.join(
    root,
    relativePath
  );
}

function exists(
  relativePath: string
) {
  return fs.existsSync(
    absolute(relativePath)
  );
}

function read(
  relativePath: string
) {
  const file =
    absolute(relativePath);

  if (!fs.existsSync(file)) {
    return '';
  }

  return fs.readFileSync(
    file,
    'utf8'
  );
}

function stripComments(
  source: string
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    )
    .replace(
      /^[ \t]*\/\/.*$/gm,
      ''
    );
}

describe(
  'Cambio #1 — Contrato de autorización de terminal',
  () => {
    test(
      'conserva las cuatro transiciones del flujo terminal',
      () => {
        const routes =
          read(
            'src/modules/auth/terminalAccess.routes.ts'
          );

        expect(routes).toMatch(
          /['"]\/request['"]/
        );

        expect(routes).toMatch(
          /['"]\/status['"]/
        );

        expect(routes).toMatch(
          /['"]\/decision['"]/
        );

        expect(routes).toMatch(
          /['"]\/session['"]/
        );
      }
    );

    test(
      'el scaffold continúa cerrado hasta implementar la autorización real',
      () => {
        const controller =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(controller).toMatch(
          /status\s*\(\s*503\s*\)/
        );

        expect(controller).toMatch(
          /todavía no está habilitada/
        );
      }
    );

    test(
      'la decisión administrativa debe quedar protegida únicamente para admin',
      () => {
        const routes =
          stripComments(
            read(
              'src/modules/auth/terminalAccess.routes.ts'
            )
          );

        const decisionBlock =
          routes.match(
            /terminalAccessRoutes\.post\(\s*['"]\/decision['"][\s\S]*?terminalAccessDecisionController\s*\)/
          )?.[0] || '';

        expect(
          decisionBlock
        ).toContain(
          'authJwt'
        );

        expect(
          decisionBlock
        ).toMatch(
          /requireRole\(\s*['"]admin['"]\s*\)/
        );

        expect(
          decisionBlock
        ).not.toContain(
          'requireAdminAccess'
        );
      }
    );

    test(
      'debe existir un servicio independiente para el ciclo de autorización terminal',
      () => {
        const servicePath =
          'src/modules/auth/terminalAccess.service.ts';

        expect(
          exists(servicePath)
        ).toBe(true);

        const service =
          stripComments(
            read(servicePath)
          );

        expect(service).not.toMatch(
          /\badminAccessToken\b/
        );

        expect(service).not.toMatch(
          /\brequireAdminAccess\b/
        );
      }
    );

    test(
      'debe existir un token propio de terminal con role y scope limitados',
      () => {
        const tokenPath =
          'src/modules/auth/terminalAccess.token.ts';

        expect(
          exists(tokenPath)
        ).toBe(true);

        const token =
          stripComments(
            read(tokenPath)
          );

        expect(token).toContain(
          'terminal_asistencia'
        );

        expect(token).toContain(
          'attendance:kiosk'
        );

        expect(token).not.toMatch(
          /\badminAccessToken\b/
        );
      }
    );

    test(
      'debe existir criptografía propia para el challenge de terminal',
      () => {
        const cryptoPath =
          'src/modules/auth/terminalAccess.crypto.ts';

        expect(
          exists(cryptoPath)
        ).toBe(true);

        const crypto =
          stripComments(
            read(cryptoPath)
          );

        expect(crypto).toMatch(
          /randomBytes|randomInt/
        );

        expect(crypto).toMatch(
          /timingSafeEqual/
        );
      }
    );

    test(
      'el flujo terminal no depende del mecanismo adminAccess',
      () => {
        const sources = [
          'src/modules/auth/terminalAccess.routes.ts',
          'src/modules/auth/terminalAccess.controller.ts',
          'src/modules/auth/terminalAccess.service.ts',
          'src/modules/auth/terminalAccess.token.ts',
          'src/modules/auth/terminalAccess.crypto.ts',
        ]
          .map(read)
          .map(stripComments)
          .join('\n');

        expect(sources).not.toMatch(
          /\brequireAdminAccess\b/
        );

        expect(sources).not.toMatch(
          /\badminAccessToken\b/
        );

        expect(sources).not.toMatch(
          /adminAccess\.token/
        );

        expect(sources).not.toMatch(
          /adminAccess\.service/
        );
      }
    );
  }
);
