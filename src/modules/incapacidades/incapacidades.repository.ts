import type {
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2';

import {
  pool,
} from '../../config/db.js';


export type IncapacidadEstado =
  | 'pendiente'
  | 'aprobada'
  | 'rechazada';


export type IncapacidadRow =
  RowDataPacket & {
    id: number;
    usuario_id: number;

    fecha_inicio: string;
    fecha_fin: string;

    dias_calculados: number;

    motivo: string;

    estado:
      IncapacidadEstado;

    comprobante_key:
      string | null;

    comprobante_nombre:
      string | null;

    comprobante_mime:
      string | null;

    comprobante_tamano:
      number | null;

    observaciones_admin:
      string | null;

    revisado_por_admin_id:
      number | null;

    revisado_at:
      Date | string | null;

    created_at:
      Date | string;

    updated_at:
      Date | string;

    usuario_nombre?:
      string | null;

    usuario_apellido?:
      string | null;

    usuario_correo?:
      string | null;

    admin_nombre?:
      string | null;

    admin_apellido?:
      string | null;
  };


type CreateIncapacidadParams = {
  usuarioId: number;
  fechaInicio: string;
  fechaFin: string;
  diasCalculados: number;
  motivo: string;
};


export async function hasActiveOverlap(
  usuarioId: number,
  fechaInicio: string,
  fechaFin: string
): Promise<boolean> {
  const [rows] =
    await pool.execute<RowDataPacket[]>(
      `
      SELECT id
      FROM incapacidades
      WHERE usuario_id = ?
        AND estado IN (
          'pendiente',
          'aprobada'
        )
        AND fecha_inicio <= ?
        AND fecha_fin >= ?
      LIMIT 1
      `,
      [
        usuarioId,
        fechaFin,
        fechaInicio,
      ]
    );

  return rows.length > 0;
}


export async function createIncapacidad(
  params: CreateIncapacidadParams
): Promise<number> {
  const [result] =
    await pool.execute<ResultSetHeader>(
      `
      INSERT INTO incapacidades (
        usuario_id,
        fecha_inicio,
        fecha_fin,
        dias_calculados,
        motivo,
        estado
      )
      VALUES (?, ?, ?, ?, ?, 'pendiente')
      `,
      [
        params.usuarioId,
        params.fechaInicio,
        params.fechaFin,
        params.diasCalculados,
        params.motivo,
      ]
    );

  return Number(
    result.insertId
  );
}


export async function findIncapacidadById(
  id: number
): Promise<IncapacidadRow | null> {
  const [rows] =
    await pool.execute<IncapacidadRow[]>(
      `
      SELECT
        i.*,

        u.nombre
          AS usuario_nombre,

        u.apellido
          AS usuario_apellido,

        u.correo
          AS usuario_correo,

        admin.nombre
          AS admin_nombre,

        admin.apellido
          AS admin_apellido

      FROM incapacidades i

      INNER JOIN usuarios u
        ON u.id = i.usuario_id

      LEFT JOIN usuarios admin
        ON admin.id =
           i.revisado_por_admin_id

      WHERE i.id = ?

      LIMIT 1
      `,
      [id]
    );

  return rows[0] || null;
}


export async function listOwnIncapacidades(
  usuarioId: number
): Promise<IncapacidadRow[]> {
  const [rows] =
    await pool.execute<IncapacidadRow[]>(
      `
      SELECT
        i.*
      FROM incapacidades i
      WHERE i.usuario_id = ?
      ORDER BY
        i.created_at DESC,
        i.id DESC
      `,
      [usuarioId]
    );

  return rows;
}


export async function listAllIncapacidades(
  estado?: IncapacidadEstado
): Promise<IncapacidadRow[]> {
  const selectSql = `
      SELECT
        i.*,

        u.nombre
          AS usuario_nombre,

        u.apellido
          AS usuario_apellido,

        u.correo
          AS usuario_correo,

        admin.nombre
          AS admin_nombre,

        admin.apellido
          AS admin_apellido

      FROM incapacidades i

      INNER JOIN usuarios u
        ON u.id = i.usuario_id

      LEFT JOIN usuarios admin
        ON admin.id =
           i.revisado_por_admin_id
  `;

  const orderSql = `
      ORDER BY
        CASE
          WHEN i.estado = 'pendiente'
            THEN 0
          ELSE 1
        END,
        i.created_at DESC,
        i.id DESC
  `;

  if (estado) {
    const [rows] =
      await pool.execute<IncapacidadRow[]>(
        `
        ${selectSql}

        WHERE i.estado = ?

        ${orderSql}
        `,
        [estado]
      );

    return rows;
  }

  const [rows] =
    await pool.query<IncapacidadRow[]>(
      `
      ${selectSql}

      ${orderSql}
      `
    );

  return rows;
}


export async function reviewIncapacidad(
  id: number,
  adminUserId: number,
  estado:
    'aprobada' |
    'rechazada',
  observacionesAdmin:
    string | null
): Promise<boolean> {
  const [result] =
    await pool.execute<ResultSetHeader>(
      `
      UPDATE incapacidades

      SET
        estado = ?,
        observaciones_admin = ?,
        revisado_por_admin_id = ?,
        revisado_at = CURRENT_TIMESTAMP

      WHERE id = ?
        AND estado = 'pendiente'
      `,
      [
        estado,
        observacionesAdmin,
        adminUserId,
        id,
      ]
    );

  return (
    Number(
      result.affectedRows
    ) === 1
  );
}



// ============================================================
// GI-HU02 — COMPROBANTE
// ============================================================

export async function setIncapacidadComprobante(
  id: number,
  usuarioId: number,
  comprobanteKey: string,
  comprobanteNombre: string,
  comprobanteMime: string,
  comprobanteTamano: number
): Promise<boolean> {
  const [result] =
    await pool.execute<ResultSetHeader>(
      `
      UPDATE incapacidades

      SET
        comprobante_key = ?,
        comprobante_nombre = ?,
        comprobante_mime = ?,
        comprobante_tamano = ?

      WHERE id = ?
        AND usuario_id = ?
        AND estado = 'pendiente'
        AND comprobante_key IS NULL
      `,
      [
        comprobanteKey,
        comprobanteNombre,
        comprobanteMime,
        comprobanteTamano,
        id,
        usuarioId,
      ]
    );

  return (
    Number(
      result.affectedRows
    ) === 1
  );
}
