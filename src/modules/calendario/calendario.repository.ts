import type {
  RowDataPacket,
} from 'mysql2';

import {
  pool,
} from '../../config/db.js';


type CalendarioScope = {
  usuarioId?: number;
  inicio: string;
  fin: string;
};


export type CalendarioAsistenciaRow =
  RowDataPacket & {
    id: number;
    usuario_id: number;
    nombre: string | null;
    apellido: string | null;
    correo: string | null;
    fecha: string | Date;
    hora_entrada: string | null;
    hora_salida: string | null;
    estado: string | null;
    duracion_minima_aplicada_minutos: number | null;
    duracion_registrada_segundos: number | null;
  };


export type CalendarioVacacionRow =
  RowDataPacket & {
    id: number;
    usuario_id: number;
    nombre: string | null;
    apellido: string | null;
    correo: string | null;
    dias_solicitados: number;
    fecha_inicio: string | Date;
    fecha_fin: string | Date;
    estado: string | null;
  };


export type CalendarioIncapacidadRow =
  RowDataPacket & {
    id: number;
    usuario_id: number;
    nombre: string | null;
    apellido: string | null;
    correo: string | null;
    fecha_inicio: string | Date;
    fecha_fin: string | Date;
    dias_calculados: number;
    motivo: string | null;
    estado: string | null;
  };


function withUserFilter(
  sql: string,
  scope: CalendarioScope
) {
  if (!scope.usuarioId) {
    return {
      sql,
      params: [
        scope.fin,
        scope.inicio,
      ],
    };
  }

  return {
    sql: `${sql}
      AND base.usuario_id = ?`,
    params: [
      scope.fin,
      scope.inicio,
      scope.usuarioId,
    ],
  };
}


export async function listAsistenciasCalendario(
  scope: CalendarioScope
): Promise<CalendarioAsistenciaRow[]> {
  const params:
    Array<string | number> = [
      scope.inicio,
      scope.fin,
    ];

  let userSql = '';

  if (scope.usuarioId) {
    userSql =
      'AND a.usuario_id = ?';
    params.push(
      scope.usuarioId
    );
  }

  const [
    rows,
  ] =
    await pool.execute<
      CalendarioAsistenciaRow[]
    >(
      `
      SELECT
        a.id,
        a.usuario_id,
        u.nombre,
        u.apellido,
        u.correo,
        a.fecha,
        a.hora_entrada,
        a.hora_salida,
        a.estado,
        a.duracion_minima_aplicada_minutos,
        a.duracion_registrada_segundos
      FROM asistencias a
      INNER JOIN usuarios u
        ON u.id = a.usuario_id
      WHERE a.fecha BETWEEN ? AND ?
        ${userSql}
      ORDER BY
        a.fecha ASC,
        a.id ASC
      `,
      params
    );

  return rows;
}


export async function listVacacionesCalendario(
  scope: CalendarioScope
): Promise<CalendarioVacacionRow[]> {
  const query =
    withUserFilter(
      `
      SELECT
        base.id,
        base.usuario_id,
        u.nombre,
        u.apellido,
        u.correo,
        base.dias_solicitados,
        base.fecha_inicio,
        base.fecha_fin,
        base.estado
      FROM vacaciones base
      INNER JOIN usuarios u
        ON u.id = base.usuario_id
      WHERE base.fecha_inicio <= ?
        AND base.fecha_fin >= ?
      `,
      scope
    );

  const [
    rows,
  ] =
    await pool.execute<
      CalendarioVacacionRow[]
    >(
      `${query.sql}
      ORDER BY
        base.fecha_inicio ASC,
        base.id ASC
      `,
      query.params
    );

  return rows;
}


export async function listIncapacidadesCalendario(
  scope: CalendarioScope
): Promise<CalendarioIncapacidadRow[]> {
  const query =
    withUserFilter(
      `
      SELECT
        base.id,
        base.usuario_id,
        u.nombre,
        u.apellido,
        u.correo,
        base.fecha_inicio,
        base.fecha_fin,
        base.dias_calculados,
        base.motivo,
        base.estado
      FROM incapacidades base
      INNER JOIN usuarios u
        ON u.id = base.usuario_id
      WHERE base.fecha_inicio <= ?
        AND base.fecha_fin >= ?
      `,
      scope
    );

  const [
    rows,
  ] =
    await pool.execute<
      CalendarioIncapacidadRow[]
    >(
      `${query.sql}
      ORDER BY
        base.fecha_inicio ASC,
        base.id ASC
      `,
      query.params
    );

  return rows;
}
