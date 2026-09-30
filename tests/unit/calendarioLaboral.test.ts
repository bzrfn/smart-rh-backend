import {
  normalizeCalendarioRange,
  MAX_CALENDARIO_RANGE_DAYS,
} from '../../src/modules/calendario/calendario.service.js';

import fs from 'fs';
import path from 'path';


function readSource(
  relativePath: string
): string {
  return fs.readFileSync(
    path.resolve(
      process.cwd(),
      relativePath
    ),
    'utf8'
  );
}


function compact(
  value: string
): string {
  return value
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}


describe(
  'Calendario laboral',
  () => {
    test(
      'normaliza rangos validos en formato YYYY-MM-DD',
      () => {
        expect(
          normalizeCalendarioRange(
            '2026-09-01',
            '2026-09-30'
          )
        ).toEqual({
          inicio:
            '2026-09-01',
          fin:
            '2026-09-30',
        });
      }
    );


    test(
      'rechaza fechas invalidas y rangos invertidos',
      () => {
        expect(
          () =>
            normalizeCalendarioRange(
              '2026-02-30',
              '2026-03-01'
            )
        ).toThrow(
          'inicio y fin deben tener formato YYYY-MM-DD'
        );

        expect(
          () =>
            normalizeCalendarioRange(
              '2026-10-10',
              '2026-10-01'
            )
        ).toThrow(
          'fin no puede ser menor que inicio'
        );
      }
    );


    test(
      'limita el rango maximo para proteger la consulta movil',
      () => {
        expect(
          MAX_CALENDARIO_RANGE_DAYS
        ).toBe(93);

        expect(
          () =>
            normalizeCalendarioRange(
              '2026-01-01',
              '2026-05-01'
            )
        ).toThrow(
          'El rango máximo permitido'
        );
      }
    );


    test(
      'la ruta laboral requiere JWT y queda montada en /calendario',
      () => {
        const routes =
          compact(
            readSource(
              'src/modules/calendario/calendario.routes.ts'
            )
          );

        const index =
          compact(
            readSource(
              'src/routes/index.ts'
            )
          );

        expect(
          routes
        ).toMatch(
          /calendarioRoutes\.get\(\s*'\/laboral'\s*,\s*authJwt\s*,\s*laboral\s*\)/
        );

        expect(
          index
        ).toMatch(
          /router\.use\(\s*'\/calendario'\s*,\s*calendarioRoutes\s*\)/
        );
      }
    );


    test(
      'el servicio filtra por usuario y respeta permisos modulares del empleado',
      () => {
        const service =
          compact(
            readSource(
              'src/modules/calendario/calendario.service.ts'
            )
          );

        expect(
          service
        ).toMatch(
          /usuarioId:\s*isAdmin\(actor\)\s*\?\s*undefined\s*:\s*actor\.userId/
        );

        expect(
          service
        ).toContain(
          'isModuloEnabledForUser'
        );

        expect(
          service
        ).toMatch(
          /access\.asistencia\s*\?\s*listAsistenciasCalendario/
        );

        expect(
          service
        ).toMatch(
          /access\.vacaciones\s*\?\s*listVacacionesCalendario/
        );
      }
    );
  }
);
