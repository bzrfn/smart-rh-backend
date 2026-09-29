import fs from 'fs';
import path from 'path';

const migrationPath =
  path.resolve(
    process.cwd(),
    'db/migrations/2026_09_21_asistencia_validacion_automatica.sql'
  );

describe(
  'Cambio #3 - contrato de migracion de asistencia',
  () => {
    test(
      'existe la migracion',
      () => {
        expect(
          fs.existsSync(
            migrationPath
          )
        ).toBe(true);
      }
    );

    test(
      'amplia estado con INVALIDA_PENDIENTE_REVISION',
      () => {
        const sql =
          fs.readFileSync(
            migrationPath,
            'utf8'
          );

        expect(sql).toContain(
          'INVALIDA_PENDIENTE_REVISION'
        );

        expect(sql).toMatch(
          /ALTER\s+TABLE\s+asistencias/i
        );
      }
    );

    test(
      'crea configuracion de asistencia con politica inicial de 2 minutos',
      () => {
        const sql =
          fs.readFileSync(
            migrationPath,
            'utf8'
          );

        expect(sql).toMatch(
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+asistencia_configuracion/i
        );

        expect(sql).toContain(
          'duracion_minima_minutos'
        );

        expect(sql).toContain(
          'activa'
        );

        expect(sql).toMatch(
          /duracion_minima_minutos[\s\S]*2/i
        );
      }
    );

    test(
      'preserva la politica aplicada y la duracion calculada en la asistencia',
      () => {
        const sql =
          fs.readFileSync(
            migrationPath,
            'utf8'
          );

        expect(sql).toContain(
          'duracion_minima_aplicada_minutos'
        );

        expect(sql).toContain(
          'duracion_registrada_segundos'
        );
      }
    );

    test(
      'crea historial SQL de revisiones administrativas',
      () => {
        const sql =
          fs.readFileSync(
            migrationPath,
            'utf8'
          );

        expect(sql).toMatch(
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+asistencia_revisiones/i
        );

        expect(sql).toContain(
          'asistencia_id'
        );

        expect(sql).toContain(
          'admin_usuario_id'
        );

        expect(sql).toContain(
          'accion'
        );

        expect(sql).toContain(
          'motivo'
        );

        expect(sql).toContain(
          'estado_anterior'
        );

        expect(sql).toContain(
          'estado_nuevo'
        );
      }
    );

    test(
      'el historial contempla aprobacion rechazo justificacion y correccion',
      () => {
        const sql =
          fs.readFileSync(
            migrationPath,
            'utf8'
          );

        expect(sql).toContain(
          'APROBAR'
        );

        expect(sql).toContain(
          'RECHAZAR'
        );

        expect(sql).toContain(
          'JUSTIFICAR'
        );

        expect(sql).toContain(
          'CORREGIR'
        );
      }
    );
  }
);
