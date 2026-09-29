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


export type IncapacidadReviewHistoryRow =
  RowDataPacket & {
    id: number;

    incapacidad_id: number;

    admin_usuario_id: number;

    accion:
      | 'APROBAR'
      | 'RECHAZAR';

    estado_anterior:
      IncapacidadEstado;

    estado_nuevo:
      | 'aprobada'
      | 'rechazada';

    observaciones_admin:
      string | null;

    analisis_disponible:
      number;

    estado_analisis_snapshot:
      | 'pendiente'
      | 'completado'
      | 'requiere_revision'
      | 'error'
      | null;

    estado_estructura_snapshot:
      | 'valido'
      | 'requiere_revision'
      | 'invalido'
      | null;

    puntaje_estructura_snapshot:
      number | string | null;

    duplicado_detectado_snapshot:
      number | null;

    duplicado_de_incapacidad_id_snapshot:
      number | null;

    decidido_at:
      Date | string;

    admin_nombre:
      string;

    admin_apellido:
      string;
  };


export async function listIncapacidadReviewHistory(
  incapacidadId: number
): Promise<IncapacidadReviewHistoryRow[]> {
  const [
    rows,
  ] =
    await pool.execute<
      IncapacidadReviewHistoryRow[]
    >(
      `
      SELECT
        r.id,
        r.incapacidad_id,
        r.admin_usuario_id,
        r.accion,
        r.estado_anterior,
        r.estado_nuevo,
        r.observaciones_admin,

        r.analisis_disponible,
        r.estado_analisis_snapshot,
        r.estado_estructura_snapshot,
        r.puntaje_estructura_snapshot,
        r.duplicado_detectado_snapshot,
        r.duplicado_de_incapacidad_id_snapshot,

        r.decidido_at,

        admin.nombre
          AS admin_nombre,

        admin.apellido
          AS admin_apellido

      FROM incapacidad_revisiones r

      INNER JOIN usuarios admin
        ON admin.id =
           r.admin_usuario_id

      WHERE r.incapacidad_id = ?

      ORDER BY
        r.decidido_at DESC,
        r.id DESC
      `,
      [
        incapacidadId,
      ]
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
  const connection =
    await pool.getConnection();


  try {
    await connection
      .beginTransaction();


    /*
     * El guard de estado mantiene una única
     * decisión final por incapacidad.
     */
    const [
      result,
    ] =
      await connection
        .execute<ResultSetHeader>(
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


    if (
      Number(
        result.affectedRows
      ) !== 1
    ) {
      await connection
        .rollback();

      return false;
    }


    /*
     * Snapshot mínimo del resultado automático
     * disponible cuando RRHH tomó la decisión.
     *
     * Puede no existir análisis.
     */
    const [
      analysisRows,
    ] =
      await connection
        .execute<
          (
            RowDataPacket & {
              id:
                number;

              estado_analisis:
                | 'pendiente'
                | 'completado'
                | 'requiere_revision'
                | 'error';

              estado_estructura:
                | 'valido'
                | 'requiere_revision'
                | 'invalido';

              puntaje_estructura:
                number | string;

              duplicado_detectado:
                number;

              duplicado_de_incapacidad_id:
                number | null;

              proveedor_analisis:
                string;

              version_analisis:
                string;
            }
          )[]
        >(
          `
          SELECT
            id,
            estado_analisis,
            estado_estructura,
            puntaje_estructura,
            duplicado_detectado,
            duplicado_de_incapacidad_id,
            proveedor_analisis,
            version_analisis

          FROM incapacidad_analisis

          WHERE incapacidad_id = ?

          LIMIT 1
          `,
          [
            id,
          ]
        );


    const analysis =
      analysisRows[0] ||
      null;


    await connection
      .execute<ResultSetHeader>(
        `
        INSERT INTO incapacidad_revisiones (
          incapacidad_id,
          admin_usuario_id,
          accion,
          estado_anterior,
          estado_nuevo,
          observaciones_admin,

          analisis_disponible,
          analisis_id,
          estado_analisis_snapshot,
          estado_estructura_snapshot,
          puntaje_estructura_snapshot,
          duplicado_detectado_snapshot,
          duplicado_de_incapacidad_id_snapshot,
          proveedor_analisis_snapshot,
          version_analisis_snapshot,

          decidido_at
        )
        VALUES (
          ?,
          ?,
          ?,
          'pendiente',
          ?,
          ?,

          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,

          CURRENT_TIMESTAMP
        )
        `,
        [
          id,
          adminUserId,

          estado === 'aprobada'
            ? 'APROBAR'
            : 'RECHAZAR',

          estado,
          observacionesAdmin,

          analysis
            ? 1
            : 0,

          analysis?.id ??
            null,

          analysis
            ?.estado_analisis ??
            null,

          analysis
            ?.estado_estructura ??
            null,

          analysis
            ?.puntaje_estructura ??
            null,

          analysis
            ? Number(
                analysis
                  .duplicado_detectado
              )
            : null,

          analysis
            ?.duplicado_de_incapacidad_id ??
            null,

          analysis
            ?.proveedor_analisis ??
            null,

          analysis
            ?.version_analisis ??
            null,
        ]
      );


    await connection
      .commit();


    return true;

  } catch (error) {
    try {
      await connection
        .rollback();

    } catch {
      /*
       * Se conserva el error original.
       */
    }

    throw error;

  } finally {
    connection.release();
  }
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
