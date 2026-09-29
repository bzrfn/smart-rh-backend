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
  'GI-HU03 — contrato de revisión de incapacidades',
  () => {
    const routes =
      compact(
        readSource(
          'src/modules/incapacidades/incapacidades.routes.ts'
        )
      );

    const service =
      compact(
        readSource(
          'src/modules/incapacidades/incapacidades.service.ts'
        )
      );

    const repository =
      compact(
        readSource(
          'src/modules/incapacidades/incapacidades.repository.ts'
        )
      );


    test(
      'el listado administrativo requiere JWT y rol administrador',
      () => {
        expect(
          routes
        ).toMatch(
          /incapacidadesRoutes\.get\(\s*'\/'\s*,\s*authJwt\s*,\s*requireAdmin\s*,\s*all\s*\)/
        );
      }
    );


    test(
      'aprobar o rechazar requiere JWT y rol administrador',
      () => {
        expect(
          routes
        ).toMatch(
          /incapacidadesRoutes\.patch\(\s*'\/:id\/revision'\s*,\s*authJwt\s*,\s*requireAdmin\s*,\s*review\s*\)/
        );
      }
    );


    test(
      'service bloquea consulta administrativa a roles no admin',
      () => {
        expect(
          service
        ).toMatch(
          /export async function getAllIncapacidades/
        );

        expect(
          service
        ).toMatch(
          /if\s*\(\s*!isAdmin\(actor\)\s*\)\s*\{\s*throw new AppError\(\s*'Forbidden'\s*,\s*403/
        );
      }
    );


    test(
      'service bloquea resolución a roles no admin',
      () => {
        expect(
          service
        ).toMatch(
          /export async function reviewIncapacidadAsAdmin/
        );

        const reviewStart =
          service.indexOf(
            'export async function reviewIncapacidadAsAdmin'
          );

        expect(
          reviewStart
        ).toBeGreaterThanOrEqual(0);

        const reviewSource =
          service.slice(
            reviewStart
          );

        expect(
          reviewSource
        ).toMatch(
          /if\s*\(\s*!isAdmin\(actor\)\s*\)\s*\{\s*throw new AppError\(\s*'Forbidden'\s*,\s*403/
        );
      }
    );


    test(
      'solo una solicitud pendiente puede resolverse',
      () => {
        expect(
          repository
        ).toMatch(
          /UPDATE incapacidades SET estado = \?, observaciones_admin = \?, revisado_por_admin_id = \?, revisado_at = CURRENT_TIMESTAMP WHERE id = \? AND estado = 'pendiente'/
        );
      }
    );


    test(
      'la resolución registra administrador fecha estado y observación',
      () => {
        expect(
          repository
        ).toContain(
          'estado = ?'
        );

        expect(
          repository
        ).toContain(
          'observaciones_admin = ?'
        );

        expect(
          repository
        ).toContain(
          'revisado_por_admin_id = ?'
        );

        expect(
          repository
        ).toContain(
          'revisado_at = CURRENT_TIMESTAMP'
        );
      }
    );


    test(
      'el listado administrativo permite filtrar solicitudes pendientes',
      () => {
        expect(
          repository
        ).toMatch(
          /if \(estado\).*WHERE i\.estado = \?/s
        );

        expect(
          repository
        ).toContain(
          "WHEN i.estado = 'pendiente'"
        );
      }
    );


    test(
      'el empleado conserva acceso únicamente a sus propias incapacidades',
      () => {
        expect(
          routes
        ).toMatch(
          /incapacidadesRoutes\.get\(\s*'\/mias'\s*,\s*authJwt\s*,\s*mine\s*\)/
        );

        expect(
          repository
        ).toMatch(
          /WHERE i\.usuario_id = \?/
        );
      }
    );


    test(
      'detalle impide consultar incapacidad ajena',
      () => {
        expect(
          service
        ).toMatch(
          /Number\(item\.usuario_id\) !== Number\(actor\.userId\)/
        );

        expect(
          service
        ).toMatch(
          /throw new AppError\(\s*'Forbidden'\s*,\s*403/
        );
      }
    );


    test(
      'estado y resolución son visibles al recuperar el registro',
      () => {
        /*
         * findIncapacidadById utiliza i.*,
         * por lo que devuelve estado,
         * observaciones_admin,
         * revisado_por_admin_id y
         * revisado_at después del UPDATE.
         */
        expect(
          repository
        ).toMatch(
          /SELECT i\.\*, u\.nombre AS usuario_nombre/
        );

        expect(
          repository
        ).toContain(
          'admin.nombre AS admin_nombre'
        );

        expect(
          repository
        ).toContain(
          'admin.apellido AS admin_apellido'
        );
      }
    );
  }
);
