import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

import {
  requireRole,
} from '../../src/middlewares/requireRole.js';

describe(
  'Analytics authorization hardening',
  () => {
    test(
      'la ruta resumen-visual exige authJwt y rol admin',
      () => {
        const source =
          readFileSync(
            resolve(
              process.cwd(),
              'src/modules/analytics/analytics.routes.ts'
            ),
            'utf8'
          )
            .replace(
              /\s+/g,
              ' '
            );

        expect(
          source
        ).toContain(
          "requireRole('admin')"
        );

        expect(
          source
        ).toContain(
          "router.get( '/resumen-visual', authJwt, requireRole('admin'), obtenerResumenVisualController );"
        );
      }
    );

    test(
      'requireRole admin permite administrador',
      () => {
        const middleware =
          requireRole(
            'admin'
          );

        const next =
          jest.fn();

        middleware(
          {
            auth: {
              userId: 1,
              role: 'admin',
            },
          } as any,
          {} as any,
          next
        );

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          next
        ).toHaveBeenCalledWith();
      }
    );

    test(
      'requireRole admin rechaza empleado',
      () => {
        const middleware =
          requireRole(
            'admin'
          );

        const next =
          jest.fn();

        middleware(
          {
            auth: {
              userId: 2,
              role: 'empleado',
            },
          } as any,
          {} as any,
          next
        );

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        const error =
          next.mock.calls[0][0];

        expect(
          error
        ).toMatchObject({
          statusCode: 403,
          message: 'Forbidden',
        });
      }
    );

    test(
      'requireRole admin rechaza solicitud sin autenticacion',
      () => {
        const middleware =
          requireRole(
            'admin'
          );

        const next =
          jest.fn();

        middleware(
          {} as any,
          {} as any,
          next
        );

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        const error =
          next.mock.calls[0][0];

        expect(
          error
        ).toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        });
      }
    );
  }
);
