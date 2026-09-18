import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

describe(
  'ETL role mapping',
  () => {
    const source =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/etl/etl.service.ts'
        ),
        'utf8'
      );

    test(
      'elimina IDs fijos de Admin y Empleado',
      () => {
        expect(
          source
        ).not.toContain(
          "WHEN rol_id = 1 THEN 'Admin'"
        );

        expect(
          source
        ).not.toContain(
          "WHEN rol_id = 2 THEN 'Empleado'"
        );
      }
    );

    test(
      'consulta roles en los dos flujos de usuarios',
      () => {
        const joins =
          source.match(
            /LEFT JOIN roles r/g
          ) || [];

        expect(
          joins
        ).toHaveLength(
          2
        );
      }
    );

    test(
      'usa el nombre real del rol',
      () => {
        const roleNames =
          source.match(
            /NULLIF\(TRIM\(r\.nombre\), ''\)/g
          ) || [];

        expect(
          roleNames
        ).toHaveLength(
          2
        );
      }
    );

    test(
      'mantiene fallback Rol mas id',
      () => {
        const fallbacks =
          source.match(
            /CONCAT\('Rol ', u\.rol_id\)/g
          ) || [];

        expect(
          fallbacks
        ).toHaveLength(
          2
        );
      }
    );

    test(
      'mantiene rol_id en la salida',
      () => {
        const roleIds =
          source.match(
            /u\.rol_id/g
          ) || [];

        expect(
          roleIds.length
        ).toBeGreaterThanOrEqual(
          4
        );
      }
    );
  }
);
