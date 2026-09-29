import {
  pool,
} from '../../config/db.js';

export type PoliticaAsistencia = {
  duracionMinimaMinutos: number;
};

type PoliticaAsistenciaRow = {
  duracion_minima_minutos?: unknown;
};

type PoliticaQueryExecutor = {
  query(
    sql: string
  ): Promise<any>;
};

export async function obtenerPoliticaAsistencia(
  executor: PoliticaQueryExecutor = pool
): Promise<PoliticaAsistencia> {
  const [rows] =
    await executor.query(
      `
      SELECT
        duracion_minima_minutos
      FROM asistencia_configuracion
      WHERE activa = 1
      ORDER BY id DESC
      LIMIT 1
      `
    );

  const row =
    (rows as PoliticaAsistenciaRow[])[0];

  if (!row) {
    throw new Error(
      'No existe una politica de asistencia activa'
    );
  }

  const duracionMinimaMinutos =
    Number(
      row.duracion_minima_minutos
    );

  if (
    !Number.isFinite(
      duracionMinimaMinutos
    ) ||
    duracionMinimaMinutos <= 0
  ) {
    throw new Error(
      'La duracion minima configurada es invalida'
    );
  }

  return {
    duracionMinimaMinutos,
  };
}
