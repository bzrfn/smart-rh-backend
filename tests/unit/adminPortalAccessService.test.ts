import {
  buildAdminAccessService,
} from '../../src/modules/auth/adminAccess.service.js';

import {
  verifyAdminAccessToken,
} from '../../src/modules/auth/adminAccess.token.js';


function createDependencies() {
  return {
    findEligibleAdminByEmail:
      jest.fn(),

    findLatestActiveAdminChallenge:
      jest.fn(),

    countRecentAdminChallenges:
      jest.fn(),

    countRecentIpChallenges:
      jest.fn(),

    invalidateActiveAdminChallenges:
      jest.fn(),

    createAdminAccessChallenge:
      jest.fn(),

    consumeAdminAccessChallenge:
      jest.fn(),

    sendAdminAccessCodeEmail:
      jest.fn(),

    registerEvent:
      jest.fn(),
  };
}


const admin = {
  id:
    7,

  nombre:
    'Admin',

  apellido:
    'SMART RH',

  correo:
    'admin@smart-rh.com.mx',
};


describe(
  'Admin portal access service',
  () => {
    test(
      'correo no elegible recibe respuesta neutra',
      async () => {
        const deps =
          createDependencies();

        deps
          .findEligibleAdminByEmail
          .mockResolvedValue(
            null
          );

        const service =
          buildAdminAccessService(
            deps as any
          );

        const result =
          await service.requestAdminAccess(
            'desconocido@example.com',
            '127.0.0.1'
          );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          result.challengeId
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          result.message
        ).not.toContain(
          'desconocido@example.com'
        );

        expect(
          deps.createAdminAccessChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.sendAdminAccessCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'correo mal formado mantiene respuesta neutra',
      async () => {
        const deps =
          createDependencies();

        const service =
          buildAdminAccessService(
            deps as any
          );

        const result =
          await service.requestAdminAccess(
            'no-es-correo',
            '127.0.0.1'
          );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          result.challengeId
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          deps.findEligibleAdminByEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'administrador elegible crea challenge y envia codigo',
      async () => {
        const deps =
          createDependencies();

        deps
          .findEligibleAdminByEmail
          .mockResolvedValue(
            admin
          );

        deps
          .findLatestActiveAdminChallenge
          .mockResolvedValue(
            null
          );

        deps
          .countRecentAdminChallenges
          .mockResolvedValue(
            0
          );

        deps
          .countRecentIpChallenges
          .mockResolvedValue(
            0
          );

        deps
          .invalidateActiveAdminChallenges
          .mockResolvedValue(
            undefined
          );

        deps
          .createAdminAccessChallenge
          .mockResolvedValue(
            undefined
          );

        deps
          .sendAdminAccessCodeEmail
          .mockResolvedValue(
            undefined
          );

        deps
          .registerEvent
          .mockResolvedValue(
            undefined
          );

        const service =
          buildAdminAccessService(
            deps as any
          );

        const result =
          await service.requestAdminAccess(
            'ADMIN@SMART-RH.COM.MX',
            '10.10.10.10'
          );

        expect(
          deps.findEligibleAdminByEmail
        ).toHaveBeenCalledWith(
          'admin@smart-rh.com.mx'
        );

        expect(
          deps.createAdminAccessChallenge
        ).toHaveBeenCalledTimes(
          1
        );

        const persisted =
          deps
            .createAdminAccessChallenge
            .mock
            .calls[0][0];

        expect(
          persisted.challengeId
        ).toBe(
          result.challengeId
        );

        expect(
          persisted.codeHmac
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        const email =
          deps
            .sendAdminAccessCodeEmail
            .mock
            .calls[0][0];

        expect(
          email.codigo
        ).toMatch(
          /^\d{6}$/
        );

        expect(
          persisted.codeHmac
        ).not.toBe(
          email.codigo
        );

        expect(
          persisted.requestIpHash
        ).toMatch(
          /^[a-f0-9]{64}$/
        );

        expect(
          persisted.requestIpHash
        ).not.toContain(
          '10.10.10.10'
        );
      }
    );


    test(
      'cooldown reutiliza challenge activo sin enviar otro correo',
      async () => {
        const deps =
          createDependencies();

        deps
          .findEligibleAdminByEmail
          .mockResolvedValue(
            admin
          );

        deps
          .findLatestActiveAdminChallenge
          .mockResolvedValue({
            challengeId:
              'a'.repeat(
                64
              ),

            secondsElapsed:
              20,
          });

        const service =
          buildAdminAccessService(
            deps as any
          );

        const result =
          await service.requestAdminAccess(
            admin.correo,
            '127.0.0.1'
          );

        expect(
          result.challengeId
        ).toBe(
          'a'.repeat(
            64
          )
        );

        expect(
          deps.createAdminAccessChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.sendAdminAccessCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'limite por administrador evita nuevos envios',
      async () => {
        const deps =
          createDependencies();

        deps
          .findEligibleAdminByEmail
          .mockResolvedValue(
            admin
          );

        deps
          .findLatestActiveAdminChallenge
          .mockResolvedValue(
            null
          );

        deps
          .countRecentAdminChallenges
          .mockResolvedValue(
            3
          );

        deps
          .countRecentIpChallenges
          .mockResolvedValue(
            0
          );

        const service =
          buildAdminAccessService(
            deps as any
          );

        const result =
          await service.requestAdminAccess(
            admin.correo,
            '127.0.0.1'
          );

        expect(
          result.accepted
        ).toBe(
          true
        );

        expect(
          deps.createAdminAccessChallenge
        ).not.toHaveBeenCalled();

        expect(
          deps.sendAdminAccessCodeEmail
        ).not.toHaveBeenCalled();
      }
    );


    test(
      'verificacion correcta emite token administrativo temporal',
      async () => {
        const deps =
          createDependencies();

        deps
          .consumeAdminAccessChallenge
          .mockResolvedValue({
            status:
              'ok',

            admin,
          });

        deps
          .registerEvent
          .mockResolvedValue(
            undefined
          );

        const service =
          buildAdminAccessService(
            deps as any
          );

        const result =
          await service.verifyAdminAccess(
            'b'.repeat(
              64
            ),
            '123456'
          );

        expect(
          result.authorized
        ).toBe(
          true
        );

        expect(
          result.tokenType
        ).toBe(
          'Bearer'
        );

        const decoded =
          verifyAdminAccessToken(
            result.adminAccessToken
          );

        expect(
          decoded.sponsorAdminId
        ).toBe(
          7
        );

        expect(
          decoded.sponsorEmail
        ).toBe(
          admin.correo
        );
      }
    );


    test(
      'challenge invalido no emite token',
      async () => {
        const deps =
          createDependencies();

        deps
          .consumeAdminAccessChallenge
          .mockResolvedValue({
            status:
              'invalid',
          });

        const service =
          buildAdminAccessService(
            deps as any
          );

        await expect(
          service.verifyAdminAccess(
            'c'.repeat(
              64
            ),
            '654321'
          )
        ).rejects.toMatchObject({
          statusCode:
            400,

          message:
            'Código o autorización inválidos o expirados',
        });
      }
    );


    test(
      'formato invalido se rechaza antes de consultar repository',
      async () => {
        const deps =
          createDependencies();

        const service =
          buildAdminAccessService(
            deps as any
          );

        await expect(
          service.verifyAdminAccess(
            'challenge-malo',
            '12'
          )
        ).rejects.toMatchObject({
          statusCode:
            400,
        });

        expect(
          deps.consumeAdminAccessChallenge
        ).not.toHaveBeenCalled();
      }
    );
  }
);
