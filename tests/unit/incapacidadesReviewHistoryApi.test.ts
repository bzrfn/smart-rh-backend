// @ts-nocheck

import fs from 'node:fs';


function read(
  path: string
): string {
  return fs.readFileSync(
    path,
    'utf8'
  );
}


describe(
  'Incapacidades - API admin de historial RRHH',
  () => {
    const routes =
      read(
        'src/modules/incapacidades/incapacidades.routes.ts'
      );

    const controller =
      read(
        'src/modules/incapacidades/incapacidades.controller.ts'
      );

    const service =
      read(
        'src/modules/incapacidades/incapacidades.service.ts'
      );

    const repository =
      read(
        'src/modules/incapacidades/incapacidades.repository.ts'
      );


    test(
      'historial tiene endpoint dedicado protegido por requireAdmin',
      () => {
        expect(
          routes
        ).toMatch(
          /incapacidadesRoutes\.get\(\s*'\/:id\/revisiones'\s*,\s*authJwt\s*,\s*requireAdmin\s*,\s*reviewHistory\s*\)/
        );
      }
    );


    test(
      'service aplica defensa adicional de rol admin',
      () => {
        const start =
          service.indexOf(
            'export async function getIncapacidadReviewHistoryAsAdmin('
          );

        const end =
          service.indexOf(
            'export async function reviewIncapacidadAsAdmin(',
            start
          );

        const scope =
          service.slice(
            start,
            end
          );

        expect(
          scope
        ).toContain(
          'if (!isAdmin(actor))'
        );

        expect(
          scope
        ).toContain(
          "'Forbidden'"
        );

        expect(
          scope
        ).toContain(
          '403'
        );
      }
    );


    test(
      'service responde 404 si la incapacidad no existe',
      () => {
        const start =
          service.indexOf(
            'export async function getIncapacidadReviewHistoryAsAdmin('
          );

        const end =
          service.indexOf(
            'export async function reviewIncapacidadAsAdmin(',
            start
          );

        const scope =
          service.slice(
            start,
            end
          );

        expect(
          scope
        ).toContain(
          'findIncapacidadById'
        );

        expect(
          scope
        ).toContain(
          "'Incapacidad no encontrada'"
        );

        expect(
          scope
        ).toContain(
          '404'
        );
      }
    );


    test(
      'repository consulta historial y nombre del administrador',
      () => {
        expect(
          repository
        ).toContain(
          'export async function listIncapacidadReviewHistory('
        );

        expect(
          repository
        ).toContain(
          'FROM incapacidad_revisiones r'
        );

        expect(
          repository
        ).toContain(
          'INNER JOIN usuarios admin'
        );

        expect(
          repository
        ).toContain(
          'AS admin_nombre'
        );

        expect(
          repository
        ).toContain(
          'AS admin_apellido'
        );
      }
    );


    test(
      'repository no selecciona correo del administrador',
      () => {
        const start =
          repository.indexOf(
            'export async function listIncapacidadReviewHistory('
          );

        const end =
          repository.indexOf(
            'export async function reviewIncapacidad(',
            start
          );

        const scope =
          repository.slice(
            start,
            end
          );

        const selectStart =
          scope.indexOf(
            'SELECT'
          );

        const selectEnd =
          scope.indexOf(
            'FROM incapacidad_revisiones r'
          );

        const selectScope =
          scope.slice(
            selectStart,
            selectEnd
          );

        expect(
          selectScope
        ).not.toMatch(
          /\bcorreo\b/i
        );
      }
    );


    test(
      'DTO no expone payload técnico sensible',
      () => {
        const start =
          service.indexOf(
            'export async function getIncapacidadReviewHistoryAsAdmin('
          );

        const end =
          service.indexOf(
            'export async function reviewIncapacidadAsAdmin(',
            start
          );

        const scope =
          service.slice(
            start,
            end
          );

        expect(
          scope
        ).not.toMatch(
          /documento_sha256|campos_extraidos|diferencias_detectadas|base64|raw_ocr/i
        );
      }
    );


    test(
      'DTO contiene snapshot resumido',
      () => {
        const start =
          service.indexOf(
            'export async function getIncapacidadReviewHistoryAsAdmin('
          );

        const end =
          service.indexOf(
            'export async function reviewIncapacidadAsAdmin(',
            start
          );

        const scope =
          service.slice(
            start,
            end
          );

        const fields = [
          'validacion_automatica_snapshot',
          'disponible',
          'estado_analisis',
          'estado_estructura',
          'puntaje_estructura',
          'duplicado_detectado',
          'duplicado_de_incapacidad_id',
        ];

        for (
          const field of fields
        ) {
          expect(
            scope
          ).toContain(
            field
          );
        }
      }
    );


    test(
      'rutas de empleado permanecen independientes del historial',
      () => {
        expect(
          routes
        ).toMatch(
          /incapacidadesRoutes\.get\(\s*'\/mias'\s*,\s*authJwt\s*,\s*mine\s*\)/
        );

        expect(
          routes
        ).toMatch(
          /incapacidadesRoutes\.get\(\s*'\/:id'\s*,\s*authJwt\s*,\s*detail\s*\)/
        );

        expect(
          routes
        ).not.toMatch(
          /incapacidadesRoutes\.get\(\s*'\/mias'\s*,\s*authJwt\s*,\s*requireAdmin/
        );
      }
    );


    test(
      'controller devuelve revisiones como colección separada',
      () => {
        expect(
          controller
        ).toContain(
          'export async function reviewHistory('
        );

        expect(
          controller
        ).toContain(
          'getIncapacidadReviewHistoryAsAdmin('
        );

        expect(
          controller
        ).toContain(
          'revisiones:'
        );
      }
    );
  }
);
