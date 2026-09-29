import {
  createHmac,
} from 'node:crypto';

import {
  env,
} from '../../src/config/env.js';

import {
  signJwt,
  verifyJwt,
} from '../../src/config/jwt.js';

import {
  signAdminAccessToken,
  verifyAdminAccessToken,
} from '../../src/modules/auth/adminAccess.token.js';

import {
  createAdminAccessCodeHmac,
} from '../../src/modules/auth/adminAccess.crypto.js';


describe(
  'Admin access cryptographic key separation',
  () => {
    test(
      'las tres claves son fuertes y diferentes',
      () => {
        expect(
          env.jwt.secret.length
        ).toBeGreaterThanOrEqual(
          32
        );

        expect(
          env.adminAccess.jwtSecret.length
        ).toBeGreaterThanOrEqual(
          32
        );

        expect(
          env.adminAccess.hmacSecret.length
        ).toBeGreaterThanOrEqual(
          32
        );

        const secrets =
          new Set([
            env.jwt.secret,
            env.adminAccess.jwtSecret,
            env.adminAccess.hmacSecret,
          ]);

        expect(
          secrets.size
        ).toBe(
          3
        );
      }
    );


    test(
      'un JWT de sesion no valida como ADMIN_PORTAL_ACCESS',
      () => {
        const token =
          signJwt({
            userId:
              1,

            role:
              'admin',
          });

        expect(
          () =>
            verifyAdminAccessToken(
              token
            )
        ).toThrow(
          'Acceso administrativo inválido o expirado'
        );
      }
    );


    test(
      'un ADMIN_PORTAL_ACCESS no valida como JWT de sesion',
      () => {
        const token =
          signAdminAccessToken({
            sponsorAdminId:
              1,

            sponsorEmail:
              'admin@example.com',
          });

        expect(
          () =>
            verifyJwt(
              token
            )
        ).toThrow();
      }
    );


    test(
      'HMAC administrativo utiliza una tercera clave independiente',
      () => {
        const challengeId =
          'a'.repeat(
            64
          );

        const code =
          '123456';

        const context =
          `SMART_RH_ADMIN_ACCESS_V1:CODE:${challengeId}:${code}`;

        const actual =
          createAdminAccessCodeHmac(
            challengeId,
            code
          );

        const usingSessionSecret =
          createHmac(
            'sha256',
            env.jwt.secret
          )
            .update(
              context,
              'utf8'
            )
            .digest(
              'hex'
            );

        const usingAdminJwtSecret =
          createHmac(
            'sha256',
            env.adminAccess.jwtSecret
          )
            .update(
              context,
              'utf8'
            )
            .digest(
              'hex'
            );

        const usingAdminHmacSecret =
          createHmac(
            'sha256',
            env.adminAccess.hmacSecret
          )
            .update(
              context,
              'utf8'
            )
            .digest(
              'hex'
            );

        expect(
          actual
        ).not.toBe(
          usingSessionSecret
        );

        expect(
          actual
        ).not.toBe(
          usingAdminJwtSecret
        );

        expect(
          actual
        ).toBe(
          usingAdminHmacSecret
        );
      }
    );
  }
);
