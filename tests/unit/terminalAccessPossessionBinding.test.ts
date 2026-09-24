import fs from 'node:fs';
import path from 'node:path';

import * as terminalCryptoModule
  from '../../src/modules/auth/terminalAccess.crypto.js';


type AnyFunction =
  (...args: any[]) => any;


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


function getCryptoExport(
  name:
    string
): unknown {
  return (
    terminalCryptoModule as
      Record<string, unknown>
  )[name];
}


describe(
  'Cambio #1 — Prueba de posesión de autorización terminal',
  () => {
    test(
      'crypto genera un session proof de alta entropía',
      () => {
        const generateProof =
          getCryptoExport(
            'generateTerminalAccessSessionProof'
          ) as
            AnyFunction | undefined;

        expect(
          typeof generateProof
        ).toBe(
          'function'
        );

        if (
          typeof generateProof !==
          'function'
        ) {
          return;
        }

        const first =
          generateProof();

        const second =
          generateProof();

        expect(
          first
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          second
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          first
        ).not.toBe(
          second
        );
      }
    );


    test(
      'crypto expone HMAC propio para session proof',
      () => {
        expect(
          typeof getCryptoExport(
            'createTerminalAccessSessionProofHmac'
          )
        ).toBe(
          'function'
        );
      }
    );


    test(
      'migration persiste únicamente HMAC del proof',
      () => {
        const source =
          read(
            'db/migrations/2026_09_23_terminal_access_challenges.sql'
          );

        expect(
          source
        ).toMatch(
          /session_proof_hmac\s+CHAR\(64\)\s+NOT NULL/i
        );

        expect(
          source
        ).not.toMatch(
          /\bsession_proof\s+(?!hmac)/i
        );
      }
    );


    test(
      'repository recibe proofHmac al crear challenge',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.repository.ts'
          );

        expect(
          source
        ).toMatch(
          /\bsessionProofHmac\b/
        );

        expect(
          source
        ).toMatch(
          /session_proof_hmac/
        );
      }
    );


    test(
      'consumo de aprobación exige challengeId y proofHmac',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.repository.ts'
          );

        expect(
          source
        ).toMatch(
          /consumeApprovedTerminalAccessChallenge\s*\(\s*(?:input\s*:\s*)?\{/s
        );

        expect(
          source
        ).toMatch(
          /challengeId\s*:\s*string/s
        );

        expect(
          source
        ).toMatch(
          /proofHmac\s*:\s*string/s
        );
      }
    );


    test(
      'service genera proof, persiste solo su HMAC y devuelve proof crudo únicamente a terminal',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /\bgenerateSessionProof\b/
        );

        expect(
          source
        ).toMatch(
          /\bcreateSessionProofHmac\b/
        );

        expect(
          source
        ).toMatch(
          /\bsessionProofHmac\b/
        );

        expect(
          source
        ).toMatch(
          /\bsessionProof\b/
        );
      }
    );


    test(
      'canje de sesión recibe también sessionProof',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        expect(
          source
        ).toMatch(
          /consumeTerminalAccessForSession\s*\([\s\S]*?challengeIdInput[\s\S]*?sessionProofInput/
        );

        expect(
          source
        ).toMatch(
          /createSessionProofHmac\s*\(\s*sessionProof/s
        );
      }
    );


    test(
      'proof privado no se incorpora al JWT terminal',
      () => {
        const source =
          read(
            'src/modules/auth/terminalAccess.token.ts'
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
      }
    );


    test(
      'flujo público sigue cerrado mientras se endurece el canje',
      () => {
        const service =
          read(
            'src/modules/auth/terminalAccess.service.ts'
          );

        const controller =
          read(
            'src/modules/auth/terminalAccess.controller.ts'
          );

        expect(
          service
        ).toMatch(
          /TERMINAL_ACCESS_ENABLED\s*=\s*env\.terminalAccess\.enabled/
        );

        expect(
          controller
        ).toMatch(
          /status\s*\(\s*503\s*\)/
        );
      }
    );
  }
);
