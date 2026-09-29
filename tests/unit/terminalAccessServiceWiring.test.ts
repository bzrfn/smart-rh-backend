import fs from 'node:fs';
import path from 'node:path';

import * as terminalAccessModule
  from '../../src/modules/auth/terminalAccess.service.js';


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


function getExport(
  name:
    string
): unknown {
  return (
    terminalAccessModule as
      Record<string, unknown>
  )[name];
}


describe(
  'Cambio #1 — Wiring real de terminal access',
  () => {
    test(
      'expone servicio real para request, status, decision y consumo',
      () => {
        expect(
          typeof getExport(
            'requestTerminalAccess'
          )
        ).toBe(
          'function'
        );

        expect(
          typeof getExport(
            'getTerminalAccessStatus'
          )
        ).toBe(
          'function'
        );

        expect(
          typeof getExport(
            'decideTerminalAccess'
          )
        ).toBe(
          'function'
        );

        expect(
          typeof getExport(
            'consumeTerminalAccessForSession'
          )
        ).toBe(
          'function'
        );
      }
    );


    test(
      'service conecta exclusivamente repository terminal',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /terminalAccess\.repository\.js/
        );

        expect(
          source
        ).toMatch(
          /\bcountRecentTerminalAccessRequests\b/
        );

        expect(
          source
        ).toMatch(
          /\bcreateTerminalAccessChallenge\b/
        );

        expect(
          source
        ).toMatch(
          /\bfindTerminalAccessStatus\b/
        );

        expect(
          source
        ).toMatch(
          /\bdecideTerminalAccessChallenge\b/
        );

        expect(
          source
        ).toMatch(
          /\bconsumeApprovedTerminalAccessChallenge\b/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccess\.repository/
        );

        expect(
          source
        ).not.toMatch(
          /admin_access_challenges/
        );
      }
    );


    test(
      'service conecta challenge e IP hash exclusivos de terminal',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /terminalAccess\.crypto\.js/
        );

        expect(
          source
        ).toMatch(
          /\bgenerateTerminalAccessChallengeId\b/
        );

        expect(
          source
        ).toMatch(
          /\bcreateTerminalAccessIpHash\b/
        );

        expect(
          source
        ).not.toMatch(
          /createAdminAccessIpHash/
        );

        expect(
          source
        ).not.toMatch(
          /generateAdminAccessChallengeId/
        );
      }
    );


    test(
      'default service se construye mediante buildTerminalAccessService',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /buildTerminalAccessService\s*\(\s*\{/s
        );

        expect(
          source
        ).toMatch(
          /generateChallengeId\s*:\s*generateTerminalAccessChallengeId/
        );

        expect(
          source
        ).toMatch(
          /createIpHash\s*:\s*createTerminalAccessIpHash/
        );
      }
    );


    test(
      'wiring respeta feature flag de entorno y conserva fallback 503',
      () => {
        const service =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          service
        ).toMatch(
          /TERMINAL_ACCESS_ENABLED\s*=\s*[\s\S]*?env\.terminalAccess\.enabled/
        );

        const controller =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          controller
        ).toMatch(
          /status\s*\(\s*503\s*\)/
        );
      }
    );

    test(
      'wiring no incorpora JWT normal ni adminAccess',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
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
          /requireAdminAccess/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccessToken/
        );
      }
    );
  }
);
