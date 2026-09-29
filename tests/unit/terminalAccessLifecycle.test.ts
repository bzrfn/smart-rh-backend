import fs from 'node:fs';
import path from 'node:path';

import * as terminalAccessModule
  from '../../src/modules/auth/terminalAccess.service.js';


type AnyFunction =
  (...args: any[]) => any;


function getBuilder():
  AnyFunction | undefined {
  return (
    terminalAccessModule as
      Record<string, unknown>
  ).buildTerminalAccessService as
    AnyFunction | undefined;
}


function createDeps() {
  return {
    generateChallengeId:
      jest.fn(
        () =>
          'a'.repeat(48)
      ),

    generateSessionProof:
      jest.fn(
        () =>
          'c'.repeat(64)
      ),

    createIpHash:
      jest.fn(
        () =>
          'b'.repeat(64)
      ),

    createSessionProofHmac:
      jest.fn(
        () =>
          'd'.repeat(64)
      ),

    countRecentTerminalAccessRequests:
      jest.fn(
        async () =>
          0
      ),

    createTerminalAccessChallenge:
      jest.fn(
        async () =>
          undefined
      ),

    findTerminalAccessStatus:
      jest.fn(),

    decideTerminalAccessChallenge:
      jest.fn(),

    consumeApprovedTerminalAccessChallenge:
      jest.fn(),
  };
}


describe(
  'Cambio #1 — Ciclo de autorización de terminal QR',
  () => {
    test(
      'expone un builder independiente para el flujo terminal',
      () => {
        expect(
          typeof getBuilder()
        ).toBe(
          'function'
        );
      }
    );


    test(
      'el servicio expone request, status, decision y consumo de aprobación',
      () => {
        const builder =
          getBuilder();

        expect(
          typeof builder
        ).toBe(
          'function'
        );

        if (
          typeof builder !==
          'function'
        ) {
          return;
        }

        const service =
          builder(
            createDeps()
          );

        expect(
          typeof service.requestTerminalAccess
        ).toBe(
          'function'
        );

        expect(
          typeof service.getTerminalAccessStatus
        ).toBe(
          'function'
        );

        expect(
          typeof service.decideTerminalAccess
        ).toBe(
          'function'
        );

        expect(
          typeof service.consumeTerminalAccessForSession
        ).toBe(
          'function'
        );
      }
    );


    test(
      'request crea challenge pendiente ligado a terminalId, IP hasheada y proof HMAC',
      async () => {
        const builder =
          getBuilder();

        expect(
          typeof builder
        ).toBe(
          'function'
        );

        if (
          typeof builder !==
          'function'
        ) {
          return;
        }

        const deps =
          createDeps();

        const service =
          builder(
            deps
          );

        const result =
          await service.requestTerminalAccess(
            'terminal-recepcion-01',
            '203.0.113.10'
          );

        expect(
          deps.generateChallengeId
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          deps.generateSessionProof
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          deps.createIpHash
        ).toHaveBeenCalledWith(
          '203.0.113.10'
        );

        expect(
          deps.createSessionProofHmac
        ).toHaveBeenCalledWith(
          'c'.repeat(64)
        );

        expect(
          deps.createTerminalAccessChallenge
        ).toHaveBeenCalledWith({
          challengeId:
            'a'.repeat(48),

          terminalId:
            'terminal-recepcion-01',

          requestIpHash:
            'b'.repeat(64),

          sessionProofHmac:
            'd'.repeat(64),

          expiresInMinutes:
            5,
        });

        expect(
          result
        ).toEqual({
          challengeId:
            'a'.repeat(48),

          sessionProof:
            'c'.repeat(64),

          status:
            'pending',

          expiresInMinutes:
            5,
        });
      }
    );


    test(
      'status devuelve únicamente estado público de la solicitud',
      async () => {
        const builder =
          getBuilder();

        expect(
          typeof builder
        ).toBe(
          'function'
        );

        if (
          typeof builder !==
          'function'
        ) {
          return;
        }

        const deps =
          createDeps();

        deps.findTerminalAccessStatus
          .mockResolvedValue({
            challengeId:
              'a'.repeat(48),

            terminalId:
              'terminal-recepcion-01',

            status:
              'approved',

            decisionAdminUserId:
              7,

            expiresAt:
              new Date(),

            decidedAt:
              new Date(),

            usedAt:
              null,

            createdAt:
              new Date(),
          });

        const service =
          builder(
            deps
          );

        const result =
          await service.getTerminalAccessStatus(
            'a'.repeat(48)
          );

        expect(
          result
        ).toEqual({
          challengeId:
            'a'.repeat(48),

          status:
            'approved',
        });

        expect(
          result
        ).not.toHaveProperty(
          'terminalId'
        );

        expect(
          result
        ).not.toHaveProperty(
          'decisionAdminUserId'
        );

        expect(
          result
        ).not.toHaveProperty(
          'sessionProof'
        );

        expect(
          result
        ).not.toHaveProperty(
          'sessionProofHmac'
        );
      }
    );


    test(
      'decision administrativa persiste admin y approve/reject',
      async () => {
        const builder =
          getBuilder();

        expect(
          typeof builder
        ).toBe(
          'function'
        );

        if (
          typeof builder !==
          'function'
        ) {
          return;
        }

        const deps =
          createDeps();

        deps.decideTerminalAccessChallenge
          .mockResolvedValue(
            true
          );

        const service =
          builder(
            deps
          );

        const result =
          await service.decideTerminalAccess(
            'a'.repeat(48),
            7,
            'approve'
          );

        expect(
          deps.decideTerminalAccessChallenge
        ).toHaveBeenCalledWith({
          challengeId:
            'a'.repeat(48),

          adminUserId:
            7,

          decision:
            'approve',
        });

        expect(
          result
        ).toEqual({
          challengeId:
            'a'.repeat(48),

          status:
            'approved',
        });
      }
    );


    test(
      'una aprobación solo se consume con challengeId y sessionProof correctos',
      async () => {
        const builder =
          getBuilder();

        expect(
          typeof builder
        ).toBe(
          'function'
        );

        if (
          typeof builder !==
          'function'
        ) {
          return;
        }

        const deps =
          createDeps();

        deps.consumeApprovedTerminalAccessChallenge
          .mockResolvedValue({
            status:
              'ok',

            terminalId:
              'terminal-recepcion-01',
          });

        const service =
          builder(
            deps
          );

        const result =
          await service.consumeTerminalAccessForSession(
            'a'.repeat(48),
            'c'.repeat(64)
          );

        expect(
          deps.createSessionProofHmac
        ).toHaveBeenCalledWith(
          'c'.repeat(64)
        );

        expect(
          deps.consumeApprovedTerminalAccessChallenge
        ).toHaveBeenCalledWith({
          challengeId:
            'a'.repeat(48),

          proofHmac:
            'd'.repeat(64),
        });

        expect(
          result
        ).toEqual({
          terminalId:
            'terminal-recepcion-01',
        });

        expect(
          result
        ).not.toHaveProperty(
          'sessionProof'
        );

        expect(
          result
        ).not.toHaveProperty(
          'proofHmac'
        );
      }
    );


    test(
      'el servicio terminal no depende de adminAccess',
      () => {
        const source =
          fs.readFileSync(
            path.join(
              process.cwd(),
              'src/modules/auth/terminalAccess.service.ts'
            ),
            'utf8'
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

        expect(
          source
        ).not.toMatch(
          /adminAccess\.service/
        );

        expect(
          source
        ).not.toMatch(
          /adminAccess\.repository/
        );
      }
    );
  }
);
