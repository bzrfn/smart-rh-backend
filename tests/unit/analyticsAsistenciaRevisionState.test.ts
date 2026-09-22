import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Cambio #3 - Analytics distingue asistencias pendientes de revision',
  () => {

    const source =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/analytics/analytics.repository.ts'
        ),
        'utf8'
      );


    test(
      'normaliza INVALIDA_PENDIENTE_REVISION antes del pendiente generico',
      () => {

        const revisionRule =
          source.indexOf(
            "if (estado === 'invalida_pendiente_revision') return 'pendiente_revision';"
          );

        const genericPendingRule =
          source.indexOf(
            "if (estado.includes('pend')) return 'pendiente';"
          );


        expect(
          revisionRule
        ).toBeGreaterThanOrEqual(
          0
        );


        expect(
          genericPendingRule
        ).toBeGreaterThanOrEqual(
          0
        );


        expect(
          revisionRule
        ).toBeLessThan(
          genericPendingRule
        );
      }
    );


    test(
      'expone contador propio para asistencias pendientes de revision',
      () => {

        expect(
          source
        ).toContain(
          'const asistenciasPendientesRevision'
        );


        expect(
          source
        ).toContain(
          "normalizeEstado(row.estado) === 'pendiente_revision'"
        );


        expect(
          source
        ).toContain(
          'asistenciasPendientesRevision,'
        );
      }
    );


    test(
      'las pendientes de revision cuentan como incidencia administrativa',
      () => {

        const normalized =
          source.replace(
            /\s+/g,
            ' '
          );


        expect(
          normalized
        ).toContain(
          'const totalIncidencias = asistenciasPendientes + asistenciasPendientesRevision + asistenciasRechazadas;'
        );
      }
    );


    test(
      'grafica por estado incluye categoria pendiente_revision',
      () => {

        const normalized =
          source.replace(
            /\s+/g,
            ' '
          );


        expect(
          normalized
        ).toMatch(
          /asistenciasPorEstado:\s*buildEstadoChart\(\s*asistenciasFiltradas,\s*\[\s*['"]aprobada['"]\s*,\s*['"]pendiente['"]\s*,\s*['"]pendiente_revision['"]\s*,\s*['"]rechazada['"]/
        );
      }
    );


    test(
      'evolucion por fecha conserva un contador separado de revision',
      () => {

        expect(
          source
        ).toContain(
          'pendientes_revision: number;'
        );


        expect(
          source
        ).toContain(
          'pendientes_revision: 0,'
        );


        expect(
          source
        ).toContain(
          "if (estado === 'pendiente_revision') current.pendientes_revision += 1;"
        );
      }
    );
  }
);
