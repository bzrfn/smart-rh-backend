import fs from 'fs';
import path from 'path';


describe(
  'Cambio #3 - ruta administrativa para justificar asistencia',
  () => {

    test(
      'PATCH /:id/justify usa authJwt, requireRole admin y justifyController',
      () => {

        const routePath =
          path.join(
            process.cwd(),
            'src/modules/asistencia/asistencia.routes.ts'
          );


        const source =
          fs.readFileSync(
            routePath,
            'utf8'
          );


        expect(
          source
        ).toContain(
          'justifyController'
        );


        const normalized =
          source.replace(
            /\s+/g,
            ' '
          );


        expect(
          normalized
        ).toMatch(
          /asistenciaRoutes\.patch\(\s*['"]\/:id\/justify['"]\s*,\s*authJwt\s*,\s*requireRole\(\s*['"]admin['"]\s*\)\s*,\s*justifyController\s*\)/
        );
      }
    );
  }
);


// CAMBIO3_TDD_CORRECT_ROUTE
describe(
  'Cambio #3 - ruta administrativa para corregir asistencia',
  () => {

    test(
      'PATCH /:id/correct usa authJwt, requireRole admin y correctController',
      () => {

        const routePath =
          path.join(
            process.cwd(),
            'src/modules/asistencia/asistencia.routes.ts'
          );


        const source =
          fs.readFileSync(
            routePath,
            'utf8'
          );


        expect(
          source
        ).toContain(
          'correctController'
        );


        const normalized =
          source.replace(
            /\s+/g,
            ' '
          );


        expect(
          normalized
        ).toMatch(
          /asistenciaRoutes\.patch\(\s*['"]\/:id\/correct['"]\s*,\s*authJwt\s*,\s*requireRole\(\s*['"]admin['"]\s*\)\s*,\s*correctController\s*\)/
        );
      }
    );
  }
);


// CAMBIO3_TDD_HISTORY_ROUTE
describe(
  'Cambio #3 - ruta administrativa de historial de revisiones',
  () => {

    test(
      'GET /:id/revisiones usa authJwt, requireRole admin y listRevisionesController',
      () => {

        const routePath =
          path.join(
            process.cwd(),
            'src/modules/asistencia/asistencia.routes.ts'
          );


        const source =
          fs.readFileSync(
            routePath,
            'utf8'
          );


        expect(
          source
        ).toContain(
          'listRevisionesController'
        );


        const normalized =
          source.replace(
            /\s+/g,
            ' '
          );


        expect(
          normalized
        ).toMatch(
          /asistenciaRoutes\.get\(\s*['"]\/:id\/revisiones['"]\s*,\s*authJwt\s*,\s*requireRole\(\s*['"]admin['"]\s*\)\s*,\s*listRevisionesController\s*\)/
        );
      }
    );
  }
);
