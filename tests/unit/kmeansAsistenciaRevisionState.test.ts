import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Cambio #3 - KMeans no entrena con asistencias pendientes de revision',
  () => {

    const repositorySource =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/kmeans/kmeans.repository.ts'
        ),
        'utf8'
      );


    const utilsSource =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/kmeans/kmeans.utils.ts'
        ),
        'utf8'
      );


    test(
      'excluye INVALIDA_PENDIENTE_REVISION antes de incrementar total_asistencias',
      () => {

        const estadoLine =
          repositorySource.indexOf(
            'const estado = normalizeText(row.estado);'
          );

        const revisionGuard =
          repositorySource.indexOf(
            "if (estado === 'invalida_pendiente_revision')"
          );

        const totalIncrement =
          repositorySource.indexOf(
            'current.total_asistencias += 1;'
          );


        expect(
          estadoLine
        ).toBeGreaterThanOrEqual(
          0
        );


        expect(
          revisionGuard
        ).toBeGreaterThan(
          estadoLine
        );


        expect(
          totalIncrement
        ).toBeGreaterThan(
          revisionGuard
        );


        const between =
          repositorySource.slice(
            revisionGuard,
            totalIncrement
          );


        expect(
          between
        ).toContain(
          'continue;'
        );
      }
    );


    test(
      'no agrega una nueva dimension pendiente_revision al vector KMeans',
      () => {

        expect(
          utilsSource
        ).not.toContain(
          "'asistencias_pendientes_revision'"
        );


        const featureBlock =
          utilsSource.match(
            /export const KMEANS_FEATURES\s*=\s*\[([\s\S]*?)\];/
          );


        expect(
          featureBlock
        ).not.toBeNull();


        const features =
          Array.from(
            featureBlock![1]
              .matchAll(
                /['"]([^'"]+)['"]/g
              )
          ).map(
            (match) =>
              match[1]
          );


        expect(
          features
        ).toHaveLength(
          14
        );
      }
    );
  }
);
