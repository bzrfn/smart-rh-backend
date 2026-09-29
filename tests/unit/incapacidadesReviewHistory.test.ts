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
  'Incapacidades - historial durable de decisiones RRHH',
  () => {
    const repository =
      read(
        'src/modules/incapacidades/incapacidades.repository.ts'
      );

    const migration =
      read(
        'db/migrations/2026_09_29_incapacidad_revisiones.sql'
      );


    function reviewScope() {
      const start =
        repository.indexOf(
          'export async function reviewIncapacidad('
        );

      const end =
        repository.indexOf(
          '// GI-HU02 — COMPROBANTE',
          start
        );

      return repository.slice(
        start,
        end
      );
    }


    test(
      'revision usa transaccion',
      () => {
        const scope =
          reviewScope();

        expect(
          scope
        ).toContain(
          'await pool.getConnection()'
        );

        expect(
          scope
        ).toContain(
          '.beginTransaction()'
        );

        expect(
          scope
        ).toContain(
          '.commit()'
        );

        expect(
          scope
        ).toContain(
          '.rollback()'
        );

        expect(
          scope
        ).toContain(
          'connection.release()'
        );
      }
    );


    test(
      'estado e historial se confirman juntos',
      () => {
        const scope =
          reviewScope();

        const update =
          scope.indexOf(
            'UPDATE incapacidades'
          );

        const history =
          scope.indexOf(
            'INSERT INTO incapacidad_revisiones'
          );

        const commit =
          scope.indexOf(
            '.commit()'
          );

        expect(
          update
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          history
        ).toBeGreaterThan(
          update
        );

        expect(
          commit
        ).toBeGreaterThan(
          history
        );
      }
    );


    test(
      'conserva guard de pendiente',
      () => {
        expect(
          reviewScope()
        ).toContain(
          "AND estado = 'pendiente'"
        );
      }
    );


    test(
      'registra administrador decision observacion y tiempo',
      () => {
        expect(
          migration
        ).toContain(
          'admin_usuario_id INT NOT NULL'
        );

        expect(
          migration
        ).toContain(
          "'APROBAR'"
        );

        expect(
          migration
        ).toContain(
          "'RECHAZAR'"
        );

        expect(
          migration
        ).toContain(
          'observaciones_admin VARCHAR(1000) NULL'
        );

        expect(
          migration
        ).toContain(
          'decidido_at DATETIME NOT NULL'
        );
      }
    );


    test(
      'snapshot conserva contexto automatico',
      () => {
        const required = [
          'analisis_disponible',
          'analisis_id',
          'estado_analisis_snapshot',
          'estado_estructura_snapshot',
          'puntaje_estructura_snapshot',
          'duplicado_detectado_snapshot',
          'duplicado_de_incapacidad_id_snapshot',
          'proveedor_analisis_snapshot',
          'version_analisis_snapshot',
        ];


        for (
          const marker of required
        ) {
          expect(
            migration
          ).toContain(
            marker
          );

          expect(
            repository
          ).toContain(
            marker
          );
        }
      }
    );


    test(
      'permite decision aun sin analisis automatico',
      () => {
        expect(
          repository
        ).toContain(
          'analysisRows[0] ||'
        );

        expect(
          repository
        ).toContain(
          'analysis?.id ??'
        );
      }
    );


    test(
      'FKs preservan la trazabilidad',
      () => {
        expect(
          migration
        ).toContain(
          'fk_incap_revision_incapacidad'
        );

        expect(
          migration
        ).toContain(
          'fk_incap_revision_admin'
        );

        expect(
          migration
        ).toContain(
          'fk_incap_revision_analisis'
        );

        expect(
          (
            migration.match(
              /ON DELETE RESTRICT/g
            ) ||
            []
          ).length
        ).toBeGreaterThanOrEqual(
          2
        );

        expect(
          migration
        ).toContain(
          'ON DELETE SET NULL'
        );
      }
    );


    test(
      'schema no agrega campos de contenido medico',
      () => {
        const sql =
          migration
            .split('\n')
            .filter(
              line =>
                !line
                  .trimStart()
                  .startsWith('--')
            )
            .join('\n');


        expect(
          sql
        ).not.toMatch(
          /^\s*(?:base64|raw_ocr|ocr_crudo|pdf_binario|documento_binario|diagnostico)\b/im
        );
      }
    );


    test(
      'inteligencia no decide aprobar o rechazar',
      () => {
        const intelligence =
          read(
            'src/modules/incapacidades/incapacidades.intelligence.ts'
          );

        expect(
          intelligence
        ).not.toMatch(
          /auto_aprobad|auto_rechazad/i
        );
      }
    );
  }
);
