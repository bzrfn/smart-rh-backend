import fs from 'node:fs';
import path from 'node:path';

import * as terminalCryptoModule
  from '../../src/modules/auth/terminalAccess.crypto.js';


type AnyFunction =
  (...args: any[]) => any;


function read(
  relativePath: string
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
  name: string
): unknown {
  return (
    terminalCryptoModule as
      Record<string, unknown>
  )[name];
}


describe(
  'Cambio #1 — Crypto hardening de terminal access',
  () => {
    test(
      'expone hash de IP exclusivo para terminal',
      () => {
        expect(
          typeof getExport(
            'createTerminalAccessIpHash'
          )
        ).toBe(
          'function'
        );
      }
    );


    test(
      'env define HMAC exclusivo para terminalAccess',
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
          /TERMINAL_ACCESS_HMAC_SECRET/
        );
      }
    );


    test(
      '.env.example documenta HMAC terminal sin secreto real',
      () => {
        const source =
          read(
            '.env.example'
          );

        expect(
          source
        ).toMatch(
          /^TERMINAL_ACCESS_HMAC_SECRET=/m
        );

        expect(
          source
        ).not.toMatch(
          /SMART_RH_TEST_ONLY_TERMINAL_ACCESS_HMAC/
        );
      }
    );


    test(
      'crypto terminal no reutiliza secretos adminAccess',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.crypto.ts'
          );

        expect(
          source
        ).not.toMatch(
          /ADMIN_ACCESS_HMAC_SECRET/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccess\.hmacSecret/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccess\.crypto/
        );

        expect(
          source
        ).not.toMatch(
          /createAdminAccessIpHash/
        );
      }
    );


    test(
      'hash de IP es determinista, hexadecimal y no conserva IP cruda',
      () => {
        const createIpHash =
          getExport(
            'createTerminalAccessIpHash'
          ) as
            AnyFunction | undefined;

        expect(
          typeof createIpHash
        ).toBe(
          'function'
        );

        if (
          typeof createIpHash !==
          'function'
        ) {
          return;
        }

        const first =
          createIpHash(
            '203.0.113.10'
          );

        const second =
          createIpHash(
            '203.0.113.10'
          );

        expect(
          first
        ).toBe(
          second
        );

        expect(
          first
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          first
        ).not.toContain(
          '203.0.113.10'
        );
      }
    );


    test(
      'IP vacía conserva semántica null y no inventa identidad',
      () => {
        const createIpHash =
          getExport(
            'createTerminalAccessIpHash'
          ) as
            AnyFunction | undefined;

        expect(
          typeof createIpHash
        ).toBe(
          'function'
        );

        if (
          typeof createIpHash !==
          'function'
        ) {
          return;
        }

        expect(
          createIpHash(
            ''
          )
        ).toBeNull();

        expect(
          createIpHash(
            undefined
          )
        ).toBeNull();
      }
    );


    test(
      'JWT terminal y HMAC terminal siguen siendo configuraciones distintas',
      () => {
        const source =
          read(
            'src/config/env.ts'
          );

        expect(
          source
        ).toMatch(
          /TERMINAL_ACCESS_JWT_SECRET/
        );

        expect(
          source
        ).toMatch(
          /TERMINAL_ACCESS_HMAC_SECRET/
        );

        expect(
          source.match(
            /TERMINAL_ACCESS_JWT_SECRET/g
          )?.length
        ).toBeGreaterThanOrEqual(
          1
        );

        expect(
          source.match(
            /TERMINAL_ACCESS_HMAC_SECRET/g
          )?.length
        ).toBeGreaterThanOrEqual(
          1
        );
      }
    );
  }
);
